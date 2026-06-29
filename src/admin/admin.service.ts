import { BadRequestException, ForbiddenException, Injectable } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { Prisma, UserRole } from "@prisma/client";
import * as bcrypt from "bcrypt";

@Injectable()
export class AdminService {
  constructor(private prisma: PrismaService) {}

  private normalizeEmail(email: string) {
    const normalized = String(email || "").trim().toLowerCase();
    if (!normalized || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized)) {
      throw new BadRequestException("Valid email is required");
    }
    return normalized;
  }

  async createStaff(
    actor: { id: number; role: UserRole },
    body: {
      name: string;
      email: string;
      phone?: string;
      password: string;
      role: UserRole;
      shopId?: number;
      shop?: {
        name: string;
        phone?: string;
        address: string;
        city: string;
        state: string;
        pincode: string;
        latitude?: number;
        longitude?: number;
        radiusKm?: number;
      };
    },
  ) {
    const role = body.role;
    if (!([UserRole.SUB_ADMIN, UserRole.PICKER, UserRole.DELIVERY_PARTNER] as UserRole[]).includes(role)) {
      throw new BadRequestException("Only SUB_ADMIN, PICKER or DELIVERY_PARTNER staff can be created");
    }

    if (role === UserRole.SUB_ADMIN && actor.role !== UserRole.ADMIN) {
      throw new ForbiddenException("Only admin can create sub-admins");
    }

    if (role === UserRole.PICKER && !([UserRole.ADMIN, UserRole.SUB_ADMIN] as UserRole[]).includes(actor.role)) {
      throw new ForbiddenException("Only admin or sub-admin can create pickers");
    }

    if (role === UserRole.DELIVERY_PARTNER && actor.role !== UserRole.ADMIN) {
      throw new ForbiddenException("Only admin can create delivery partners");
    }

    const name = String(body.name || "").trim();
    const email = this.normalizeEmail(body.email);
    const password = String(body.password || "");

    if (!name) throw new BadRequestException("Name is required");
    if (password.length < 6) throw new BadRequestException("Password must be at least 6 characters");

    const existing = await this.prisma.user.findUnique({ where: { email } });
    if (existing) throw new BadRequestException("Email already exists");

    const staffShopId =
      role === UserRole.PICKER
        ? actor.role === UserRole.SUB_ADMIN
          ? await this.getOwnedShopId(actor.id)
          : body.shopId
        : undefined;

    const staff = await this.prisma.user.create({
      data: {
        name,
        email,
        phone: body.phone?.trim() || null,
        passwordHash: await bcrypt.hash(password, 10),
        isVerified: true,
        role,
        createdById: actor.id,
        ...(staffShopId ? { staffShopId } : {}),
      },
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        role: true,
        createdAt: true,
        staffShop: { select: { id: true, name: true, pincode: true } },
      },
    });

    if (role === UserRole.SUB_ADMIN && body.shop) {
      await this.createShop(actor, {
        ...body.shop,
        ownerId: staff.id,
      });
    }

    return staff;
  }

  private async getOwnedShopId(ownerId: number) {
    const shop = await this.prisma.shop.findFirst({
      where: { ownerId },
      select: { id: true },
    });

    if (!shop) {
      throw new BadRequestException("Sub-admin must have a shop before creating pickers");
    }

    return shop.id;
  }

  async createShop(
    actor: { id: number; role: UserRole },
    body: {
      ownerId: number;
      name: string;
      phone?: string;
      address: string;
      city: string;
      state: string;
      pincode: string;
      latitude?: number;
      longitude?: number;
      radiusKm?: number;
    },
  ) {
    if (actor.role !== UserRole.ADMIN) {
      throw new ForbiddenException("Only admin can create shops");
    }

    const owner = await this.prisma.user.findUnique({ where: { id: Number(body.ownerId) } });
    if (!owner || owner.role !== UserRole.SUB_ADMIN) {
      throw new BadRequestException("Shop owner must be a sub-admin");
    }

    return this.prisma.shop.create({
      data: {
        ownerId: owner.id,
        name: String(body.name || "").trim(),
        phone: body.phone?.trim() || null,
        address: String(body.address || "").trim(),
        city: String(body.city || "").trim(),
        state: String(body.state || "").trim(),
        pincode: String(body.pincode || "").trim(),
        latitude: body.latitude,
        longitude: body.longitude,
        radiusKm: body.radiusKm ?? 5,
      },
    });
  }

  async getShops(actor: { id: number; role: UserRole }) {
    const where: Prisma.ShopWhereInput =
      actor.role === UserRole.ADMIN ? {} : { ownerId: actor.id };

    return this.prisma.shop.findMany({
      where,
      orderBy: { createdAt: "desc" },
      include: {
        owner: { select: { id: true, name: true, email: true, phone: true } },
        _count: { select: { staff: true, orders: true } },
      },
    });
  }

  async getStaff(actor: { id: number; role: UserRole }, role?: UserRole) {
    const where: Prisma.UserWhereInput = {
      role: role && ([UserRole.SUB_ADMIN, UserRole.PICKER, UserRole.DELIVERY_PARTNER] as UserRole[]).includes(role)
        ? role
        : { in: [UserRole.SUB_ADMIN, UserRole.PICKER, UserRole.DELIVERY_PARTNER] },
    };

    if (actor.role === UserRole.SUB_ADMIN) {
      where.OR = [
        { createdById: actor.id },
        { id: actor.id },
      ];
      where.role = UserRole.PICKER;
    }

    return this.prisma.user.findMany({
      where,
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        role: true,
        isVerified: true,
        createdAt: true,
        createdBy: { select: { id: true, name: true, email: true } },
        staffShop: { select: { id: true, name: true, pincode: true } },
      },
    });
  }

  async updateDeliveryPartnerVerification(
    actor: { id: number; role: UserRole },
    id: number,
    isVerified: boolean,
  ) {
    if (actor.role !== UserRole.ADMIN) {
      throw new ForbiddenException("Only admin can verify delivery partners");
    }

    const user = await this.prisma.user.findUnique({
      where: { id },
      select: { id: true, role: true },
    });

    if (!user || user.role !== UserRole.DELIVERY_PARTNER) {
      throw new BadRequestException("Delivery partner not found");
    }

    return this.prisma.user.update({
      where: { id },
      data: { isVerified: Boolean(isVerified) },
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        role: true,
        isVerified: true,
        createdAt: true,
      },
    });
  }

  async getPickerMonthlyReport(actor: { id: number; role: UserRole }, month?: string) {
    const base = month && /^\d{4}-\d{2}$/.test(month) ? `${month}-01` : new Date().toISOString().slice(0, 7) + "-01";
    const from = new Date(`${base}T00:00:00.000Z`);
    const to = new Date(from);
    to.setUTCMonth(to.getUTCMonth() + 1);

    const shopId =
      actor.role === UserRole.SUB_ADMIN ? await this.getOwnedShopId(actor.id) : undefined;

    const pickers = await this.prisma.user.findMany({
      where: {
        role: UserRole.PICKER,
        ...(shopId ? { staffShopId: shopId } : {}),
      },
      select: {
        id: true,
        name: true,
        email: true,
        createdBy: { select: { id: true, name: true, email: true } },
        _count: {
          select: {
            acceptedOrders: { where: { acceptedAt: { gte: from, lt: to } } },
            dispatchedOrders: { where: { dispatchedAt: { gte: from, lt: to } } },
            fulfilledOrders: { where: { fulfilledAt: { gte: from, lt: to } } },
          },
        },
      },
    });

    return {
      month: from.toISOString().slice(0, 7),
      from,
      to,
      pickers: pickers
        .map((picker) => ({
          id: picker.id,
          name: picker.name,
          email: picker.email,
          createdBy: picker.createdBy,
          accepted: picker._count.acceptedOrders,
          dispatched: picker._count.dispatchedOrders,
          fulfilled: picker._count.fulfilledOrders,
          score: picker._count.fulfilledOrders,
        }))
        .sort((a, b) => b.fulfilled - a.fulfilled),
    };
  }

  async getDashboardStats() {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const last7Days = new Date();
  last7Days.setDate(last7Days.getDate() - 7);
  last7Days.setHours(0, 0, 0, 0);

  


  const [
    products,
    totalOrders,
    todayOrders,
    revenueAgg,
    todayRevenueAgg,
    recentProducts,

    // 👇 USER STATS
    totalUsers,
    todayUsers,
    last7DaysUsers,
    verifiedUsers,
    unverifiedUsers,
  ] = await Promise.all([
    this.prisma.product.count(),

    this.prisma.order.count(),

    this.prisma.order.count({
      where: {
        createdAt: { gte: today },
      },
    }),

    this.prisma.order.aggregate({
      _sum: { totalAmount: true },
    }),

    this.prisma.order.aggregate({
      where: {
        createdAt: { gte: today },
      },
      _sum: { totalAmount: true },
    }),

    this.prisma.product.findMany({
      take: 5,
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        title: true,
        price: true,
        img1: true,
      },
    }),

    // 👇 USERS
    this.prisma.user.count(),

    this.prisma.user.count({
      where: {
        createdAt: { gte: today },
      },
    }),

    this.prisma.user.count({
      where: {
        createdAt: { gte: last7Days },
      },
    }),

    this.prisma.user.count({
      where: { isVerified: true },
    }),

    this.prisma.user.count({
      where: { isVerified: false },
    }),
  ]);

  return {
    products,
    totalOrders,
    todayOrders,
    revenue: revenueAgg._sum.totalAmount || 0,
    todayRevenue: todayRevenueAgg._sum.totalAmount || 0,
    recentProducts,

    // 👇 USERS RESPONSE
    users: {
      total: totalUsers,
      today: todayUsers,
      last7Days: last7DaysUsers,
      verified: verifiedUsers,
      unverified: unverifiedUsers,
    },
  };
}

  async getChartData() {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // Last 7 days
  const last7Days = [...Array(7)].map((_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - i);
    d.setHours(0, 0, 0, 0);
    return d;
  }).reverse();

  // Revenue & Orders per day
  const dailyStats = await Promise.all(
    last7Days.map(async (date) => {
      const next = new Date(date);
      next.setDate(date.getDate() + 1);

      const orders = await this.prisma.order.findMany({
        where: {
          createdAt: { gte: date, lt: next },
        },
      });

      return {
        date: date.toLocaleDateString("en-IN", { weekday: "short" }),
        orders: orders.length,
        revenue: orders.reduce(
          (sum, o) => sum + Number(o.totalAmount),
          0
        ),
      };
    })
  );

  const usersTrend = await Promise.all(
  last7Days.map(async (date) => {
    const next = new Date(date);
    next.setDate(date.getDate() + 1);

    const count = await this.prisma.user.count({
      where: {
        createdAt: { gte: date, lt: next },
      },
    });

    return {
      date: date.toLocaleDateString("en-IN", { weekday: "short" }),
      users: count,
    };
  })
);

  // Order status split
  const statusCounts = await this.prisma.order.groupBy({
    by: ["status"],
    _count: true,
  });

  return {
    revenueTrend: dailyStats.map(d => ({
      date: d.date,
      revenue: d.revenue,
    })),
    ordersTrend: dailyStats.map(d => ({
      date: d.date,
      orders: d.orders,
    })),
    orderStatus: statusCounts.map(s => ({
      status: s.status,
      value: s._count,
    })),
     usersTrend, 
  };
}

async getUsers(
  page = 1,
  limit = 10,
  search?: string,
  sort: "new" | "old" = "new",
  range?: "7d" | "30d"
) {
  page = Math.max(1, page);
  limit = Math.min(Math.max(1, limit), 50);
  const skip = (page - 1) * limit;

  let createdAtFilter: { gte: Date } | undefined;
  if (range) {
    const from = new Date();
    from.setHours(0, 0, 0, 0);
    const daysMap = { "7d": 7, "30d": 30 } as const;
    from.setDate(from.getDate() - daysMap[range]);
    createdAtFilter = { gte: from };
  }

  const safeSearch = search?.trim();

  const orderBy: Prisma.UserOrderByWithRelationInput = {
    createdAt: sort === "old" ? "asc" : "desc",
  };

  const where = {
    ...(safeSearch && {
      OR: [
        { name: { contains: safeSearch } },   // ✅ FIX
        { email: { contains: safeSearch } },  // ✅ FIX
      ],
    }),
    ...(createdAtFilter && { createdAt: createdAtFilter }),
  };

  const [users, total] = await Promise.all([
    this.prisma.user.findMany({
      where,
      skip,
      take: limit,
      orderBy,
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        role: true,
        isVerified: true,
        createdAt: true,
      },
    }),
    this.prisma.user.count({ where }),
  ]);

  return {
    data: users,
    meta: {
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
      sort,
      range,
    },
  };
}
}
