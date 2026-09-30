ALTER TABLE negocio ADD COLUMN IF NOT EXISTS monto_minimo_orden decimal(12,2) NOT NULL DEFAULT 0;
ALTER TABLE producto ADD COLUMN IF NOT EXISTS cantidad_minima_compra integer;
