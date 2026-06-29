import { Body, Controller, Get, Param, ParseIntPipe, Patch, Req, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
import { DeliveryPartnerGuard } from "../auth/admin.guard";
import { JwtAuthGuard } from "../auth/strategies/jwt-auth.guard";
import { DeliveryPartnerService } from "./delivery-partner.service";

@ApiTags("Delivery Partner")
@ApiBearerAuth("JWT-auth")
@UseGuards(JwtAuthGuard, DeliveryPartnerGuard)
@Controller("delivery-partner")
export class DeliveryPartnerController {
  constructor(private readonly service: DeliveryPartnerService) {}

  @ApiOperation({ summary: "Ready-to-pick orders dispatched by shop pickers" })
  @Get("orders/ready")
  getReadyOrders(@Req() req: any) {
    return this.service.getReadyOrders(req.user);
  }

  @ApiOperation({ summary: "Orders assigned to the logged-in delivery partner" })
  @Get("orders/my")
  getMyOrders(@Req() req: any) {
    return this.service.getMyOrders(req.user);
  }

  @ApiOperation({ summary: "Accept a ready order for delivery" })
  @Patch("orders/:id/accept")
  acceptOrder(@Param("id", ParseIntPipe) id: number, @Req() req: any) {
    return this.service.acceptOrder(id, req.user);
  }

  @ApiOperation({ summary: "Update live delivery partner location for an order" })
  @Patch("orders/:id/location")
  updateLocation(
    @Param("id", ParseIntPipe) id: number,
    @Req() req: any,
    @Body()
    body: {
      latitude: number;
      longitude: number;
      deliveryPartnerName?: string;
      deliveryPartnerPhone?: string;
    },
  ) {
    return this.service.updateLocation(id, req.user, body);
  }

  @ApiOperation({ summary: "Mark delivery as completed" })
  @Patch("orders/:id/delivered")
  markDelivered(
    @Param("id", ParseIntPipe) id: number,
    @Req() req: any,
    @Body() body: { otp?: string },
  ) {
    return this.service.markDelivered(id, req.user, body.otp);
  }
}
