import { useEffect, useRef, useState } from 'react';
import { ItemCarrito } from './api';
import { limitarCantidad } from './useCarrito';

export default function CantidadCarrito({ item, alGuardar }: {
  item: ItemCarrito; alGuardar: (cantidad: number) => Promise<boolean> | undefined;
}) {
  const [texto, setTexto] = useState(String(item.cantidad));
  const [guardando, setGuardando] = useState(false);
  const editando = useRef(false);
  const solicitudEnCurso = useRef(false);
  useEffect(() => {
    if (!editando.current) setTexto(String(item.cantidad));
  }, [item.cantidad]);

  async function confirmar(valor = texto) {
    if (solicitudEnCurso.current) return;
    editando.current = false;
    const cantidad = limitarCantidad(Number(valor), item.stock, item.cantidadMinimaCompra ?? 1);
    setTexto(String(cantidad));
    if (cantidad === item.cantidad) return;
    setGuardando(true);
    solicitudEnCurso.current = true;
    try {
      const guardado = await alGuardar(cantidad);
      if (!guardado) setTexto(String(item.cantidad));
    } finally { solicitudEnCurso.current = false; setGuardando(false); }
  }

  function cambiar(paso: number) {
    const base = Number.isFinite(Number(texto)) && texto !== '' ? Number(texto) : item.cantidad;
    void confirmar(String(base + paso));
  }

  return <div className="carrito-cantidad"><input type="number" aria-label={`Cantidad de ${item.nombre}`}
    min={item.cantidadMinimaCompra ?? 1} max={item.stock} step={1}
    value={texto} disabled={guardando}
    onFocus={() => { editando.current = true; }}
    onChange={evento => setTexto(evento.target.value)}
    onBlur={() => { void confirmar(); }}
    onKeyDown={evento => {
      if (evento.key === 'Enter') { evento.preventDefault(); evento.currentTarget.blur(); }
      if (evento.key === 'ArrowUp' || evento.key === 'ArrowDown') {
        evento.preventDefault(); cambiar(evento.key === 'ArrowUp' ? 1 : -1);
      }
    }} />
    <div className="carrito-cantidad-flechas">
      <button type="button" aria-label={`Aumentar cantidad de ${item.nombre}`} disabled={guardando || Number(texto) >= item.stock}
        onMouseDown={evento => evento.preventDefault()} onClick={() => cambiar(1)}>▴</button>
      <button type="button" aria-label={`Disminuir cantidad de ${item.nombre}`} disabled={guardando || Number(texto) <= (item.cantidadMinimaCompra ?? 1)}
        onMouseDown={evento => evento.preventDefault()} onClick={() => cambiar(-1)}>▾</button>
    </div>
  </div>;
}
