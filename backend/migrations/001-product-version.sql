-- Solo para bases con synchronize deshabilitado (NODE_ENV=production).
ALTER TABLE producto ADD COLUMN IF NOT EXISTS version integer NOT NULL DEFAULT 1;
