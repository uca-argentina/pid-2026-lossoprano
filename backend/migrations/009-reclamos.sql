-- 009-reclamos.sql
-- Página web del negocio, plazo de reclamo por vendedor, fecha fija de entrega y
-- tabla de reclamos. Las entregas anteriores toman su última actualización como fecha.
-- No ejecutar automáticamente: revisar DATABASE_URL y aplicar en el orden numérico.

BEGIN;
ALTER TABLE negocio ADD COLUMN IF NOT EXISTS pagina_web varchar(200);
ALTER TABLE negocio ADD COLUMN IF NOT EXISTS dias_reclamo integer NOT NULL DEFAULT 7;
ALTER TABLE suborden ADD COLUMN IF NOT EXISTS entregada_en timestamptz;
UPDATE suborden SET entregada_en = actualizado_en
  WHERE estado = 'ENTREGADA' AND entregada_en IS NULL;

CREATE TABLE IF NOT EXISTS reclamo (
  id_reclamo serial PRIMARY KEY,
  id_suborden integer NOT NULL REFERENCES suborden(id_suborden) ON DELETE CASCADE,
  id_negocio_comprador integer NOT NULL,
  id_negocio_vendedor integer NOT NULL,
  estado varchar(20) NOT NULL DEFAULT 'PENDIENTE',
  items jsonb NOT NULL,
  motivo varchar(500) NOT NULL,
  motivo_rechazo varchar(500),
  importe numeric(20,2) NOT NULL,
  nota_credito varchar(30),
  creado_en timestamptz NOT NULL DEFAULT now(),
  resuelto_en timestamptz,
  recibido_en timestamptz
);
CREATE INDEX IF NOT EXISTS reclamo_suborden_idx ON reclamo(id_suborden);
CREATE INDEX IF NOT EXISTS reclamo_vendedor_idx ON reclamo(id_negocio_vendedor);
CREATE INDEX IF NOT EXISTS reclamo_comprador_idx ON reclamo(id_negocio_comprador);
COMMIT;
