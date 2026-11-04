# BulkMarket Web

Para estudiar la arquitectura y practicar cambios sin asistencia, empezá por la [guía de estudio](../GUIA_DE_ESTUDIO.md). El formato común se mantiene desde la raíz con `npm run format`.

Interfaz React responsive de BulkMarket: registro de comprador/vendedor, inicio de sesión, edición y baja del negocio.

El detalle del producto mantiene Cerrar en una cabecera propia, fuera del área desplazable de fotos e información. En móvil sigue visible con imágenes verticales y carruseles, incluso al recorrer el contenido.

Sorteos está disponible para ambos roles. Muestra el premio simulado, las compras y ventas entregadas que suman chances, la probabilidad actual, el desglose de comisiones y los últimos resultados. Un único sorteo compartido cierra cada 14 días a medianoche de Argentina. La sección informa que no cobra comisiones ni paga dinero real. Al abrirla o pulsar Actualizar sorteos, la API cierra los períodos vencidos con actividad y conserva sus ganadores. Requiere reiniciar la API en desarrollo o aplicar la migración 007 en producción.

Para probar el cierre completo, abrí Sorteos → **Reloj de prueba**, elegí la fecha/hora del próximo cierre (precargada) y pulsá **Aplicar fecha de prueba**. El ganador se guarda en Resultados anteriores y el siguiente período comienza con fondo y chances en cero. Solo hay ganador si existían entregas y premio. La fecha de prueba se comparte entre cuentas, persiste al reiniciar y también se aplica a nuevas entregas; solo se puede avanzar. En producción/Vercel este control no aparece. La paleta acompaña al rol: verde para compradores y violeta para vendedores.

Mis Compras está disponible para compradores y vendedores, con Seguimiento (compras en curso) e Historial (compras completadas). La orden general aparece completada únicamente cuando todas sus subórdenes están entregadas o cerradas; las rechazadas y canceladas se consideran cerradas.

Pedidos es una sección independiente y exclusiva de vendedores: Pedidos recibidos muestra sus ventas pendientes, confirmadas, preparadas o enviadas, con las acciones de gestión; Historial reúne las entregadas, rechazadas y canceladas. El cierre de la suborden de ese vendedor basta para que aparezca en su historial de ventas, aunque la orden general del comprador siga en curso por otros vendedores. Cada sección consulta solamente su listado de compras o ventas. Usá Actualizar pedidos para consultar cambios de la otra parte. El vendedor actualiza stock desde Mis Productos → Agregar stock.

En pantallas de hasta 1100 px, la navegación se abre desde Menú, con todas las secciones en una lista vertical y la sección activa resaltada. El carrito y el cierre de sesión siguen visibles en la barra. El menú se cierra al elegir una sección, tocar fuera o pulsar Escape; al volver a escritorio reaparecen las solapas.

Crea `.env`, ejecutá `npm install` y luego `npm run dev`.

Para Vercel y la migración de datos e imágenes, seguí [la guía de despliegue](../DEPLOYMENT.md).
