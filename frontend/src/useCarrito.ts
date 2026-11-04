/**
 * Hook que centraliza el carrito compartido por las pantallas. La base del servidor
 * es la fuente de verdad.
 * Combina estado React para dibujar con referencias para coordinar solicitudes
 * asíncronas sin esperar otro render.
 * Consulta al montar, al recuperar foco y cada diez segundos; el número de revisión
 * evita que una respuesta vieja pise una edición reciente.
 */

import { useEffect, useRef, useState } from 'react';
import { api, Carrito, ItemCarrito, Producto, ConfirmacionPedido } from './api';

/**
 * Convierte la entrada en unidades enteras dentro de mínimo y stock. Si el producto no
 * permite cumplir el mínimo devuelve cero.
 */
export function limitarCantidad(cantidad: number, stock: number, minimo = 1) {
  if (!Number.isInteger(stock) || stock < minimo) return 0;
  return Math.max(
    minimo,
    Math.min(stock, Number.isFinite(cantidad) ? Math.trunc(cantidad) : minimo),
  );
}

export default function useCarrito(idCliente: number, token: string, idNegocio: number) {
  const [carrito, setCarrito] = useState<Carrito>(null);
  const [avisoCarrito, setAviso] = useState('');
  const [listo, setListo] = useState(false);
  const [procesando, setProcesando] = useState(false);
  // Las referencias permiten leer el último valor desde callbacks sin depender del render
  // que los creó. ocupado coordina escrituras; revision identifica respuestas de consultas viejas.
  const actual = useRef<Carrito>(null);
  const ocupado = useRef(false);
  const revision = useRef(0);
  const activo = useRef(false);
  /**
   * Actualiza primero la referencia síncrona y luego el estado visible, solo mientras el
   * hook siga montado.
   */
  function mostrar(valor: Carrito) {
    actual.current = valor;
    if (activo.current) setCarrito(valor);
  }

  useEffect(() => {
    activo.current = true;
    let cancelado = false;
    let cargando = false;
    let falloCarga = false;
    /**
     * Sincroniza con servidor e importa una copia local antigua si corresponde. Ignora
     * respuestas canceladas o anteriores a la última edición.
     */
    async function cargar() {
      if (ocupado.current || cargando) return;
      cargando = true;
      const revisionConsulta = revision.current;
      try {
        let valor = await api.obtenerCarrito(token);
        if (cancelado) return;
        const clave = `bulkmarket-carrito-${idCliente}`;
        const local = localStorage.getItem(clave);
        if (local) {
          // Copia previa al carrito en servidor, cuando era de un solo vendedor.
          let antiguo: { idNegocio?: number; items?: ItemCarrito[] } | null = null;
          try {
            antiguo = JSON.parse(local);
          } catch {
            /* Datos locales inválidos. */
          }
          if (
            !valor &&
            antiguo &&
            antiguo.idNegocio !== idNegocio &&
            Array.isArray(antiguo.items)
          ) {
            const items = antiguo.items
              .filter((item) => Number.isInteger(item.version) && item.version > 0)
              .map((item) => ({
                idProducto: item.idProducto,
                version: item.version,
                cantidad: limitarCantidad(item.cantidad, item.stock),
              }))
              .filter((item) => item.cantidad > 0);
            valor = await api.guardarCarrito(items, token, true);
          }
          localStorage.removeItem(clave);
        }
        // Si el usuario editó mientras llegaba la lectura, esa respuesta ya es obsoleta.
        if (cancelado || revisionConsulta !== revision.current) return;
        if (
          actual.current?.items.some(
            (item) => !valor?.items.some((nuevo) => nuevo.idProducto === item.idProducto),
          )
        ) {
          setAviso(
            'Tu carrito se actualizó: algunos productos fueron retirados o modificados.',
          );
        } else if (falloCarga) {
          setAviso('');
        }
        falloCarga = false;
        mostrar(valor);
        setListo(true);
      } catch (error) {
        if (!cancelado) {
          falloCarga = true;
          setAviso(
            error instanceof Error ? error.message : 'No se pudo cargar el carrito.',
          );
        }
      } finally {
        cargando = false;
      }
    }
    void cargar();
    const intervalo = window.setInterval(cargar, 10000);
    window.addEventListener('focus', cargar);
    return () => {
      cancelado = true;
      activo.current = false;
      window.clearInterval(intervalo);
      window.removeEventListener('focus', cargar);
    };
  }, [idCliente, token, idNegocio]);

  /**
   * Evita escrituras simultáneas y aumenta la revisión antes de enviar. Devuelve un
   * booleano para que el editor pueda restaurar su borrador si falla.
   */
  async function guardar(
    items: Pick<ItemCarrito, 'idProducto' | 'version' | 'cantidad'>[],
  ) {
    if (!listo || ocupado.current) {
      setAviso('Esperá a que termine de actualizarse el carrito e intentá nuevamente.');
      return false;
    }
    ocupado.current = true;
    setProcesando(true);
    revision.current++;
    try {
      mostrar(await api.guardarCarrito(items, token));
      if (activo.current) setAviso('');
      return true;
    } catch (error) {
      if (activo.current)
        setAviso(
          error instanceof Error ? error.message : 'No se pudo guardar el carrito.',
        );
      return false;
    } finally {
      ocupado.current = false;
      setProcesando(false);
    }
  }

  /**
   * Envía la confirmación con exclusión de otras escrituras. Vacía la vista solo tras el
   * éxito y avisa al catálogo que cambió el stock.
   */
  async function confirmar(datos: ConfirmacionPedido) {
    if (!listo || ocupado.current)
      throw new Error('Esperá a que termine de actualizarse el carrito.');
    ocupado.current = true;
    setProcesando(true);
    revision.current++;
    try {
      const pedido = await api.confirmarPedido(datos, token);
      mostrar(null);
      setAviso('');
      window.dispatchEvent(new Event('stock-actualizado'));
      return pedido;
    } finally {
      ocupado.current = false;
      setProcesando(false);
    }
  }

  /**
   * Rechaza productos propios, calcula cantidad válida y conserva las líneas de otros
   * vendedores. Si cambió la versión del producto, no suma cantidades de la versión
   * anterior.
   */
  async function agregar(producto: Producto, cantidad: number) {
    if (producto.idNegocio === idNegocio) {
      setAviso('No podés comprar productos de tu propio negocio.');
      return false;
    }
    const unidades = limitarCantidad(
      cantidad,
      producto.stock,
      producto.cantidadMinimaCompra ?? 1,
    );
    if (!unidades) return false;
    // El carrito admite varios vendedores: se suma al resto sin vaciarlo.
    const items = actual.current?.items ?? [];
    const existente = items.find((item) => item.idProducto === producto.idProducto);
    const nuevo = {
      idProducto: producto.idProducto,
      version: producto.version,
      cantidad: limitarCantidad(
        (existente?.version === producto.version ? existente.cantidad : 0) + unidades,
        producto.stock,
        producto.cantidadMinimaCompra ?? 1,
      ),
    };
    return guardar([
      ...items.filter((item) => item.idProducto !== producto.idProducto),
      nuevo,
    ]);
  }
  /**
   * Modifica una línea manteniendo el resto del carrito y vuelve a aplicar límites antes
   * del guardado.
   */
  function actualizarCantidad(id: number, cantidad: number) {
    const previo = actual.current;
    if (!previo) return;
    return guardar(
      previo.items.map((item) =>
        item.idProducto === id
          ? {
              ...item,
              cantidad: limitarCantidad(
                cantidad,
                item.stock,
                item.cantidadMinimaCompra ?? 1,
              ),
            }
          : item,
      ),
    );
  }
  /**
   * Filtra una línea y usa el mismo guardado centralizado que las demás ediciones.
   */
  function quitar(id: number) {
    const previo = actual.current;
    if (previo) return guardar(previo.items.filter((item) => item.idProducto !== id));
  }
  return {
    carrito,
    avisoCarrito,
    procesando,
    confirmar,
    agregar,
    actualizarCantidad,
    quitar,
    vaciar: () => guardar([]),
  };
}
