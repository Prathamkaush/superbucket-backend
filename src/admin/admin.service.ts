import { Injectable } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { Prisma } from "@prisma/client";

@Injectable()
export class AdminService {
  constructor(private prisma: PrismaService) {}

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
