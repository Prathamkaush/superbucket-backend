import { Injectable, NotFoundException  } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { ContactReason , ContactStatus } from "@prisma/client";

@Injectable()
export class ContactService {
  constructor(private prisma: PrismaService) {}

async createContact(input: {
  name?: string;
  email?: string;
  phone?: string;
  subject?: string;
  message: string;
  reason?: ContactReason;
  page?: string;
  userId?: number | null;
  orderId?: number | null;
}) {
  const { userId, orderId, page, name, email, phone, subject, message, reason } = input;

  return this.prisma.contact.create({
    data: {
      name,
      email,
      phone,
      subject,
      message,
      reason,

      ...(userId
        ? { user: { connect: { id: userId } } }
        : {}),

      ...(orderId
        ? { order: { connect: { id: orderId } } }
        : {}),
    },
  });
}
 async getAllContacts(params: {
  page?: number;
  limit?: number;
  status?: ContactStatus;
  reason?: ContactReason;
  search?: string;
}) {
  const {
    page = 1,
    limit = 10,
    status,
    reason,
    search,
  } = params;

  const skip = (page - 1) * limit;

  const where: any = {};

  // 🔹 Status filter
  if (status) {
    where.status = status;
  }

  // 🔹 Reason filter
  if (reason) {
    where.reason = reason;
  }

  // 🔹 Search filter (name, email, phone, subject)
  if (search) {
    where.OR = [
      { name: { contains: search } },
      { email: { contains: search } },
      { phone: { contains: search} },
      { subject: { contains: search} },
    ];
  }

  const [items, total] = await Promise.all([
    this.prisma.contact.findMany({
      where,
      skip,
      take: limit,
      orderBy: { createdAt: "desc" },
      include: {
        user: true,
        order: true,
      },
    }),
    this.prisma.contact.count({ where }),
  ]);

  return {
    items,
    meta: {
      total,
      page,
      limit,
      pages: Math.ceil(total / limit),
    },
  };
}


  async getById(id: number) {
    const contact = await this.prisma.contact.findUnique({
      where: { id },
      include: {
        user: true,
        order: true,
      },
    });

    if (!contact) throw new NotFoundException("Contact not found");
    return contact;
  }

  async delete(id: number) {
    return this.prisma.contact.delete({
      where: { id },
    });
  }
  async updateStatus(id: number, status: ContactStatus) {
  const contact = await this.prisma.contact.findUnique({
    where: { id },
  });

  if (!contact) {
    throw new NotFoundException("Contact not found");
  }

  return this.prisma.contact.update({
    where: { id },
    data: { status },
  });
}

}
