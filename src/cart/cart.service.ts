import { Injectable, NotFoundException , BadRequestException } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";

@Injectable()
export class CartService {
  constructor(private prisma: PrismaService) {}

private calculateFinalPrice(product: any): number {
  const price = Number(product.price);

  if (product.discountType === "PERCENT" && product.discountValue) {
    return Math.max(
      0,
      Math.round(price - (price * Number(product.discountValue)) / 100)
    );
  }

  if (product.discountType === "FLAT" && product.discountValue) {
    return Math.max(
      0,
      Math.round(price - Number(product.discountValue))
    );
  }

  return price;
}

private calculateGstAmount(price: number, gstRate: unknown): number {
  const rate = Number(gstRate || 0);
  if (!Number.isFinite(rate) || rate <= 0) return 0;
  return Math.round(((Number(price) * rate) / 100) * 100) / 100;
}


  // GET /cart
async getCart(userId: number) {
  const items = await this.prisma.cartItem.findMany({
    where: { userId },
    select: {
      id: true,
      quantity: true,
      price: true,
      gstRate: true,
      gstAmount: true,
      weight: true,
      product: {
        select: {
          id: true,
          title: true,
          slug: true,
          img1: true,
        },
      },
      variant: {
        select: {
          id: true,
          sku: true,
          name: true,
          attributes: true,
          flavour: true,
          weightLabel: true,
          image1: true,
        },
      },
      size: {
        select: {
          id: true,
          size: true,
        },
      },
    },
  });

  return { items };
}


  // POST /cart/add
async addToCart(
  userId: number,
  productId: number,
  variantId?: number,
  sizeId?: number,
  quantity: number = 1
) {
  const requestedQuantity = Math.floor(Number(quantity) || 1);

  if (requestedQuantity < 1) {
    throw new BadRequestException("Quantity must be at least 1");
  }

  const product = await this.prisma.product.findUnique({
    where: { id: productId },
    include: { sizes: true, variants: true },
  });

  if (!product) {
    throw new BadRequestException("Product not found");
  }

  const activeVariants = product.variants.filter((variant) => variant.status === "ACTIVE");
  let selectedVariant: any = null;

  if (activeVariants.length > 0) {
    selectedVariant = variantId
      ? activeVariants.find((variant) => variant.id === Number(variantId))
      : activeVariants.find((variant) => variant.isDefault);

    if (!selectedVariant) {
      throw new BadRequestException("Please select a valid product variant");
    }
  }

  if (!selectedVariant && product.sizes.length > 0 && !sizeId) {
    throw new BadRequestException("Please select a size");
  }

  const weight = Number(selectedVariant?.weightKg ?? product.weight);

if (!weight || weight <= 0) {
  throw new BadRequestException("Invalid product weight");
}

  let availableStock: number;

  if (selectedVariant) {
    availableStock = selectedVariant.stock;
  } else if (sizeId) {
    const size = await this.prisma.productSize.findUnique({
      where: { id: sizeId },
    });

    if (!size || size.productId !== productId) {
      throw new BadRequestException("Invalid size selected");
    }

    availableStock = size.stock;
  } else {
    availableStock = product.stock;
  }

  if (availableStock < 1) {
    throw new BadRequestException("Out of stock");
  }

  const finalPrice = selectedVariant
    ? this.calculateFinalPrice({
        price: selectedVariant.price,
        discountType: selectedVariant.discountType ?? product.discountType,
        discountValue: selectedVariant.discountValue ?? product.discountValue,
      })
    : this.calculateFinalPrice(product);
  const gstRate = Number(product.gstRate || 0);
  const gstAmount = this.calculateGstAmount(finalPrice, gstRate);

  const existing = await this.prisma.cartItem.findFirst({
    where: {
      userId,
      productId,
      variantId: selectedVariant?.id ?? null,
      sizeId: sizeId ?? null,
    },
  });

  if (existing) {
    if (existing.quantity + requestedQuantity > availableStock) {
      throw new BadRequestException("Not enough stock");
    }

    return this.prisma.cartItem.update({
      where: { id: existing.id },
      data: {
        quantity: existing.quantity + requestedQuantity,
        price: finalPrice,
        gstRate,
        gstAmount,
      },
    });
  }

  if (requestedQuantity > availableStock) {
    throw new BadRequestException("Not enough stock");
  }

  return this.prisma.cartItem.create({
    data: {
      userId,
      productId,
      variantId: selectedVariant?.id ?? null,
      sizeId: sizeId ?? null,
      quantity: requestedQuantity,
      price: finalPrice,
      gstRate,
      gstAmount,
      weight,
    },
  });
}
  // PUT /cart/:id  (update quantity)
  async updateQuantity(id: number, quantity: number, userId: number) {
  if (quantity < 1) {
    throw new BadRequestException("Quantity must be at least 1");
  }

  const item = await this.prisma.cartItem.findUnique({
    where: { id },
    include: {
      product: true,
      variant: true,
      size: true,
    },
  });

  if (!item || item.userId !== userId) {
    throw new NotFoundException("Cart item not found");
  }

  const availableStock = item.variant
    ? item.variant.stock
    : item.size
    ? item.size.stock
    : item.product.stock;

  if (quantity > availableStock) {
    throw new BadRequestException("Not enough stock available");
  }

  return this.prisma.cartItem.update({
    where: { id },
    data: { quantity },
  });
}


  // DELETE /cart/:id
  async removeItem(id: number, userId: number) {
    const item = await this.prisma.cartItem.findUnique({ where: { id } });

    if (!item || item.userId !== userId) {
      throw new NotFoundException("Item not found");
    }

    await this.prisma.cartItem.delete({ where: { id } });
    return { success: true };
  }
}
