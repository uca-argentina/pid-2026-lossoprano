-- 003-order-minimums.sql
-- Separa mínimo monetario por negocio y cantidad mínima por producto. Son reglas
-- distintas y se validan al comprar.
-- No ejecutar automáticamente: revisar DATABASE_URL y aplicar en el orden numérico.

ALTER TABLE negocio ADD COLUMN IF NOT EXISTS monto_minimo_orden decimal(12,2) NOT NULL DEFAULT 0;
ALTER TABLE producto ADD COLUMN IF NOT EXISTS cantidad_minima_compra integer;
