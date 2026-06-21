"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const client_1 = require("@prisma/client");
async function main() {
    const prisma = new client_1.PrismaClient();
    try {
        const userId = 2; // user from output
        const addressData = {
            name: 'John Doe',
            phone: '9654764464',
            street: '123 Test Street, Landmark: Near Metro',
            city: 'Delhi',
            state: 'Delhi',
            pincode: '110030',
            isDefault: true,
        };
        console.log('Trying to insert address:');
        // We replicate addresses.service.ts create logic
        if (addressData.isDefault) {
            await prisma.userAddress.updateMany({
                where: { userId },
                data: { isDefault: false },
            });
        }
        const result = await prisma.userAddress.create({
            data: {
                ...addressData,
                userId,
            },
        });
        console.log('Address saved successfully!', result);
    }
    catch (error) {
        console.error('Error saving address:', error);
    }
    finally {
        await prisma.$disconnect();
    }
}
main();
