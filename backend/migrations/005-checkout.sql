-- 005-checkout.sql
-- Crea la estructura histórica del checkout inicial. La migración 006 la adapta luego
-- a compras de varios vendedores.
-- No ejecutar automáticamente: revisar DATABASE_URL y aplicar en el orden numérico.

BEGIN;
CREATE TABLE IF NOT EXISTS pedido (
  id_pedido serial PRIMARY KEY,
  id_cliente integer NOT NULL,
  id_negocio_comprador integer NOT NULL,
  id_negocio_vendedor integer NOT NULL,
  clave_confirmacion uuid NOT NULL,
  direccion_entrega varchar(255) NOT NULL,
  condicion_pago varchar(20) NOT NULL,
  estado varchar(20) NOT NULL DEFAULT 'CONFIRMADO',
  items jsonb NOT NULL,
  total numeric(20,2) NOT NULL,
  creado_en timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS pedido_confirmacion_idx ON pedido(id_cliente, clave_confirmacion);
COMMIT;
