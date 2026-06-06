import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  /* ---------------- COLORS ---------------- */
  await prisma.color.createMany({
    skipDuplicates: true,
    data: [
      { name: "Black", slug: "black", hex: "#000000" },
      { name: "White", slug: "white", hex: "#ffffff" },
      { name: "Red", slug: "red", hex: "#ff0000" },
      { name: "Pink", slug: "pink", hex: "#ffc0cb" },
      { name: "Blue", slug: "blue", hex: "#0000ff" },
      { name: "Green", slug: "green", hex: "#008000" },
      { name: "Yellow", slug: "yellow", hex: "#ffff00" },
      { name: "Beige", slug: "beige", hex: "#f5f5dc" },
      { name: "Grey", slug: "grey", hex: "#808080" },
    ],
  });

  /* ---------------- FABRICS ---------------- */
  await prisma.fabric.createMany({
    skipDuplicates: true,
    data: [
      { name: "Cotton", slug: "cotton" },
      { name: "Rayon", slug: "rayon" },
      { name: "Silk", slug: "silk" },
      { name: "Chiffon", slug: "chiffon" },
      { name: "Georgette", slug: "georgette" },
      { name: "Linen", slug: "linen" },
      { name: "Denim", slug: "denim" },
      { name: "Wool", slug: "wool" },
    ],
  });

  /* ---------------- OCCASIONS ---------------- */
  await prisma.occasion.createMany({
    skipDuplicates: true,
    data: [
      { name: "Casual", slug: "casual" },
      { name: "Party", slug: "party" },
      { name: "Wedding", slug: "wedding" },
      { name: "Festive", slug: "festive" },
      { name: "Office Wear", slug: "office-wear" },
      { name: "Daily Wear", slug: "daily-wear" },
    ],
  });

  /* ---------------- FITS ---------------- */
  await prisma.fit.createMany({
    skipDuplicates: true,
    data: [
      { name: "Slim Fit", slug: "slim-fit" },
      { name: "Regular Fit", slug: "regular-fit" },
      { name: "Relaxed Fit", slug: "relaxed-fit" },
      { name: "Oversized", slug: "oversized" },
      { name: "Bodycon", slug: "bodycon" },
      { name: "A-Line", slug: "a-line" },
    ],
  });

  /* ---------------- SLEEVES ---------------- */
  await prisma.sleeve.createMany({
    skipDuplicates: true,
    data: [
      { name: "Sleeveless", slug: "sleeveless" },
      { name: "Short Sleeve", slug: "short-sleeve" },
      { name: "Half Sleeve", slug: "half-sleeve" },
      { name: "Full Sleeve", slug: "full-sleeve" },
      { name: "Cap Sleeve", slug: "cap-sleeve" },
    ],
  });

  /* ---------------- PATTERNS ---------------- */
  await prisma.pattern.createMany({
    skipDuplicates: true,
    data: [
      { name: "Solid", slug: "solid" },
      { name: "Printed", slug: "printed" },
      { name: "Floral", slug: "floral" },
      { name: "Striped", slug: "striped" },
      { name: "Checked", slug: "checked" },
      { name: "Embroidered", slug: "embroidered" },
    ],
  });

  /* ---------------- SEASONS ---------------- */
  await prisma.season.createMany({
    skipDuplicates: true,
    data: [
      { name: "Summer", slug: "summer" },
      { name: "Winter", slug: "winter" },
      { name: "Monsoon", slug: "monsoon" },
      { name: "All Season", slug: "all-season" },
    ],
  });

  console.log("✅ Attribute seed completed");
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
