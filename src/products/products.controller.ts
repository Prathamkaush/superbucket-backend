import {
  Controller,
  Post,
  Get,
  Delete,
  Body,
  Param,
  ParseIntPipe,
  Query,
  UseInterceptors,
  UploadedFiles,
  UseGuards,
  Put,
  Patch,
  BadRequestException,
  UploadedFile,
  Res,
} from "@nestjs/common";
import { FileInterceptor } from '@nestjs/platform-express';
import { Response } from 'express';
import { ProductsService } from "./products.service";
import { FileFieldsInterceptor } from "@nestjs/platform-express";
import { diskStorage } from "multer";
import { extname, join } from "path";
import { JwtAuthGuard } from "../auth/strategies/jwt-auth.guard";
import { AdminGuard } from "../auth/admin.guard";
import { UpdateProductSeoDto } from "./dto/update-product-seo.dto";

import {
  ApiTags,
  ApiOperation,
  ApiBearerAuth,
  ApiConsumes,
  ApiBody,
  ApiParam,
  ApiQuery,
  ApiUnauthorizedResponse,
} from "@nestjs/swagger";

@ApiTags("Products")
@Controller("products")
export class ProductsController {
  constructor(private readonly productsService: ProductsService) {}

  // ================= CREATE PRODUCT =================
  @ApiBearerAuth("JWT-auth")
  @ApiOperation({ summary: "Create a new product (Admin)" })
  @ApiConsumes("multipart/form-data")
  @UseGuards(JwtAuthGuard, AdminGuard)
  @UseInterceptors(
    FileFieldsInterceptor(
      [
        { name: "image1", maxCount: 1 },
        { name: "image2", maxCount: 1 },
        { name: "image3", maxCount: 1 },
        { name: "image4", maxCount: 1 },
      ],
      {
        storage: diskStorage({
          destination: join(process.cwd(), "uploads", "products"),
          filename: (_, file, cb) => {
            const unique = Date.now() + "-" + Math.round(Math.random() * 1e9);
            cb(null, unique + extname(file.originalname));
          },
        }),
      }
    )
  )
  @Post()
  create(@UploadedFiles() files: any, @Body() body: any) {
    return this.productsService.create(body, files);
  }

  // ================= LIST PRODUCTS =================
  @ApiOperation({ summary: "Get products (search, filter, pagination)" })
  @Get()
  findAll(@Query() query: any) {
    return this.productsService.findAll(query);
  }

  // ================= HOME ROUTES (STATIC FIRST) =================
  @ApiOperation({ summary: "Homepage trending products" })
  @Get("home/trending")
  getHomeTrending(@Query("limit") limit?: string) {
    return this.productsService.getHomeTrending(limit ? Number(limit) : 8);
  }

  @ApiOperation({ summary: "Homepage discount products" })
  @Get("home/discounts")
  getHomeDiscounts(@Query("limit") limit?: string) {
    return this.productsService.getHomeDiscounts(limit ? Number(limit) : 8);
  }

  // ================= ADMIN LOW STOCK =================
  @ApiBearerAuth("JWT-auth")
  @ApiOperation({ summary: "Low stock products (Admin)" })
  @UseGuards(JwtAuthGuard, AdminGuard)
  @Get("admin/low-stock")
  getLowStock(@Query("threshold") threshold?: string) {
    return this.productsService.getLowStock(threshold ? Number(threshold) : 5);
  }

  // ================= GET BY ID OR SLUG =================
  @ApiOperation({ summary: "Get product by ID or slug" })
  @Get(":identifier")
  findOneOrBySlug(@Param("identifier") identifier: string) {
    if (/^\d+$/.test(identifier)) {
      return this.productsService.findOne(Number(identifier));
    }
    return this.productsService.findBySlug(identifier);
  }

  // ================= UPDATE PRODUCT =================
  @ApiBearerAuth("JWT-auth")
  @ApiOperation({ summary: "Update product (Admin)" })
  @ApiConsumes("multipart/form-data")
  @UseGuards(JwtAuthGuard, AdminGuard)
  @UseInterceptors(
    FileFieldsInterceptor(
      [
        { name: "image1", maxCount: 1 },
        { name: "image2", maxCount: 1 },
        { name: "image3", maxCount: 1 },
        { name: "image4", maxCount: 1 },
      ],
      {
        storage: diskStorage({
          destination: join(process.cwd(), "uploads", "products"),
          filename: (_, file, cb) => {
            const unique = Date.now() + "-" + Math.round(Math.random() * 1e9);
            cb(null, unique + extname(file.originalname));
          },
        }),
      }
    )
  )
  @Patch(":id")
  update(
    @Param("id", ParseIntPipe) id: number,
    @UploadedFiles() files: any,
    @Body() body: any
  ) {
    return this.productsService.update(id, body, files);
  }

  // ================= DELETE PRODUCT =================
  @ApiBearerAuth("JWT-auth")
  @ApiOperation({ summary: "Delete product (Admin)" })
  @UseGuards(JwtAuthGuard, AdminGuard)
  @Delete(":id")
  remove(@Param("id", ParseIntPipe) id: number) {
    return this.productsService.remove(id);
  }

  // ================= UPDATE STOCK =================
  @ApiBearerAuth("JWT-auth")
  @ApiOperation({ summary: "Update product stock (Admin)" })
  @UseGuards(JwtAuthGuard, AdminGuard)
  @Patch(":id/stock")
  updateStock(
    @Param("id", ParseIntPipe) id: number,
    @Body("stock", ParseIntPipe) stock: number
  ) {
    return this.productsService.updateStock(id, stock);
  }

  // ================= UPDATE PRODUCT SEO =================
  @ApiBearerAuth("JWT-auth")
  @ApiOperation({ summary: "Update product SEO (Admin)" })
  @UseGuards(JwtAuthGuard, AdminGuard)
  @Patch(":id/seo")
  updateSeo(
    @Param("id", ParseIntPipe) id: number,
    @Body() dto: UpdateProductSeoDto
  ) {
    return this.productsService.updateSeo(id, dto);
  }

// ----------------------------------
// BULK UPLOAD WITH IMAGES
// ----------------------------------
@Post('bulk-upload-enhanced')
@UseInterceptors(
  FileFieldsInterceptor(
    [
      { name: 'dataFile', maxCount: 1 },
      { name: 'imageZip', maxCount: 1 },
    ],
    {
      storage: diskStorage({
        destination: './uploads/bulk',
        filename: (req, file, cb) => {
          const uniqueName = `${Date.now()}-${file.originalname}`;
          cb(null, uniqueName);
        },
      }),
      fileFilter: (req, file, cb) => {
        if (file.fieldname === 'dataFile') {
          const allowedTypes = [
            'text/csv',
            'application/vnd.ms-excel',
            'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          ];
 
          if (allowedTypes.includes(file.mimetype)) {
            cb(null, true);
          } else {
            cb(
              new BadRequestException(
                'Data file must be CSV or Excel format',
              ),
              false,
            );
          }
        } else if (file.fieldname === 'imageZip') {
          if (
            file.mimetype === 'application/zip' ||
            file.mimetype === 'application/x-zip-compressed'
          ) {
            cb(null, true);
          } else {
            cb(
              new BadRequestException('Image file must be ZIP format'),
              false,
            );
          }
        } else {
          cb(new BadRequestException('Invalid field name'), false);
        }
      },
      limits: {
        fileSize: 50 * 1024 * 1024, // 50MB total limit
      },
    },
  ),
)
async bulkUploadEnhanced(
  @UploadedFiles()
  files: {
    dataFile?: Express.Multer.File[];
    imageZip?: Express.Multer.File[];
  },
) {
  if (!files.dataFile || files.dataFile.length === 0) {
    throw new BadRequestException('Please upload a data file (CSV or Excel)');
  }
 
  const dataFile = files.dataFile[0];
  const imageZip = files.imageZip?.[0];
 
  const results = await this.productsService.bulkUploadWithImages(
    dataFile,
    imageZip,
  );
 
  return {
    success: true,
    message: `Processed ${results.total} products: ${results.successful} successful, ${results.failed} failed`,
    data: {
      ...results,
      imageInfo: imageZip
        ? {
            totalImages: results.imageStats.total,
            usedImages: results.imageStats.used,
            unusedImages: results.imageStats.unused.length,
            unusedImagesList: results.imageStats.unused,
          }
        : null,
    },
  };
}
 
// ----------------------------------
// VALIDATE BULK UPLOAD WITH IMAGES
// ----------------------------------
@Post('bulk-upload-enhanced/validate')
@UseInterceptors(
  FileFieldsInterceptor(
    [
      { name: 'dataFile', maxCount: 1 },
      { name: 'imageZip', maxCount: 1 },
    ],
    {
      storage: diskStorage({
        destination: './uploads/bulk',
        filename: (req, file, cb) => {
          const uniqueName = `${Date.now()}-${file.originalname}`;
          cb(null, uniqueName);
        },
      }),
      fileFilter: (req, file, cb) => {
        if (file.fieldname === 'dataFile') {
          const allowedTypes = [
            'text/csv',
            'application/vnd.ms-excel',
            'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          ];
          cb(null, allowedTypes.includes(file.mimetype));
        } else if (file.fieldname === 'imageZip') {
          cb(
            null,
            file.mimetype === 'application/zip' ||
              file.mimetype === 'application/x-zip-compressed',
          );
        }
      },
      limits: {
        fileSize: 50 * 1024 * 1024,
      },
    },
  ),
)
async validateBulkUploadEnhanced(
  @UploadedFiles()
  files: {
    dataFile?: Express.Multer.File[];
    imageZip?: Express.Multer.File[];
  },
) {
  if (!files.dataFile || files.dataFile.length === 0) {
    throw new BadRequestException('Please upload a data file');
  }
 
  const dataFile = files.dataFile[0];
  const imageZip = files.imageZip?.[0];
 
  const results = await this.productsService.validateBulkUploadWithImages(
    dataFile,
    imageZip,
  );
 
  return {
    success: true,
    message: `Validation complete: ${results.valid} valid, ${results.invalid} invalid rows`,
    data: results,
  };
}
 
// ----------------------------------
// DOWNLOAD ENHANCED TEMPLATE
// ----------------------------------
@Get('bulk-upload/template-enhanced')
async downloadEnhancedTemplate(@Res() res: Response) {
  const template = await this.productsService.downloadSmartTemplate();
 
  res.setHeader('Content-Type', 'text/csv');
  res.setHeader(
    'Content-Disposition',
    'attachment; filename=product-upload-template-enhanced.csv',
  );
 
  return res.send(template);
}
 
// ----------------------------------
// DOWNLOAD INSTRUCTIONS
// ----------------------------------
@Get('bulk-upload/instructions')
async downloadInstructions(@Res() res: Response) {
  const instructions = await this.productsService.downloadSmartTemplate();
 
  res.setHeader('Content-Type', 'text/plain');
  res.setHeader(
    'Content-Disposition',
    'attachment; filename=bulk-upload-instructions.txt',
  );
 
  return res.send(instructions);
}
 
// ----------------------------------
// DOWNLOAD SAMPLE WITH ALL FIELDS
// ----------------------------------
@Get('bulk-upload/sample-enhanced')
async downloadSampleEnhanced(@Res() res: Response) {
  const sample = `title,category_id,type_id,subtype_id,price,stock,weight,sizes,description,discount_type,discount_value,is_trending,free_shipping,estimated_shipping,season_id,colors,fabrics,occasions,fits,sleeves,patterns,vendors,image1,image2,image3,image4,meta_title,meta_description,meta_keywords
Premium Cotton T-Shirt,1,2,3,799,100,0.25,"S:20,M:30,L:30,XL:20","Soft and comfortable premium cotton t-shirt perfect for daily wear",PERCENT,15,true,false,3,1,"1,2,3","1,2","1,3,5",1,"1,2",1,1:450:Premium Cotton:50|2:480:Organic Cotton:50,tshirt-black-front.jpg,tshirt-black-back.jpg,tshirt-black-detail.jpg,,Premium Cotton T-Shirt - Comfortable & Stylish,"Buy premium cotton t-shirt online. Soft, comfortable, and durable. Available in multiple sizes and colors.","cotton t-shirt, premium tshirt, casual wear, comfortable clothing"
Designer Silk Kurta,1,1,2,2499,50,0.35,"S:10,M:15,L:15,XL:10","Elegant designer silk kurta for special occasions and festivities",FLAT,200,false,true,5,2,"4,5,6","3,4","2,4,6",2,"3,4","2,3",3:1800:Pure Silk:30|4:1750:Silk Blend:20,kurta-red-front.jpg,kurta-red-side.jpg,,,Designer Silk Kurta - Traditional Ethnic Wear,"Shop designer silk kurta online. Perfect for weddings and festivals. Premium quality silk fabric.","silk kurta, designer kurta, ethnic wear, traditional clothing, festive wear"
Casual Denim Jacket,2,3,5,1899,40,0.8,"M:10,L:15,XL:15","Stylish denim jacket perfect for casual outings and layering",PERCENT,20,true,false,4,,"1,5,6","5,6","1,3",3,5,3,5:1200:Premium Denim:40,jacket-blue-front.jpg,jacket-blue-back.jpg,jacket-blue-detail.jpg,,Casual Denim Jacket - Classic Style,"Buy casual denim jacket online. Perfect for layering. Durable premium denim fabric.","denim jacket, casual jacket, layering piece, outerwear"`;
 
  res.setHeader('Content-Type', 'text/csv');
  res.setHeader(
    'Content-Disposition',
    'attachment; filename=product-upload-sample-enhanced.csv',
  );
 
  return res.send(sample);
}
}
