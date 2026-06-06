"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const client_1 = require("@prisma/client");
const prisma = new client_1.PrismaClient();
function slugify(text) {
    return text
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/(^-|-$)+/g, "");
}
async function main() {
    const products = await prisma.product.findMany();
    for (const p of products) {
        if (!p.slug) {
            const slug = slugify(p.title) + "-" + p.id;
            await prisma.product.update({
                where: { id: p.id },
                data: { slug }
            });
            console.log(`Added slug for ID ${p.id}: ${slug}`);
        }
    }
}
main()
    .catch(e => console.error(e))
    .finally(() => prisma.$disconnect());
//# sourceMappingURL=seed-slugs.js.map