import { BadRequestException, Body, Controller, Delete, Get, NotFoundException, Param, Patch, Post, Query, Req, Res, UploadedFile, UseGuards, UseInterceptors } from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import { diskStorage } from "multer";
import { existsSync, mkdirSync } from "fs";
import { basename, extname, join } from "path";
import type { Response } from "express";
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

  @Get("notification-images/:filename")
  getNotificationImage(@Param("filename") filename: string, @Res() response: Response) {
    const safeFilename = basename(filename);
    if (safeFilename !== filename) throw new BadRequestException("Invalid image filename");

    const filePath = join(process.cwd(), "uploads", "notifications", safeFilename);
    if (!existsSync(filePath)) throw new NotFoundException("Notification image not found");

    response.setHeader("Cache-Control", "public, max-age=31536000, immutable");
    return response.sendFile(filePath);
  }

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

  @UseGuards(JwtAuthGuard)
  @Delete("notifications/:id")
  deleteMine(@Req() req: any, @Param("id") id: string) {
    return this.notifications.deleteMine(req.user.id, Number(id));
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
      imageUrl: image ? `/notification-images/${image.filename}` : undefined,
      audience: (dto.audience || "ALL") as NotificationAudience,
    });
  }
}
