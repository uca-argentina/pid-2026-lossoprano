/**
 * Rutas de confirmación, compras, ventas, transiciones de subórdenes y reclamos.
 * Las ventas exigen rol vendedor; cambiar un estado exige ser parte de esa suborden y
 * respetar las reglas del servicio.
 */

import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Request,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { RolCliente } from '../users/user.entity';
import { CambiarEstadoDto, ConfirmarPedidoDto } from './dto/confirmar-pedido.dto';
import { CrearReclamoDto, RechazarReclamoDto } from './dto/reclamo.dto';
import { PedidosService } from './orders.service';

// Tipo de 'req': describe que trae user con sub (id del usuario) e idNegocio.
// req.user lo llena JwtStrategy.validate con los datos del TOKEN. No es lo que manda el front en el body.
type Solicitud = { user: { sub: number; idNegocio: number } };

// CONTROLLER: recibe la petición HTTP y llama al service. No tiene lógica ni toca la base.
// Todas las rutas de esta clase empiezan con /api/pedidos.
@Controller('pedidos')
// Exige token en TODAS las rutas de esta clase. Sin token o vencido → 401.
@UseGuards(JwtAuthGuard)
export class PedidosController {
  // Nest le pasa el PedidosService; queda en this.pedidos.
  constructor(private readonly pedidos: PedidosService) {}
  // POST /api/pedidos → confirma la compra del carrito.
  // req.user.sub = id del USUARIO (no del negocio).
  @Post()
  confirmar(@Request() req: Solicitud, @Body() dto: ConfirmarPedidoDto) {
    // → orders.service.ts, función confirmar(idCliente, dto).
    //   req.user.sub (del TOKEN) → idCliente · dto (del BODY) → dto.
    // Lo llama el front: api.confirmarPedido (api.ts).
    return this.pedidos.confirmar(req.user.sub, dto);
  }
  // GET /api/pedidos/compras → las compras del negocio logueado (comprador).
  // No tiene @Param ni @Body: lo único que necesita es quién está logueado (req.user.idNegocio).
  @Get('compras')
  compras(@Request() req: Solicitud) {
    // → orders.service.ts, listarCompras(idNegocio). req.user.idNegocio (TOKEN) → idNegocio.
    // Lo llama el front: api.misCompras (api.ts) desde cargar() de Pedidos.tsx.
    return this.pedidos.listarCompras(req.user.idNegocio);
  }
  // GET /api/pedidos/ventas → las subórdenes que recibió el vendedor logueado.
  @Get('ventas')
  // Estas dos líneas: solo VENDEDOR. Un comprador recibe 403.
  @UseGuards(RolesGuard)
  @Roles(RolCliente.VENDEDOR)
  ventas(@Request() req: Solicitud) {
    // → orders.service.ts, listarVentas(idNegocio). Front: api.misVentas desde Pedidos.tsx.
    return this.pedidos.listarVentas(req.user.idNegocio);
  }
  // El servicio decide qué cambios puede hacer el vendedor y cuáles el comprador de la suborden.
  // PATCH /api/pedidos/subordenes/12/estado → cambia el estado de la suborden 12.
  // :id es una variable de la URL.
  @Patch('subordenes/:id/estado')
  cambiarEstado(
    // @Param('id') agarra el :id de la URL. ParseIntPipe lo convierte de texto ('12') a número (12); si no es número → 400.
    @Param('id', ParseIntPipe) id: number,
    // @Request() = la petición completa. De acá sale req.user.idNegocio (del token).
    @Request() req: Solicitud,
    // @Body() = el body JSON, validado con el DTO. Acá: { estado: 'CONFIRMADA' }.
    @Body() dto: CambiarEstadoDto,
  ) {
    // Le pasa al service: (id de la URL, negocio del token, estado del body). El ORDEN tiene que coincidir con los parámetros del service.
    return this.pedidos.cambiarEstado(id, req.user.idNegocio, dto.estado);
  }

  // El comprador inicia un reclamo sobre una de sus subórdenes entregadas.
  // POST /api/pedidos/subordenes/:id/reclamos → el comprador inicia un reclamo.
  // MOLDE para cualquier POST sobre una suborden: @Param + @Request + @Body → service(id, req.user.idNegocio, dto).
  @Post('subordenes/:id/reclamos')
  crearReclamo(
    @Param('id', ParseIntPipe) id: number,
    @Request() req: Solicitud,
    @Body() dto: CrearReclamoDto,
  ) {
    // → orders.service.ts, crearReclamo(idSuborden, idNegocio, dto).
    //   id (URL :id) → idSuborden · req.user.idNegocio (TOKEN) → idNegocio · dto (BODY) → dto.
    // Front: api.crearReclamo (api.ts) desde Reclamos.tsx.
    return this.pedidos.crearReclamo(id, req.user.idNegocio, dto);
  }

  // Las tres acciones siguientes son del vendedor que recibió el reclamo.
  // PATCH sin @Body: no hace falta mandar datos, la acción está en la ruta.
  @Patch('reclamos/:id/aprobar')
  @UseGuards(RolesGuard)
  @Roles(RolCliente.VENDEDOR)
  aprobarReclamo(@Param('id', ParseIntPipe) id: number, @Request() req: Solicitud) {
    // → orders.service.ts, aprobarReclamo(idReclamo, idNegocio). id = :id de la URL (acá es id de RECLAMO, no de suborden).
    return this.pedidos.aprobarReclamo(id, req.user.idNegocio);
  }

  // Rechazar sí lleva body: { motivo }. Al service le pasa solo dto.motivo.
  @Patch('reclamos/:id/rechazar')
  @UseGuards(RolesGuard)
  @Roles(RolCliente.VENDEDOR)
  rechazarReclamo(
    @Param('id', ParseIntPipe) id: number,
    @Request() req: Solicitud,
    @Body() dto: RechazarReclamoDto,
  ) {
    // → orders.service.ts, rechazarReclamo(idReclamo, idNegocio, motivo). dto.motivo sale del BODY { motivo }.
    return this.pedidos.rechazarReclamo(id, req.user.idNegocio, dto.motivo);
  }

  @Patch('reclamos/:id/recepcion')
  @UseGuards(RolesGuard)
  @Roles(RolCliente.VENDEDOR)
  confirmarRecepcionReclamo(
    @Param('id', ParseIntPipe) id: number,
    @Request() req: Solicitud,
  ) {
    // → orders.service.ts, confirmarRecepcionReclamo(idReclamo, idNegocio).
    return this.pedidos.confirmarRecepcionReclamo(id, req.user.idNegocio);
  }
}
