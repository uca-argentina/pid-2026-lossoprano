CREATE TABLE IF NOT EXISTS carrito_item (
  id_cliente integer NOT NULL REFERENCES cliente(id_cliente) ON DELETE CASCADE,
  id_producto integer NOT NULL REFERENCES producto(id_producto) ON DELETE CASCADE,
  cantidad integer NOT NULL CHECK (cantidad > 0),
  version integer NOT NULL,
  PRIMARY KEY (id_cliente, id_producto)
);
CREATE INDEX IF NOT EXISTS carrito_item_producto_idx ON carrito_item(id_producto);
