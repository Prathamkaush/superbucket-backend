"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const prisma_service_1 = require("./src/prisma/prisma.service");
const products_service_1 = require("./src/products/products.service");
const enhanced_bulk_product_parser_util_1 = require("./src/products/utils/enhanced-bulk-product-parser.util");
async function main() {
    const prisma = new prisma_service_1.PrismaService();
    await prisma.$connect();
    const service = new products_service_1.ProductsService(prisma, new enhanced_bulk_product_parser_util_1.SmartBulkProductParser(prisma));
    const product = await service.create({
        title: `Generic variant test ${Date.now()}`,
        categoryId: '1',
        description: 'Temporary product used to verify generic variants.',
        price: '95',
        stock: '18',
        weight: '1',
        gstRate: '5',
        sizes: '[]',
        specifications: JSON.stringify([
            { name: 'Grain Type', value: 'Basmati' },
        ]),
        variants: JSON.stringify([
            {
                name: '1 kg',
                sku: `TEST-1KG-${Date.now()}`,
                attributes: [{ name: 'Pack Size', value: '1 kg' }],
                mrp: 110,
                price: 95,
                stock: 10,
                weightKg: 1,
                isDefault: true,
            },
            {
                name: '2 kg',
                sku: `TEST-2KG-${Date.now()}`,
                attributes: [{ name: 'Pack Size', value: '2 kg' }],
                mrp: 210,
                price: 180,
                stock: 8,
                weightKg: 2,
            },
        ]),
        nutritionFacts: '[]',
    }, {});
    const saved = await prisma.product.findUnique({
        where: { id: product.id },
        include: { variants: true },
    });
    console.log(JSON.stringify({
        id: saved?.id,
        title: saved?.title,
        stock: saved?.stock,
        specifications: saved?.specifications,
        variants: saved?.variants.map((variant) => ({
            name: variant.name,
            attributes: variant.attributes,
            price: variant.price.toString(),
            stock: variant.stock,
        })),
    }, null, 2));
    await prisma.product.delete({ where: { id: product.id } });
    await prisma.$disconnect();
}
main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
