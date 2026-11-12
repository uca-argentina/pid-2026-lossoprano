/**
 * Checkout y ciclo de vida de pedidos. La transacción valida el carrito, bloquea
 * filas, descuenta stock y guarda las subórdenes.
 * La clave de confirmación hace idempotente el reintento: la misma compra no descuenta
 * dos veces.
 * Rechazo/cancelación devuelve stock; la entrega fija la fecha que usa el sorteo,
 * coordinada con su reloj y bloqueo, y la fecha desde la que corre el plazo de reclamo.
 * Los reclamos se inician sobre subórdenes entregadas y los resuelve el vendedor.
 */

import {
  // Errores HTTP de Nest. throw new X('mensaje') corta la función y el front recibe ese mensaje:
  // BadRequestException = 400 · ConflictException = 409 · NotFoundException = 404 · UnauthorizedException = 401 · ForbiddenException = 403.
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
// DataSource = la conexión a la base. EntityManager = la conexión dentro de una transacción (el 'manager').
// In(lista) = 'que el valor esté en esta lista' (se usa en where).
import { DataSource, EntityManager, In } from 'typeorm';
import { Cliente } from '../users/user.entity';
import { Negocio } from '../business/business.entity';
import { CarritoItem } from './cart-item.entity';
import { Producto } from './products.entity';
import { PrecioEscalonado, precioParaCantidad } from './price-tier.entity';
import { CrearReclamoDto } from './dto/reclamo.dto';
import { EstadoReclamo, Reclamo } from './claim.entity';
import {
  conEstadoPedido,
  EstadoSuborden,
  LineaPedido,
  Pedido,
  Suborden,
  TRANSICIONES,
} from './order.entity';
import { ConfirmarPedidoDto } from './dto/confirmar-pedido.dto';
import { BLOQUEO_SORTEOS } from '../sweepstakes/sweepstakes.rules';
import { ahoraSorteos } from '../sweepstakes/sweepstakes-clock';

// Pasa '1500.50' a 150050 (centavos, BigInt) para hacer cuentas de plata sin errores de decimales.
const centavos = (valor: string) => BigInt(valor.replace('.', ''));
// Lo inverso: de centavos (150050n) vuelve a texto '1500.50'.
const importe = (valor: bigint) =>
  `${valor / 100n}.${(valor % 100n).toString().padStart(2, '0')}`;
const UN_DIA = 24 * 60 * 60 * 1000;
// Último momento en que se puede reclamar una entrega, según los días del vendedor.
const limiteReclamo = (entregadaEn: Date, dias: number) =>
  new Date(entregadaEn.getTime() + dias * UN_DIA);
// Número visible de la nota de crédito simulada, derivado del número de reclamo.
const numeroNotaCredito = (idReclamo: number) =>
  `NC-0001-${String(idReclamo).padStart(8, '0')}`;

// SERVICE: acá va TODA la lógica (reglas del negocio) y el acceso a la base. El controller solo lo llama.
@Injectable()
export class PedidosService {
  // Nest le pasa la conexión a la base; queda en this.db.
  // this.db.getRepository(Tabla) → te da find / findOne / save / delete de esa tabla.
  constructor(private readonly db: DataSource) {}

  /**
   * Confirma la revisión enviada del carrito. Revalida precios, versiones, stock y
   * mínimos dentro de la misma transacción que descuenta unidades. Devuelve el pedido
   * anterior si la clave UUID ya fue utilizada por esa cuenta.
   */
  // CONFIRMAR COMPRA (checkout). Lo llama POST /api/pedidos.
  // idCliente viene del token (req.user.sub); dto es el body.
  // LO LLAMA: orders.controller.ts → confirmar() con (req.user.sub, dto).
  // DEVUELVE: el pedido con sus subórdenes → llega al front como respuesta de api.confirmarPedido.
  confirmar(idCliente: number, dto: ConfirmarPedidoDto) {
    // TRANSACCIÓN: todo lo de adentro se guarda junto o nada. Si hay un throw, se deshace todo (incluido el stock).
    // Adentro se usa manager.getRepository(...) en vez de this.db.getRepository(...).
    return this.db.transaction(async (manager) => {
      // Bloqueo exclusivo por cuenta: dos confirmaciones simultáneas no consumen el mismo carrito.
      // Busca la cuenta. lock = bloquea la fila para que dos confirmaciones al mismo tiempo no choquen (solo se puede dentro de transacción).
      const cliente = await manager
        .getRepository(Cliente)
        .findOne({ where: { idCliente }, lock: { mode: 'pessimistic_write' } });
      // ! = 'no'. Si findOne devolvió null → 401.
      if (!cliente) throw new UnauthorizedException('La cuenta ya no existe.');
      const pedidos = manager.getRepository(Pedido);
      // Si ya se confirmó con esta misma clave (doble click), devuelve el pedido anterior en vez de comprar dos veces.
      // relations: trae también las subórdenes.
      const anterior = await pedidos.findOne({
        where: { idCliente, claveConfirmacion: dto.claveConfirmacion },
        relations: { subordenes: true },
      });
      // La clave se busca antes de releer un carrito que pudo vaciarse tras el primer éxito.
      if (anterior) return conEstadoPedido(anterior);
      const carrito = manager.getRepository(CarritoItem);
      // find = trae VARIAS filas (lista). Los productos del carrito de este cliente, ordenados por id.
      const filas = await carrito.find({
        where: { idCliente },
        order: { idProducto: 'ASC' },
      });
      // Si el carrito está vacío o no coincide con lo que mandó el front (.some = '¿alguno cumple?') → 409.
      if (
        !filas.length ||
        filas.length !== dto.items.length ||
        filas.some(
          (fila) =>
            !dto.items.some(
              (item) =>
                item.idProducto === fila.idProducto &&
                item.version === fila.version &&
                item.cantidad === fila.cantidad,
            ),
        )
      ) {
        throw new ConflictException('El carrito cambió. Revisalo antes de confirmar.');
      }
      // Una suborden por vendedor: cada una junta sus líneas y su propio total.
      // Map = diccionario idNegocioVendedor → { items, total }. Así arma UNA SUBORDEN POR VENDEDOR.
      const grupos = new Map<number, { items: LineaPedido[]; total: bigint }>();
      // Recorre cada producto del carrito.
      for (const fila of filas) {
        // findOne = UNA fila o null. Busca el producto actual en la base y lo bloquea.
        const producto = await manager.getRepository(Producto).findOne({
          where: { idProducto: fila.idProducto },
          loadEagerRelations: false,
          lock: { mode: 'pessimistic_write' },
        });
        // REGLA: si el producto cambió (otra versión) desde que lo agregaste → 409.
        if (!producto || producto.version !== fila.version)
          throw new ConflictException('Un producto cambió. Revisá el carrito.');
        // REGLA: no podés comprarte a vos mismo.
        if (producto.idNegocio === cliente.idNegocio)
          throw new ConflictException('No podés comprar productos de tu propio negocio.');
        if (
          // REGLAS MAYORISTAS: la cantidad tiene que ser >= mínimo de compra y <= stock.
          // ?? 1 = si cantidadMinimaCompra es null, usa 1.
          fila.cantidad < (producto.cantidadMinimaCompra ?? 1) ||
          fila.cantidad > producto.stock
        )
          throw new ConflictException(
            `No hay stock suficiente o no se cumple el mínimo de ${producto.nombre}.`,
          );
        // Trae los precios escalonados del producto (findBy = find con where directo).
        const tramos = await manager
          .getRepository(PrecioEscalonado)
          .findBy({ idProducto: producto.idProducto });
        // El precio válido se recalcula desde la base; no se confía en el total del navegador.
        // REGLA MAYORISTA: el precio depende de la cantidad (precio escalonado). Se calcula en el back, no se confía en el front.
        const precioUnitario = precioParaCantidad(
          producto.precioBase,
          tramos,
          fila.cantidad,
        );
        const subtotal = centavos(precioUnitario) * BigInt(fila.cantidad);
        // Agarra el grupo de ese vendedor o crea uno vacío si no existe.
        const grupo = grupos.get(producto.idNegocio) ?? { items: [], total: 0n };
        // push = agrega al final de la lista.
        grupo.items.push({
          idProducto: producto.idProducto,
          nombre: producto.nombre,
          cantidad: fila.cantidad,
          precioUnitario,
          subtotal: importe(subtotal),
        });
        grupo.total += subtotal;
        grupos.set(producto.idNegocio, grupo);
      }
      if (
        // Tiene que haber una entrega (dirección + pago) por cada vendedor.
        dto.entregas.length !== grupos.size ||
        dto.entregas.some((entrega) => !grupos.has(entrega.idNegocio))
      ) {
        throw new ConflictException(
          'Indicá la entrega y la condición de pago de cada vendedor del carrito.',
        );
      }
      // Se conservan nombres, precios y dirección como fotografía de la compra: cambios futuros
      // del catálogo o del perfil no reescriben los datos históricos del pedido.
      const negocios = manager.getRepository(Negocio);
      const comprador = await negocios.findOne({
        where: { idNegocio: cliente.idNegocio },
      });
      let total = 0n;
      const subordenes: Partial<Suborden>[] = [];
      // Por cada vendedor: chequea el monto mínimo y arma la suborden.
      for (const entrega of [...dto.entregas].sort((a, b) => a.idNegocio - b.idNegocio)) {
        const grupo = grupos.get(entrega.idNegocio)!;
        const vendedor = await negocios.findOne({
          where: { idNegocio: entrega.idNegocio },
          lock: { mode: 'pessimistic_read' },
        });
        // REGLA MAYORISTA: monto mínimo de compra por vendedor.
        if (!vendedor || grupo.total < centavos(vendedor.montoMinimoOrden))
          throw new ConflictException(
            `No se alcanza el monto mínimo de ${vendedor?.nombreComercial ?? 'un vendedor'}.`,
          );
        total += grupo.total;
        // Arma la suborden (todavía no se guarda). Estado: PENDIENTE por default.
        subordenes.push({
          idNegocioVendedor: vendedor.idNegocio,
          nombreVendedor: vendedor.nombreComercial,
          idNegocioComprador: cliente.idNegocio,
          nombreComprador: comprador?.nombreComercial ?? 'Comprador',
          direccionEntrega: entrega.direccionEntrega,
          condicionPago: entrega.condicionPago,
          items: grupo.items,
          total: importe(grupo.total),
        });
      }
      // Si el total calculado no coincide con el que vio el comprador → 409.
      if (importe(total) !== dto.total)
        throw new ConflictException(
          'El importe cambió. Revisá el carrito antes de confirmar.',
        );
      for (const { items } of subordenes) {
        for (const item of items!) {
          // El movimiento de inventario no es una edición comercial: conserva la versión del carrito.
          // SQL directo: descuenta el stock de cada producto comprado. $1 y $2 se reemplazan por los valores de la lista.
          await manager.query(
            'UPDATE producto SET stock = stock - $1 WHERE id_producto = $2',
            [item.cantidad, item.idProducto],
          );
        }
      }
      // save sin id → CREA el pedido. create arma el objeto, save lo guarda y devuelve la fila con su id nuevo.
      const pedido = await pedidos.save(
        pedidos.create({
          idCliente,
          idNegocioComprador: cliente.idNegocio,
          claveConfirmacion: dto.claveConfirmacion,
          total: importe(total),
        }),
      );
      const repo = manager.getRepository(Suborden);
      // Guarda todas las subórdenes juntas, cada una con el id del pedido.
      pedido.subordenes = await repo.save(
        subordenes.map((suborden) =>
          repo.create({ ...suborden, idPedido: pedido.idPedido }),
        ),
      );
      // Este vaciado pertenece a la misma transacción: si algo falla, también se revierte el stock.
      // Vacía el carrito del cliente.
      await carrito.delete({ idCliente });
      return conEstadoPedido(pedido);
    });
  }

  /**
   * Carga los pedidos del negocio comprador con todas sus subórdenes y calcula el estado
   * general a partir de ellas.
   */
  // MIS COMPRAS. Lo llama GET /api/pedidos/compras. idNegocio = comprador logueado (del token).
  // LO LLAMA: orders.controller.ts → compras() con (req.user.idNegocio).
  // DEVUELVE: lista de pedidos → en el front, setCompras(await api.misCompras(token)) en Pedidos.tsx.
  async listarCompras(idNegocio: number) {
    // Sin transacción: solo lee, así que usa this.db directo.
    const pedidos = await this.db.getRepository(Pedido).find({
      // where: { columnaDeLaEntity: valor }. Izquierda = nombre en la entity; derecha = la variable.
      where: { idNegocioComprador: idNegocio },
      // Trae también las subórdenes de cada pedido, y los reclamos de cada suborden.
      relations: { subordenes: { reclamos: true } },
      // Ordena: DESC = del más nuevo al más viejo; ASC = al revés.
      order: {
        idPedido: 'DESC',
        subordenes: { idSuborden: 'ASC', reclamos: { idReclamo: 'ASC' } },
      },
    });
    // flatMap junta las subórdenes de todos los pedidos en una sola lista, y les agrega el plazo de reclamo.
    const subordenes = await this.conPlazoReclamo(pedidos.flatMap((p) => p.subordenes));
    // map = transforma cada pedido: le pone sus subórdenes (filter por idPedido) y le calcula el estado general.
    return pedidos.map((pedido) =>
      conEstadoPedido({
        ...pedido,
        subordenes: subordenes.filter((s) => s.idPedido === pedido.idPedido),
      }),
    );
  }

  /**
   * Agrega a cada suborden entregada la fecha límite para reclamar (según el plazo que
   * configuró su vendedor) y si todavía se puede. La pantalla lo usa para mostrar el
   * botón; crearReclamo lo vuelve a comprobar.
   */
  // private = solo se usa dentro de esta clase. Agrega a cada suborden 'limiteReclamo' y 'puedeReclamar'.
  private async conPlazoReclamo(subordenes: Suborden[]) {
    const ids = [...new Set(subordenes.map((s) => s.idNegocioVendedor))];
    const vendedores = ids.length
      ? await this.db.getRepository(Negocio).findBy({ idNegocio: In(ids) })
      : [];
    const hoy = await ahoraSorteos(this.db);
    return subordenes.map((suborden) => {
      const vendedor = vendedores.find((v) => v.idNegocio === suborden.idNegocioVendedor);
      const limite =
        suborden.estado === EstadoSuborden.ENTREGADA && suborden.entregadaEn && vendedor
          ? limiteReclamo(suborden.entregadaEn, vendedor.diasReclamo)
          : null;
      return {
        ...suborden,
        limiteReclamo: limite,
        puedeReclamar: limite !== null && hoy <= limite,
      };
    });
  }

  /**
   * Carga únicamente las subórdenes cuyo vendedor es el negocio autenticado; no mezcla
   * ventas con compras propias.
   */
  // PEDIDOS RECIBIDOS (vendedor). GET /api/pedidos/ventas.
  // No lleva async/await porque devuelve el find directo (Nest espera la promesa solo).
  // LO LLAMA: orders.controller.ts → ventas() con (req.user.idNegocio).
  // DEVUELVE: lista de subórdenes → setVentas(...) en Pedidos.tsx.
  listarVentas(idNegocio: number) {
    return this.db.getRepository(Suborden).find({
      // Solo las subórdenes donde el logueado es el VENDEDOR.
      where: { idNegocioVendedor: idNegocio },
      relations: { reclamos: true },
      order: { idSuborden: 'DESC', reclamos: { idReclamo: 'ASC' } },
    });
  }

  /**
   * Bloquea la suborden, identifica si actúa comprador o vendedor y comprueba la
   * transición. Cancelar/rechazar repone stock; entregar usa el reloj del sorteo antes
   * de guardar.
   */
  // CICLO DEL PEDIDO. PATCH /api/pedidos/subordenes/:id/estado.
  // Recibe en el mismo orden que le pasa el controller: (id de la URL, negocio del token, estado del body).
  // LO LLAMA: orders.controller.ts → cambiarEstado() con (id de la URL, req.user.idNegocio, dto.estado).
  // En el front: botón de estado → cambiarEstado() de Pedidos.tsx → api.cambiarEstadoSuborden (api.ts).
  cambiarEstado(idSuborden: number, idNegocio: number, estado: EstadoSuborden) {
    return this.db.transaction(async (manager) => {
      // Repositorio de la tabla suborden dentro de la transacción.
      const repo = manager.getRepository(Suborden);
      // Busca la suborden por id. where: { idSuborden } = forma corta de { idSuborden: idSuborden }.
      const suborden = await repo.findOne({
        where: { idSuborden },
        lock: { mode: 'pessimistic_write' },
      });
      // ¿Quién es el logueado en esta suborden? 'vendedor', 'comprador' o null (no es suya).
      // ?. = si suborden es null no explota, da undefined.
      const parte =
        suborden?.idNegocioVendedor === idNegocio
          ? 'vendedor'
          : suborden?.idNegocioComprador === idNegocio
            ? 'comprador'
            : null;
      // No existe o no es suya → 404 (no le decimos que existe).
      if (!suborden || !parte) throw new NotFoundException('Pedido no encontrado.');
      // REGLA DEL CICLO: busca en TRANSICIONES (order.entity.ts) qué estados puede poner esta parte desde el estado actual.
      // Si el pedido no está en la lista → 409.
      if (!TRANSICIONES[suborden.estado][parte].includes(estado)) {
        throw new ConflictException(
          `No podés pasar este pedido de ${suborden.estado.toLowerCase()} a ${estado.toLowerCase()}.`,
        );
      }
      // Si se rechaza o cancela, DEVUELVE el stock de cada producto.
      if (estado === EstadoSuborden.RECHAZADA || estado === EstadoSuborden.CANCELADA) {
        // Devuelve el stock descontado al confirmar. Los productos eliminados se ignoran.
        for (const item of [...suborden.items].sort(
          (a, b) => a.idProducto - b.idProducto,
        )) {
          await manager.query(
            'UPDATE producto SET stock = stock + $1 WHERE id_producto = $2',
            [item.cantidad, item.idProducto],
          );
        }
      }
      // Cambia el estado en el objeto (todavía no en la base).
      suborden.estado = estado;
      // Si se entrega, guarda la fecha de entrega (entregadaEn). Desde ahí corre el plazo para reclamar.
      if (estado === EstadoSuborden.ENTREGADA) {
        // Serializa entrega y cierre: una entrega confirmada nunca queda fuera de su período.
        await manager.query('SELECT pg_advisory_xact_lock($1)', [BLOQUEO_SORTEOS]);
        suborden.actualizadoEn = await ahoraSorteos(manager);
        suborden.entregadaEn = suborden.actualizadoEn;
      }
      // save CON id (porque la suborden se cargó de la base) → ACTUALIZA la fila. Devuelve la suborden actualizada al front.
      return repo.save(suborden);
    });
  }

  /**
   * El comprador inicia un reclamo sobre una suborden entregada, dentro del plazo del
   * vendedor, indicando productos, cantidades y motivo. Queda PENDIENTE.
   */
  // INICIAR RECLAMO (comprador). POST /api/pedidos/subordenes/:id/reclamos.
  // MOLDE para validar una suborden del comprador: buscar → ¿existe y es mía? → ¿estado correcto? → ... → save.
  // LO LLAMA: orders.controller.ts → crearReclamo() con (id de la URL, req.user.idNegocio, dto del body).
  // dto.items y dto.motivo los arma FormularioReclamo en Reclamos.tsx.
  crearReclamo(idSuborden: number, idNegocio: number, dto: CrearReclamoDto) {
    return this.db.transaction(async (manager) => {
      // 1. ¿Existe la compra y es de quien reclama?
      const repo = manager.getRepository(Suborden);
      const suborden = await repo.findOne({
        where: { idSuborden },
        lock: { mode: 'pessimistic_write' },
      });
      // No existe O (||) no es de este comprador → 404.
      if (!suborden || suborden.idNegocioComprador !== idNegocio) {
        throw new NotFoundException('Pedido no encontrado.');
      }
      // 2. ¿Ya se entregó?
      // Solo se reclama si está ENTREGADA → si no, 409.
      if (EstadoSuborden.ENTREGADA !== suborden.estado) {
        throw new ConflictException('Solo se pueden reclamar órdenes entregadas.');
      }
      // 3. ¿Está dentro del plazo del vendedor?
      // Busca al vendedor para saber cuántos días de plazo da (diasReclamo).
      const vendedor = await manager.getRepository(Negocio).findOne({
        where: { idNegocio: suborden.idNegocioVendedor },
      });
      if (!vendedor) {
        throw new ConflictException('El vendedor ya no existe.');
      }
      if (!suborden.entregadaEn) {
        throw new ConflictException('No se conoce la fecha de entrega de este pedido.');
      }
      const unDia = 24 * 60 * 60 * 1000;
      // Fecha límite = fecha de entrega + días de plazo (en milisegundos).
      const limite = new Date(
        suborden.entregadaEn.getTime() + vendedor.diasReclamo * unDia,
      );
      const hoy = await ahoraSorteos(manager);
      // Si ya pasó la fecha límite → 409.
      if (hoy > limite) {
        throw new ConflictException('Venció el plazo para reclamar este pedido.');
      }

      // 4. ¿Los productos son de esta compra y las cantidades no se pasan?
      const reclamos = manager.getRepository(Reclamo);
      // Los reclamos que ya se hicieron sobre esta suborden.
      const anteriores = await reclamos.findBy({ idSuborden });
      const lineas: LineaPedido[] = [];
      let total = 0n;
      // Recorre cada producto que el comprador quiere reclamar (viene del body).
      for (const pedido of dto.items) {
        // find (de listas, no de la base): busca ese producto entre los comprados. undefined si no está.
        const comprado = suborden.items.find(
          (item) => item.idProducto === pedido.idProducto,
        );
        if (!comprado) {
          throw new BadRequestException('Uno de los productos no es de esta compra.');
        }
        // Unidades de este producto que ya se reclamaron. Los rechazados no cuentan.
        // Cadena de funciones de listas:
        // filter (saca los rechazados) → flatMap (junta todos los items) → filter (solo este producto) → reduce (suma las cantidades, arrancando en 0).
        const yaReclamadas = anteriores
          .filter((reclamo) => reclamo.estado !== EstadoReclamo.RECHAZADO)
          .flatMap((reclamo) => reclamo.items)
          .filter((item) => item.idProducto === pedido.idProducto)
          .reduce((suma, item) => suma + item.cantidad, 0);
        const disponibles = comprado.cantidad - yaReclamadas;
        // No podés reclamar más de lo que compraste menos lo ya reclamado → 400.
        if (pedido.cantidad > disponibles) {
          throw new BadRequestException(
            disponibles > 0
              ? `Podés reclamar como máximo ${disponibles} unidad(es) de ${comprado.nombre}.`
              : `Ya reclamaste todas las unidades de ${comprado.nombre}.`,
          );
        }
        // La nota de crédito usa el precio que se pagó, no el precio actual.
        const subtotal = centavos(comprado.precioUnitario) * BigInt(pedido.cantidad);
        total += subtotal;
        lineas.push({
          idProducto: comprado.idProducto,
          nombre: comprado.nombre,
          cantidad: pedido.cantidad,
          precioUnitario: comprado.precioUnitario,
          subtotal: importe(subtotal),
        });
      }

      // 5. Guardar el reclamo (arranca PENDIENTE).
      // Guarda el reclamo nuevo (sin id → crea). Estado PENDIENTE por default.
      // Izquierda = nombres de la entity Reclamo; derecha = de dónde sale cada dato.
      return reclamos.save(
        reclamos.create({
          idSuborden,
          idNegocioComprador: suborden.idNegocioComprador,
          idNegocioVendedor: suborden.idNegocioVendedor,
          items: lineas,
          motivo: dto.motivo,
          importe: importe(total),
        }),
      );
    });
  }

  /** El vendedor aprueba el reclamo y se genera la nota de crédito simulada. */
  // APROBAR RECLAMO (vendedor). PATCH /api/pedidos/reclamos/:id/aprobar.
  // LO LLAMA: orders.controller.ts → aprobarReclamo() con (id de la URL, req.user.idNegocio).
  aprobarReclamo(idReclamo: number, idNegocio: number) {
    return this.db.transaction(async (manager) => {
      // Función auxiliar de abajo: busca el reclamo y chequea que sea de este vendedor (si no, 404).
      const reclamo = await this.reclamoDelVendedor(manager, idReclamo, idNegocio);
      // Solo se responde un reclamo PENDIENTE.
      if (reclamo.estado !== EstadoReclamo.PENDIENTE) {
        throw new ConflictException('Este reclamo ya fue respondido.');
      }
      // MOLDE para editar: cambiás propiedades del objeto cargado y después save (actualiza).
      reclamo.estado = EstadoReclamo.APROBADO;
      reclamo.notaCredito = numeroNotaCredito(reclamo.idReclamo);
      reclamo.resueltoEn = await ahoraSorteos(manager);
      return manager.getRepository(Reclamo).save(reclamo);
    });
  }

  /**
   * El vendedor rechaza el reclamo con un motivo obligatorio. La suborden sigue
   * entregada y no cambian montos ni stock.
   */
  // RECHAZAR RECLAMO (vendedor). motivo viene del body (dto.motivo en el controller).
  // LO LLAMA: orders.controller.ts → rechazarReclamo() con (id, req.user.idNegocio, dto.motivo).
  rechazarReclamo(idReclamo: number, idNegocio: number, motivo: string) {
    return this.db.transaction(async (manager) => {
      const reclamo = await this.reclamoDelVendedor(manager, idReclamo, idNegocio);
      if (reclamo.estado !== EstadoReclamo.PENDIENTE) {
        throw new ConflictException('Este reclamo ya fue respondido.');
      }
      reclamo.estado = EstadoReclamo.RECHAZADO;
      reclamo.motivoRechazo = motivo;
      reclamo.resueltoEn = await ahoraSorteos(manager);
      return manager.getRepository(Reclamo).save(reclamo);
    });
  }

  /**
   * El vendedor confirma que recibió los productos devueltos de un reclamo aprobado:
   * recién ahí vuelve el stock. Los productos eliminados del catálogo se ignoran.
   */
  // El vendedor confirma que le devolvieron los productos → vuelve el stock.
  // LO LLAMA: orders.controller.ts → confirmarRecepcionReclamo() con (id, req.user.idNegocio).
  confirmarRecepcionReclamo(idReclamo: number, idNegocio: number) {
    return this.db.transaction(async (manager) => {
      const reclamo = await this.reclamoDelVendedor(manager, idReclamo, idNegocio);
      if (reclamo.estado !== EstadoReclamo.APROBADO) {
        throw new ConflictException(
          'Solo se puede confirmar la devolución de un reclamo aprobado.',
        );
      }
      for (const item of [...reclamo.items].sort((a, b) => a.idProducto - b.idProducto)) {
        // Movimiento de inventario: no cambia la versión del producto ni vacía carritos.
        await manager.query(
          'UPDATE producto SET stock = stock + $1 WHERE id_producto = $2',
          [item.cantidad, item.idProducto],
        );
      }
      reclamo.estado = EstadoReclamo.RECIBIDO;
      reclamo.recibidoEn = await ahoraSorteos(manager);
      return manager.getRepository(Reclamo).save(reclamo);
    });
  }

  // Busca y bloquea un reclamo del vendedor. Si es de otro negocio, responde 404.
  // Auxiliar reutilizada por las 3 funciones de arriba: evita repetir buscar + chequear dueño.
  // LA LLAMAN: aprobarReclamo, rechazarReclamo y confirmarRecepcionReclamo (este mismo archivo) con this.reclamoDelVendedor(manager, idReclamo, idNegocio).
  // this. = función de esta misma clase.
  private async reclamoDelVendedor(
    manager: EntityManager,
    idReclamo: number,
    idNegocio: number,
  ) {
    const reclamo = await manager.getRepository(Reclamo).findOne({
      where: { idReclamo },
      lock: { mode: 'pessimistic_write' },
    });
    if (!reclamo || reclamo.idNegocioVendedor !== idNegocio) {
      throw new NotFoundException('Reclamo no encontrado.');
    }
    return reclamo;
  }
}
