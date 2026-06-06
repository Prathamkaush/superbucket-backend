[33mcommit 63d9a5849ed08a865b139815c4d2f54c871dcf6e[m
Author: prathamcodecody-code <pratham.codecody@gmail.com>
Date:   Thu Dec 18 19:09:01 2025 +0530

    first commit

[1mdiff --git a/src/products/products.service.ts b/src/products/products.service.ts[m
[1mnew file mode 100644[m
[1mindex 0000000..7a2e202[m
[1m--- /dev/null[m
[1m+++ b/src/products/products.service.ts[m
[36m@@ -0,0 +1,456 @@[m
[32m+[m[32mimport {[m[41m[m
[32m+[m[32m  Injectable,[m[41m[m
[32m+[m[32m  NotFoundException,[m[41m[m
[32m+[m[32m  BadRequestException,[m[41m[m
[32m+[m[32m} from "@nestjs/common";[m[41m[m
[32m+[m[32mimport { PrismaService } from "../prisma/prisma.service";[m[41m[m
[32m+[m[41m[m
[32m+[m[32m@Injectable()[m[41m[m
[32m+[m[32mexport class ProductsService {[m[41m[m
[32m+[m[32m  constructor(private prisma: PrismaService) {}[m[41m[m
[32m+[m[41m[m
[32m+[m[32m  // ----------------------------------[m[41m[m
[32m+[m[32m  // SLUG HELPER[m[41m[m
[32m+[m[32m  // ----------------------------------[m[41m[m
[32m+[m[32m  private generateSlug(title: string): string {[m[41m[m
[32m+[m[32m    return title[m[41m[m
[32m+[m[32m      .toLowerCase()[m[41m[m
[32m+[m[32m      .trim()[m[41m[m
[32m+[m[32m      .replace(/[^\w\s-]/g, "")[m[41m[m
[32m+[m[32m      .replace(/\s+/g, "-")[m[41m[m
[32m+[m[32m      .replace(/-+/g, "-")[m[41m[m
[32m+[m[32m      .replace(/^-+|-+$/g, "");[m[41m[m
[32m+[m[32m  }[m[41m[m
[32m+[m[41m[m
[32m+[m[32m  // ----------------------------------[m[41m[m
[32m+[m[32m  // FINAL PRICE HELPER[m[41m[m
[32m+[m[32m  // ----------------------------------[m[41m[m
[32m+[m[32m  private getFinalPrice(product: any) {[m[41m[m
[32m+[m[32m    if (!product.discountType || !product.discountValue) {[m[41m[m
[32m+[m[32m      return product.price;[m[41m[m
[32m+[m[32m    }[m[41m[m
[32m+[m[41m[m
[32m+[m[32m    if (product.discountType === "PERCENT") {[m[41m[m
[32m+[m[32m      return ([m[41m[m
[32m+[m[32m        product.price -[m[41m[m
[32m+[m[32m        (product.price * product.discountValue) / 100[m[41m[m
[32m+[m[32m      );[m[41m[m
[32m+[m[32m    }[m[41m[m
[32m+[m[41m[m
[32m+[m[32m    if (product.discountType === "FLAT") {[m[41m[m
[32m+[m[32m      return product.price - product.discountValue;[m[41m[m
[32m+[m[32m    }[m[41m[m
[32m+[m[41m[m
[32m+[m[32m    return product.price;[m[41m[m
[32m+[m[32m  }[m[41m[m
[32m+[m[41m[m
[32m+[m[32m  // ----------------------------------[m[41m[m
[32m+[m[32m  // CREATE PRODUCT[m[41m[m
[32m+[m[32m  // ----------------------------------[m[41m[m
[32m+[m[32masync create(body: any, files: any) {[m[41m[m
[32m+[m[32m  const images = {[m[41m[m
[32m+[m[32m    img1: files?.image1?.[0]?.filename || null,[m[41m[m
[32m+[m[32m    img2: files?.image2?.[0]?.filename || null,[m[41m[m
[32m+[m[32m    img3: files?.image3?.[0]?.filename || null,[m[41m[m
[32m+[m[32m    img4: files?.image4?.[0]?.filename || null,[m[41m[m
[32m+[m[32m  };[m[41m[m
[32m+[m[41m[m
[32m+[m[32m  const price = Number(body.price);[m[41m[m
[32m+[m[41m[m
[32m+[m[32m  // ✅ PARSE SIZES[m[41m[m
[32m+[m[32m  let sizes: { size: string; stock: number }[] = [];[m[41m[m
[32m+[m[41m[m
[32m+[m[32m  try {[m[41m[m
[32m+[m[32m    sizes = body.sizes ? JSON.parse(body.sizes) : [];[m[41m[m
[32m+[m[32m  } catch {[m[41m[m
[32m+[m[32m    throw new BadRequestException("Invalid sizes format");[m[41m[m
[32m+[m[32m  }[m[41m[m
[32m+[m[41m[m
[32m+[m[32m  if (!Array.isArray(sizes) || sizes.length === 0) {[m[41m[m
[32m+[m[32m    throw new BadRequestException("At least one size is required");[m[41m[m
[32m+[m[32m  }[m[41m[m
[32m+[m[41m[m
[32m+[m[32m  // ✅ UNIQUE SLUG[m[41m[m
[32m+[m[32m  const baseSlug = this.generateSlug(body.title);[m[41m[m
[32m+[m[32m  const exists = await this.prisma.product.findUnique({[m[41m[m
[32m+[m[32m    where: { slug: baseSlug },[m[41m[m
[32m+[m[32m  });[m[41m[m
[32m+[m[41m[m
[32m+[m[32m  const slug = exists ? `${baseSlug}-${Date.now()}` : baseSlug;[m[41m[m
[32m+[m[41m[m
[32m+[m[32m  // ✅ TRANSACTION (IMPORTANT)[m[41m[m
[32m+[m[32m  return this.prisma.$transaction(async (tx) => {[m[41m[m
[32m+[m[32m    const product = await tx.product.create({[m[41m[m
[32m+[m[32m      data: {[m[41m[m
[32m+[m[32m        title: body.title,[m[41m[m
[32m+[m[32m        slug,[m[41m[m
[32m+[m[32m        description: body.description || "",[m[41m[m
[32m+[m[32m        price,[m[41m[m
[32m+[m[32m        stock: Number(body.stock),[m[41m[m
[32m+[m[32m        categoryId: Number(body.categoryId),[m[41m[m
[32m+[m[32m        typeId: Number(body.typeId),[m[41m[m
[32m+[m[32m        subtypeId: Number(body.subtypeId),[m[41m[m
[32m+[m[32m        ...images,[m[41m[m
[32m+[m[32m      },[m[41m[m
[32m+[m[32m    });[m[41m[m
[32m+[m[41m[m
[32m+[m[32m    // ✅ SAVE SIZES[m[41m[m
[32m+[m[32m    await tx.productSize.createMany({[m[41m[m
[32m+[m[32m      data: sizes.map((s) => ({[m[41m[m
[32m+[m[32m        productId: product.id,[m[41m[m
[32m+[m[32m        size: s.size,[m[41m[m
[32m+[m[32m        stock: s.stock,[m[41m[m
[32m+[m[32m      })),[m[41m[m
[32m+[m[32m    });[m[41m[m
[32m+[m[41m[m
[32m+[m[32m    return product;[m[41m[m
[32m+[m[32m  });[m[41m[m
[32m+[m[32m}[m[41m[m
[32m+[m[41m[m
[32m+[m[41m[m
[32m+[m[32m  // ----------------------------------[m[41m[m
[32m+[m[32m  // FIND ALL (FILTER + PAGINATION)[m[41m[m
[32m+[m[32m  // ----------------------------------[m[41m[m
[32m+[m[32m  async findAll(query: any) {[m[41m[m
[32m+[m[32m    const {[m[41m[m
[32m+[m[32m      page,[m[41m[m
[32m+[m[32m      limit,[m[41m[m
[32m+[m[32m      categoryId,[m[41m[m
[32m+[m[32m      typeId,[m[41m[m
[32m+[m[32m      subtypeId,[m[41m[m
[32m+[m[32m      minPrice,[m[41m[m
[32m+[m[32m      maxPrice,[m[41m[m
[32m+[m[32m      sort,[m[41m[m
[32m+[m[32m      stock,[m[41m[m
[32m+[m[32m      search,[m[41m[m
[32m+[m[32m    } = query;[m[41m[m
[32m+[m[41m[m
[32m+[m[32m    const where: any = { AND: [] };[m[41m[m
[32m+[m[41m[m
[32m+[m[32m    if (categoryId) where.AND.push({ categoryId: Number(categoryId) });[m[41m[m
[32m+[m[32m    if (typeId) where.AND.push({ typeId: Number(typeId) });[m[41m[m
[32m+[m[32m    if (subtypeId) where.AND.push({ subtypeId: Number(subtypeId) });[m[41m[m
[32m+[m[41m[m
[32m+[m[32m    if (minPrice || maxPrice) {[m[41m[m
[32m+[m[32m      where.AND.push({[m[41m[m
[32m+[m[32m        price: {[m[41m[m
[32m+[m[32m          ...(minPrice ? { gte: Number(minPrice) } : {}),[m[41m[m
[32m+[m[32m          ...(maxPrice ? { lte: Number(maxPrice) } : {}),[m[41m[m
[32m+[m[32m        },[m[41m[m
[32m+[m[32m      });[m[41m[m
[32m+[m[32m    }[m[41m[m
[32m+[m[41m[m
[32m+[m[32m    if (stock === "in") where.AND.push({ stock: { gt: 0 } });[m[41m[m
[32m+[m[32m    if (stock === "out") where.AND.push({ stock: 0 });[m[41m[m
[32m+[m[41m[m
[32m+[m[32m    if (search) {[m[41m[m
[32m+[m[32m      where.AND.push({[m[41m[m
[32m+[m[32m        OR: [[m[41m[m
[32m+[m[32m          { title: { contains: search } },[m[41m[m
[32m+[m[32m          {[m[41m[m
[32m+[m[32m            description: {[m[41m[m
[32m+[m[32m              contains: search,[m[41m[m
[32m+[m[32m            },[m[41m[m
[32m+[m[32m          },[m[41m[m
[32m+[m[32m        ],[m[41m[m
[32m+[m[32m      });[m[41m[m
[32m+[m[32m    }[m[41m[m
[32m+[m[41m[m
[32m+[m[32m    let orderBy: any = { createdAt: "desc" };[m[41m[m
[32m+[m[32m    if (sort === "low_to_high") orderBy = { price: "asc" };[m[41m[m
[32m+[m[32m    if (sort === "high_to_low") orderBy = { price: "desc" };[m[41m[m
[32m+[m[32m    if (sort === "oldest") orderBy = { createdAt: "asc" };[m[41m[m
[32m+[m[41m[m
[32m+[m[32m    const take = limit ? Number(limit) : undefined;[m[41m[m
[32m+[m[32m    const skip =[m[41m[m
[32m+[m[32m      page && take ? (Number(page) - 1) * take : undefined;[m[41m[m
[32m+[m[41m[m
[32m+[m[32m    const products = await this.prisma.product.findMany({[m[41m[m
[32m+[m[32m      where,[m[41m[m
[32m+[m[32m      orderBy,[m[41m[m
[32m+[m[32m      take,[m[41m[m
[32m+[m[32m      skip,[m[41m[m
[32m+[m[32m      select: {[m[41m[m
[32m+[m[32m  id: true,[m[41m[m
[32m+[m[32m  title: true,[m[41m[m
[32m+[m[32m  slug: true,[m[41m[m
[32m+[m[32m  price: true,[m[41m[m
[32m+[m[32m  discountType: true,[m[41m[m
[32m+[m[32m  discountValue: true,[m[41m[m
[32m+[m[32m  stock: true,[m[41m[m
[32m+[m[32m  img1: true,[m[41m[m
[32m+[m[32m  img2: true,[m[41m[m
[32m+[m[32m  img3: true,[m[41m[m
[32m+[m[32m  img4: true,[m[41m[m
[32m+[m[41m[m
[32m+[m[32m  sizes: {[m[41m[m
[32m+[m[32m    select: {[m[41m[m
[32m+[m[32m      id: true,[m[41m[m
[32m+[m[32m      size: true,[m[41m[m
[32m+[m[32m      stock: true,[m[41m[m
[32m+[m[32m      price: true,[m[41m[m
[32m+[m[32m    },[m[41m[m
[32m+[m[32m  },[m[41m[m
[32m+[m[41m[m
[32m+[m[32m  category: true,[m[41m[m
[32m+[m[32m  type: true,[m[41m[m
[32m+[m[32m  subtype: true,[m[41m[m
[32m+[m[32m  createdAt: true,[m[41m[m
[32m+[m[32m},[m[41m[m
[32m+[m[32m    });[m[41m[m
[32m+[m[41m[m
[32m+[m[32m    const total = await this.prisma.product.count({ where });[m[41m[m
[32m+[m[41m[m
[32m+[m[32m    const mapped = products.map((p) => ({[m[41m[m
[32m+[m[32m      ...p,[m[41m[m
[32m+[m[32m      finalPrice: this.getFinalPrice(p),[m[41m[m
[32m+[m[32m    }));[m[41m[m
[32m+[m[41m[m
[32m+[m[32m    return {[m[41m[m
[32m+[m[32m      products: mapped,[m[41m[m
[32m+[m[32m      total,[m[41m[m
[32m+[m[32m      page: page ? Number(page) : 1,[m[41m[m
[32m+[m[32m      pages: take ? Math.ceil(total / take) : 1,[m[41m[m
[32m+[m[32m    };[m[41m[m
[32m+[m[32m  }[m[41m[m
[32m+[m[41m[m
[32m+[m[32m  // ----------------------------------[m[41m[m
[32m+[m[32m  // FIND ONE BY ID[m[41m[m
[32m+[m[32m  // ----------------------------------[m[41m[m
[32m+[m[32m  async findOne(id: number) {[m[41m[m
[32m+[m[32m    const product = await this.prisma.product.findUnique({[m[41m[m
[32m+[m[32m      where: { id },[m[41m[m
[32m+[m[32m      select: {[m[41m[m
[32m+[m[32m        id: true,[m[41m[m
[32m+[m[32m        title: true,[m[41m[m
[32m+[m[32m        slug: true,[m[41m[m
[32m+[m[32m        description: true,[m[41m[m
[32m+[m[32m        price: true,[m[41m[m
[32m+[m[32m        discountType: true,[m[41m[m
[32m+[m[32m        discountValue: true,[m[41m[m
[32m+[m[32m        stock: true,[m[41m[m
[32m+[m[32m        img1: true,[m[41m[m
[32m+[m[32m        img2: true,[m[41m[m
[32m+[m[32m        img3: true,[m[41m[m
[32m+[m[32m        img4: true,[m[41m[m
[32m+[m[32m        sizes: {[m[41m[m
[32m+[m[32m          select: {[m[41m[m
[32m+[m[32m            id: true,[m[41m[m
[32m+[m[32m            size: true,[m[41m[m
[32m+[m[32m            stock: true,[m[41m[m
[32m+[m[32m            price: true,[m[41m[m
[32m+[m[32m          },[m[41m[m
[32m+[m[32m        },[m[41m[m
[32m+[m[32m        category: true,[m[41m[m
[32m+[m[32m        type: true,[m[41m[m
[32m+[m[32m        subtype: true,[m[41m[m
[32m+[m[32m        createdAt: true,[m[41m[m
[32m+[m[32m        updatedAt: true,[m[41m[m
[32m+[m[32m      },[m[41m[m
[32m+[m[32m    });[m[41m[m
[32m+[m[41m[m
[32m+[m[32m    if (!product) throw new NotFoundException("Product not found");[m[41m[m
[32m+[m[41m[m
[32m+[m[32m    return {[m[41m[m
[32m+[m[32m      ...product,[m[41m[m
[32m+[m[32m      finalPrice: this.getFinalPrice(product),[m[41m[m
[32m+[m[32m    };[m[41m[m
[32m+[m[32m  }[m[41m[m
[32m+[m[41m[m
[32m+[m[32m  // ----------------------------------[m[41m[m
[32m+[m[32m  // FIND BY SLUG[m[41m[m
[32m+[m[32m  // ----------------------------------[m[41m[m
[32m+[m[32m  async findBySlug(slug: string) {[m[41m[m
[32m+[m[32m    const product = await this.prisma.product.findUnique({[m[41m[m
[32m+[m[32m      where: { slug },[m[41m[m
[32m+[m[32m      select: {[m[41m[m
[32m+[m[32m        id: true,[m[41m[m
[32m+[m[32m        title: true,[m[41m[m
[32m+[m[32m        slug: true,[m[41m[m
[32m+[m[32m        description: true,[m[41m[m
[32m+[m[32m        price: true,[m[41m[m
[32m+[m[32m        discountType: true,[m[41m[m
[32m+[m[32m        discountValue: true,[m[41m[m
[32m+[m[32m        stock: true,[m[41m[m
[32m+[m[32m        img1: true,[m[41m[m
[32m+[m[32m        img2: true,[m[41m[m
[32m+[m[32m        img3: true,[m[41m[m
[32m+[m[32m        img4: true,[m[41m[m
[32m+[m[32m        sizes: {[m[41m[m
[32m+[m[32m          select: {[m[41m[m
[32m+[m[32m            id: true,[m[41m[m
[32m+[m[32m            size: true,[m[41m[m
[32m+[m[32m            stock: true,[m[41m[m
[32m+[m[32m            price: true,[m[41m[m
[32m+[m[32m          },[m[41m[m
[32m+[m[32m        },[m[41m[m
[32m+[m[32m        category: true,[m[41m[m
[32m+[m[32m        type: true,[m[41m[m
[32m+[m[32m        subtype: true,[m[41m[m
[32m+[m[32m        createdAt: true,[m[41m[m
[32m+[m[32m        updatedAt: true,[m[41m[m
[32m+[m[32m      },[m[41m[m
[32m+[m[32m    });[m[41m[m
[32m+[m[41m[m
[32m+[m[32m    if (!product) throw new NotFoundException("Product not found");[m[41m[m
[32m+[m[41m[m
[32m+[m[32m    return {[m[41m[m
[32m+[m[32m      ...product,[m[41m[m
[32m+[m[32m      finalPrice: this.getFinalPrice(product),[m[41m[m
[32m+[m[32m    };[m[41m[m
[32m+[m[32m  }[m[41m[m
[32m+[m[41m[m
[32m+[m[32m  // ----------------------------------[m[41m[m
[32m+[m[32m  // UPDATE PRODUCT[m[41m[m
[32m+[m[32m  // ----------------------------------[m[41m[m
[32m+[m[32m  async update(id: number, body: any, files: any) {[m[41m[m
[32m+[m[32m    await this.findOne(id);[m[41m[m
[32m+[m[41m[m
[32m+[m[32m    const images: any = {};[m[41m[m
[32m+[m[41m[m
[32m+[m[32m    if (files?.image1?.[0]) images.img1 = files.image1[0].filename;[m[41m[m
[32m+[m[32m    if (files?.image2?.[0]) images.img2 = files.image2[0].filename;[m[41m[m
[32m+[m[32m    if (files?.image3?.[0]) images.img3 = files.image3[0].filename;[m[41m[m
[32m+[m[32m    if (files?.image4?.[0]) images.img4 = files.image4[0].filename;[m[41m[m
[32m+[m[41m[m
[32m+[m[32m    for (let i = 1; i <= 4; i++) {[m[41m[m
[32m+[m[32m      if (body[`remove_image_${i}`] === "true") {[m[41m[m
[32m+[m[32m        images[`img${i}`] = null;[m[41m[m
[32m+[m[32m      }[m[41m[m
[32m+[m[32m    }[m[41m[m
[32m+[m[41m[m
[32m+[m[32m    const data: any = {};[m[41m[m
[32m+[m[41m[m
[32m+[m[32m    if (body.title !== undefined) {[m[41m[m
[32m+[m[32m      data.title = body.title;[m[41m[m
[32m+[m[32m      data.slug = this.generateSlug(body.title);[m[41m[m
[32m+[m[32m    }[m[41m[m
[32m+[m[41m[m
[32m+[m[32m    if (body.description !== undefined)[m[41m[m
[32m+[m[32m      data.description = body.description;[m[41m[m
[32m+[m[32m    if (body.price !== undefined)[m[41m[m
[32m+[m[32m      data.price = Number(body.price);[m[41m[m
[32m+[m[32m    if (body.stock !== undefined)[m[41m[m
[32m+[m[32m      data.stock = Number(body.stock);[m[41m[m
[32m+[m[41m[m
[32m+[m[32m    if (body.discountType !== undefined)[m[41m[m
[32m+[m[32m      data.discountType = body.discountType;[m[41m[m
[32m+[m[41m[m
[32m+[m[32m    if (body.discountValue !== undefined)[m[41m[m
[32m+[m[32m      data.discountValue = Number(body.discountValue);[m[41m[m
[32m+[m[41m[m
[32m+[m[32m    if (body.categoryId !== undefined)[m[41m[m
[32m+[m[32m      data.categoryId = Number(body.categoryId);[m[41m[m
[32m+[m[32m    if (body.typeId !== undefined)[m[41m[m
[32m+[m[32m      data.typeId = Number(body.typeId);[m[41m[m
[32m+[m[32m    if (body.subtypeId !== undefined)[m[41m[m
[32m+[m[32m      data.subtypeId = Number(body.subtypeId);[m[41m[m
[32m+[m[41m[m
[32m+[m[32m    Object.assign(data, images);[m[41m[m
[32m+[m[41m[m
[32m+[m[32m    return this.prisma.product.update({[m[41m[m
[32m+[m[32m      where: { id },[m[41m[m
[32m+[m[32m      data,[m[41m[m
[32m+[m[32m    });[m[41m[m
[32m+[m[32m  }[m[41m[m
[32m+[m[41m[m
[32m+[m[32m  // ----------------------------------[m[41m[m
[32m+[m[32m  // DELETE PRODUCT[m[41m[m
[32m+[m[32m  // ----------------------------------[m[41m[m
[32m+[m[32m  async remove(id: number) {[m[41m[m
[32m+[m[32m    await this.findOne(id);[m[41m[m
[32m+[m[41m[m
[32m+[m[32m    await this.prisma.cartItem.deleteMany({[m[41m[m
[32m+[m[32m      where: { productId: id },[m[41m[m
[32m+[m[32m    });[m[41m[m
[32m+[m[41m[m
[32m+[m[32m    await this.prisma.orderItem.deleteMany({[m[41m[m
[32m+[m[32m      where: { productId: id },[m[41m[m
[32m+[m[32m    });[m[41m[m
[32m+[m[41m[m
[32m+[m[32m    await this.prisma.review.deleteMany({[m[41m[m
[32m+[m[32m      where: { productId: id },[m[41m[m
[32m+[m[32m    });[m[41m[m
[32m+[m[41m[m
[32m+[m[32m    return this.prisma.product.delete({[m[41m[m
[32m+[m[32m      where: { id },[m[41m[m
[32m+[m[32m    });[m[41m[m
[32m+[m[32m  }[m[41m[m
[32m+[m[41m[m
[32m+[m[32m  // ----------------------------------[m[41m[m
[32m+[m[32m  // UPDATE STOCK[m[41m[m
[32m+[m[32m  // ----------------------------------[m[41m[m
[32m+[m[32m  async updateStock(productId: number, stock: number) {[m[41m[m
[32m+[m[32m    if (stock < 0) {[m[41m[m
[32m+[m[32m      throw new BadRequestException([m[41m[m
[32m+[m[32m        "Stock cannot be negative"[m[41m[m
[32m+[m[32m      );[m[41m[m
[32m+[m[32m    }[m[41m[m
[32m+[m[41m[m
[32m+[m[32m    return this.prisma.product.update({[m[41m[m
[32m+[m[32m      where: { id: productId },[m[41m[m
[32m+[m[32m      data: { stock },[m[41m[m
[32m+[m[32m    });[m[41m[m
[32m+[m[32m  }[m[41m[m
[32m+[m[41m[m
[32m+[m[32m// ----------------------------------[m[41m[m
[32m+[m[32m// UPDATE DISCOUNT[m[41m[m
[32m+[m[32m// ----------------------------------[m[41m[m
[32m+[m[41m[m
[32m+[m[32m  async updateDiscount([m[41m[m
[32m+[m[32m  id: number,[m[41m[m
[32m+[m[32m  body: { discountType?: string; discountValue?: number }[m[41m[m
[32m+[m[32m) {[m[41m[m
[32m+[m[32m  const product = await this.prisma.product.findUnique({ where: { id } });[m[41m[m
[32m+[m[41m[m
[32m+[m[32m  if (!product) throw new NotFoundException("Product not found");[m[41m[m
[32m+[m[41m[m
[32m+[m[32m  const { discountType, discountValue } = body;[m[41m[m
[32m+[m[41m[m
[32m+[m[32m  if (!discountType || discountValue == null) {[m[41m[m
[32m+[m[32m    return this.prisma.product.update({[m[41m[m
[32m+[m[32m      where: { id },[m[41m[m
[32m+[m[32m      data: {[m[41m[m
[32m+[m[32m        discountType: null,[m[41m[m
[32m+[m[32m        discountValue: null,[m[41m[m
[32m+[m[32m      },[m[41m[m
[32m+[m[32m    });[m[41m[m
[32m+[m[32m  }[m[41m[m
[32m+[m[41m[m
[32m+[m[32m  if (discountType === "PERCENT" && discountValue > 100) {[m[41m[m
[32m+[m[32m    throw new BadRequestException("Discount percent cannot exceed 100");[m[41m[m
[32m+[m[32m  }[m[41m[m
[32m+[m[41m[m
[32m+[m[32m  if (discountType === "FLAT" && discountValue >= Number(product.price)) {[m[41m[m
[32m+[m[32m    throw new BadRequestException("Flat discount must be less than price");[m[41m[m
[32m+[m[32m  }[m[41m[m
[32m+[m[41m[m
[32m+[m[32m  return this.prisma.product.update({[m[41m[m
[32m+[m[32m    where: { id },[m[41m[m
[32m+[m[32m    data: {[m[41m[m
[32m+[m[32m      discountType,[m[41m[m
[32m+[m[32m      discountValue,[m[41m[m
[32m+[m[32m    },[m[41m[m
[32m+[m[32m  });[m[41m[m
[32m+[m[32m}[m[41m[m
[32m+[m[41m[m
[32m+[m[41m[m
[32m+[m[32m  // ----------------------------------[m[41m[m
[32m+[m[32m  // LOW STOCK[m[41m[m
[32m+[m[32m  // ----------------------------------[m[41m[m
[32m+[m[32m  async getLowStock(threshold = 5) {[m[41m[m
[32m+[m[32m    return this.prisma.product.findMany({[m[41m[m
[32m+[m[32m      where: {[m[41m[m
[32m+[m[32m        stock: { lte: threshold },[m[41m[m
[32m+[m[32m      },[m[41m[m
[32m+[m[32m      select: {[m[41m[m
[32m+[m[32m        id: true,[m[41m[m
[32m+[m[32m        title: true,[m[41m[m
[32m+[m[32m        stock: true,[m[41m[m
[32m+[m[32m      },[m[41m[m
[32m+[m[32m      orderBy: {[m[41m[m
[32m+[m[32m        stock: "asc",[m[41m[m
[32m+[m[32m      },[m[41m[m
[32m+[m[32m    });[m[41m[m
[32m+[m[32m  }[m[41m[m
[32m+[m[32m}[m[41m[m
