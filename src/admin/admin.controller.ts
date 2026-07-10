import { Body, Controller, Get, Patch, Post, Req, UseGuards, Query ,Param, ParseIntPipe, NotFoundException } from "@nestjs/common";
import { AdminService } from "./admin.service";
import { JwtAuthGuard } from "../auth/strategies/jwt-auth.guard";
import { AdminGuard, AdminOrSubAdminGuard } from "../auth/admin.guard";
import {
  ApiTags,
  ApiBearerAuth,
  ApiOperation,
  ApiQuery,
} from "@nestjs/swagger";
import { PrismaService } from "../prisma/prisma.service";
import { UserRole } from "@prisma/client";

@ApiTags("Admin")
@ApiBearerAuth("JWT-auth")
@UseGuards(JwtAuthGuard)
@Controller("admin")
export class AdminController {
  constructor(private adminService: AdminService,
    private prisma: PrismaService
  ) {}

  @ApiOperation({
    summary: "Get admin dashboard statistics",
    description: "Returns total users, orders, revenue, products, etc.",
  })
  @Get("stats")
  @UseGuards(AdminGuard)
  getStats() {
    return this.adminService.getDashboardStats();
  }

  @ApiOperation({
    summary: "Get admin dashboard charts data",
    description: "Returns analytics data for charts (orders, revenue, trends)",
  })
  @Get("charts")
  @UseGuards(AdminGuard)
  getCharts() {
    return this.adminService.getChartData();
  }

  @Post("staff")
  @UseGuards(AdminOrSubAdminGuard)
  createStaff(
    @Req() req: any,
    @Body()
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
    return this.adminService.createStaff(req.user, body);
  }

  @Post("shops")
  @UseGuards(AdminOrSubAdminGuard)
  createShop(
    @Req() req: any,
    @Body()
    body: {
      ownerId?: number;
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
    return this.adminService.createShop(req.user, body);
  }

  @Get("shops")
  @UseGuards(AdminOrSubAdminGuard)
  getShops(@Req() req: any) {
    return this.adminService.getShops(req.user);
  }

  @Get("staff")
  @UseGuards(AdminOrSubAdminGuard)
  getStaff(@Req() req: any, @Query("role") role?: UserRole) {
    return this.adminService.getStaff(req.user, role);
  }

  @Patch("staff/:id/verification")
  @UseGuards(AdminGuard)
  updateDeliveryPartnerVerification(
    @Req() req: any,
    @Param("id", ParseIntPipe) id: number,
    @Body() body: { isVerified: boolean },
  ) {
    return this.adminService.updateDeliveryPartnerVerification(req.user, id, body.isVerified);
  }

  @Patch("staff/:id/shop")
  @UseGuards(AdminOrSubAdminGuard)
  updateStaffShop(
    @Req() req: any,
    @Param("id", ParseIntPipe) id: number,
    @Body() body: { shopId: number },
  ) {
    return this.adminService.updateStaffShop(req.user, id, Number(body.shopId));
  }

  @Get("reports/pickers")
  @UseGuards(AdminOrSubAdminGuard)
  getPickerReports(@Req() req: any, @Query("month") month?: string) {
    return this.adminService.getPickerMonthlyReport(req.user, month);
  }

  @ApiOperation({
    summary: "Get paginated users list",
    description:
      "Returns users with pagination, search, sorting and date filtering",
  })
  @ApiQuery({ name: "page", required: false, type: Number, example: 1 })
  @ApiQuery({ name: "limit", required: false, type: Number, example: 10 })
  @ApiQuery({ name: "search", required: false, type: String })
  @ApiQuery({
    name: "sort",
    required: false,
    enum: ["new", "old"],
    example: "new",
  })
  @ApiQuery({
    name: "range",
    required: false,
    enum: ["7d", "30d"],
    example: "7d",
  })
  @Get("users")
  @UseGuards(AdminGuard)
  getUsers(
    @Query("page") page = "1",
    @Query("limit") limit = "10",
    @Query("search") search?: string,
    @Query("sort") sort: "new" | "old" = "new",
    @Query("range") range?: "7d" | "30d"
  ) {
    // 🔒 Sanitize values (important for safety)
    const safeSort = sort === "old" ? "old" : "new";
    const safeRange =
      range === "7d" || range === "30d" ? range : undefined;

    return this.adminService.getUsers(
      Number(page),
      Number(limit),
      search,
      safeSort,
      safeRange
    );
  }
  @Get("orders/:id")
  @UseGuards(AdminGuard)
async getOrderById(
  @Param("id", ParseIntPipe) id: number
) {
  const order = await this.prisma.order.findUnique({
    where: { id },
    include: {
      user: {
        select: {
          id: true,
          name: true,
          email: true,
          phone: true,
        },
      },
      items: {
        include: {
          product: {
            select: {
              id: true,
              title: true,
              img1: true,
            },
          },
        },
      },
    },
  });

  if (!order) {
    throw new NotFoundException("Order not found");
  }

  return order;
}
}
