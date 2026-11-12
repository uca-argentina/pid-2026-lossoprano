/**
 * Pantalla del catálogo del vendedor. Coordina listado, alta, edición, borrado,
 * reposición y categorías.
 * Los formularios y modales viven en componentes separados para reutilizar sus campos
 * y mantener esta pantalla centrada en el flujo.
 */

// ================= CÓMO LEER UN ARCHIVO DEL FRONT (React) =================
// ORDEN DE UN COMPONENTE (siempre igual):
//   1) imports: traen funciones/tipos/componentes de otros archivos.
//   2) export default function Nombre({ props }) { ... }  ← el componente es una FUNCIÓN.
//   3) adentro, arriba: const [dato, setDato] = useState(inicial)  ← datos que cambian.
//   4) después: funciones (cargar, guardar, enviar...) que llaman al back con api.algo(...).
//   5) al final: return ( ...JSX... )  ← lo que se VE en pantalla.
// FLUJO TÍPICO: useEffect → api.algo(token) (api.ts) → back → respuesta → setDato(respuesta) → React redibuja.
// CÓMO SE CONECTA CON OTROS ARCHIVOS:
//   - PROPS: el padre escribe <Hijo token={token} alGuardar={fn} />  y el hijo las recibe en function Hijo({ token, alGuardar }).
//   - api.algo(...) está en api.ts: arma la URL y hace el fetch al back.
// SINTAXIS QUE VAS A VER:
//   (x) => algo          función flecha (función sin nombre). () => fn(x) = 'ejecutá fn(x) cuando pase (click)'.
//   await               espera la respuesta del back (solo dentro de una función async).
//   a && <p/>           si a es verdadero, muestra <p/>; si no, nada.
//   a ? b : c           ternario: si a → b, si no → c.
//   x?.y                lee y solo si x existe (si x es null/undefined no explota).
//   x ?? valor          si x es null/undefined usa valor.
//   lista.map((e) => <li/>)   un elemento de pantalla por cada elemento de la lista.
//   {variable}          dentro del JSX: muestra el valor de la variable o ejecuta código JS.
//   `texto ${variable}` texto con una variable adentro.
//   ...objeto           copia todas las propiedades de un objeto/lista.
//   className="..."     es el class de HTML (estilos de CSS).
//   onClick / onChange / onSubmit   eventos: qué función se ejecuta al tocar / escribir / enviar.
// ==============================================================================
import { useEffect, useState } from 'react';
import { api, imagenUrl, Producto } from './api';
import { formatCurrency } from './utils';
import EditarProducto from './EditarProducto';
import NuevoProducto from './NuevoProducto';
import AgregarStock from './AgregarStock';
import { GestionCategorias, useCategorias } from './CampoCategoria';

// PANTALLA 'Mis productos' del vendedor. App.tsx la muestra con <CrearProducto token={sesion.accessToken} />.
// { token } = la PROP que recibe (el token para llamar al back).
export default function CrearProducto({ token }: { token: string }) {
  // Lista de productos del vendedor. Arranca vacía [].
  const [misProductos, setMisProductos] = useState<Producto[]>([]);
  const [cargando, setCargando] = useState(true);
  // Texto de error (rojo). '' = no hay error.
  const [error, setError] = useState('');
  // Texto de éxito (verde), ej 'Producto creado correctamente.'.
  const [mensaje, setMensaje] = useState('');
  // true = está abierto el modal de crear producto.
  const [crear, setCrear] = useState(false);
  const [productoSeleccionado, setProductoSeleccionado] = useState<Producto | null>(null);
  // Producto al que le estás agregando stock. null = modal cerrado. Objeto → arranca en null con <Tipo | null>.
  // PATRÓN MODAL: guardás el objeto en el estado → se abre; lo volvés a null → se cierra.
  const [productoStock, setProductoStock] = useState<Producto | null>(null);
  // Hook de CampoCategoria.tsx: carga las categorías del vendedor (para los formularios).
  const categorias = useCategorias(token);

  // Al aparecer la pantalla (y si cambia el token) pide los productos al back.
  useEffect(() => {
    // activo evita guardar datos si la pantalla ya se cerró antes de que responda el back.
    let activo = true;
    setCargando(true);
    // Otra forma de esperar al back (en vez de await): .then(recibe el resultado) .catch(recibe el error) .finally(siempre).
    // Es lo mismo que try { const productos = await api.misProductos(token); ... } catch ... finally ...
    api
      .misProductos(token)
      .then((productos) => {
        if (activo) {
          // Guarda la lista que mandó el back (GET /productos/mi-negocio) → React dibuja las tarjetas.
          setMisProductos(productos);
          setError('');
        }
      })
      .catch((error) => {
        if (activo)
          setError(
            error instanceof Error
              ? error.message
              : 'No se pudieron cargar los productos.',
          );
      })
      .finally(() => {
        if (activo) setCargando(false);
      });
    // La función que devuelve un useEffect se ejecuta cuando la pantalla se cierra (limpieza).
    return () => {
      activo = false;
    };
  }, [token]);

  // Reemplaza UN producto de la lista por su versión nueva (la que devolvió el back), sin recargar todo.
  function actualizarProducto(producto: Producto) {
    // set con función: (actual) = el valor actual del estado; lo que devuelve pasa a ser el nuevo valor.
    setMisProductos((actual) =>
      // map recorre la lista: si es el mismo id pone el producto nuevo; si no, deja el que estaba (ternario).
      actual.map((item) => (item.idProducto === producto.idProducto ? producto : item)),
    );
  }

  // Lo que se ve en pantalla.
  return (
    // TODO lo que está dentro de return( ) es lo que se ve.
    <section className="business-panel" id="crear-producto">
      <div className="mis-productos">
        <header className="mis-productos-header">
          <h2>Mis productos</h2>
          {/* Botón 'Crear nuevo producto': onClick limpia el mensaje y abre el modal (setCrear(true)). */}
          <button
            type="button"
            className="primary"
            onClick={() => {
              setMensaje('');
              setCrear(true);
            }}
          >
            Crear nuevo producto
          </button>
        </header>
        {/* Si hay mensaje, lo muestra. */}
        {mensaje && (
          <p className="success" role="status">
            {mensaje}
          </p>
        )}
        {/* Si error tiene texto (lo puso setError en el catch), lo muestra en rojo. */}
        {error && (
          <p className="error" role="alert">
            {error}
          </p>
        )}
        {/* Mientras espera la respuesta del back. */}
        {cargando && (
          <p className="muted" role="status">
            Cargando productos…
          </p>
        )}
        {/* Si ya cargó, sin error, y la lista está vacía (.length === 0) → texto de 'no tenés productos'. */}
        {!cargando && !error && misProductos.length === 0 && (
          <p className="muted">
            Todavía no tenés productos. Creá el primero para empezar a vender.
          </p>
        )}
        <div className="producto-grilla">
          {/* Una tarjeta por producto. 'producto' solo existe dentro de este map. */}
          {misProductos.map((producto) => (
            // Tarjeta de UN producto. key = idProducto (único).
            <article
              className="producto-card"
              key={producto.idProducto}
              aria-label={producto.nombre}
            >
              <button
                type="button"
                className="producto-card-editar"
                aria-label={`Editar ${producto.nombre}`}
                // Al tocar la tarjeta: guarda ESTE producto en productoSeleccionado → se abre el modal EditarProducto (abajo).
                onClick={() => {
                  setMensaje('');
                  setProductoSeleccionado(producto);
                }}
              >
                {/* [0] = la primera foto. Si existe, la muestra. */}
                {producto.imagenes[0] && (
                  <img src={imagenUrl(producto.imagenes[0])} alt={producto.nombre} />
                )}
                <div className="producto-info">
                  {/* Datos del producto que vino del back (los nombres son los de la entity Producto / type Producto de api.ts). */}
                  <b>{producto.nombre}</b>
                  {/* categoria es un objeto dentro del producto → .nombre. */}
                  <span className="muted">{producto.categoria.nombre}</span>
                  <div className="producto-precio">
                    {/* formatCurrency (utils.ts) muestra el precio como $ 1.500,00. */}
                    {formatCurrency(producto.precioBase)}
                  </div>
                  {/* Si tiene precios escalonados, muestra cuántos. Ternario para singular/plural. */}
                  {producto.preciosEscalonados.length > 0 && (
                    <small>
                      {producto.preciosEscalonados.length === 1
                        ? '1 precio por cantidad'
                        : `${producto.preciosEscalonados.length} precios por cantidad`}
                    </small>
                  )}
                  {/* { } dentro del texto = mostrar el valor de una variable. */}
                  <small>Stock: {producto.stock}</small>
                  {/* Si tiene mínimo de compra (no es null), lo muestra. */}
                  {producto.cantidadMinimaCompra && (
                    <small>Mínimo: {producto.cantidadMinimaCompra} unidades</small>
                  )}
                </div>
              </button>
              {/* Botones de cada tarjeta. Molde para agregar un botón nuevo por producto. */}
              <div className="producto-acciones">
                <button
                  type="button"
                  className="link"
                  onClick={() => {
                    setMensaje('');
                    setProductoSeleccionado(producto);
                  }}
                >
                  Editar
                </button>
                <button
                  type="button"
                  // Botón 'Agregar stock': setProductoStock(producto) guarda ESTE producto → se abre el modal AgregarStock (más abajo).
                  className="stock-boton"
                  onClick={() => {
                    setMensaje('');
                    setProductoStock(producto);
                  }}
                >
                  Agregar stock
                </button>
              </div>
            </article>
          ))}
        </div>
      </div>
      <hr className="product-separator" />
      {/* Componente de CampoCategoria.tsx para administrar categorías. */}
      <GestionCategorias estado={categorias} />
      {/* Si crear es true, muestra el modal NuevoProducto. alCrear agrega el producto nuevo al principio de la lista ([nuevo, ...lista]). */}
      {crear && (
        // Modal de NuevoProducto.tsx. alCrear recibe el producto creado por el back (POST /productos).
        <NuevoProducto
          token={token}
          categorias={categorias}
          alCerrar={() => setCrear(false)}
          alCrear={(producto) => {
            // Lista nueva = [el producto nuevo, ...todos los que había] → aparece primero.
            setMisProductos((actual) => [producto, ...actual]);
            setCrear(false);
            setMensaje('Producto creado correctamente.');
            void categorias.recargar();
          }}
        />
      )}
      {/* Si hay un producto elegido, muestra el modal AgregarStock.
         PROPS: producto, token, alCerrar (cierra) y alGuardar (recibe el producto actualizado del back). */}
      {productoStock && (
        <AgregarStock
          producto={productoStock}
          token={token}
          alCerrar={() => setProductoStock(null)}
          // AgregarStock llama a esta función cuando el back respondió OK: actualiza la tarjeta, cierra el modal y muestra el mensaje.
          alGuardar={(producto) => {
            actualizarProducto(producto);
            setProductoStock(null);
            setMensaje(
              `Stock de ${producto.nombre} actualizado: ${producto.stock} unidades.`,
            );
          }}
        />
      )}
      {productoSeleccionado && (
        // Modal de EditarProducto.tsx. Props: el producto elegido, token, categorías y 3 funciones (cerrar, guardar, eliminar).
        <EditarProducto
          producto={productoSeleccionado}
          token={token}
          categorias={categorias}
          alCerrar={() => setProductoSeleccionado(null)}
          alGuardar={(producto) => {
            actualizarProducto(producto);
            setProductoSeleccionado(null);
            setMensaje('Producto actualizado correctamente.');
            void categorias.recargar();
          }}
          // filter con !== saca el producto borrado de la lista.
          alEliminar={(id) => {
            setMisProductos((actual) => actual.filter((item) => item.idProducto !== id));
            setProductoSeleccionado(null);
            setMensaje('Producto eliminado correctamente.');
            void categorias.recargar();
          }}
        />
      )}
    </section>
  );
}
