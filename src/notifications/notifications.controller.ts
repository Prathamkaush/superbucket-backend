import { BadRequestException, Body, Controller, Get, Param, Patch, Post, Query, Req, UploadedFile, UseGuards, UseInterceptors } from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import { diskStorage } from "multer";
import { mkdirSync } from "fs";
import { extname, join } from "path";
import { NotificationAudience } from "@prisma/client";
import { AdminGuard } from "../auth/admin.guard";
import { JwtAuthGuard } from "../auth/strategies/jwt-auth.guard";
import { AdminBroadcastNotificationDto } from "./dto/admin-broadcast-notification.dto";
import { RegisterDeviceTokenDto } from "./dto/register-device-token.dto";
import { NotificationsService } from "./notifications.service";

@Controller()
export class NotificationsController {
  constructor(private readonly notifications: NotificationsService) {}

  private static imageStorage = diskStorage({
    destination: (_req, _file, cb) => {
      const uploadPath = join(process.cwd(), "uploads", "notifications");
      mkdirSync(uploadPath, { recursive: true });
      cb(null, uploadPath);
    },
    filename: (_req, file, cb) => {
      const unique = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
      cb(null, unique + extname(file.originalname).toLowerCase());
    },
  });

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
  @UseInterceptors(FileInterceptor("image", {
    storage: NotificationsController.imageStorage,
    limits: { fileSize: 10 * 1024 * 1024 },
    fileFilter: (_req, file, cb) => {
      if (!file.mimetype.startsWith("image/")) {
        return cb(new BadRequestException("Only image files are allowed"), false);
      }
      cb(null, true);
    },
  }))
  broadcast(@Req() req: any, @Body() dto: AdminBroadcastNotificationDto, @UploadedFile() image?: Express.Multer.File) {
    return this.notifications.adminBroadcast(req.user.id, {
      ...dto,
      imageUrl: image ? `/uploads/notifications/${image.filename}` : undefined,
      audience: (dto.audience || "ALL") as NotificationAudience,
    });
  }
}
