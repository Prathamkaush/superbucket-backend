import {
  Controller,
  Get,
  Post,
  Put,
  Body,
  Param,
  UseGuards,
  Req,
  Query,
  BadRequestException,
  UnauthorizedException,
} from "@nestjs/common";
import { OrdersService } from "./orders.service";
import { JwtAuthGuard } from "../auth/strategies/jwt-auth.guard";
import { UpdateOrderStatusDto } from "./dto/update-order-status.dto";
import {PreviewOrderDto} from "./dto/preview-order.dto"
import { AdminGuard } from "../auth/admin.guard";

// ✅ Swagger imports
import {
  ApiTags,
  ApiOperation,
  ApiBearerAuth,
  ApiQuery,
  ApiParam,
  ApiBody,
  ApiUnauthorizedResponse,
  ApiForbiddenResponse,
  ApiBadRequestResponse,
} from "@nestjs/swagger";

@ApiTags("Orders")
@Controller("orders")
export class OrdersController {
  constructor(private readonly ordersService: OrdersService) {
    console.log("✅ OrdersController initialized");
  }

  // ================= USER ROUTES =================

  @ApiOperation({
    summary: "Get my orders",
    description: "Returns paginated list of orders for the logged-in user",
  })
  @ApiBearerAuth("JWT-auth")
  @ApiQuery({ name: "page", required: false, example: 1 })
  @ApiQuery({ name: "limit", required: false, example: 5 })
  @ApiUnauthorizedResponse({ description: "Unauthorized" })
  @UseGuards(JwtAuthGuard)
  @Get("my")
  getMyOrders(@Req() req: any, @Query() query: any) {
    const page = Number(query.page) || 1;
    const limit = Number(query.limit) || 5;

    return this.ordersService.getMyOrders(req.user.id, page, limit);
  }

  @ApiOperation({
    summary: "Get my order by ID",
    description: "Fetch a single order belonging to the logged-in user",
  })
  @ApiBearerAuth("JWT-auth")
  @ApiParam({ name: "id", example: 12 })
  @ApiUnauthorizedResponse({ description: "Unauthorized" })
  @ApiBadRequestResponse({ description: "Invalid order id" })
  @UseGuards(JwtAuthGuard)
  @Get("my/:id")
  getMyOrderById(@Param("id") id: string, @Req() req: any) {
    const orderId = Number(id);
    if (isNaN(orderId)) {
      throw new BadRequestException("Invalid order id");
    }

    return this.ordersService.getMyOrderById(orderId, req.user.id);
  }

  // ================= ADMIN ROUTES =================

  @ApiOperation({
    summary: "Get all orders (Admin)",
    description: "Admin-only endpoint to fetch all orders with filters",
  })
  @ApiBearerAuth("JWT-auth")
  @ApiUnauthorizedResponse({ description: "Unauthorized" })
  @ApiForbiddenResponse({ description: "Admin access required" })
  @UseGuards(JwtAuthGuard, AdminGuard)
  @Get()
  getAll(@Query() query: any) {
    return this.ordersService.getAll(query);
  }

  @ApiOperation({
    summary: "Get order by ID (Admin)",
    description: "Admin-only access to fetch any order",
  })
  @ApiBearerAuth("JWT-auth")
  @ApiParam({ name: "id", example: 15 })
  @ApiBadRequestResponse({ description: "Invalid order id" })
  @ApiUnauthorizedResponse({ description: "Unauthorized" })
  @ApiForbiddenResponse({ description: "Admin access required" })
  @UseGuards(JwtAuthGuard, AdminGuard)
  @Get(":id")
  getOne(@Param("id") id: string) {
    const orderId = Number(id);
    if (isNaN(orderId)) {
      throw new BadRequestException("Invalid order id");
    }

    return this.ordersService.getOne(orderId);
  }

  @ApiOperation({
    summary: "Update order status (Admin)",
    description: "Admin-only endpoint to update order status",
  })
  @ApiBearerAuth("JWT-auth")
  @ApiParam({ name: "id", example: 15 })
  @ApiBody({ type: UpdateOrderStatusDto })
  @ApiUnauthorizedResponse({ description: "Unauthorized" })
  @ApiForbiddenResponse({ description: "Admin access required" })
  @ApiBadRequestResponse({ description: "Invalid order id" })
  @UseGuards(JwtAuthGuard, AdminGuard)
  @Put(":id/status")
  updateStatus(
    @Param("id") id: string,
    @Body() dto: UpdateOrderStatusDto
  ) {
    const orderId = Number(id);
    if (isNaN(orderId)) {
      throw new BadRequestException("Invalid order id");
    }

    return this.ordersService.updateStatus(orderId, dto.status);
  }

  // ================= USER ACTIONS =================

  @ApiOperation({
    summary: "Place order",
    description: "Create a new order using cart items and delivery address",
  })
  @ApiBearerAuth("JWT-auth")
  @ApiBody({
    schema: {
      example: {
        address: {
          name: "Pratham",
          street: "MG Road",
          city: "Delhi",
          state: "Delhi",
          pincode: "110001",
          phone: "9999999999",
        },
        paymentMethod: "COD",
        couponCode: "WELCOME10"
      },
    },
  })
  @ApiUnauthorizedResponse({ description: "Unauthorized" })
  @ApiBadRequestResponse({ description: "Invalid request" })
  @UseGuards(JwtAuthGuard)
@Post()
placeOrder(
  @Req() req: any,
  @Body()
  body: {
    address?: any;
    addressId?: number;
    paymentMethod: "COD" | "RAZORPAY";
    couponCode?: string;
  }
) {
  if (!req.user?.id) {
    throw new UnauthorizedException("User not authenticated");
  }

  if (!body.address && !body.addressId) {
    throw new BadRequestException("Address or addressId is required");
  }

  if (!["COD", "RAZORPAY"].includes(body.paymentMethod)) {
    throw new BadRequestException("Invalid payment method");
  }

  return this.ordersService.createOrder(
    req.user.id,
    {
      address: body.address,
      addressId: body.addressId,
      paymentMethod: body.paymentMethod,
      couponCode: body.couponCode,
    }
  );
}


  @ApiOperation({
    summary: "Cancel order",
    description: "Allows user to cancel their order if allowed",
  })
  @ApiBearerAuth("JWT-auth")
  @ApiParam({ name: "id", example: 22 })
  @ApiBadRequestResponse({ description: "Invalid order id" })
  @ApiUnauthorizedResponse({ description: "Unauthorized" })
  @UseGuards(JwtAuthGuard)
  @Put(":id/cancel")
  cancelOrder(@Param("id") id: string, @Req() req: any) {
    const orderId = Number(id);
    if (isNaN(orderId)) {
      throw new BadRequestException("Invalid order id");
    }

    return this.ordersService.cancelOrder(orderId, req.user.id);
  }

  @ApiOperation({
    summary: "Reorder",
    description: "Reorder items from a previous order",
  })
  @ApiBearerAuth("JWT-auth")
  @ApiParam({ name: "id", example: 22 })
  @ApiBadRequestResponse({ description: "Invalid order id" })
  @ApiUnauthorizedResponse({ description: "Unauthorized" })
  @UseGuards(JwtAuthGuard)
  @Post(":id/reorder")
  reorder(@Param("id") id: string, @Req() req: any) {
    const orderId = Number(id);
    if (isNaN(orderId)) {
      throw new BadRequestException("Invalid order id");
    }

    return this.ordersService.reorder(orderId, req.user.id);
  }

  @UseGuards(JwtAuthGuard)
@Post("preview")
previewOrder(
  @Req() req: any,
  @Body()
  body: {
    address?: any;
    addressId?: number;
    paymentMethod: "COD" | "RAZORPAY";
    couponCode?: string;
  }
) {
  if (!body.address && !body.addressId) {
    throw new BadRequestException("Address or addressId is required");
  }

  if (!body.paymentMethod) {
    throw new BadRequestException("Payment method is required");
  }

  return this.ordersService.previewOrder(
    req.user.id,
    {
      address: body.address,
      addressId: body.addressId,
    },
    body.paymentMethod,
    body.couponCode
  );
}

}