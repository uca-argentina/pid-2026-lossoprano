-- 006-subordenes.sql
-- Divide pedidos anteriores en subórdenes por vendedor conservando su información.
-- Las nuevas compras usan un pedido general más sus subórdenes.
-- No ejecutar automáticamente: revisar DATABASE_URL y aplicar en el orden numérico.

BEGIN;
CREATE TABLE IF NOT EXISTS suborden (
  id_suborden serial PRIMARY KEY,
  id_pedido integer NOT NULL REFERENCES pedido(id_pedido) ON DELETE CASCADE,
  id_negocio_vendedor integer NOT NULL,
  nombre_vendedor varchar(150) NOT NULL,
  id_negocio_comprador integer NOT NULL,
  nombre_comprador varchar(150) NOT NULL,
  direccion_entrega varchar(255) NOT NULL,
  condicion_pago varchar(20) NOT NULL,
  estado varchar(20) NOT NULL DEFAULT 'PENDIENTE',
  items jsonb NOT NULL,
  total numeric(20,2) NOT NULL,
  creado_en timestamptz NOT NULL DEFAULT now(),
  actualizado_en timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS suborden_pedido_idx ON suborden(id_pedido);
CREATE INDEX IF NOT EXISTS suborden_vendedor_idx ON suborden(id_negocio_vendedor);
CREATE INDEX IF NOT EXISTS suborden_comprador_idx ON suborden(id_negocio_comprador);

-- Los pedidos anteriores eran de un solo vendedor y nacían confirmados: cada uno pasa a ser una suborden confirmada.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'pedido' AND column_name = 'id_negocio_vendedor') THEN
    INSERT INTO suborden (id_pedido, id_negocio_vendedor, nombre_vendedor, id_negocio_comprador, nombre_comprador,
      direccion_entrega, condicion_pago, estado, items, total, creado_en, actualizado_en)
    SELECT p.id_pedido, p.id_negocio_vendedor, COALESCE(v.nombre_comercial, 'Vendedor eliminado'),
      p.id_negocio_comprador, COALESCE(c.nombre_comercial, 'Comprador eliminado'),
      p.direccion_entrega, p.condicion_pago, 'CONFIRMADA', p.items, p.total, p.creado_en, p.creado_en
    FROM pedido p
    LEFT JOIN negocio v ON v.id_negocio = p.id_negocio_vendedor
    LEFT JOIN negocio c ON c.id_negocio = p.id_negocio_comprador;
    ALTER TABLE pedido DROP COLUMN id_negocio_vendedor, DROP COLUMN direccion_entrega,
      DROP COLUMN condicion_pago, DROP COLUMN estado, DROP COLUMN items;
  END IF;
END $$;
COMMIT;
