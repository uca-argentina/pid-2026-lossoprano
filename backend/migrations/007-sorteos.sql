-- 007-sorteos.sql
-- Guarda instantáneas de sorteos por inicio de período. Sin cascadas a negocios:
-- borrar una cuenta no altera un ganador histórico.
-- No ejecutar automáticamente: revisar DATABASE_URL y aplicar en el orden numérico.

BEGIN;
CREATE TABLE IF NOT EXISTS sorteo (
  inicio timestamptz PRIMARY KEY,
  fin timestamptz NOT NULL,
  volumen numeric(24,2) NOT NULL,
  comisiones numeric(24,2) NOT NULL,
  premio numeric(24,2) NOT NULL,
  ingreso_plataforma numeric(24,2) NOT NULL,
  participantes jsonb NOT NULL,
  peso_total text NOT NULL,
  ganador jsonb,
  reglas jsonb NOT NULL,
  sorteado_en timestamptz NOT NULL DEFAULT now()
);
COMMIT;
