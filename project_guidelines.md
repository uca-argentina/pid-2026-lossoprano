Stack propuesto tentativo:
- frontend: react c/ tailwind
- backend: node + typescript con nest.js y postgresql
- auth: JWT

Alcance
Marketplace B2B mayorista que conecta comercios minoristas (compradores) con marcas/fabricantes independientes (vendedores), para que los comercios chicos puedan diversificar proveedores sin depender de un único distribuidor. No es B2C: los usuarios son negocios, no consumidores finales.

Objetivos del proyecto
- Permitir que fabricantes publiquen catálogos mayoristas con condiciones propias (pedido mínimo, precios por volumen, términos de pago).
- Permitir que comercios busquen, comparen y hagan pedidos a múltiples marcas desde una sola plataforma.
- Modelar correctamente la lógica de negocio B2B (que es lo que le da peso al proyecto): MOQ (cantidad mínima de orden), tiers de precio, condiciones de pago, estados de pedido.
No busca ser vistoso, sino demostrar diseño de dominio sólido y manejo de reglas de negocio complejas.

Features
- Roles y auth: comprador vs vendedor, cada uno con su vista.
- Alta de catálogo (vendedor): productos, precios, fotos, pedido mínimo por producto o por orden.
- Búsqueda/listado de marcas y productos (comprador).
- Carrito con validación de MOQ: no dejar avanzar si no se cumple el mínimo de esa marca.
- Checkout multi-marca: un pedido se puede dividir en sub-órdenes por vendedor, cada una con sus propios términos.
- Estados de pedido: pendiente → confirmado → enviado → entregado (al menos ese flujo básico).
- Panel de vendedor: ver pedidos recibidos, gestionar stock.

Features Fase 2 (si da el tiempo)
- Precios escalonados por volumen (tiers).
- Sistema de reseñas/calificación de marcas.

--------------------------------------------------

Primera consigna: 

A su equipo de desarrollo se le asignó un cliente que busca conectar fabricantes y marcas independientes con comercios minoristas para realizar compras mayoristas desde una única plataforma.

Por el momento, el PM nos pasó los siguientes requisitos:

No es una aplicación B2C: compradores y vendedores representan negocios.

Aplicación web compatible con dispositivos móviles.

Debe haber autenticación y vistas diferenciadas.

El foco estará en las reglas comerciales mayoristas y el ciclo de los pedidos.



Sprint 1 - Primer MVP


Registro y log-in con roles Comprador y Vendedor.

ABM de negocios con razón social, nombre comercial, identificación fiscal, contacto y dirección.

El vendedor puede crear productos con descripción, imágenes, categoría, precio base y stock.

El comprador puede buscar productos y marcas, consultar sus detalles y armar un carrito de un único vendedor.

