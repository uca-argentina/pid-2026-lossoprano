-- 008-sorteos-reloj.sql
-- Crea el reloj local compartido con un desfase en milisegundos. Producción ignora
-- este desfase y utiliza la hora real.
-- No ejecutar automáticamente: revisar DATABASE_URL y aplicar en el orden numérico.

BEGIN;
CREATE TABLE IF NOT EXISTS sorteo_reloj (
  id integer PRIMARY KEY,
  desfase_ms bigint NOT NULL DEFAULT 0
);
COMMIT;
