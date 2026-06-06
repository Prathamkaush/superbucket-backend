import { Injectable, BadRequestException } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { calculateFinalPrice } from "../utils/pricing";

@Injectable()
export class WishlistService {
  constructor(private prisma: PrismaService) {}

  async toggleWishlist(userId: number, productId: number, variantId?: number) {
    const product = await this.prisma.product.findUnique({
      where: { id: productId },
    });

    if (!product) {
      throw new BadRequestException("Product not found");
    }

    const existing = await this.prisma.wishlist.findFirst({
      where: {
        userId,
        productId,
        variantId: variantId ?? null,
      },
    });

    // ✅ REMOVE
    if (existing) {
      await this.prisma.wishlist.delete({
        where: { id: existing.id },
      });
      return { wished: false };
    }

    // ✅ ADD
    await this.prisma.wishlist.create({
      data: {
        userId,
        productId,
        variantId: variantId ?? null,
      },
    });

    return { wished: true };
  }

  async isWishlisted(userId: number, productId: number, variantId?: number) {
    const exists = await this.prisma.wishlist.findFirst({
      where: { userId, productId, variantId: variantId ?? null },
    });

    return {
      wished: !!exists,
      productId,
      variantId: variantId ?? null,
    };
  }

  async getUserWishlist(userId: number) {
const items = await this.prisma.wishlist.findMany({
where: { userId },
orderBy: { createdAt: "desc" },
include: {
product: {
select: {
id: true,
title: true,
slug: true,
img1: true,
price: true,
discountType: true,
discountValue: true,
stock: true,
},
},
variant: {
select: {
id: true,
sku: true,
flavour: true,
weightLabel: true,
price: true,
discountType: true,
discountValue: true,
stock: true,
image1: true,
},
},
size: {
select: {
id: true,
size: true,
stock: true,
},
},
},
});

return items.map((item) => {
const finalPrice = calculateFinalPrice(
item.product.price,
item.product.discountType,
item.product.discountValue
);

return {
...item,
product: {
...item.product,
finalPrice, // 🔥 COMPUTED, NOT STORED
},
};
});
}

}


