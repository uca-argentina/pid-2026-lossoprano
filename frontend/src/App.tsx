/**
 * Entrada funcional de la interfaz: restaura la sesión guardada y decide entre
 * ingreso, registro y panel autenticado.
 * El panel mantiene la navegación por rol y coordina el carrito, pero delega cada
 * pantalla en su componente.
 * La sesión incluye JWT, cliente y negocio: cliente identifica la cuenta; negocio
 * identifica al comercio que compra o vende.
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
import { FormEvent, useEffect, useState, useRef } from 'react';
// Trae el objeto api (llamadas al back, archivo api.ts) y los tipos.
import { api, Negocio, Rol, Sesion } from './api';
import Comprador from './Comprador';
// Cada import de un componente = otro archivo .tsx que se dibuja acá adentro como <NombreComponente ... />.
import CrearProducto from './CrearProducto';
import useCarrito from './useCarrito';
import PanelCarrito from './PanelCarrito';
import Pedidos from './Pedidos';
import Dashboard from './Dashboard';
import Sorteos from './Sorteos';

type Vista = 'ingreso' | 'registro';
const negocioInicial = {
  razonSocial: '',
  nombreComercial: '',
  identificacionFiscal: '',
  telefono: '',
  direccion: '',
};
// Nombre con el que se guarda la sesión en localStorage (memoria del navegador que sobrevive a recargar la página).
const claveSesion = 'bulkmarket-sesion';

/**
 * Mantiene la sesión en memoria y localStorage. Sin sesión muestra autenticación; con
 * sesión monta el panel del negocio.
 */
// COMPONENTE RAÍZ: lo primero que se dibuja (lo monta main.tsx).
// Si hay sesión → muestra el Panel. Si no → Ingreso / Registro.
function App() {
  // sesion = { accessToken (EL TOKEN), cliente { idCliente, email, rol }, negocio { idNegocio, ... } }.
  // Arranca leyendo localStorage: si ya te habías logueado, no te pide login de nuevo.
  const [sesion, setSesion] = useState<Sesion | null>(() => {
    const valor = localStorage.getItem(claveSesion);
    return valor ? JSON.parse(valor) : null;
  });
  const [vista, setVista] = useState<Vista>('ingreso');

  // Se llama después del login/registro con lo que devolvió el back (POST /auth/iniciar-sesion).
  // La guarda en localStorage (como texto con JSON.stringify) y en el estado → React muestra el Panel.
  const guardarSesion = (nuevaSesion: Sesion) => {
    localStorage.setItem(claveSesion, JSON.stringify(nuevaSesion));
    setSesion(nuevaSesion);
  };
  // Borra la sesión → vuelve a la pantalla de login.
  const cerrarSesion = () => {
    localStorage.removeItem(claveSesion);
    setSesion(null);
  };

  if (sesion)
    return (
      // Le pasa al Panel (más abajo en este archivo) la sesión y las funciones como PROPS.
      <Panel sesion={sesion} guardarSesion={guardarSesion} cerrarSesion={cerrarSesion} />
    );

  return (
    <main className="auth-layout">
      <section className="hero">
        <h1>
          Comprá mejor.
          <br />
          <em>Vendé más.</em>
        </h1>
        <p>
          La plataforma que conecta comercios y marcas independientes para hacer negocios.
        </p>
      </section>
      <section className="auth-card">
        <Marca />
        <div className="tabs">
          <button
            className={vista === 'ingreso' ? 'active' : ''}
            onClick={() => setVista('ingreso')}
          >
            Ingresar
          </button>
          <button
            className={vista === 'registro' ? 'active' : ''}
            onClick={() => setVista('registro')}
          >
            Crear cuenta
          </button>
        </div>
        {/* Ternario en JSX: muestra el formulario de Ingreso o el de Registro según la pestaña.
           alIngresar={guardarSesion}: el componente Ingreso llama a esta función cuando el login sale bien. */}
        {vista === 'ingreso' ? (
          <Ingreso
            alIngresar={guardarSesion}
            alRegistrarse={() => setVista('registro')}
          />
        ) : (
          <Registro alRegistrarse={guardarSesion} />
        )}
      </section>
    </main>
  );
}

/**
 * Presenta la identidad visual reutilizada en navegación e ingreso.
 */
function Marca() {
  return (
    <div className="brand" role="img" aria-label="Bulkmarket">
      <span className="brand-mark" aria-hidden="true">
        B
      </span>
      <span className="brand-name" aria-hidden="true">
        bulk<span>market</span>
      </span>
    </div>
  );
}

/**
 * Controla credenciales y estado de la solicitud. Al completar entrega la sesión a
 * App.
 */
// FORMULARIO DE LOGIN. Recibe por props alIngresar (= guardarSesion de App) y alRegistrarse.
function Ingreso({
  alIngresar,
  alRegistrarse,
}: {
  alIngresar: (sesion: Sesion) => void;
  alRegistrarse: () => void;
}) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [cargando, setCargando] = useState(false);

  async function enviar(evento: FormEvent) {
    evento.preventDefault();
    setError('');
    setCargando(true);
    try {
      // 1) api.iniciarSesion (api.ts) → POST /api/auth/iniciar-sesion con { email, password } (los estados del form).
      // 2) el back (auth.controller → auth.service) verifica y devuelve la Sesion con el token.
      // 3) alIngresar(sesion) = guardarSesion de App → guarda y muestra el Panel.
      await alIngresar(await api.iniciarSesion({ email, password }));
    } catch (error) {
      setError(error instanceof Error ? error.message : 'No se pudo iniciar sesión.');
    } finally {
      setCargando(false);
    }
  }

  return (
    <form onSubmit={enviar}>
      <h2>Bienvenido de nuevo</h2>
      <p className="muted">Ingresá para gestionar tu negocio.</p>
      <Campo
        etiqueta="Correo electrónico"
        tipo="email"
        valor={email}
        alCambiar={setEmail}
        requerido
      />
      <Campo
        etiqueta="Contraseña"
        tipo="password"
        valor={password}
        alCambiar={setPassword}
        requerido
      />
      <ErrorFormulario error={error} />
      <button className="primary" disabled={cargando}>
        {cargando ? 'Ingresando…' : 'Ingresar a mi cuenta'}
      </button>
      <p className="footnote">
        ¿Todavía no tenés una cuenta?{' '}
        <button type="button" className="link" onClick={alRegistrarse}>
          Creala ahora
        </button>
      </p>
    </form>
  );
}

/**
 * Construye cuenta y negocio, valida los campos del formulario y delega la creación en
 * la API.
 */
function Registro({ alRegistrarse }: { alRegistrarse: (sesion: Sesion) => void }) {
  const [rol, setRol] = useState<Rol>('COMPRADOR');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmacionPassword, setConfirmacionPassword] = useState('');
  const [negocio, setNegocio] = useState(negocioInicial);
  const [error, setError] = useState('');
  const [cargando, setCargando] = useState(false);

  const actualizarCampo = (campo: keyof typeof negocio) => (valor: string) =>
    setNegocio((actual) => ({ ...actual, [campo]: valor }));

  async function enviar(evento: FormEvent) {
    evento.preventDefault();
    setError('');
    if (password !== confirmacionPassword) {
      setError('Las contraseñas no coinciden. Volvé a escribirlas.');
      return;
    }
    setCargando(true);
    try {
      await alRegistrarse(await api.registrar({ email, password, rol, negocio }));
    } catch (error) {
      setError(error instanceof Error ? error.message : 'No se pudo crear la cuenta.');
    } finally {
      setCargando(false);
    }
  }

  return (
    <form className={`registro ${rol.toLowerCase()}`} onSubmit={enviar}>
      <h2>Creá tu cuenta</h2>
      <p className="muted">Completá los datos de tu negocio para operar en BulkMarket.</p>
      <div className="role-selector">
        <button
          type="button"
          className={rol === 'COMPRADOR' ? 'chosen' : ''}
          onClick={() => setRol('COMPRADOR')}
        >
          <b>Quiero comprar</b>
          <small>Comercio minorista</small>
        </button>
        <button
          type="button"
          className={rol === 'VENDEDOR' ? 'chosen' : ''}
          onClick={() => setRol('VENDEDOR')}
        >
          <b>Quiero vender</b>
          <small>Marca o fabricante</small>
        </button>
      </div>
      <div className="form-grid">
        <Campo
          etiqueta="Razón social"
          valor={negocio.razonSocial}
          alCambiar={actualizarCampo('razonSocial')}
          requerido
        />
        <Campo
          etiqueta="Nombre comercial"
          valor={negocio.nombreComercial}
          alCambiar={actualizarCampo('nombreComercial')}
          requerido
        />
        <Campo
          etiqueta="Identificación fiscal"
          valor={negocio.identificacionFiscal}
          alCambiar={actualizarCampo('identificacionFiscal')}
          placeholder="XX-XXXXXXXX-X"
          inputMode="numeric"
          soloNumeros
          exactDigitos={11}
          formatear={formatearCuit}
          maxLength={13}
          pattern="\\d{2}-\\d{8}-\\d"
          title="Ingresá los 11 dígitos del CUIT."
          requerido
        />
        <Campo
          etiqueta="Teléfono"
          valor={negocio.telefono}
          alCambiar={actualizarCampo('telefono')}
          placeholder="XX XXXX-XXXX"
          inputMode="numeric"
          soloNumeros
          maximoDigitos={10}
          minDigitos={8}
          formatear={formatearTelefono}
          maxLength={12}
          pattern="\\d{2} \\d{4}-\\d{4}"
          title="Ingresá el código de área y ocho dígitos."
          requerido
        />
        <div className="full">
          <Campo
            etiqueta="Dirección"
            valor={negocio.direccion}
            alCambiar={actualizarCampo('direccion')}
            requerido
          />
        </div>
      </div>

      <Campo
        etiqueta="Correo electrónico"
        tipo="email"
        valor={email}
        alCambiar={setEmail}
        requerido
      />
      <Campo
        etiqueta="Contraseña"
        tipo="password"
        valor={password}
        alCambiar={setPassword}
        hint="Mínimo 8 caracteres"
        requerido
      />
      <Campo
        etiqueta="Repetir contraseña"
        tipo="password"
        valor={confirmacionPassword}
        alCambiar={setConfirmacionPassword}
        requerido
      />
      <ErrorFormulario error={error} />
      <button className="primary" disabled={cargando}>
        {cargando ? 'Creando cuenta…' : 'Crear cuenta gratis'}
      </button>
    </form>
  );
}

type Seccion =
  | 'explorar'
  | 'perfil'
  | 'productos'
  | 'compras'
  | 'pedidos'
  | 'dashboard'
  | 'sorteos';

/**
 * Coordina secciones y menú adaptable según el rol. Mantiene un solo hook de carrito
 * para compartir estado entre catálogo y panel lateral.
 */
// PANEL LOGUEADO: barra de navegación + la pantalla elegida. Recibe la sesión por props desde App.
function Panel({
  sesion,
  guardarSesion,
  cerrarSesion,
}: {
  sesion: Sesion;
  guardarSesion: (sesion: Sesion) => void;
  cerrarSesion: () => void;
}) {
  // Hook propio (archivo useCarrito.ts): maneja el carrito. Parámetros sacados de la sesión: id del cliente, token y negocio.
  const estadoCarrito = useCarrito(
    sesion.cliente.idCliente,
    sesion.accessToken,
    sesion.negocio.idNegocio,
  );
  const [carritoAbierto, setCarritoAbierto] = useState(false);
  const unidadesCarrito =
    estadoCarrito.carrito?.items.reduce((total, item) => total + item.cantidad, 0) ?? 0;
  // rol viene del login (sesion.cliente.rol). Decide qué pestañas se ven.
  const esComprador = sesion.cliente.rol === 'COMPRADOR';
  // seccion = qué pantalla se muestra ('productos', 'compras', 'pedidos', ...). Las pestañas de arriba la cambian con setSeccion.
  const [seccion, setSeccion] = useState<Seccion>(esComprador ? 'explorar' : 'perfil');
  const [menuAbierto, setMenuAbierto] = useState(false);
  const navegacionRef = useRef<HTMLDivElement>(null);
  const menuBotonRef = useRef<HTMLButtonElement>(null);
  const lastClickRef = useRef(0);
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    if (!menuAbierto) return;
    const cerrarAlSalir = (evento: PointerEvent) => {
      if (!navegacionRef.current?.contains(evento.target as Node)) setMenuAbierto(false);
    };
    const cerrarConEscape = (evento: KeyboardEvent) => {
      if (evento.key === 'Escape') {
        evento.preventDefault();
        setMenuAbierto(false);
        menuBotonRef.current?.focus();
      }
    };
    const cerrarEnEscritorio = () => {
      if (window.innerWidth > 1100) setMenuAbierto(false);
    };
    document.addEventListener('pointerdown', cerrarAlSalir);
    document.addEventListener('keydown', cerrarConEscape);
    window.addEventListener('resize', cerrarEnEscritorio);
    return () => {
      document.removeEventListener('pointerdown', cerrarAlSalir);
      document.removeEventListener('keydown', cerrarConEscape);
      window.removeEventListener('resize', cerrarEnEscritorio);
    };
  }, [menuAbierto]);

  /**
   * Cambia de sección y cierra el menú móvil. Un doble clic sobre la sección actual
   * incrementa una clave para remontar su contenido.
   */
  const handleTabClick = (targetSection: Seccion) => {
    setMenuAbierto(false);
    if (menuAbierto) menuBotonRef.current?.focus();
    const now = Date.now();
    const timeSinceLastClick = now - lastClickRef.current;

    // Un segundo clic en la misma sección dentro de 300 ms se interpreta como recarga.
    if (targetSection === seccion && timeSinceLastClick < 300) {
      // Cambiar la clave remonta la pantalla y reinicia sus consultas.
      setRefreshKey((prev) => prev + 1);
    } else {
      setSeccion(targetSection);
    }

    lastClickRef.current = now;
  };

  const [negocio, setNegocio] = useState<Omit<Negocio, 'idNegocio'>>(() => {
    const { idNegocio, ...datos } = sesion.negocio;
    return {
      ...datos,
      montoMinimoOrden: datos.montoMinimoOrden ?? '0.00',
      diasReclamo: datos.diasReclamo ?? 7,
      recargoUrgente: datos.recargoUrgente ?? 0,
      identificacionFiscal: soloDigitos(datos.identificacionFiscal, 11),
      telefono: soloDigitos(datos.telefono, 10),
    };
  });
  const [mensaje, setMensaje] = useState('');
  const [error, setError] = useState('');
  const [cargando, setCargando] = useState(false);
  const [eliminando, setEliminando] = useState(false);

  const actualizar = (campo: keyof typeof negocio) => (valor: string) =>
    setNegocio((actual) => ({ ...actual, [campo]: valor }));

  async function enviar(evento: FormEvent) {
    evento.preventDefault();
    setCargando(true);
    setError('');
    try {
      // Mínimo y plazo de reclamos son datos del vendedor: un comprador no los envía.
      const { montoMinimoOrden, diasReclamo, recargoUrgente, ...datos } = negocio;
      const actualizado = await api.actualizarNegocio(
        esComprador ? datos : negocio,
        sesion.accessToken,
      );
      guardarSesion({ ...sesion, negocio: actualizado });
      setMensaje('Los datos del negocio se actualizaron correctamente.');
    } catch (error) {
      setError(
        error instanceof Error ? error.message : 'No se pudieron guardar los cambios.',
      );
    } finally {
      setCargando(false);
    }
  }

  /**
   * Pide confirmación de la baja y cierra la sesión después de que la API elimina el
   * negocio.
   */
  async function eliminarNegocio() {
    if (
      !window.confirm(
        `¿Seguro que querés eliminar ${negocio.nombreComercial}? Esta acción eliminará el negocio y sus clientes asociados, y no se puede deshacer.`,
      )
    )
      return;
    setEliminando(true);
    setError('');
    try {
      await api.eliminarNegocio(sesion.accessToken);
      cerrarSesion();
    } catch (error) {
      setError(
        error instanceof Error ? error.message : 'No se pudo eliminar el negocio.',
      );
    } finally {
      setEliminando(false);
    }
  }

  const nombreRol = sesion.cliente.rol === 'COMPRADOR' ? 'Comprador' : 'Vendedor';
  const claseRol = sesion.cliente.rol.toLowerCase();

  return (
    <main className={`dashboard ${claseRol}`}>
      <header className="navbar">
        <Marca />
        <div className="navbar-navigation" ref={navegacionRef}>
          <button
            type="button"
            className="navbar-menu-toggle"
            ref={menuBotonRef}
            aria-expanded={menuAbierto}
            aria-controls="navegacion-principal"
            onClick={() => setMenuAbierto((abierto) => !abierto)}
          >
            <svg
              aria-hidden="true"
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
            >
              <path
                d={menuAbierto ? 'M6 6l12 12M6 18L18 6' : 'M4 6h16M4 12h16M4 18h16'}
              />
            </svg>
            Menú
          </button>
          <nav
            id="navegacion-principal"
            className={`navbar-tabs${menuAbierto ? ' abierto' : ''}`}
            aria-label="Navegación principal"
          >
            {!esComprador && (
              <button
                type="button"
                className={`nav-tab ${seccion === 'dashboard' ? 'active' : ''}`}
                aria-current={seccion === 'dashboard' ? 'page' : undefined}
                onClick={() => handleTabClick('dashboard')}
              >
                Dashboard
              </button>
            )}
            <button
              type="button"
              className={`nav-tab ${seccion === 'perfil' ? 'active' : ''}`}
              aria-current={seccion === 'perfil' ? 'page' : undefined}
              onClick={() => handleTabClick('perfil')}
            >
              Perfil
            </button>
            {!esComprador && (
              <button
                type="button"
                className={`nav-tab ${seccion === 'productos' ? 'active' : ''}`}
                aria-current={seccion === 'productos' ? 'page' : undefined}
                onClick={() => handleTabClick('productos')}
              >
                Mis Productos
              </button>
            )}
            <button
              type="button"
              className={`nav-tab ${seccion === 'compras' ? 'active' : ''}`}
              aria-current={seccion === 'compras' ? 'page' : undefined}
              onClick={() => handleTabClick('compras')}
            >
              Mis Compras
            </button>
            {!esComprador && (
              <button
                type="button"
                className={`nav-tab ${seccion === 'pedidos' ? 'active' : ''}`}
                aria-current={seccion === 'pedidos' ? 'page' : undefined}
                onClick={() => handleTabClick('pedidos')}
              >
                Pedidos
              </button>
            )}
            <button
              type="button"
              className={`nav-tab ${seccion === 'explorar' ? 'active' : ''}`}
              aria-current={seccion === 'explorar' ? 'page' : undefined}
              onClick={() => handleTabClick('explorar')}
            >
              Explorar
            </button>
            <button
              type="button"
              className={`nav-tab ${seccion === 'sorteos' ? 'active' : ''}`}
              aria-current={seccion === 'sorteos' ? 'page' : undefined}
              onClick={() => handleTabClick('sorteos')}
            >
              Sorteos
            </button>
          </nav>
        </div>
        <div className="navbar-actions">
          <span className={`role-badge ${claseRol}`}>{nombreRol}</span>
          <button
            type="button"
            className="carrito-boton navbar-carrito"
            onClick={() => setCarritoAbierto(true)}
            aria-label={`Abrir carrito, ${unidadesCarrito} unidades`}
            aria-haspopup="dialog"
            aria-expanded={carritoAbierto}
          >
            <svg
              aria-hidden="true"
              width="22"
              height="22"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M3 3h2l3 12h11l2-8H6" />
              <circle cx="9" cy="20" r="1" />
              <circle cx="18" cy="20" r="1" />
            </svg>
            <span className="carrito-text">Carrito</span>
            {unidadesCarrito > 0 && (
              <span className="carrito-badge" aria-hidden="true">
                {unidadesCarrito}
              </span>
            )}
          </button>
          <button
            type="button"
            className="logout"
            aria-label="Cerrar sesión"
            title="Cerrar sesión"
            onClick={cerrarSesion}
          >
            <span className="logout-text">Cerrar sesión</span>
            <svg
              className="logout-icon"
              aria-hidden="true"
              width="22"
              height="22"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M9 5H5v14h4M14 8l4 4-4 4M9 12h9" />
            </svg>
          </button>
        </div>
      </header>
      {seccion === 'sorteos' && (
        <Sorteos key={`sorteos-${refreshKey}`} token={sesion.accessToken} />
      )}
      {!esComprador && seccion === 'dashboard' && (
        <div key={`dashboard-${refreshKey}`}>
          <Dashboard token={sesion.accessToken} />
        </div>
      )}
      {seccion === 'explorar' && (
        <div key={`explorar-${refreshKey}`}>
          <Comprador
            token={sesion.accessToken}
            idNegocio={sesion.negocio.idNegocio}
            estadoCarrito={estadoCarrito}
            abrirCarrito={() => setCarritoAbierto(true)}
          />
        </div>
      )}
      {seccion === 'perfil' && (
        <div key={`perfil-${refreshKey}`}>
          <>
            <section className="welcome">
              <span className="eyebrow">PERFIL DE {nombreRol.toUpperCase()}</span>
              <h1>Hola, {negocio.nombreComercial}</h1>
              <p>Gestioná la información comercial y de contacto de tu negocio.</p>
            </section>
            <section className="business-panel" id="perfil">
              <div>
                <h2>Perfil del negocio</h2>
                <p className="muted">
                  Mantené actualizada la información comercial y de contacto.
                </p>
              </div>
              <form onSubmit={enviar}>
                <div className="form-grid">
                  <Campo
                    etiqueta="Razón social"
                    valor={negocio.razonSocial}
                    alCambiar={actualizar('razonSocial')}
                    requerido
                  />
                  <Campo
                    etiqueta="Nombre comercial"
                    valor={negocio.nombreComercial}
                    alCambiar={actualizar('nombreComercial')}
                    requerido
                  />
                  <Campo
                    etiqueta="Identificación fiscal"
                    valor={negocio.identificacionFiscal}
                    alCambiar={actualizar('identificacionFiscal')}
                    placeholder="XX-XXXXXXXX-X"
                    inputMode="numeric"
                    soloNumeros
                    maximoDigitos={11}
                    formatear={formatearCuit}
                    maxLength={13}
                    pattern="\\d{2}-\\d{8}-\\d"
                    title="Ingresá los 11 dígitos del CUIT."
                    requerido
                  />
                  <Campo
                    etiqueta="Teléfono"
                    valor={negocio.telefono}
                    alCambiar={actualizar('telefono')}
                    placeholder="XX XXXX-XXXX"
                    inputMode="numeric"
                    soloNumeros
                    maximoDigitos={10}
                    formatear={formatearTelefono}
                    maxLength={12}
                    pattern="\\d{2} \\d{4}-\\d{4}"
                    title="Ingresá el código de área y ocho dígitos."
                    requerido
                  />
                  <div className="full">
                    <Campo
                      etiqueta="Dirección"
                      valor={negocio.direccion}
                      alCambiar={actualizar('direccion')}
                      requerido
                    />
                  </div>
                  <div className="full">
                    <Campo
                      etiqueta="Página web"
                      valor={negocio.paginaWeb ?? ''}
                      alCambiar={actualizar('paginaWeb')}
                      maxLength={200}
                      placeholder="www.ejemplo.com"
                    />
                  </div>
                </div>
                {!esComprador && (
                  <label className="field">
                    <span>Monto mínimo por pedido</span>
                    <input
                      type="number"
                      min="0"
                      max="9999999999.99"
                      step="0.01"
                      required
                      value={negocio.montoMinimoOrden ?? '0.00'}
                      onChange={(evento) =>
                        actualizar('montoMinimoOrden')(evento.target.value)
                      }
                    />
                    <small>
                      Importe mínimo del pedido en dinero. Usá 0 si no exigís un mínimo.
                    </small>
                  </label>
                )}
                {!esComprador && (
                  <>
                    <label className="field">
                      <span>Plazo para reclamos (días)</span>
                      <input
                        type="number"
                        min="1"
                        max="90"
                        step="1"
                        required
                        value={negocio.diasReclamo ?? 7}
                        onChange={(evento) =>
                          actualizar('diasReclamo')(evento.target.value)
                        }
                      />
                      <small>
                        Días desde la entrega en los que tus compradores pueden iniciar un
                        reclamo.
                      </small>
                    </label>
                    <label className="field">
                      <span>Recargo fijo por pedidos urgentes</span>
                      <input
                        type="number"
                        min="0"
                        value={negocio.recargoUrgente ?? 0}
                        onChange={(evento) =>
                          actualizar('recargoUrgente')(evento.target.value)
                        }
                      />
                      <small>
                        Monto fijo a cobrar por pedido urgrente. Si se define como 0, el negocio no aceptara pedidos urgentes. Por defecto es 0.
                      </small>
                    </label>
                  </>
                )}
                <ErrorFormulario error={error} />
                {mensaje && <p className="success">✓ {mensaje}</p>}
                <button className="primary" disabled={cargando || eliminando}>
                  {cargando ? 'Guardando…' : 'Guardar cambios'}
                </button>
              </form>
              <section className="danger-zone" aria-labelledby="delete-business-title">
                <div>
                  <h2 id="delete-business-title">Eliminar negocio</h2>
                  <p>
                    Esta acción elimina permanentemente el negocio y los clientes
                    asociados.
                  </p>
                </div>
                <button
                  type="button"
                  className="danger"
                  onClick={eliminarNegocio}
                  disabled={eliminando || cargando}
                >
                  {eliminando ? 'Eliminando…' : 'Eliminar negocio'}
                </button>
              </section>
            </section>
          </>
        </div>
      )}
      {/* Pestaña 'Mis productos' (vendedor) → dibuja CrearProducto (archivo CrearProducto.tsx). */}
      {seccion === 'productos' && (
        <div key={`productos-${refreshKey}`}>
          <>
            <section className="welcome">
              <span className="eyebrow">MIS PRODUCTOS</span>
              <h1>Gestioná tus productos</h1>
              <p>Creá y administrá los productos de tu negocio.</p>
            </section>
            {sesion.cliente.rol === 'VENDEDOR' && (
              // token={sesion.accessToken}: así le llega el TOKEN a la pantalla. De ahí lo pasa a api.misProductos(token), etc.
              <CrearProducto token={sesion.accessToken} />
            )}
          </>
        </div>
      )}
      {/* Pestaña 'Mis compras' → Pedidos.tsx con tipo="compras" (en Pedidos, esVenta = false). */}
      {seccion === 'compras' && (
        <div key={`compras-${refreshKey}`}>
          <Pedidos token={sesion.accessToken} tipo="compras" />
        </div>
      )}
      {/* Pestaña 'Pedidos' (solo vendedor) → el MISMO componente Pedidos.tsx con tipo="ventas" (esVenta = true). */}
      {!esComprador && seccion === 'pedidos' && (
        <div key={`pedidos-${refreshKey}`}>
          <Pedidos token={sesion.accessToken} tipo="ventas" />
        </div>
      )}
      {carritoAbierto && (
        <PanelCarrito
          estado={estadoCarrito}
          direccionInicial={sesion.negocio.direccion}
          alCerrar={() => setCarritoAbierto(false)}
        />
      )}
    </main>
  );
}

function soloDigitos(valor: string, maximoDigitos: number) {
  return valor.replace(/\D/g, '').slice(0, maximoDigitos);
}
function formatearCuit(valor: string) {
  const digitos = soloDigitos(valor, 11);
  if (digitos.length <= 2) return digitos;
  if (digitos.length <= 10) return `${digitos.slice(0, 2)}-${digitos.slice(2)}`;
  return `${digitos.slice(0, 2)}-${digitos.slice(2, 10)}-${digitos.slice(10)}`;
}
function formatearTelefono(valor: string) {
  const digitos = soloDigitos(valor, 10);
  if (digitos.length <= 2) return digitos;
  if (digitos.length <= 6) return `${digitos.slice(0, 2)} ${digitos.slice(2)}`;
  return `${digitos.slice(0, 2)} ${digitos.slice(2, 6)}-${digitos.slice(6)}`;
}
function Campo({
  etiqueta,
  valor,
  alCambiar,
  tipo = 'text',
  hint,
  requerido = false,
  soloNumeros = false,
  maximoDigitos,
  formatear,
  minDigitos,
  exactDigitos,
  ...props
}: {
  etiqueta: string;
  valor: string;
  alCambiar: (valor: string) => void;
  tipo?: string;
  hint?: string;
  soloNumeros?: boolean;
  maximoDigitos?: number;
  formatear?: (valor: string) => string;
  placeholder?: string;
  requerido?: boolean;
  inputMode?: 'numeric';
  maxLength?: number;
  pattern?: string;
  title?: string;
  minDigitos?: number;
  exactDigitos?: number;
}) {
  const valorVisible = formatear ? formatear(valor) : valor;
  const patron = props.pattern?.split('\\\\').join('\\');
  return (
    <label className="field">
      <span>{etiqueta}</span>
      <input
        type={tipo}
        value={valorVisible}
        onChange={(evento) => {
          let input = evento.target.value;
          if (soloNumeros) {
            const digitsOnly = input.replace(/\D/g, '');
            let max = maximoDigitos ?? Number.MAX_SAFE_INTEGER;
            if (exactDigitos !== undefined) {
              max = exactDigitos;
            }
            const limited = digitsOnly.slice(0, max);
            alCambiar(soloDigitos(limited, max));
          } else {
            alCambiar(input);
          }
        }}
        {...props}
        required={requerido}
        pattern={patron}
      />
      {hint && <small>{hint}</small>}
    </label>
  );
}
function ErrorFormulario({ error }: { error: string }) {
  return error ? (
    <p className="error" role="alert">
      {error}
    </p>
  ) : null;
}
export default App;
