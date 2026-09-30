import { FormEvent, useState, useRef } from 'react';
import { api, Negocio, Rol, Sesion } from './api';
import Comprador from './Comprador';
import CrearProducto from './CrearProducto';

type Vista = 'ingreso' | 'registro';
const negocioInicial = { razonSocial: '', nombreComercial: '', identificacionFiscal: '', telefono: '', direccion: '' };
const claveSesion = 'bulkmarket-sesion';

function App() {
  const [sesion, setSesion] = useState<Sesion | null>(() => { const valor = localStorage.getItem(claveSesion); return valor ? JSON.parse(valor) : null; });
  const [vista, setVista] = useState<Vista>('ingreso');

  const guardarSesion = (nuevaSesion: Sesion) => { localStorage.setItem(claveSesion, JSON.stringify(nuevaSesion)); setSesion(nuevaSesion); };
  const cerrarSesion = () => { localStorage.removeItem(claveSesion); setSesion(null); };

  if (sesion) return <Panel sesion={sesion} guardarSesion={guardarSesion} cerrarSesion={cerrarSesion} />;

  return <main className="auth-layout">
            <section className="hero">
                <h1>Comprá mejor.
                    <br />
                    <em>Vendé más.</em>
                </h1>
                <p>La plataforma que conecta comercios y marcas independientes para hacer negocios.</p>
            </section>
            <section className="auth-card">
                <Marca />
                <div className="tabs">
                    <button className={vista === 'ingreso' ? 'active' : ''} onClick={() => setVista('ingreso')}>Ingresar</button>
                    <button className={vista === 'registro' ? 'active' : ''} onClick={() => setVista('registro')}>Crear cuenta</button>
                </div>{vista === 'ingreso' ? 
                <Ingreso alIngresar={guardarSesion} alRegistrarse={() => setVista('registro')} /> : 
                <Registro alRegistrarse={guardarSesion} />}
            </section>
        </main>;
}

function Marca() { return <div className="brand" role="img" aria-label="Bulkmarket"><span className="brand-mark" aria-hidden="true">B</span><span className="brand-name" aria-hidden="true">bulk<span>market</span></span></div>; }

function Ingreso({ alIngresar, alRegistrarse }: { alIngresar: (sesion: Sesion) => void; alRegistrarse: () => void }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [cargando, setCargando] = useState(false);

  async function enviar(evento: FormEvent) {
    evento.preventDefault();
    setError('');
    setCargando(true);
    try {
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
      <button
        className="primary"
        disabled={cargando}
      >
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
      <p className="muted">
        Completá los datos de tu negocio para operar en BulkMarket.
      </p>
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
      <button
        className="primary"
        disabled={cargando}
      >
        {cargando ? 'Creando cuenta…' : 'Crear cuenta gratis'}
      </button>
    </form>
  );
}

type Seccion = 'explorar' | 'perfil' | 'productos';

function Panel({ sesion, guardarSesion, cerrarSesion }: { sesion: Sesion; guardarSesion: (sesion: Sesion) => void; cerrarSesion: () => void }) {
  const esComprador = sesion.cliente.rol === 'COMPRADOR';
  const [seccion, setSeccion] = useState<Seccion>(esComprador ? 'explorar' : 'perfil');
  const lastClickRef = useRef(0);
  const [refreshKey, setRefreshKey] = useState(0);

  const handleTabClick = (targetSection: Seccion) => {
    const now = Date.now();
    const timeSinceLastClick = now - lastClickRef.current;

    // If clicking the same section and it's a double click (within 300ms)
    if (targetSection === seccion && timeSinceLastClick < 300) {
      // Trigger a refresh by incrementing refresh key
      setRefreshKey(prev => prev + 1);
    } else {
      setSeccion(targetSection);
    }

    lastClickRef.current = now;
  };

  const [negocio, setNegocio] = useState<Omit<Negocio, 'idNegocio'>>(() => {
    const { idNegocio, ...datos } = sesion.negocio;
    return { ...datos, montoMinimoOrden: datos.montoMinimoOrden ?? '0.00', identificacionFiscal: soloDigitos(datos.identificacionFiscal, 11), telefono: soloDigitos(datos.telefono, 10) };
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
      const { montoMinimoOrden, ...datos } = negocio;
      const actualizado = await api.actualizarNegocio(esComprador ? datos : negocio, sesion.accessToken);
      guardarSesion({ ...sesion, negocio: actualizado });
      setMensaje('Los datos del negocio se actualizaron correctamente.');
    } catch (error) {
      setError(error instanceof Error ? error.message : 'No se pudieron guardar los cambios.');
    } finally {
      setCargando(false);
    }
  }

  async function eliminarNegocio() {
    if (!window.confirm(`¿Seguro que querés eliminar ${negocio.nombreComercial}? Esta acción eliminará el negocio y sus clientes asociados, y no se puede deshacer.`)) return;
    setEliminando(true);
    setError('');
    try {
      await api.eliminarNegocio(sesion.accessToken);
      cerrarSesion();
    } catch (error) {
      setError(error instanceof Error ? error.message : 'No se pudo eliminar el negocio.');
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
        <nav className="navbar-tabs" aria-label="Navegación principal">
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
            className={`nav-tab ${seccion === 'explorar' ? 'active' : ''}`}
            aria-current={seccion === 'explorar' ? 'page' : undefined}
            onClick={() => handleTabClick('explorar')}
          >
            Explorar
          </button>
        </nav>
        <div className="navbar-actions">
          <span className={`role-badge ${claseRol}`}>{nombreRol}</span>
          <button type="button" className="logout" aria-label="Cerrar sesión" title="Cerrar sesión" onClick={cerrarSesion}>
            <span className="logout-text">Cerrar sesión</span>
            <svg className="logout-icon" aria-hidden="true" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M9 5H5v14h4M14 8l4 4-4 4M9 12h9" />
            </svg>
          </button>
        </div>
      </header>
      {seccion === 'explorar' && (
        <div key={`explorar-${refreshKey}`}>
          <Comprador token={sesion.accessToken} idCliente={sesion.cliente.idCliente} idNegocio={sesion.negocio.idNegocio} />
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
                <p className="muted">Mantené actualizada la información comercial y de contacto.</p>
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
                </div>
                {!esComprador && <label className="field">
                  <span>Monto mínimo por pedido</span>
                  <input type="number" min="0" max="9999999999.99" step="0.01" required
                    value={negocio.montoMinimoOrden ?? '0.00'} onChange={evento => actualizar('montoMinimoOrden')(evento.target.value)} />
                  <small>Importe mínimo del pedido en dinero. Usá 0 si no exigís un mínimo.</small>
                </label>}
                <ErrorFormulario error={error} />
                {mensaje && <p className="success">✓ {mensaje}</p>}
                <button
                  className="primary"
                  disabled={cargando || eliminando}
                >
                  {cargando ? 'Guardando…' : 'Guardar cambios'}
                </button>
              </form>
              <section className="danger-zone" aria-labelledby="delete-business-title">
                <div>
                  <h2 id="delete-business-title">Eliminar negocio</h2>
                  <p>Esta acción elimina permanentemente el negocio y los clientes asociados.</p>
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
      {seccion === 'productos' && (
        <div key={`productos-${refreshKey}`}>
          <>
            <section className="welcome">
              <span className="eyebrow">MIS PRODUCTOS</span>
              <h1>Gestioná tus productos</h1>
              <p>Creá y administrá los productos de tu negocio.</p>
            </section>
            {sesion.cliente.rol === 'VENDEDOR' && <CrearProducto token={sesion.accessToken} listPosition="above" />}
          </>
        </div>
      )}
    </main>
  );
}

function soloDigitos(valor: string, maximoDigitos: number) { return valor.replace(/\D/g, '').slice(0, maximoDigitos); }
function formatearCuit(valor: string) { const digitos = soloDigitos(valor, 11); if (digitos.length <= 2) return digitos; if (digitos.length <= 10) return `${digitos.slice(0, 2)}-${digitos.slice(2)}`; return `${digitos.slice(0, 2)}-${digitos.slice(2, 10)}-${digitos.slice(10)}`; }
function formatearTelefono(valor: string) { const digitos = soloDigitos(valor, 10); if (digitos.length <= 2) return digitos; if (digitos.length <= 6) return `${digitos.slice(0, 2)} ${digitos.slice(2)}`; return `${digitos.slice(0, 2)} ${digitos.slice(2, 6)}-${digitos.slice(6)}`; }
function Campo({ etiqueta, valor, alCambiar, tipo = 'text', hint, requerido = false, soloNumeros = false, maximoDigitos, formatear, minDigitos, exactDigitos, ...props }: { etiqueta: string; valor: string; alCambiar: (valor: string) => void; tipo?: string; hint?: string; soloNumeros?: boolean; maximoDigitos?: number; formatear?: (valor: string) => string; placeholder?: string; requerido?: boolean; inputMode?: 'numeric'; maxLength?: number; pattern?: string; title?: string; minDigitos?: number; exactDigitos?: number }) {
  const valorVisible = formatear ? formatear(valor) : valor;
  const patron = props.pattern?.split('\\\\').join('\\');
  return <label className="field"><span>{etiqueta}</span><input type={tipo} value={valorVisible} onChange={(evento) => {
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
  }} {...props} required={requerido} pattern={patron} />{hint && <small>{hint}</small>}</label>; }
function ErrorFormulario({ error }: { error: string }) { return error ? <p className="error" role="alert">{error}</p> : null; }
export default App;
