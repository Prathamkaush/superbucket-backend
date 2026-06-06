import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

async function main() {
  await prisma.homepageSection.createMany({
    data: [
      {
        type: "HERO",
        title: "Main Banner",
        position: 1,
        config: {
          autoplayMs: 5000,
          slides: [
            {
              image: "/banner/banner1.jpg",
              title: "New Season Styles",
              subtitle: "Fresh fashion for everyday elegance",
              ctaText: "Shop Now",
              ctaLink: "/all-products"
            }
          ]
        }
      },
      {
        type: "EDITORIAL",
        title: "New In",
        position: 2,
        config: {
          title: "New In",
          subtitle: "Fresh styles just dropped",
          autoplayMs: 5000,
          slides: [
            {
              productId: 32,
              modelImage: "/editorial/newin-1.png",
              bgColor: "#FDF2F2",
              accent: "NEW IN!"
            }
          ]
        }
      }
    ]
  });
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
