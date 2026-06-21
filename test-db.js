"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const client_1 = require("@prisma/client");
async function main() {
    const prisma = new client_1.PrismaClient();
    try {
        console.log('Connecting to database...');
        await prisma.$connect();
        console.log('Connected successfully!');
        const users = await prisma.user.findMany({ take: 5 });
        console.log('Users count:', users.length);
        console.log('Users:', users);
    }
    catch (error) {
        console.error('Database connection error:', error);
    }
    finally {
        await prisma.$disconnect();
    }
}
main();
