export function formatCurrency(amount: string | number): string {
  const num = typeof amount === 'string' ? parseFloat(amount) : amount;
  if (isNaN(num)) return '$0.00';

  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(num);
}
type Tramo = { cantidadMinima: number; precioUnitario: string };

// Precio del tramo más alto alcanzado; si no alcanza ninguno, el precio base.
export function precioParaCantidad(precioBase: string, tramos: Tramo[] = [], cantidad: number) {
  return tramos.reduce((mejor, tramo) => tramo.cantidadMinima <= cantidad && tramo.cantidadMinima > mejor.cantidadMinima ? tramo : mejor,
    { cantidadMinima: 0, precioUnitario: precioBase }).precioUnitario;
}

export function siguienteTramo(tramos: Tramo[] = [], cantidad: number, stock: number) {
  return [...tramos].sort((a, b) => a.cantidadMinima - b.cantidadMinima)
    .find(tramo => tramo.cantidadMinima > cantidad && tramo.cantidadMinima <= stock);
}
