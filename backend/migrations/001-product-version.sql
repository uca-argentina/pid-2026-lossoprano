-- 001-product-version.sql
-- Agrega la versión comercial inicial a productos existentes sin eliminar sus datos.
-- No ejecutar automáticamente: revisar DATABASE_URL y aplicar en el orden numérico.

-- Solo para bases con synchronize deshabilitado (NODE_ENV=production).
ALTER TABLE producto ADD COLUMN IF NOT EXISTS version integer NOT NULL DEFAULT 1;
