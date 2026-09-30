-- Aplicar sobre bases existentes ANTES de iniciar la API (también en desarrollo):
-- convierte la categoría de texto libre de cada producto en una fila de la tabla categoria.
-- Se puede ejecutar más de una vez.
BEGIN;

CREATE TABLE IF NOT EXISTS categoria (
  id_categoria serial PRIMARY KEY,
  nombre varchar(100) NOT NULL,
  clave varchar(100) NOT NULL,
  id_negocio integer REFERENCES negocio(id_negocio) ON DELETE CASCADE
);
CREATE UNIQUE INDEX IF NOT EXISTS categoria_negocio_clave_idx ON categoria(id_negocio, clave);

CREATE TABLE IF NOT EXISTS precio_escalonado (
  id_precio_escalonado serial PRIMARY KEY,
  id_producto integer NOT NULL REFERENCES producto(id_producto) ON DELETE CASCADE,
  cantidad_minima integer NOT NULL,
  precio_unitario decimal(12,2) NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS precio_escalonado_producto_cantidad_idx ON precio_escalonado(id_producto, cantidad_minima);

-- Misma normalización que claveCategoria() en category.entity.ts.
CREATE TEMP TABLE generales(nombre varchar(100)) ON COMMIT DROP;
INSERT INTO generales VALUES ('Alimentos'), ('Bebidas'), ('Perfumería'), ('Cosmética'), ('Higiene personal'), ('Limpieza'),
  ('Indumentaria'), ('Calzado'), ('Accesorios'), ('Hogar y decoración'), ('Librería y papelería'), ('Electrónica'),
  ('Ferretería'), ('Juguetes'), ('Mascotas');

INSERT INTO categoria(nombre, clave, id_negocio)
SELECT g.nombre, lower(translate(g.nombre, 'ÁÉÍÓÚÜÑáéíóúüñ', 'AEIOUUNaeiouun')), NULL
FROM generales g
WHERE NOT EXISTS (
  SELECT 1 FROM categoria c WHERE c.id_negocio IS NULL AND c.clave = lower(translate(g.nombre, 'ÁÉÍÓÚÜÑáéíóúüñ', 'AEIOUUNaeiouun'))
);

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'producto' AND column_name = 'categoria') THEN
    -- Las categorías escritas a mano que no coinciden con una general pasan a ser del vendedor.
    INSERT INTO categoria(nombre, clave, id_negocio)
    SELECT DISTINCT ON (p.id_negocio, lower(translate(regexp_replace(trim(p.categoria), '\s+', ' ', 'g'), 'ÁÉÍÓÚÜÑáéíóúüñ', 'AEIOUUNaeiouun')))
      regexp_replace(trim(p.categoria), '\s+', ' ', 'g'),
      lower(translate(regexp_replace(trim(p.categoria), '\s+', ' ', 'g'), 'ÁÉÍÓÚÜÑáéíóúüñ', 'AEIOUUNaeiouun')),
      p.id_negocio
    FROM producto p
    WHERE NOT EXISTS (
      SELECT 1 FROM categoria c
      WHERE (c.id_negocio IS NULL OR c.id_negocio = p.id_negocio)
        AND c.clave = lower(translate(regexp_replace(trim(p.categoria), '\s+', ' ', 'g'), 'ÁÉÍÓÚÜÑáéíóúüñ', 'AEIOUUNaeiouun'))
    );

    ALTER TABLE producto ADD COLUMN IF NOT EXISTS id_categoria integer;
    UPDATE producto p SET id_categoria = (
      SELECT c.id_categoria FROM categoria c
      WHERE (c.id_negocio IS NULL OR c.id_negocio = p.id_negocio)
        AND c.clave = lower(translate(regexp_replace(trim(p.categoria), '\s+', ' ', 'g'), 'ÁÉÍÓÚÜÑáéíóúüñ', 'AEIOUUNaeiouun'))
      ORDER BY c.id_negocio NULLS FIRST LIMIT 1
    );
    ALTER TABLE producto DROP COLUMN categoria;
  END IF;
END $$;

ALTER TABLE producto ALTER COLUMN id_categoria SET NOT NULL;
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'producto_categoria_fk') THEN
    ALTER TABLE producto ADD CONSTRAINT producto_categoria_fk FOREIGN KEY (id_categoria) REFERENCES categoria(id_categoria) ON DELETE NO ACTION;
  END IF;
END $$;

COMMIT;
