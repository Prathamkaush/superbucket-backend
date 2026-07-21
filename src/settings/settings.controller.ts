import {
  Controller,
  Get,
  Patch,
  Body,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from "@nestjs/common";
import { SettingsService } from "./settings.service";
import { FileInterceptor } from "@nestjs/platform-express";
import { diskStorage } from "multer";
import { extname } from "path";
import { mkdirSync } from "fs";
import { AdminGuard } from "../auth/admin.guard";
import { JwtAuthGuard } from "../auth/strategies/jwt-auth.guard";

// ✅ Swagger
import {
  ApiTags,
  ApiOperation,
  ApiConsumes,
  ApiBody,
} from "@nestjs/swagger";

@ApiTags("Settings")
@Controller("settings")
export class SettingsController {
  constructor(private readonly service: SettingsService) {}

  private static settingsStorage = diskStorage({
    destination: (_, __, callback) => {
      const uploadPath = "./uploads/settings";
      mkdirSync(uploadPath, { recursive: true });
      callback(null, uploadPath);
    },
    filename: (_, file, callback) => {
      const unique = Date.now() + "-" + Math.round(Math.random() * 1e9);
      callback(null, unique + extname(file.originalname));
    },
  });

  /* ================= GET ALL SETTINGS ================= */
  @ApiOperation({
    summary: "Get application settings",
    description: "Returns profile, store and general settings",
  })
  @Get()
  async getAll() {
    return this.service.getSettings();
  }

  /* ================= UPDATE PROFILE ================= */
  @ApiOperation({
    summary: "Update profile settings",
    description: "Update admin/store owner profile details",
  })
  @ApiBody({
    schema: {
      example: {
        name: "Admin Name",
        email: "admin@example.com",
        phone: "9999999999",
      },
    },
  })
  @Patch("profile")
  @UseGuards(JwtAuthGuard, AdminGuard)
  async updateProfile(@Body() body: any) {
    return this.service.updateProfile(body);
  }

  /* ================= UPDATE STORE (WITH LOGO UPLOAD) ================= */
  @ApiOperation({
    summary: "Update store settings",
    description: "Update store details and upload store logo",
  })
  @ApiConsumes("multipart/form-data")
  @ApiBody({
    schema: {
      type: "object",
      properties: {
        name: { type: "string", example: "FirstFemale Store" },
        tagline: { type: "string", example: "Fashion for Everyone" },
        logo: {
          type: "string",
          format: "binary",
        },
      },
    },
  })
  @Patch("store")
  @UseGuards(JwtAuthGuard, AdminGuard)
  @UseInterceptors(
    FileInterceptor("logo", {
      storage: SettingsController.settingsStorage,
    })
  )
  async updateStore(
    @UploadedFile() file: Express.Multer.File,
    @Body() body: any
  ) {
    return this.service.updateStore(body, file);
  }

  /* ================= UPDATE GENERAL SETTINGS ================= */
  @ApiOperation({
    summary: "Update general settings",
    description: "Update global application settings",
  })
  @ApiBody({
    schema: {
      example: {
        currency: "INR",
        supportEmail: "support@firstfemale.in",
        maintenanceMode: false,
      },
    },
  })
  @Patch("general")
  @UseGuards(JwtAuthGuard, AdminGuard)
  async updateGeneral(@Body() body: any) {
    return this.service.updateGeneral(body);
  }
}
