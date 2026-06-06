"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const client_1 = require("@prisma/client");
const prisma = new client_1.PrismaClient();
async function main() {
    console.log("🌱 Starting database seed...");
    // -------------------------------
    // 1️⃣ CREATE CATEGORIES
    // -------------------------------
    const women = await prisma.category.create({
        data: { name: "Women" },
    });
    const men = await prisma.category.create({
        data: { name: "Men" },
    });
    const kids = await prisma.category.create({
        data: { name: "Kids" },
    });
    console.log("✔ Categories added");
    // -------------------------------
    // 2️⃣ WOMEN PRODUCT TYPES
    // -------------------------------
    const ethnicWear = await prisma.productType.create({
        data: {
            name: "Ethnic Wear",
            categoryId: women.id,
        },
    });
    const westernWear = await prisma.productType.create({
        data: {
            name: "Western Wear",
            categoryId: women.id,
        },
    });
    const winterWear = await prisma.productType.create({
        data: {
            name: "Winter Wear",
            categoryId: women.id,
        },
    });
    const nightwear = await prisma.productType.create({
        data: {
            name: "Innerwear & Nightwear",
            categoryId: women.id,
        },
    });
    const activeWear = await prisma.productType.create({
        data: {
            name: "Active Wear",
            categoryId: women.id,
        },
    });
    console.log("✔ Women product types added");
    // -------------------------------
    // 3️⃣ WOMEN SUBTYPES
    // -------------------------------
    await prisma.productSubtype.createMany({
        data: [
            // ETHNIC WEAR
            { name: "Kurtis", typeId: ethnicWear.id },
            { name: "Suits & Dress Material", typeId: ethnicWear.id },
            { name: "Sarees", typeId: ethnicWear.id },
            { name: "Lehenga Choli", typeId: ethnicWear.id },
            { name: "Blouses", typeId: ethnicWear.id },
            // WESTERN WEAR
            { name: "Tops", typeId: westernWear.id },
            { name: "Dresses", typeId: westernWear.id },
            { name: "Jeans", typeId: westernWear.id },
            { name: "Skirts", typeId: westernWear.id },
            { name: "Trousers", typeId: westernWear.id },
            { name: "Jumpsuits", typeId: westernWear.id },
            // WINTER WEAR
            { name: "Sweaters", typeId: winterWear.id },
            { name: "Cardigans", typeId: winterWear.id },
            { name: "Hoodies", typeId: winterWear.id },
            { name: "Jackets", typeId: winterWear.id },
            // NIGHTWEAR
            { name: "Night Suits", typeId: nightwear.id },
            { name: "Lingerie Sets", typeId: nightwear.id },
            { name: "Bras", typeId: nightwear.id },
            { name: "Panties", typeId: nightwear.id },
            // ACTIVE WEAR
            { name: "Sports Bra", typeId: activeWear.id },
            { name: "Leggings", typeId: activeWear.id },
            { name: "Track Pants", typeId: activeWear.id },
        ],
    });
    console.log("✔ Women subtypes added");
    // -------------------------------
    // 4️⃣ MEN PRODUCT TYPES
    // -------------------------------
    const topWearMen = await prisma.productType.create({
        data: { name: "Top Wear", categoryId: men.id },
    });
    const bottomWearMen = await prisma.productType.create({
        data: { name: "Bottom Wear", categoryId: men.id },
    });
    console.log("✔ Men product types added");
    // -------------------------------
    // 5️⃣ MEN SUBTYPES
    // -------------------------------
    await prisma.productSubtype.createMany({
        data: [
            { name: "T-Shirts", typeId: topWearMen.id },
            { name: "Shirts", typeId: topWearMen.id },
            { name: "Sweatshirts", typeId: topWearMen.id },
            { name: "Jeans", typeId: bottomWearMen.id },
            { name: "Trousers", typeId: bottomWearMen.id },
            { name: "Shorts", typeId: bottomWearMen.id },
        ],
    });
    console.log("✔ Men subtypes added");
    // -------------------------------
    // 6️⃣ KIDS PRODUCT TYPES
    // -------------------------------
    const girlsWear = await prisma.productType.create({
        data: { name: "Girls Wear", categoryId: kids.id },
    });
    const boysWear = await prisma.productType.create({
        data: { name: "Boys Wear", categoryId: kids.id },
    });
    console.log("✔ Kids product types added");
    // -------------------------------
    // 7️⃣ KIDS SUBTYPES
    // -------------------------------
    await prisma.productSubtype.createMany({
        data: [
            // Girls
            { name: "Frocks", typeId: girlsWear.id },
            { name: "Tops", typeId: girlsWear.id },
            { name: "Skirts", typeId: girlsWear.id },
            // Boys
            { name: "T-Shirts", typeId: boysWear.id },
            { name: "Shorts", typeId: boysWear.id },
            { name: "Shirts", typeId: boysWear.id },
        ],
    });
    console.log("✔ Kids subtypes added");
    console.log("🌱 SEED COMPLETE!");
}
main()
    .catch((e) => {
    console.error(e);
    process.exit(1);
})
    .finally(async () => {
    await prisma.$disconnect();
});
//# sourceMappingURL=seed.js.map