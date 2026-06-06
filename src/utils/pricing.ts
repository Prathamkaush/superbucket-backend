import { Decimal } from "@prisma/client/runtime/library";

export function calculateFinalPrice(
  price: Decimal,
  discountType?: string | null,
  discountValue?: Decimal | null
): number {
  const base = Number(price);

  if (!discountType || !discountValue) {
    return base;
  }

  if (discountType === "PERCENT") {
    return Math.max(
      0,
      Math.round(base - (base * Number(discountValue)) / 100)
    );
  }

  if (discountType === "FLAT") {
    return Math.max(0, Math.round(base - Number(discountValue)));
  }

  return base;
}
