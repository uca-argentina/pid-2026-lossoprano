import { useEffect, useRef, useState } from 'react';
import { api, Carrito, Producto, ConfirmacionPedido } from './api';

export function limitarCantidad(cantidad: number, stock: number, minimo = 1) {
  if (!Number.isInteger(stock) || stock < minimo) return 0;
  return Math.max(minimo, Math.min(stock, Number.isFinite(cantidad) ? Math.trunc(cantidad) : minimo));
}

export default function useCarrito(idCliente: number, token: string, idNegocio: number) {
  const [carrito, setCarrito] = useState<Carrito>(null);
  const [avisoCarrito, setAviso] = useState('');
  const [listo, setListo] = useState(false);
  const [procesando, setProcesando] = useState(false);
  const actual = useRef<Carrito>(null);
  const ocupado = useRef(false);
  const revision = useRef(0);
  const activo = useRef(false);
  function mostrar(valor: Carrito) { actual.current = valor; if (activo.current) setCarrito(valor); }

  useEffect(() => {
    activo.current = true;
    let cancelado = false;
    let cargando = false;
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
          let antiguo: Carrito = null;
          try { antiguo = JSON.parse(local); } catch { /* Datos locales inválidos. */ }
          if (!valor && antiguo && antiguo.idNegocio !== idNegocio && Array.isArray(antiguo.items)) {
            const items = antiguo.items.filter(item => Number.isInteger(item.version) && item.version > 0)
              .map(item => ({ idProducto: item.idProducto, version: item.version, cantidad: limitarCantidad(item.cantidad, item.stock) }))
              .filter(item => item.cantidad > 0);
            valor = await api.guardarCarrito(items, token, true);
          }
          localStorage.removeItem(clave);
        }
        if (cancelado || revisionConsulta !== revision.current) return;
        if (actual.current?.items.some(item => !valor?.items.some(nuevo => nuevo.idProducto === item.idProducto))) {
          setAviso('Tu carrito se actualizó: algunos productos fueron retirados o modificados.');
        }
        mostrar(valor);
        setListo(true);
      } catch (error) {
        if (!cancelado) setAviso(error instanceof Error ? error.message : 'No se pudo cargar el carrito.');
      } finally { cargando = false; }
    }
    void cargar();
    const intervalo = window.setInterval(cargar, 10000);
    window.addEventListener('focus', cargar);
    return () => { cancelado = true; activo.current = false; window.clearInterval(intervalo); window.removeEventListener('focus', cargar); };
  }, [idCliente, token, idNegocio]);

  async function guardar(valor: Pick<NonNullable<Carrito>, 'idNegocio' | 'nombreNegocio' | 'items'> | null) {
    if (!listo || ocupado.current) { setAviso('Esperá a que termine de actualizarse el carrito e intentá nuevamente.'); return false; }
    ocupado.current = true;
    setProcesando(true);
    revision.current++;
    try {
      mostrar(await api.guardarCarrito(valor?.items ?? [], token));
      if (activo.current) setAviso('');
      return true;
    } catch (error) {
      if (activo.current) setAviso(error instanceof Error ? error.message : 'No se pudo guardar el carrito.');
      return false;
    } finally { ocupado.current = false; setProcesando(false); }
  }

  async function confirmar(datos: ConfirmacionPedido) {
    if (!listo || ocupado.current) throw new Error('Esperá a que termine de actualizarse el carrito.');
    ocupado.current = true;
    setProcesando(true);
    revision.current++;
    try {
      const pedido = await api.confirmarPedido(datos, token);
      mostrar(null);
      setAviso('');
      window.dispatchEvent(new Event('stock-actualizado'));
      return pedido;
    } finally { ocupado.current = false; setProcesando(false); }
  }

  async function agregar(producto: Producto, cantidad: number) {
    if (producto.idNegocio === idNegocio) { setAviso('No podés comprar productos de tu propio negocio.'); return false; }
    const unidades = limitarCantidad(cantidad, producto.stock, producto.cantidadMinimaCompra ?? 1);
    if (!unidades) return false;
    const previo = actual.current;
    if (previo && previo.idNegocio !== producto.idNegocio && !window.confirm(`Tu carrito tiene productos de ${previo.nombreNegocio}. ¿Vaciarlo para comprar a otro vendedor?`)) return false;
    const items = previo?.idNegocio === producto.idNegocio ? [...previo.items] : [];
    const existente = items.find(item => item.idProducto === producto.idProducto);
    const nuevo = { idProducto: producto.idProducto, version: producto.version, nombre: producto.nombre,
      precioBase: producto.precioBase, precioUnitario: producto.precioBase, preciosEscalonados: producto.preciosEscalonados, stock: producto.stock, cantidadMinimaCompra: producto.cantidadMinimaCompra, imagen: producto.imagenes[0],
      cantidad: limitarCantidad((existente?.version === producto.version ? existente.cantidad : 0) + unidades, producto.stock, producto.cantidadMinimaCompra ?? 1) };
    return guardar({ idNegocio: producto.idNegocio, nombreNegocio: producto.negocio?.nombreComercial ?? 'Vendedor',
      items: [...items.filter(item => item.idProducto !== producto.idProducto), nuevo] });
  }
  function actualizarCantidad(id: number, cantidad: number) {
    const previo = actual.current;
    if (!previo) return;
    return guardar({ ...previo, items: previo.items.map(item => item.idProducto === id ? { ...item, cantidad: limitarCantidad(cantidad, item.stock, item.cantidadMinimaCompra ?? 1) } : item) });
  }
  function quitar(id: number) {
    const previo = actual.current;
    if (previo) return guardar({ ...previo, items: previo.items.filter(item => item.idProducto !== id) });
  }
  return { carrito, avisoCarrito, procesando, confirmar, agregar, actualizarCantidad, quitar, vaciar: () => guardar(null) };
}
