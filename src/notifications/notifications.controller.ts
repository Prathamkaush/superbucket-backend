import { Body, Controller, Get, Param, Patch, Post, Query, Req, UseGuards } from "@nestjs/common";
import { NotificationAudience } from "@prisma/client";
import { AdminGuard } from "../auth/admin.guard";
import { JwtAuthGuard } from "../auth/strategies/jwt-auth.guard";
import { AdminBroadcastNotificationDto } from "./dto/admin-broadcast-notification.dto";
import { RegisterDeviceTokenDto } from "./dto/register-device-token.dto";
import { NotificationsService } from "./notifications.service";

@Controller()
export class NotificationsController {
  constructor(private readonly notifications: NotificationsService) {}

  @UseGuards(JwtAuthGuard)
  @Post("notifications/devices")
  registerDevice(@Req() req: any, @Body() dto: RegisterDeviceTokenDto) {
    return this.notifications.registerDeviceToken(req.user.id, dto);
  }

  @UseGuards(JwtAuthGuard)
  @Get("notifications/my")
  listMine(@Req() req: any, @Query("page") page?: string, @Query("limit") limit?: string) {
    return this.notifications.listMine(req.user.id, Number(page) || 1, Number(limit) || 30);
  }

  @UseGuards(JwtAuthGuard)
  @Patch("notifications/:id/read")
  markRead(@Req() req: any, @Param("id") id: string) {
    return this.notifications.markRead(req.user.id, Number(id));
  }

  @UseGuards(JwtAuthGuard)
  @Patch("notifications/read-all")
  markAllRead(@Req() req: any) {
    return this.notifications.markAllRead(req.user.id);
  }

  @UseGuards(JwtAuthGuard, AdminGuard)
  @Post("admin/notifications/broadcast")
  broadcast(@Req() req: any, @Body() dto: AdminBroadcastNotificationDto) {
    return this.notifications.adminBroadcast(req.user.id, {
      ...dto,
      audience: (dto.audience || "ALL") as NotificationAudience,
    });
  }
}
