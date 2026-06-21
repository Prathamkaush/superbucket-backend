import {
  Controller,
  Get,
  Patch,
  Body,
  UseGuards,
  Req,
  BadRequestException,
  UploadedFile,
  UseInterceptors,
} from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import { diskStorage } from "multer";
import { mkdirSync } from "fs";
import { extname, join } from "path";
import { UsersService } from "./users.service";
import { JwtAuthGuard } from "../auth/strategies/jwt-auth.guard";
import { UpdateProfileDto } from "./dto/update-profile.dto";

// ✅ Swagger
import {
  ApiTags,
  ApiBearerAuth,
  ApiOperation,
  ApiBody,
  ApiConsumes,
} from "@nestjs/swagger";

@ApiTags("Users")
@ApiBearerAuth()
@Controller("users")
@UseGuards(JwtAuthGuard)
export class UsersController {
  constructor(private usersService: UsersService) {}

  private static profileImageStorage = diskStorage({
    destination: (_req, _file, cb) => {
      const uploadPath = join(process.cwd(), "uploads", "profiles");
      mkdirSync(uploadPath, { recursive: true });
      cb(null, uploadPath);
    },
    filename: (_req, file, cb) => {
      const uniqueName = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
      cb(null, `${uniqueName}${extname(file.originalname).toLowerCase()}`);
    },
  });

  /* ================= GET PROFILE ================= */
  @ApiOperation({
    summary: "Get user profile",
    description: "Returns the authenticated user's profile details",
  })
  @Get("profile")
  getProfile(@Req() req: any) {
    return this.usersService.getProfile(req.user.id);
  }

  /* ================= UPDATE PROFILE ================= */
  @ApiOperation({
    summary: "Update user profile",
    description: "Update the authenticated user's profile",
  })
  @ApiConsumes("multipart/form-data")
  @ApiBody({ type: UpdateProfileDto })
  @UseInterceptors(
    FileInterceptor("image", {
      storage: UsersController.profileImageStorage,
      limits: { fileSize: 5 * 1024 * 1024 },
      fileFilter: (_req, file, cb) => {
        const allowedTypes = ["image/jpeg", "image/png", "image/webp"];
        if (!allowedTypes.includes(file.mimetype)) {
          return cb(
            new BadRequestException("Profile image must be a JPEG, PNG, or WebP file"),
            false,
          );
        }
        cb(null, true);
      },
    }),
  )
  @Patch("profile")
  updateProfile(
    @Req() req: any,
    @Body() body: UpdateProfileDto,
    @UploadedFile() image?: Express.Multer.File,
  ) {
    return this.usersService.updateProfile(req.user.id, body, image?.filename);
  }

  /* ================= UPDATE BANK DETAILS ================= */
  @ApiOperation({
    summary: "Update user bank details",
    description: "Update account number, IFSC code, and account holder name",
  })
  @Patch("bank")
  updateBankDetails(
    @Req() req: any,
    @Body("bankAccountNumber") bankAccountNumber: string,
    @Body("bankIfsc") bankIfsc: string,
    @Body("bankAccountName") bankAccountName: string,
  ) {
    return this.usersService.updateBankDetails(
      req.user.id,
      bankAccountNumber,
      bankIfsc,
      bankAccountName,
    );
  }
}
