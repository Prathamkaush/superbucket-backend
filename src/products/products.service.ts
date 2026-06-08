import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { UpdateProductSeoDto } from './dto/update-product-seo.dto';
import { Prisma } from '@prisma/client';
import { SmartBulkProductParser } from './utils/enhanced-bulk-product-parser.util';
import { ParsedProductRow } from './dto/bulk-upload-product.dto';

function parseIdArray(value?: any, name?: string): number[] {
  if (!value) return [];

  try {
    const parsed = typeof value === 'string' ? JSON.parse(value) : value;
    if (!Array.isArray(parsed)) {
      throw new Error();
    }
    return parsed.map(Number).filter(Boolean);
  } catch {
    throw new BadRequestException(`Invalid ${name} format`);
  }
}

function parseJsonArray(value: any, name: string): any[] {
  if (!value) return [];

  try {
    const parsed = typeof value === 'string' ? JSON.parse(value) : value;
    if (!Array.isArray(parsed)) {
      throw new Error();
    }
    return parsed;
  } catch {
    throw new BadRequestException(`Invalid ${name} format`);
  }
}

function parseJsonValue(value: any, name: string): any {
  if (value === undefined || value === null || value === '') return undefined;

  try {
    return typeof value === 'string' ? JSON.parse(value) : value;
  } catch {
    throw new BadRequestException(`Invalid ${name} format`);
  }
}

function parseBool(value: any): boolean {
  return value === true || value === 'true' || value === '1';
}

function parseDecimalOrNull(value: any) {
  if (value === undefined || value === null || value === '') return null;
  const num = Number(value);
  if (Number.isNaN(num)) return null;
  return new Prisma.Decimal(num);
}

function parseOptionalId(value: any) {
  if (value === undefined || value === null || value === '') return null;
  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase();
    if (
      !normalized ||
      normalized === 'null' ||
      normalized === 'undefined' ||
      normalized === 'none' ||
      normalized === 'no type' ||
      normalized === 'no subtype'
    ) {
      return null;
    }
  }

  const id = Number(value);
  return Number.isInteger(id) && id > 0 ? id : null;
}

async function validateProductCatalogPath(
  prisma: PrismaService,
  categoryId: number,
  typeId: number | null,
  subtypeId: number | null,
) {
  const category = await prisma.category.findUnique({
    where: { id: categoryId },
    select: { id: true },
  });

  if (!category) {
    throw new BadRequestException('Selected category does not exist');
  }

  if (typeId) {
    const type = await prisma.productType.findFirst({
      where: { id: typeId, categoryId },
      select: { id: true },
    });

    if (!type) {
      throw new BadRequestException(
        'Selected type does not exist for this category',
      );
    }
  }

  if (subtypeId) {
    if (!typeId) {
      throw new BadRequestException('Select a type before selecting a subtype');
    }

    const subtype = await prisma.productSubtype.findFirst({
      where: { id: subtypeId, typeId },
      select: { id: true },
    });

    if (!subtype) {
      throw new BadRequestException(
        'Selected subtype does not exist for this type',
      );
    }
  }
}

function mapVariantInput(variant: any, index: number) {
  const price = Number(variant.price ?? variant.mrp ?? 0);
  const stock = Number(variant.stock ?? 0);

  if (Number.isNaN(price) || price < 0) {
    throw new BadRequestException(`Invalid variant price at row ${index + 1}`);
  }

  if (!Number.isInteger(stock) || stock < 0) {
    throw new BadRequestException(`Invalid variant stock at row ${index + 1}`);
  }

  return {
    sku: variant.sku || null,
    flavour: variant.flavour || variant.flavor || null,
    weightLabel: variant.weightLabel || variant.weight || null,
    netQuantity: variant.netQuantity || null,
    servings: variant.servings ? Number(variant.servings) : null,
    mrp: parseDecimalOrNull(variant.mrp),
    price: new Prisma.Decimal(price),
    discountType: variant.discountType || null,
    discountValue: parseDecimalOrNull(variant.discountValue),
    stock,
    weightKg: parseDecimalOrNull(variant.weightKg),
    image1: variant.image1 || null,
    image2: variant.image2 || null,
    image3: variant.image3 || null,
    image4: variant.image4 || null,
    status: variant.status || 'ACTIVE',
    isDefault:
      index === 0 ? variant.isDefault !== false : parseBool(variant.isDefault),
  };
}

function mapNutritionFactInput(fact: any, index: number) {
  if (!fact.name || !fact.amount) {
    throw new BadRequestException(
      `Nutrition fact ${index + 1} needs name and amount`,
    );
  }

  return {
    name: String(fact.name),
    amount: String(fact.amount),
    unit: fact.unit || null,
    per: fact.per || 'serving',
    position: Number(fact.position ?? index),
  };
}

@Injectable()
export class ProductsService {
  constructor(
    private prisma: PrismaService,
    private smartParser: SmartBulkProductParser,
  ) {}

  // ----------------------------------
  // SLUG HELPER
  // ----------------------------------
  private generateSlug(title: string): string {
    return title
      .toLowerCase()
      .trim()
      .replace(/[^\w\s-]/g, '')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-+|-+$/g, '');
  }

  // ----------------------------------
  // FINAL PRICE HELPER
  // ----------------------------------
  private getFinalPrice(product: any): number {
    const price = Number(product.price);

    if (!product.discountType || product.discountValue == null || price <= 0) {
      return price;
    }

    const value = Number(product.discountValue);
    let finalPrice = price;

    if (product.discountType === 'PERCENT') {
      if (value <= 0 || value > 100) return price;

      finalPrice = price - (price * value) / 100;
    }

    if (product.discountType === 'FLAT') {
      if (value <= 0) return price;

      finalPrice = price - value;
    }

    // ✅ ROUND + NEVER NEGATIVE
    return Math.max(0, Math.round(finalPrice));
  }

  private async getRatingSummary(productId: number) {
    const rating = await this.prisma.review.aggregate({
      where: { productId },
      _avg: { rating: true },
      _count: { rating: true },
    });

    return {
      averageRating: Number((rating._avg.rating || 0).toFixed(1)),
      reviewCount: rating._count.rating,
    };
  }

  // ----------------------------------
  // CREATE PRODUCT
  // ----------------------------------
  async create(body: any, files: any) {
    const images = {
      img1: files?.image1?.[0]?.filename || null,
      img2: files?.image2?.[0]?.filename || null,
      img3: files?.image3?.[0]?.filename || null,
      img4: files?.image4?.[0]?.filename || null,
    };

    const price = Number(body.price);
    const gstRate =
      body.gstRate !== undefined && body.gstRate !== ''
        ? Number(body.gstRate)
        : 0;
    const weight = Number(body.weight);
    const freeShipping = parseBool(body.freeShipping);
    const providedEstimatedShipping = Number(body.estimatedShipping);
    const estimatedShipping = Number.isFinite(providedEstimatedShipping)
      ? Math.max(0, Math.round(providedEstimatedShipping))
      : freeShipping
        ? 0
        : Math.max(0, 80 + Math.ceil(Math.max(0, weight - 0.5) / 0.5) * 30);

    if (isNaN(price) || price < 0) {
      throw new BadRequestException('Invalid price');
    }

    if (isNaN(gstRate) || gstRate < 0 || gstRate > 100) {
      throw new BadRequestException('GST rate must be between 0 and 100');
    }

    if (isNaN(weight) || weight < 0.05 || weight > 10) {
      throw new BadRequestException(
        'Product weight must be between 0.05kg and 10kg',
      );
    }

    // -------------------- SIZES --------------------
    const sizes = parseJsonArray(body.sizes, 'sizes') as {
      size: string;
      stock: number;
    }[];
    const variants = parseJsonArray(body.variants, 'variants').map(
      mapVariantInput,
    );
    const nutritionFacts = parseJsonArray(
      body.nutritionFacts,
      'nutritionFacts',
    ).map(mapNutritionFactInput);

    if (
      !Array.isArray(sizes) ||
      (sizes.length === 0 && variants.length === 0)
    ) {
      throw new BadRequestException(
        'At least one variant or legacy size is required',
      );
    }

    const sizeSet = new Set(sizes.map((s) => s.size));
    if (sizeSet.size !== sizes.length) {
      throw new BadRequestException('Duplicate sizes not allowed');
    }

    const stockFromVariants = variants.reduce(
      (sum, v) => sum + Number(v.stock),
      0,
    );
    const stockFromSizes = sizes.reduce(
      (sum, s) => sum + Number(s.stock || 0),
      0,
    );
    const stock =
      body.stock !== undefined && body.stock !== ''
        ? Number(body.stock)
        : stockFromVariants || stockFromSizes;

    if (isNaN(stock) || stock < 0) {
      throw new BadRequestException('Invalid stock');
    }

    const categoryId = parseOptionalId(body.categoryId);
    const typeId = parseOptionalId(body.typeId);
    const subtypeId = parseOptionalId(body.subtypeId);

     console.log('=== CREATE PRODUCT DEBUG ===');
     console.log('body.typeId raw:', JSON.stringify(body.typeId));
     console.log('body.categoryId raw:', JSON.stringify(body.categoryId));
     console.log('typeId parsed:', parseOptionalId(body.typeId));
     console.log('categoryId parsed:', parseOptionalId(body.categoryId));

    if (!categoryId) {
      throw new BadRequestException('Category is required');
    }

    await validateProductCatalogPath(this.prisma, categoryId, null, null);

    // -------------------- SLUG --------------------
    const baseSlug = this.generateSlug(body.title);
    const exists = await this.prisma.product.findUnique({
      where: { slug: baseSlug },
    });
    const slug = exists ? `${baseSlug}-${Date.now()}` : baseSlug;

    // -------------------- DISCOUNT --------------------
    const discountType = body.discountType || null;
    const discountValue =
      body.discountValue !== undefined && body.discountValue !== ''
        ? Number(body.discountValue)
        : null;

    // -------------------- NEW FILTER FIELDS --------------------
    const seasonId = body.seasonId ? Number(body.seasonId) : null;

    const colorIds = parseIdArray(body.colors, 'colors');
    const fabricIds = parseIdArray(body.fabrics, 'fabrics');
    const occasionIds = parseIdArray(body.occasions, 'occasions');
    const fitIds = parseIdArray(body.fits, 'fits');
    const sleeveIds = parseIdArray(body.sleeves, 'sleeves');
    const patternIds = parseIdArray(body.patterns, 'patterns');

    if (discountType && discountValue !== null) {
      if (!['PERCENT', 'FLAT'].includes(discountType)) {
        throw new BadRequestException('Invalid discount type');
      }

      if (isNaN(discountValue) || discountValue <= 0) {
        throw new BadRequestException('Invalid discount value');
      }

      if (discountType === 'PERCENT' && discountValue > 100) {
        throw new BadRequestException('Discount percent cannot exceed 100');
      }

      if (discountType === 'FLAT' && discountValue >= price) {
        throw new BadRequestException('Flat discount must be less than price');
      }
    }

    return this.prisma.$transaction(async (tx) => {
      const selectedType = typeId
        ? await tx.productType.findFirst({
            where: { id: typeId, categoryId },
            select: { id: true },
          })
        : null;
      const productTypeId = selectedType?.id ?? null;

      const selectedSubtype =
        productTypeId && subtypeId
          ? await tx.productSubtype.findFirst({
              where: { id: subtypeId, typeId: productTypeId },
              select: { id: true },
            })
          : null;
      const productSubtypeId = selectedSubtype?.id ?? null;

      const product = await tx.product.create({
        data: {
          title: body.title,
          slug,
          description: body.description || '',
          shortDescription: body.shortDescription || null,

          price: new Prisma.Decimal(price),
          gstRate: new Prisma.Decimal(gstRate),
          stock,
          weight: new Prisma.Decimal(weight),
          estimatedShipping,

          discountType,
          discountValue:
            discountValue !== null ? new Prisma.Decimal(discountValue) : null,

          isActive: true,
          status: body.status || 'ACTIVE',
          isTrending: parseBool(body.isTrending),
          isFeatured: parseBool(body.isFeatured),
          isBestSeller: parseBool(body.isBestSeller),
          isNewLaunch: parseBool(body.isNewLaunch),
          freeShipping,

          brandName: body.brandName || 'InsaneGenix',
          productLine: body.productLine || null,
          goal: body.goal || null,
          dietaryPreference: body.dietaryPreference || null,
          proteinType: body.proteinType || null,
          servingSize: body.servingSize || null,
          servingsPerContainer: body.servingsPerContainer
            ? Number(body.servingsPerContainer)
            : null,
          proteinPerServing: parseDecimalOrNull(body.proteinPerServing),
          bcaaPerServing: parseDecimalOrNull(body.bcaaPerServing),
          eaaPerServing: parseDecimalOrNull(body.eaaPerServing),
          caloriesPerServing: parseDecimalOrNull(body.caloriesPerServing),
          proteinPercentage: parseDecimalOrNull(body.proteinPercentage),
          ingredients: body.ingredients || null,
          keyBenefits: parseJsonValue(body.keyBenefits, 'keyBenefits') ?? [],
          howToUse: body.howToUse || null,
          whenToUse: body.whenToUse || null,
          safetyInformation: body.safetyInformation || null,
          allergenInfo: body.allergenInfo || null,
          certifications:
            parseJsonValue(body.certifications, 'certifications') ?? [],
          fssaiLicense: body.fssaiLicense || null,
          countryOfOrigin: body.countryOfOrigin || 'India',
          marketedBy: body.marketedBy || null,
          manufacturedBy: body.manufacturedBy || null,
          sellerName: body.sellerName || null,
          authenticityNote: body.authenticityNote || null,
          returnPolicy: body.returnPolicy || null,

          categoryId,
          ...(productTypeId !== null && { typeId: productTypeId }),
          ...(productSubtypeId !== null && { subtypeId: productSubtypeId }),
          seasonId,

          img1: images.img1,
          img2: images.img2,
          img3: images.img3,
          img4: images.img4,
        },
      });

      if (sizes.length) {
        await tx.productSize.createMany({
          data: sizes.map((s) => ({
            productId: product.id,
            size: s.size,
            stock: s.stock,
          })),
        });
      }

      if (variants.length) {
        const hasDefault = variants.some((variant) => variant.isDefault);
        await tx.productVariant.createMany({
          data: variants.map((variant, index) => ({
            ...variant,
            productId: product.id,
            isDefault: hasDefault ? variant.isDefault : index === 0,
          })),
        });
      }

      if (nutritionFacts.length) {
        await tx.nutritionFact.createMany({
          data: nutritionFacts.map((fact) => ({
            ...fact,
            productId: product.id,
          })),
        });
      }

      if (colorIds.length) {
        await tx.productColor.createMany({
          data: colorIds.map((id) => ({
            productId: product.id,
            colorId: id,
          })),
        });
      }

      if (fabricIds.length) {
        await tx.productFabric.createMany({
          data: fabricIds.map((id) => ({
            productId: product.id,
            fabricId: id,
          })),
        });
      }

      if (occasionIds.length) {
        await tx.productOccasion.createMany({
          data: occasionIds.map((id) => ({
            productId: product.id,
            occasionId: id,
          })),
        });
      }

      if (fitIds.length) {
        await tx.productFit.createMany({
          data: fitIds.map((id) => ({
            productId: product.id,
            fitId: id,
          })),
        });
      }

      if (sleeveIds.length) {
        await tx.productSleeve.createMany({
          data: sleeveIds.map((id) => ({
            productId: product.id,
            sleeveId: id,
          })),
        });
      }

      if (patternIds.length) {
        await tx.productPattern.createMany({
          data: patternIds.map((id) => ({
            productId: product.id,
            patternId: id,
          })),
        });
      }

      // -------------------- VENDORS --------------------
      const vendorInfo = body.vendorId ? JSON.parse(body.vendorId) : [];

      if (Array.isArray(vendorInfo) && vendorInfo.length > 0) {
        await tx.productVendor.createMany({
          data: vendorInfo.map((vendor: any) => ({
            productId: product.id,
            vendorId: vendor.vendorId,
            costPrice: new Prisma.Decimal(vendor.costPrice),
            fabricType: vendor.fabricType || null,
            quantity: vendor.quantity || 1,
          })),
          skipDuplicates: true,
        });
      }

      return product;
    });
  }

  // ----------------------------------
  // FIND ALL (FILTER + PAGINATION)
  // ----------------------------------
  async findAll(query: any) {
    const {
      page,
      limit,
      categoryId,
      typeId,
      subtypeId,
      minPrice,
      maxPrice,
      sort,
      stock,
      search,
      trending,
      discounted,

      // 🔥 NEW FILTERS
      seasonId,
      colors,
      fabrics,
      occasions,
      fits,
      sleeves,
      patterns,
      freeShipping,
    } = query;

    const where: any = {
      AND: [{ isActive: true }],
    };

    /* ---------------- CATEGORY / TYPE ---------------- */
    if (categoryId) where.AND.push({ categoryId: Number(categoryId) });

    if (subtypeId) {
      where.AND.push({ subtypeId: Number(subtypeId) });
    } else if (typeId) {
      where.AND.push({ typeId: Number(typeId) });
    }

    /* ---------------- PRICE FILTER ---------------- */
    if (minPrice || maxPrice) {
      where.AND.push({
        price: {
          ...(minPrice ? { gte: Number(minPrice) } : {}),
          ...(maxPrice ? { lte: Number(maxPrice) } : {}),
        },
      });
    }

    /* ---------------- STOCK ---------------- */
    if (stock === 'in') where.AND.push({ stock: { gt: 0 } });
    if (stock === 'out') where.AND.push({ stock: 0 });

    /* ---------------- FLAGS ---------------- */
    if (trending === 'true') where.AND.push({ isTrending: true });

    if (discounted === 'true') {
      where.AND.push({
        discountType: { not: null },
        discountValue: { gt: 0 },
      });
    }

    if (freeShipping === 'true') {
      where.AND.push({ freeShipping: true });
    }

    /* ---------------- SEARCH ---------------- */
    if (search) {
      where.AND.push({
        OR: [
          { title: { contains: search } },
          { description: { contains: search } },
        ],
      });
    }

    /* ==================================================
     🔥 ADVANCED ATTRIBUTE FILTERS (MANY-TO-MANY)
     ================================================== */

    if (seasonId) {
      where.AND.push({ seasonId: Number(seasonId) });
    }

    if (colors) {
      const ids = colors.split(',').map(Number);
      where.AND.push({
        productColors: {
          some: { colorId: { in: ids } },
        },
      });
    }

    if (fabrics) {
      const ids = fabrics.split(',').map(Number);
      where.AND.push({
        productFabrics: {
          some: { fabricId: { in: ids } },
        },
      });
    }

    if (occasions) {
      const ids = occasions.split(',').map(Number);
      where.AND.push({
        productOccasions: {
          some: { occasionId: { in: ids } },
        },
      });
    }

    if (fits) {
      const ids = fits.split(',').map(Number);
      where.AND.push({
        productFits: {
          some: { fitId: { in: ids } },
        },
      });
    }

    if (sleeves) {
      const ids = sleeves.split(',').map(Number);
      where.AND.push({
        productSleeves: {
          some: { sleeveId: { in: ids } },
        },
      });
    }

    if (patterns) {
      const ids = patterns.split(',').map(Number);
      where.AND.push({
        productPatterns: {
          some: { patternId: { in: ids } },
        },
      });
    }

    /* ---------------- SORT ---------------- */
    let orderBy: any = { createdAt: 'desc' };

    if (sort === 'low_to_high') orderBy = { price: 'asc' };
    if (sort === 'high_to_low') orderBy = { price: 'desc' };
    if (sort === 'oldest') orderBy = { createdAt: 'asc' };

    if (trending === 'true' && !sort) {
      orderBy = { updatedAt: 'desc' };
    }

    /* ---------------- PAGINATION ---------------- */
    const isHomepageSection = subtypeId && !page;
    const take = limit ? Math.max(1, Number(limit)) : undefined;

    const skip =
      !isHomepageSection && page && take
        ? Math.max(0, (Number(page) - 1) * take)
        : undefined;

    /* ---------------- QUERY WITH VENDORS --------------------  */
    const products = await this.prisma.product.findMany({
      where,
      orderBy,
      take,
      skip,
      include: {
        sizes: {
          select: {
            size: true,
            stock: true,
            price: true,
          },
        },
        variants: {
          where: { status: 'ACTIVE' },
          orderBy: [{ isDefault: 'desc' }, { id: 'asc' }],
        },
        nutritionFacts: {
          orderBy: { position: 'asc' },
        },

        category: true,
        type: true,
        subtype: true,
        season: true,

        // ✅ FIX: ADD VENDORS
        productVendors: {
          include: {
            vendor: true,
          },
        },

        productColors: {
          include: {
            color: true,
          },
        },

        productFabrics: {
          include: {
            fabric: true,
          },
        },

        productOccasions: {
          include: {
            occasion: true,
          },
        },

        productFits: {
          include: {
            fit: true,
          },
        },

        productSleeves: {
          include: {
            sleeve: true,
          },
        },

        productPatterns: {
          include: {
            pattern: true,
          },
        },
      },
    });

    const [total, ratingRows] = await Promise.all([
      this.prisma.product.count({ where }),
      this.prisma.review.groupBy({
        by: ['productId'],
        where: { productId: { in: products.map((product) => product.id) } },
        _avg: { rating: true },
        _count: { rating: true },
      }),
    ]);
    const ratingsByProduct = new Map(
      ratingRows.map((row) => [
        row.productId,
        {
          averageRating: Number((row._avg.rating || 0).toFixed(1)),
          reviewCount: row._count.rating,
        },
      ]),
    );

    return {
      products: products.map((p) => ({
        ...p,
        finalPrice: this.getFinalPrice(p),
        averageRating: ratingsByProduct.get(p.id)?.averageRating || 0,
        reviewCount: ratingsByProduct.get(p.id)?.reviewCount || 0,
      })),
      total,
      page: page ? Number(page) : 1,
      pages: take ? Math.ceil(total / take) : 1,
    };
  }

  // ----------------------------------
  // FIND ONE BY ID
  // ----------------------------------
  async findOne(id: number) {
    const product = await this.prisma.product.findUnique({
      where: { id },
      select: {
        id: true,
        title: true,
        slug: true,
        description: true,
        shortDescription: true,

        metaTitle: true,
        metaDescription: true,
        metaKeywords: true,

        price: true,
        gstRate: true,
        discountType: true,
        discountValue: true,

        isTrending: true,
        isFeatured: true,
        isBestSeller: true,
        isNewLaunch: true,
        isActive: true,
        status: true,
        freeShipping: true,
        stock: true,
        weight: true,
        estimatedShipping: true,

        brandName: true,
        productLine: true,
        goal: true,
        dietaryPreference: true,
        proteinType: true,
        servingSize: true,
        servingsPerContainer: true,
        proteinPerServing: true,
        bcaaPerServing: true,
        eaaPerServing: true,
        caloriesPerServing: true,
        proteinPercentage: true,
        ingredients: true,
        keyBenefits: true,
        howToUse: true,
        whenToUse: true,
        safetyInformation: true,
        allergenInfo: true,
        certifications: true,
        fssaiLicense: true,
        countryOfOrigin: true,
        marketedBy: true,
        manufacturedBy: true,
        sellerName: true,
        authenticityNote: true,
        returnPolicy: true,

        img1: true,
        img2: true,
        img3: true,
        img4: true,

        sizes: {
          select: {
            id: true,
            size: true,
            stock: true,
            price: true,
          },
        },
        variants: {
          orderBy: [{ isDefault: 'desc' }, { id: 'asc' }],
        },
        nutritionFacts: {
          orderBy: { position: 'asc' },
        },

        category: true,
        type: true,
        subtype: true,
        season: true,

        // ✅ FIX: ADD VENDORS WITH FULL DETAILS
        productVendors: {
          select: {
            id: true,
            vendorId: true,
            costPrice: true,
            fabricType: true,
            quantity: true,
            vendor: {
              select: {
                id: true,
                companyName: true,
                contactPersonName: true,
                contactNumber: true,
                emailId: true,
                gstNumber: true,
                address: true,
                vendorType: true,
                isActive: true,
              },
            },
          },
        },

        /* 🔥 NEW ATTRIBUTES */
        productColors: {
          select: {
            color: {
              select: {
                id: true,
                name: true,
                hex: true,
                slug: true,
              },
            },
          },
        },

        productFabrics: {
          select: {
            fabric: {
              select: {
                id: true,
                name: true,
                slug: true,
              },
            },
          },
        },

        productOccasions: {
          select: {
            occasion: {
              select: {
                id: true,
                name: true,
                slug: true,
              },
            },
          },
        },

        productFits: {
          select: {
            fit: {
              select: {
                id: true,
                name: true,
                slug: true,
              },
            },
          },
        },

        productSleeves: {
          select: {
            sleeve: {
              select: {
                id: true,
                name: true,
                slug: true,
              },
            },
          },
        },

        productPatterns: {
          select: {
            pattern: {
              select: {
                id: true,
                name: true,
                slug: true,
              },
            },
          },
        },

        createdAt: true,
        updatedAt: true,
      },
    });

    if (!product || !product.isActive) {
      throw new NotFoundException('Product not found');
    }

    return {
      ...product,
      finalPrice: this.getFinalPrice(product),
      ...(await this.getRatingSummary(product.id)),

      // 🔥 Normalize arrays for frontend
      colors: product.productColors.map((p) => p.color),
      fabrics: product.productFabrics.map((p) => p.fabric),
      occasions: product.productOccasions.map((p) => p.occasion),
      fits: product.productFits.map((p) => p.fit),
      sleeves: product.productSleeves.map((p) => p.sleeve),
      patterns: product.productPatterns.map((p) => p.pattern),
    };
  }

  // ----------------------------------
  // FIND BY SLUG
  // ----------------------------------
  async findBySlug(slug: string) {
    const parts = slug.split('-');
    const lastPart = parts[parts.length - 1];

    // 🔒 slug-id safety (example: product-name-123)
    if (/^\d+$/.test(lastPart)) {
      return this.findOne(Number(lastPart));
    }

    const product = await this.prisma.product.findUnique({
      where: { slug },
      select: {
        id: true,
        title: true,
        slug: true,
        description: true,
        shortDescription: true,

        metaTitle: true,
        metaDescription: true,
        metaKeywords: true,

        price: true,
        discountType: true,
        discountValue: true,

        isTrending: true,
        isFeatured: true,
        isBestSeller: true,
        isNewLaunch: true,
        isActive: true,
        status: true,
        freeShipping: true,
        stock: true,
        weight: true,
        estimatedShipping: true,

        brandName: true,
        productLine: true,
        goal: true,
        dietaryPreference: true,
        proteinType: true,
        servingSize: true,
        servingsPerContainer: true,
        proteinPerServing: true,
        bcaaPerServing: true,
        eaaPerServing: true,
        caloriesPerServing: true,
        proteinPercentage: true,
        ingredients: true,
        keyBenefits: true,
        howToUse: true,
        whenToUse: true,
        safetyInformation: true,
        allergenInfo: true,
        certifications: true,
        fssaiLicense: true,
        countryOfOrigin: true,
        marketedBy: true,
        manufacturedBy: true,
        sellerName: true,
        authenticityNote: true,
        returnPolicy: true,

        img1: true,
        img2: true,
        img3: true,
        img4: true,

        sizes: {
          select: {
            id: true,
            size: true,
            stock: true,
            price: true,
          },
        },
        variants: {
          orderBy: [{ isDefault: 'desc' }, { id: 'asc' }],
        },
        nutritionFacts: {
          orderBy: { position: 'asc' },
        },

        category: true,
        type: true,
        subtype: true,
        season: true,

        // ✅ FIX: ADD VENDORS WITH FULL DETAILS
        productVendors: {
          select: {
            id: true,
            vendorId: true,
            costPrice: true,
            fabricType: true,
            quantity: true,
            vendor: {
              select: {
                id: true,
                companyName: true,
                contactPersonName: true,
                contactNumber: true,
                emailId: true,
                gstNumber: true,
                address: true,
                vendorType: true,
                isActive: true,
              },
            },
          },
        },

        /* 🔥 NEW ATTRIBUTE RELATIONS */
        productColors: {
          select: {
            color: {
              select: {
                id: true,
                name: true,
                hex: true,
                slug: true,
              },
            },
          },
        },

        productFabrics: {
          select: {
            fabric: {
              select: {
                id: true,
                name: true,
                slug: true,
              },
            },
          },
        },

        productOccasions: {
          select: {
            occasion: {
              select: {
                id: true,
                name: true,
                slug: true,
              },
            },
          },
        },

        productFits: {
          select: {
            fit: {
              select: {
                id: true,
                name: true,
                slug: true,
              },
            },
          },
        },

        productSleeves: {
          select: {
            sleeve: {
              select: {
                id: true,
                name: true,
                slug: true,
              },
            },
          },
        },

        productPatterns: {
          select: {
            pattern: {
              select: {
                id: true,
                name: true,
                slug: true,
              },
            },
          },
        },

        createdAt: true,
        updatedAt: true,
      },
    });

    if (!product || !product.isActive) {
      throw new NotFoundException('Product not found');
    }

    return {
      ...product,
      finalPrice: this.getFinalPrice(product),
      ...(await this.getRatingSummary(product.id)),

      // 🔥 Normalize for frontend
      colors: product.productColors.map((p) => p.color),
      fabrics: product.productFabrics.map((p) => p.fabric),
      occasions: product.productOccasions.map((p) => p.occasion),
      fits: product.productFits.map((p) => p.fit),
      sleeves: product.productSleeves.map((p) => p.sleeve),
      patterns: product.productPatterns.map((p) => p.pattern),
    };
  }

  // ----------------------------------
  // UPDATE PRODUCT
  // ----------------------------------
  async update(id: number, body: any, files: any) {
    body = body || {};
    await this.findOne(id);

    const images: any = {};

    if (files?.image1?.[0]) images.img1 = files.image1[0].filename;
    if (files?.image2?.[0]) images.img2 = files.image2[0].filename;
    if (files?.image3?.[0]) images.img3 = files.image3[0].filename;
    if (files?.image4?.[0]) images.img4 = files.image4[0].filename;

    for (let i = 1; i <= 4; i++) {
      if (body[`remove_image_${i}`] === 'true') {
        images[`img${i}`] = null;
      }
    }

    const data: any = { ...images };

    if (body.title !== undefined) data.title = body.title;
    if (body.description !== undefined) data.description = body.description;
    if (body.shortDescription !== undefined)
      data.shortDescription = body.shortDescription || null;

    if (body.price !== undefined) {
      const price = Number(body.price);
      if (!isNaN(price) && price >= 0) {
        data.price = new Prisma.Decimal(price);
      }
    }

    if (body.gstRate !== undefined) {
      const gstRate = body.gstRate !== '' ? Number(body.gstRate) : 0;
      if (isNaN(gstRate) || gstRate < 0 || gstRate > 100) {
        throw new BadRequestException('GST rate must be between 0 and 100');
      }
      data.gstRate = new Prisma.Decimal(gstRate);
    }

    if (body.stock !== undefined) {
      const stock = Number(body.stock);
      if (!isNaN(stock) && stock >= 0) {
        data.stock = stock;
      }
    }

    if (body.weight !== undefined) {
      const weight = Number(body.weight);
      if (!isNaN(weight) && weight >= 0.05 && weight <= 10) {
        data.weight = new Prisma.Decimal(weight);
      }
    }

    // ✅ Add discount handling
    if (body.discountType !== undefined) {
      data.discountType = body.discountType || null;
    }

    if (body.discountValue !== undefined) {
      const discountValue =
        body.discountValue !== '' ? Number(body.discountValue) : null;
      data.discountValue =
        discountValue !== null ? new Prisma.Decimal(discountValue) : null;
    }

    if (body.isTrending !== undefined) {
      data.isTrending = parseBool(body.isTrending);
    }

    if (body.isFeatured !== undefined) {
      data.isFeatured = parseBool(body.isFeatured);
    }

    if (body.isBestSeller !== undefined) {
      data.isBestSeller = parseBool(body.isBestSeller);
    }

    if (body.isNewLaunch !== undefined) {
      data.isNewLaunch = parseBool(body.isNewLaunch);
    }

    if (body.status !== undefined) {
      data.status = body.status || 'ACTIVE';
    }

    if (body.freeShipping !== undefined) {
      data.freeShipping = parseBool(body.freeShipping);
    }

    const supplementTextFields = [
      'brandName',
      'productLine',
      'goal',
      'dietaryPreference',
      'proteinType',
      'servingSize',
      'ingredients',
      'howToUse',
      'whenToUse',
      'safetyInformation',
      'allergenInfo',
      'fssaiLicense',
      'countryOfOrigin',
      'marketedBy',
      'manufacturedBy',
      'sellerName',
      'authenticityNote',
      'returnPolicy',
    ];

    for (const field of supplementTextFields) {
      if (body[field] !== undefined) data[field] = body[field] || null;
    }

    if (body.servingsPerContainer !== undefined) {
      data.servingsPerContainer = body.servingsPerContainer
        ? Number(body.servingsPerContainer)
        : null;
    }

    const supplementDecimalFields = [
      'proteinPerServing',
      'bcaaPerServing',
      'eaaPerServing',
      'caloriesPerServing',
      'proteinPercentage',
    ];

    for (const field of supplementDecimalFields) {
      if (body[field] !== undefined)
        data[field] = parseDecimalOrNull(body[field]);
    }

    if (body.keyBenefits !== undefined) {
      data.keyBenefits = parseJsonValue(body.keyBenefits, 'keyBenefits') ?? [];
    }

    if (body.certifications !== undefined) {
      data.certifications =
        parseJsonValue(body.certifications, 'certifications') ?? [];
    }

    // ✅ FIX: Validate IDs before using them
    if (body.categoryId) {
      const categoryId = Number(body.categoryId);
      if (!isNaN(categoryId)) {
        data.category = { connect: { id: categoryId } };
      }
    }

    if (body.typeId !== undefined) {
      const typeId = parseOptionalId(body.typeId);
      data.typeId = typeId;
    }

    if (body.subtypeId !== undefined) {
      const subtypeId = parseOptionalId(body.subtypeId);
      data.subtypeId = subtypeId;
    }

    // Optional relation
    if (body.seasonId !== undefined) {
      const seasonId = body.seasonId ? Number(body.seasonId) : null;
      if (seasonId && !isNaN(seasonId)) {
        data.season = { connect: { id: seasonId } };
      } else if (seasonId === null || body.seasonId === '') {
        data.season = { disconnect: true };
      }
    }

    return this.prisma.$transaction(async (tx) => {
      // 1️⃣ Product core
      await tx.product.update({
        where: { id, isActive: true },
        data,
      });

      // 2️⃣ Sizes
      if (body.sizes !== undefined) {
        const sizes = JSON.parse(body.sizes);
        const incomingIds = sizes.filter((s) => s.id).map((s) => s.id);

        await tx.productSize.deleteMany({
          where: {
            productId: id,
            ...(incomingIds.length && { id: { notIn: incomingIds } }),
          },
        });

        for (const s of sizes) {
          if (s.id) {
            await tx.productSize.update({
              where: { id: s.id },
              data: { stock: Number(s.stock) },
            });
          } else {
            await tx.productSize.create({
              data: {
                productId: id,
                size: s.size,
                stock: Number(s.stock),
              },
            });
          }
        }
      }

      // 3️⃣ Attributes
      const syncMany = async (table: any, key: string, value: any) => {
        if (value === undefined) return;

        const ids = parseIdArray(value);
        if (!Array.isArray(ids)) return;

        await table.deleteMany({ where: { productId: id } });
        if (!ids.length) return;

        await table.createMany({
          data: ids.map((v) => ({
            productId: id,
            [key]: v,
          })),
        });
      };

      await syncMany(tx.productColor, 'colorId', body.colors);
      await syncMany(tx.productFabric, 'fabricId', body.fabrics);
      await syncMany(tx.productOccasion, 'occasionId', body.occasions);
      await syncMany(tx.productFit, 'fitId', body.fits);
      await syncMany(tx.productSleeve, 'sleeveId', body.sleeves);
      await syncMany(tx.productPattern, 'patternId', body.patterns);

      // ✅ FIX: ADD VENDOR SYNC
      if (body.vendorId !== undefined) {
        const vendorInfo = body.vendorId ? JSON.parse(body.vendorId) : [];

        // Delete all existing vendor connections for this product
        await tx.productVendor.deleteMany({
          where: { productId: id },
        });

        // Create new vendor connections
        if (Array.isArray(vendorInfo) && vendorInfo.length > 0) {
          await tx.productVendor.createMany({
            data: vendorInfo.map((vendor: any) => ({
              productId: id,
              vendorId: Number(vendor.vendorId),
              costPrice: new Prisma.Decimal(vendor.costPrice),
              fabricType: vendor.fabricType || null,
              quantity: Number(vendor.quantity) || 1,
            })),
            skipDuplicates: true,
          });
        }
      }

      if (body.variants !== undefined) {
        const variants = parseJsonArray(body.variants, 'variants').map(
          mapVariantInput,
        );

        await tx.productVariant.deleteMany({ where: { productId: id } });

        if (variants.length) {
          const hasDefault = variants.some((variant) => variant.isDefault);
          await tx.productVariant.createMany({
            data: variants.map((variant, index) => ({
              ...variant,
              productId: id,
              isDefault: hasDefault ? variant.isDefault : index === 0,
            })),
          });

          await tx.product.update({
            where: { id },
            data: {
              stock: variants.reduce(
                (sum, variant) => sum + Number(variant.stock),
                0,
              ),
            },
          });
        }
      }

      if (body.nutritionFacts !== undefined) {
        const nutritionFacts = parseJsonArray(
          body.nutritionFacts,
          'nutritionFacts',
        ).map(mapNutritionFactInput);

        await tx.nutritionFact.deleteMany({ where: { productId: id } });

        if (nutritionFacts.length) {
          await tx.nutritionFact.createMany({
            data: nutritionFacts.map((fact) => ({
              ...fact,
              productId: id,
            })),
          });
        }
      }

      return { success: true };
    });
  }
  // ----------------------------------
  // DELETE PRODUCT
  // ----------------------------------
  async remove(id: number) {
    await this.findOne(id);

    return this.prisma.product.update({
      where: { id },
      data: {
        isActive: false,
        isTrending: false,
        discountType: null,
        discountValue: null,
      },
    });
  }
  // ----------------------------------
  // UPDATE STOCK
  // ----------------------------------
  async updateStock(productId: number, stock: number) {
    if (stock < 0) {
      throw new BadRequestException('Stock cannot be negative');
    }
    if (!Number.isInteger(stock)) {
      throw new BadRequestException('Stock must be an integer');
    }

    const product = await this.prisma.product.findFirst({
      where: {
        id: productId,
        isActive: true,
      },
    });

    if (!product) {
      throw new NotFoundException('Product not found');
    }

    return this.prisma.product.update({
      where: { id: productId },
      data: { stock },
    });
  }

  // ----------------------------------
  // UPDATE DISCOUNT
  // ----------------------------------
  // @deprecated — use update() instead
  async updateDiscount(
    id: number,
    body: { discountType?: string; discountValue?: number },
  ) {
    const product = await this.prisma.product.findFirst({
      where: {
        id,
        isActive: true, // ✅ CRITICAL
      },
    });

    if (!product) {
      throw new NotFoundException('Product not found');
    }

    const { discountType, discountValue } = body;

    // Remove discount
    if (!discountType || discountValue == null) {
      return this.prisma.product.update({
        where: { id },
        data: {
          discountType: null,
          discountValue: null,
        },
      });
    }

    if (discountType === 'PERCENT') {
      if (discountValue <= 0 || discountValue > 100) {
        throw new BadRequestException(
          'Discount percent must be between 1 and 100',
        );
      }
    }

    if (discountType === 'FLAT') {
      if (discountValue <= 0) {
        throw new BadRequestException('Flat discount must be greater than 0');
      }

      if (discountValue >= Number(product.price)) {
        throw new BadRequestException('Flat discount must be less than price');
      }
    }

    return this.prisma.product.update({
      where: { id },
      data: {
        discountType,
        discountValue,
      },
    });
  }

  // ----------------------------------
  // LOW STOCK
  // ----------------------------------
  async getLowStock(threshold = 5) {
    return this.prisma.product.findMany({
      where: {
        isActive: true, // ✅ CRITICAL
        stock: {
          gt: 0,
          lte: threshold,
        },
      },
      select: {
        id: true,
        title: true,
        stock: true,
      },
      orderBy: {
        stock: 'asc',
      },
    });
  }

  // ----------------------------------
  // UPDATE PRODUCT SEO
  // ----------------------------------
  async updateSeo(id: number, dto: UpdateProductSeoDto) {
    const product = await this.prisma.product.findUnique({
      where: { id },
    });

    if (!product || !product.isActive) {
      throw new NotFoundException('Product not found');
    }

    const data: any = {};

    // -------------------------------
    // SLUG (safe, trimmed, unique)
    // -------------------------------
    if (dto.slug && dto.slug.trim()) {
      const baseSlug = this.generateSlug(dto.slug.trim());

      const exists = await this.prisma.product.findFirst({
        where: {
          slug: baseSlug,
          NOT: { id },
        },
      });

      data.slug = exists ? `${baseSlug}-${Date.now()}` : baseSlug;
    }

    // -------------------------------
    // SEO FIELDS
    // -------------------------------
    if (dto.metaTitle !== undefined) {
      data.metaTitle = dto.metaTitle?.trim() || null;
    }

    if (dto.metaDescription !== undefined) {
      data.metaDescription = dto.metaDescription?.trim() || null;
    }

    if (dto.metaKeywords !== undefined) {
      data.metaKeywords = dto.metaKeywords?.trim() || null;
    }

    // -------------------------------
    // NO-OP PROTECTION
    // -------------------------------
    if (Object.keys(data).length === 0) {
      throw new BadRequestException('No SEO fields provided');
    }

    return this.prisma.product.update({
      where: { id },
      data,
    });
  }

  async getHomeTrending(limit = 8) {
    const products = await this.prisma.product.findMany({
      where: {
        isActive: true,
        isTrending: true,
      },
      orderBy: {
        updatedAt: 'desc',
      },
      take: limit,
      select: {
        id: true,
        title: true,
        slug: true,
        price: true,
        discountType: true,
        discountValue: true,
        img1: true,
      },
    });

    return products.map((p) => ({
      ...p,
      finalPrice: this.getFinalPrice(p),
    }));
  }

  async getHomeDiscounts(limit = 8) {
    const products = await this.prisma.product.findMany({
      where: {
        isActive: true,
        discountType: { in: ['PERCENT', 'FLAT'] },
        discountValue: { gt: 0 },
      },
      orderBy: {
        discountValue: 'desc',
      },
      take: limit,
      select: {
        id: true,
        title: true,
        slug: true,
        price: true,
        discountType: true,
        discountValue: true,
        img1: true,
      },
    });

    return products.map((p) => ({
      ...p,
      finalPrice: this.getFinalPrice(p),
    }));
  }

  // ----------------------------------
  // BULK UPLOAD WITH IMAGES - SMART
  // ----------------------------------
  async bulkUploadWithImages(
    dataFile: Express.Multer.File,
    imageZip?: Express.Multer.File,
  ) {
    if (!dataFile) {
      throw new BadRequestException('No data file uploaded');
    }

    // Parse using SMART parser (supports names!)
    const { products, imageMap } = await this.smartParser.parseFile(
      dataFile.buffer,
      dataFile.originalname,
      imageZip?.buffer,
    );

    const results = {
      total: products.length,
      successful: 0,
      failed: 0,
      errors: [] as any[],
      successfulProducts: [] as any[],
      imageStats: {
        total: imageMap.size,
        used: 0,
        unused: [] as string[],
      },
    };

    const usedImages = new Set<string>();

    // Process each product
    for (let i = 0; i < products.length; i++) {
      const row = products[i];
      const rowNumber = i + 2;

      try {
        const images = this.mapProductImages(row, imageMap, usedImages);
        const product = await this.createFromParsedRow(row, images);
        results.successful++;
        results.successfulProducts.push({
          rowNumber,
          productId: product.id,
          title: product.title,
          slug: product.slug,
        });
      } catch (error) {
        results.failed++;
        results.errors.push({
          rowNumber,
          title: row.title,
          error: error.message,
        });
      }
    }

    results.imageStats.used = usedImages.size;
    results.imageStats.unused = Array.from(imageMap.keys()).filter(
      (img) => !usedImages.has(img),
    ) as string[];

    return results;
  }

  // ----------------------------------
  // VALIDATE BULK UPLOAD - SMART
  // ----------------------------------
  async validateBulkUploadWithImages(
    dataFile: Express.Multer.File,
    imageZip?: Express.Multer.File,
  ) {
    if (!dataFile) {
      throw new BadRequestException('No data file uploaded');
    }

    // Parse using SMART parser
    const { products, imageMap } = await this.smartParser.parseFile(
      dataFile.buffer,
      dataFile.originalname,
      imageZip?.buffer,
    );

    const validationResults = {
      total: products.length,
      valid: 0,
      invalid: 0,
      warnings: [] as any[],
      errors: [] as any[],
      imageStats: {
        totalInZip: imageMap.size,
        referenced: 0,
        missing: [] as string[],
        unreferenced: [] as string[],
      },
    };

    const referencedImages = new Set<string>();

    for (let i = 0; i < products.length; i++) {
      const row = products[i];
      const rowNumber = i + 2;
      const rowErrors: string[] = [];
      const rowWarnings: string[] = [];

      // Category should be already resolved by smart parser
      if (!row.categoryId) {
        rowErrors.push('Category not found');
      }

      // Type should be already resolved
      if (!row.typeId) {
        rowErrors.push('Type not found');
      }

      // Subtype should be already resolved
      if (!row.subtypeId) {
        rowErrors.push('Subtype not found');
      }

      // Validate images
      [row.image1, row.image2, row.image3, row.image4].forEach((img, idx) => {
        if (img && img.trim()) {
          referencedImages.add(img);

          if (
            !imageMap.has(img) &&
            !img.startsWith('http://') &&
            !img.startsWith('https://')
          ) {
            rowWarnings.push(`Image${idx + 1} "${img}" not found in ZIP file`);
          }
        }
      });

      if (rowErrors.length > 0) {
        validationResults.invalid++;
        validationResults.errors.push({
          rowNumber,
          title: row.title,
          errors: rowErrors,
          warnings: rowWarnings,
        });
      } else {
        validationResults.valid++;
        if (rowWarnings.length > 0) {
          validationResults.warnings.push({
            rowNumber,
            title: row.title,
            warnings: rowWarnings,
          });
        }
      }
    }

    validationResults.imageStats.referenced = referencedImages.size;
    validationResults.imageStats.unreferenced = Array.from(
      imageMap.keys(),
    ).filter((img) => !referencedImages.has(img)) as string[];

    return validationResults;
  }

  // ----------------------------------
  // DOWNLOAD SMART TEMPLATE
  // ----------------------------------
  async downloadSmartTemplate(): Promise<string> {
    return await this.smartParser.generateSmartTemplate();
  }

  // ----------------------------------
  // DOWNLOAD SMART INSTRUCTIONS
  // ----------------------------------
  async downloadSmartInstructions(): Promise<string> {
    return SmartBulkProductParser.generateSmartInstructions();
  }

  // ----------------------------------
  // EXISTING HELPER METHODS
  // ----------------------------------
  private mapProductImages(
    row: ParsedProductRow,
    imageMap: Map<string, string>,
    usedImages: Set<string>,
  ) {
    const images = {
      img1: null as string | null,
      img2: null as string | null,
      img3: null as string | null,
      img4: null as string | null,
    };

    const resolveImage = (imageName?: string): string | null => {
      if (!imageName || !imageName.trim()) return null;

      if (imageMap.has(imageName)) {
        usedImages.add(imageName);
        return imageMap.get(imageName) || null;
      }

      if (imageName.startsWith('http://') || imageName.startsWith('https://')) {
        return imageName;
      }

      return imageName;
    };

    images.img1 = resolveImage(row.image1);
    images.img2 = resolveImage(row.image2);
    images.img3 = resolveImage(row.image3);
    images.img4 = resolveImage(row.image4);

    return images;
  }

  private async createFromParsedRow(
    row: ParsedProductRow,
    images?: {
      img1: string | null;
      img2: string | null;
      img3: string | null;
      img4: string | null;
    },
  ) {
    const sizes = this.parseSizesString(row.sizes);
    const vendorInfo = this.parseVendorsString(row.vendors);

    const baseSlug = this.generateBulkSlug(row.title);
    const exists = await this.prisma.product.findUnique({
      where: { slug: baseSlug },
    });
    const slug = exists ? `${baseSlug}-${Date.now()}` : baseSlug;

    const colorIds = this.parseIdString(row.colors);
    const fabricIds = this.parseIdString(row.fabrics);
    const occasionIds = this.parseIdString(row.occasions);
    const fitIds = this.parseIdString(row.fits);
    const sleeveIds = this.parseIdString(row.sleeves);
    const patternIds = this.parseIdString(row.patterns);

    return this.prisma.$transaction(async (tx) => {
      const product = await tx.product.create({
        data: {
          title: row.title,
          slug,
          description: row.description || '',

          metaTitle: row.metaTitle || null,
          metaDescription: row.metaDescription || null,
          metaKeywords: row.metaKeywords || null,

          price: new Prisma.Decimal(row.price),
          stock: row.stock,
          weight: new Prisma.Decimal(row.weight),
          estimatedShipping: row.estimatedShipping || 3,

          discountType: row.discountType || null,
          discountValue: row.discountValue
            ? new Prisma.Decimal(row.discountValue)
            : null,

          isActive: true,
          isTrending: row.isTrending || false,
          freeShipping: row.freeShipping || false,

          category: { connect: { id: row.categoryId } },
          type: { connect: { id: row.typeId } },
          subtype: { connect: { id: row.subtypeId } },

          ...(row.seasonId && {
            season: { connect: { id: row.seasonId } },
          }),

          img1: images?.img1 || null,
          img2: images?.img2 || null,
          img3: images?.img3 || null,
          img4: images?.img4 || null,
        },
      });

      if (sizes.length > 0) {
        await tx.productSize.createMany({
          data: sizes.map((s) => ({
            productId: product.id,
            size: s.size,
            stock: s.stock,
          })),
        });
      }

      if (colorIds.length) {
        await tx.productColor.createMany({
          data: colorIds.map((id) => ({
            productId: product.id,
            colorId: id,
          })),
          skipDuplicates: true,
        });
      }

      if (fabricIds.length) {
        await tx.productFabric.createMany({
          data: fabricIds.map((id) => ({
            productId: product.id,
            fabricId: id,
          })),
          skipDuplicates: true,
        });
      }

      if (occasionIds.length) {
        await tx.productOccasion.createMany({
          data: occasionIds.map((id) => ({
            productId: product.id,
            occasionId: id,
          })),
          skipDuplicates: true,
        });
      }

      if (fitIds.length) {
        await tx.productFit.createMany({
          data: fitIds.map((id) => ({
            productId: product.id,
            fitId: id,
          })),
          skipDuplicates: true,
        });
      }

      if (sleeveIds.length) {
        await tx.productSleeve.createMany({
          data: sleeveIds.map((id) => ({
            productId: product.id,
            sleeveId: id,
          })),
          skipDuplicates: true,
        });
      }

      if (patternIds.length) {
        await tx.productPattern.createMany({
          data: patternIds.map((id) => ({
            productId: product.id,
            patternId: id,
          })),
          skipDuplicates: true,
        });
      }

      if (vendorInfo.length > 0) {
        await tx.productVendor.createMany({
          data: vendorInfo.map((vendor) => ({
            productId: product.id,
            vendorId: vendor.vendorId,
            costPrice: new Prisma.Decimal(vendor.costPrice),
            fabricType: vendor.fabricType || null,
            quantity: vendor.quantity || 1,
          })),
          skipDuplicates: true,
        });
      }

      return product;
    });
  }

  private parseSizesString(
    sizesStr?: string,
  ): { size: string; stock: number }[] {
    if (!sizesStr || !sizesStr.trim()) {
      return [];
    }

    try {
      const pairs = sizesStr.split(',');
      const sizes = pairs.map((pair) => {
        const [size, stock] = pair.split(':');
        if (!size || !stock) {
          throw new Error('Invalid size format');
        }
        return {
          size: size.trim(),
          stock: parseInt(stock.trim()),
        };
      });

      const sizeSet = new Set(sizes.map((s) => s.size));
      if (sizeSet.size !== sizes.length) {
        throw new Error('Duplicate sizes found');
      }

      return sizes;
    } catch (error) {
      throw new BadRequestException(
        `Invalid sizes format. Use: S:10,M:20,L:15`,
      );
    }
  }

  private parseVendorsString(vendorsStr?: string): Array<{
    vendorId: number;
    costPrice: number;
    fabricType?: string;
    quantity?: number;
  }> {
    if (!vendorsStr || !vendorsStr.trim()) {
      return [];
    }

    try {
      const vendors = vendorsStr.split('|').map((vendorStr) => {
        const parts = vendorStr.split(':').map((s) => s.trim());
        const [vendorId, costPrice, fabricType, quantity] = parts;

        if (!vendorId || !costPrice) {
          throw new Error('Invalid vendor format');
        }

        return {
          vendorId: parseInt(vendorId),
          costPrice: parseFloat(costPrice),
          fabricType: fabricType || null,
          quantity: quantity ? parseInt(quantity) : 1,
        };
      });

      return vendors;
    } catch (error) {
      throw new BadRequestException(
        `Invalid vendors format. Use: vendorId:costPrice:fabricType:quantity|...`,
      );
    }
  }

  private parseIdString(idsStr?: string): number[] {
    if (!idsStr || !idsStr.trim()) {
      return [];
    }

    try {
      return idsStr
        .split(',')
        .map((id) => parseInt(id.trim()))
        .filter((id) => !isNaN(id) && id > 0);
    } catch {
      return [];
    }
  }

  private generateBulkSlug(title: string): string {
    return title
      .toLowerCase()
      .trim()
      .replace(/[^\w\s-]/g, '')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-');
  }
}
