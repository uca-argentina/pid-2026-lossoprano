/**
 * Modal para sumar unidades al stock actual, no para reemplazarlo por un valor
 * absoluto.
 * La API suma dentro de una transacción y mantiene la versión comercial para conservar
 * los carritos.
 */

// FormEvent = tipo del evento de un formulario (para evento.preventDefault()).
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
import { FormEvent, useState } from 'react';
import { api, Producto } from './api';
// ModalProducto = la ventanita (modal) reutilizable con título y botón de cerrar.
import ModalProducto from './ModalProducto';
import {
  ACCIONES_COMPRADOR,
  ACCIONES_VENDEDOR,
  ACCIONES_VENTAURGENTE,
  CONDICIONES_PAGO,
  ESTADOS_PEDIDO,
  ESTADOS_SUBORDEN,
  formatCurrency,
  reclamoAbierto,
  subordenFinalizada,
} from './utils';

// MODAL 'Agregar stock'. MOLDE para cualquier formulario en ventanita.
// Recibe PROPS de CrearProducto.tsx: producto, token, alCerrar y alGuardar.
// DE DÓNDE VIENEN LAS PROPS (las pone CrearProducto.tsx en <AgregarStock ... />):
//   producto = productoStock (el que tocaste en 'Agregar stock') · token = el de CrearProducto (que vino de App.tsx)
//   alCerrar = () => setProductoStock(null) · alGuardar = función que actualiza la tarjeta y cierra.
export default function AgregarStock({
  producto,
  token,
  alCerrar,
  alGuardar,
}: {
  producto: Producto;
  token: string;
  // Función sin parámetros que no devuelve nada (void). La llama para cerrar el modal.
  alCerrar: () => void;
  // Función que recibe el producto actualizado. La define el padre (CrearProducto) y acá solo se llama.
  alGuardar: (producto: Producto) => void;
}) {
  // Lo que escribe el usuario en el input. Los inputs SIEMPRE dan texto → arranca en ''.
  const [cantidad, setCantidad] = useState('');
  // true mientras espera al back (deshabilita el formulario y muestra 'Guardando…').
  const [ocupado, setOcupado] = useState(false);
  const [error, setError] = useState('');
  // Convierte el texto a número ('10' → 10).
  const unidades = Number(cantidad);
  // Validación en el front: entero, mayor a 0 y sin pasar el máximo. (El back lo vuelve a validar con el DTO.)
  const valido =
    Number.isInteger(unidades) && unidades > 0 && unidades <= 2147483647 - producto.stock;

  // Se ejecuta al enviar el formulario (onSubmit).
  async function guardar(evento: FormEvent<HTMLFormElement>) {
    // Evita que el navegador recargue la página al enviar el form. SIEMPRE en un onSubmit.
    evento.preventDefault();
    // Si ya está guardando o el valor no sirve, no hace nada.
    if (ocupado || !valido) return;
    setOcupado(true);
    setError('');
    try {
      // 1) api.agregarStock → PATCH /productos/:id/stock con { cantidad }.
      // 2) await espera el producto actualizado que devuelve el back.
      // 3) se lo pasa a alGuardar (el padre actualiza la tarjeta y cierra el modal).
      alGuardar(await api.agregarStock(producto.idProducto, unidades, token));
    // Si el back responde error, muestra su mensaje.
    } catch (error) {
      setError(error instanceof Error ? error.message : 'No se pudo agregar stock.');
    } finally {
      setOcupado(false);
    }
  }

  

  return (
    // Usa el componente ModalProducto.tsx (la ventanita). titulo, ocupado y alCerrar son props.
    // Todo lo que va entre <ModalProducto> y </ModalProducto> es su children (el contenido del modal).
    <ModalProducto
      titulo="Agregar stock"
      idTitulo="agregar-stock-titulo"
      ocupado={ocupado}
      alCerrar={alCerrar}
      compacto
    >
      {/* producto viene por props desde CrearProducto. */}
      <p className="stock-producto">{producto.nombre}</p>
      <p className="muted">
        {/* {producto.stock} = stock actual (antes de sumar). */}
        Stock actual: <strong>{producto.stock} unidades</strong>
      </p>
      {/* onSubmit = al tocar el botón type="submit" o Enter, llama a guardar. */}
      <form onSubmit={guardar}>
        {/* fieldset disabled = deshabilita todos los inputs mientras guarda. */}
        <fieldset className="producto-campos" disabled={ocupado}>
          <label className="field">
            <span>Unidades a agregar</span>
            {/* INPUT: type number. min/max/step los valida el navegador. required = obligatorio. */}
            <input
              type="number"
              min="1"
              max={2147483647 - producto.stock}
              step="1"
              required
              autoFocus
              // INPUT CONTROLADO: value muestra el estado; onChange guarda cada tecla en el estado.
              // evento.target.value = el texto actual del input.
              value={cantidad}
              onChange={(evento) => {
                setCantidad(evento.target.value);
                setError('');
              }}
            />
            <small>Ingresá la cantidad que recibiste.</small>
          </label>
          {/* Si el valor es válido, muestra cómo quedaría el stock. */}
          {valido && (
            <p className="stock-resumen" role="status">
              Stock después de agregar:{' '}
              {/* Cuenta en el momento: stock actual + lo que escribiste (unidades = Number(cantidad)). */}
              <strong>{producto.stock + unidades} unidades</strong>
            </p>
          )}
          <p className="muted stock-aclaracion">
            Se sumará al stock disponible al guardar. Los productos permanecerán en los
            carritos de los compradores.
          </p>
          <div className="stock-acciones">
            {/* type="button" = NO envía el form. Llama a alCerrar (cierra el modal). */}
            <button type="button" className="link" onClick={alCerrar}>
              Cancelar
            </button>
            {/* type="submit" = envía el form → onSubmit → guardar. disabled si no es válido. */}
            <button type="submit" className="primary" disabled={!valido}>
              {/* Texto del botón según si está guardando. */}
              {ocupado ? 'Guardando…' : 'Agregar stock'}
            </button>
          </div>
        </fieldset>
        {/* Error que vino del back (setError en el catch). */}
        {error && (
          <p className="error" role="alert">
            {error}
          </p>
        )}
      </form>
    </ModalProducto>
  );
}
