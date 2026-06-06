import { 
  Controller, 
  Get, 
  Post, 
  UploadedFile, 
  UseGuards, 
  UseInterceptors,
  BadRequestException 
} from "@nestjs/common";
import { JwtAuthGuard } from "../auth/strategies/jwt-auth.guard";
import { AdminGuard } from "../auth/admin.guard";
import { PrismaService } from "../prisma/prisma.service";
import { FileInterceptor } from "@nestjs/platform-express";
import { diskStorage } from "multer";
import * as fs from "fs";
import * as path from "path";

@Controller("admin/media")
@UseGuards(JwtAuthGuard, AdminGuard)
export class AdminMediaController {
  constructor(private prisma: PrismaService) {}

  @Get()
  getAllMedia() {
    return this.prisma.media.findMany({
      orderBy: { createdAt: "desc" },
    });
  }

  @Post()
  @UseInterceptors(
    FileInterceptor("file", {
      storage: diskStorage({
        destination: (req, file, cb) => {
          const isVideo = file.mimetype.startsWith("video/");
          const dir = isVideo 
            ? "uploads/homepage/videos" 
            : "uploads/homepage/images";
          
          // ✅ Ensure directory exists
          if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
          }
          
          cb(null, dir);
        },
        filename: (req, file, cb) => {
          // ✅ Sanitize filename and add timestamp
          const sanitized = file.originalname.replace(/[^a-zA-Z0-9.-]/g, "_");
          cb(null, `${Date.now()}-${sanitized}`);
        },
      }),
      limits: {
        fileSize: 10 * 1024 * 1024, // 10MB limit (adjust as needed)
      },
      fileFilter: (req, file, cb) => {
        // ✅ Validate file types
        const allowedMimeTypes = [
          'image/jpeg',
          'image/jpg', 
          'image/png',
          'image/gif',
          'image/webp',
          'video/mp4',
          'video/webm',
          'video/quicktime', // for .mov files
        ];

        if (allowedMimeTypes.includes(file.mimetype)) {
          cb(null, true);
        } else {
          cb(new BadRequestException(`File type ${file.mimetype} not supported`), false);
        }
      },
    })
  )
  async uploadMedia(@UploadedFile() file: Express.Multer.File) {
    if (!file) {
      throw new BadRequestException("No file uploaded");
    }

    console.log("📁 File uploaded:", {
      originalname: file.originalname,
      mimetype: file.mimetype,
      size: file.size,
      path: file.path,
    });

    const isVideo = file.mimetype.startsWith("video/");
    
    // ✅ Store relative path in database (without 'uploads' prefix if you're serving it with express.static)
    const url = `/uploads/homepage/${isVideo ? "videos" : "images"}/${file.filename}`;

    const media = await this.prisma.media.create({
      data: {
        type: isVideo ? "VIDEO" : "IMAGE",
        url: url,
        mimeType: file.mimetype,
        size: file.size,
      },
    });

    console.log("✅ Media saved to DB:", media);

    return media;
  }
}