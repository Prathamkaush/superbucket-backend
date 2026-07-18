import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import {
  Prisma,
  ServiceBookingStatus,
  ServiceProviderStatus,
} from "@prisma/client";
import { randomInt } from "crypto";
import { PrismaService } from "../prisma/prisma.service";
import { NotificationsService } from "../notifications/notifications.service";
import {
  CancelServiceBookingDto,
  CreateServiceBookingDto,
  CreateServiceCategoryDto,
  CreateServiceExtensionDto,
  CreateServicePackageDto,
  AcceptServiceRevisitDto,
  RequestServiceRevisitDto,
  ReviewServiceBookingDto,
  UpdateProviderApprovalDto,
  UpdateProviderJobStatusDto,
  UpdateServiceCategoryDto,
  UpdateServicePackageDto,
  UpsertProviderProfileDto,
} from "./dto/service-marketplace.dto";

const providerUserSelect = {
  id: true,
  name: true,
  phone: true,
  profileImage: true,
} satisfies Prisma.UserSelect;

const customerProviderSelect = {
  ...providerUserSelect,
  providerProfile: {
    select: {
      status: true,
      experienceYears: true,
      bio: true,
      city: true,
      approvedAt: true,
    },
  },
} satisfies Prisma.UserSelect;

@Injectable()
export class ServicesMarketplaceService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
  ) {}

  getCatalog(includeInactive = false) {
    return this.prisma.serviceCategory.findMany({
      where: includeInactive ? {} : { isActive: true },
      include: {
        packages: {
          where: includeInactive ? {} : { isActive: true },
          orderBy: { price: "asc" },
        },
        _count: {
          select: {
            providers: {
              where: {
                provider: {
                  status: ServiceProviderStatus.APPROVED,
                  isOnline: true,
                },
              },
            },
          },
        },
      },
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    });
  }

  async listPublicProviders(params: { categoryId?: number; page?: number; limit?: number }) {
    const page = Math.max(1, Number(params.page) || 1);
    const limit = Math.min(20, Math.max(1, Number(params.limit) || 10));
    const skip = (page - 1) * limit;
    const where: Prisma.ServiceProviderProfileWhereInput = {
      status: ServiceProviderStatus.APPROVED,
      isOnline: true,
      ...(params.categoryId
        ? { services: { some: { categoryId: params.categoryId } } }
        : {}),
    };

    const [profiles, total] = await Promise.all([
      this.prisma.serviceProviderProfile.findMany({
        where,
        skip,
        take: limit,
        include: {
          user: { select: providerUserSelect },
          services: {
            where: params.categoryId ? { categoryId: params.categoryId } : {},
            include: { category: { include: { packages: { where: { isActive: true }, orderBy: { price: "asc" } } } } },
          },
        },
        orderBy: [{ approvedAt: "desc" }, { createdAt: "desc" }],
      }),
      this.prisma.serviceProviderProfile.count({ where }),
    ]);

    const userIds = profiles.map((profile) => profile.userId);
    const [ratings, completed] = userIds.length
      ? await Promise.all([
          this.prisma.serviceBooking.groupBy({
            by: ["providerId"],
            where: { providerId: { in: userIds }, status: ServiceBookingStatus.COMPLETED, rating: { not: null } },
            _avg: { rating: true },
            _count: { rating: true },
          }),
          this.prisma.serviceBooking.groupBy({
            by: ["providerId"],
            where: { providerId: { in: userIds }, status: ServiceBookingStatus.COMPLETED },
            _count: { id: true },
          }),
        ])
      : [[], []];
    const ratingMap = new Map(ratings.map((item) => [item.providerId, item]));
    const completedMap = new Map(completed.map((item) => [item.providerId, item._count.id]));

    return {
      items: profiles.map((profile) => {
        const rating = ratingMap.get(profile.userId);
        const categories = profile.services.map((service) => service.category);
        const packages = categories.flatMap((category) => category.packages || []);
        const startingPrice = packages.length
          ? Math.min(...packages.map((item) => Number(item.price)))
          : null;
        return {
          id: profile.userId,
          profileId: profile.id,
          name: profile.user.name || "Service provider",
          phone: profile.user.phone,
          profileImage: profile.user.profileImage,
          bio: profile.bio,
          city: profile.city,
          experienceYears: profile.experienceYears,
          serviceRadiusKm: profile.serviceRadiusKm,
          categories: categories.map((category) => ({
            id: category.id,
            name: category.name,
            icon: category.icon,
            packages: category.packages,
          })),
          startingPrice,
          averageRating: rating?._avg.rating ? Number(rating._avg.rating.toFixed(1)) : null,
          ratingCount: rating?._count.rating || 0,
          completedJobs: completedMap.get(profile.userId) || 0,
        };
      }),
      meta: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
        hasMore: page * limit < total,
      },
    };
  }

  async createBooking(customerId: number, dto: CreateServiceBookingDto) {
    const servicePackage = await this.prisma.servicePackage.findFirst({
      where: { id: dto.packageId, isActive: true, category: { isActive: true } },
      include: { category: true },
    });
    if (!servicePackage) throw new NotFoundException("Service package not found");

    const scheduledAt = new Date(dto.scheduledAt);
    if (scheduledAt.getTime() < Date.now() + 30 * 60 * 1000) {
      throw new BadRequestException("Choose a time at least 30 minutes from now");
    }

    const address = dto.address || {};
    for (const field of ["name", "phone", "street", "city", "state", "pincode"]) {
      if (!String(address[field] || "").trim()) {
        throw new BadRequestException(`Address ${field} is required`);
      }
    }

    const price = Number(servicePackage.price);
    const platformFee = Number((price * Number(servicePackage.platformFeePercent) / 100).toFixed(2));
    const bookingNumber = `SW${Date.now()}${randomInt(100, 1000)}`;
    let providerId: number | null = null;
    if (dto.providerId) {
      const provider = await this.prisma.serviceProviderProfile.findFirst({
        where: {
          userId: dto.providerId,
          status: ServiceProviderStatus.APPROVED,
          isOnline: true,
          services: { some: { categoryId: servicePackage.categoryId } },
        },
      });
      if (!provider) {
        throw new BadRequestException("Selected provider is not available for this service");
      }
      providerId = dto.providerId;
    }

    const booking = await this.prisma.serviceBooking.create({
      data: {
        bookingNumber,
        customerId,
        providerId,
        status: providerId ? ServiceBookingStatus.ACCEPTED : ServiceBookingStatus.PENDING,
        acceptedAt: providerId ? new Date() : null,
        packageId: servicePackage.id,
        scheduledAt,
        address: address as Prisma.InputJsonValue,
        customerNote: dto.customerNote?.trim() || null,
        serviceName: servicePackage.name,
        categoryName: servicePackage.category.name,
        price,
        platformFee,
        providerEarning: price - platformFee,
        completionOtp: randomInt(1000, 10000).toString(),
      },
      include: { package: true },
    });
    await Promise.allSettled([
      this.notifications.notifyServiceBookingCreated({
        id: booking.id,
        bookingNumber: booking.bookingNumber,
        customerId,
        providerId: booking.providerId,
        categoryId: booking.package.categoryId,
        serviceName: booking.serviceName,
      }),
      this.notifications.notifyAdmins(
        "ADMIN_SERVICE_ORDER_CREATED",
        "New service order",
        `${booking.serviceName} was booked as ${booking.bookingNumber}.`,
        { bookingId: booking.id, screen: "Services" },
      ),
    ]);
    return booking;
  }

  private async attachProviderRatings(bookings: any[]) {
    const providerIds = [...new Set(bookings.map((item) => item.providerId).filter(Boolean))] as number[];
    if (!providerIds.length) return bookings;
    const ratings = await this.prisma.serviceBooking.groupBy({
      by: ["providerId"],
      where: { providerId: { in: providerIds }, status: ServiceBookingStatus.COMPLETED, rating: { not: null } },
      _avg: { rating: true },
      _count: { rating: true },
    });
    const completed = await this.prisma.serviceBooking.groupBy({
      by: ["providerId"],
      where: { providerId: { in: providerIds }, status: ServiceBookingStatus.COMPLETED },
      _count: { id: true },
    });
    const ratingMap = new Map(ratings.map((item) => [item.providerId, item]));
    const completedMap = new Map(completed.map((item) => [item.providerId, item._count.id]));
    return bookings.map((booking) => {
      if (!booking.provider) return booking;
      const stats = ratingMap.get(booking.providerId);
      return {
        ...booking,
        provider: {
          ...booking.provider,
          averageRating: stats?._avg.rating ? Number(stats._avg.rating.toFixed(1)) : null,
          ratingCount: stats?._count.rating || 0,
          completedJobs: completedMap.get(booking.providerId) || 0,
          isVerified: booking.provider.providerProfile?.status === ServiceProviderStatus.APPROVED,
        },
      };
    });
  }

  async getCustomerBookings(customerId: number) {
    const bookings = await this.prisma.serviceBooking.findMany({
      where: { customerId },
      include: { customer: { select: { name: true } }, provider: { select: customerProviderSelect }, package: true, extension: true },
      orderBy: { createdAt: "desc" },
    });
    return this.attachProviderRatings(bookings);
  }

  async getCustomerBooking(customerId: number, id: number) {
    const booking = await this.prisma.serviceBooking.findFirst({
      where: { id, customerId },
      include: { customer: { select: { name: true } }, provider: { select: customerProviderSelect }, package: true, extension: true },
    });
    if (!booking) throw new NotFoundException("Booking not found");
    return (await this.attachProviderRatings([booking]))[0];
  }

  async getCustomerInvoice(customerId: number, id: number) {
    const booking = await this.getCustomerBooking(customerId, id);
    if (booking.status !== ServiceBookingStatus.COMPLETED) {
      throw new BadRequestException("Invoice is available after service completion");
    }
    const baseCharge = Number(booking.price);
    const extensionCharge = Number(booking.extension?.charge || 0);
    return {
      invoiceNumber: `SVC-${booking.bookingNumber}`,
      issuedAt: booking.completedAt || booking.updatedAt,
      bookingNumber: booking.bookingNumber,
      customerName: booking.customer?.name || (booking.address as any)?.name || "Customer",
      providerName: booking.provider?.name || "Service Partner",
      serviceName: booking.serviceName,
      scheduledAt: booking.scheduledAt,
      baseCharge,
      extension: booking.extension ? {
        serviceName: booking.extension.serviceName,
        durationMinutes: booking.extension.durationMinutes,
        charge: extensionCharge,
      } : null,
      total: baseCharge + extensionCharge,
    };
  }

  async cancelBooking(customerId: number, id: number, dto: CancelServiceBookingDto) {
    const booking = await this.getCustomerBooking(customerId, id);
    if (
      booking.status !== ServiceBookingStatus.PENDING &&
      booking.status !== ServiceBookingStatus.ACCEPTED
    ) {
      throw new BadRequestException("This booking can no longer be cancelled");
    }
    return this.prisma.serviceBooking.update({
      where: { id },
      data: {
        status: ServiceBookingStatus.CANCELLED,
        cancellationReason: dto.reason.trim(),
        cancelledAt: new Date(),
      },
    });
  }

  async acceptRevisit(customerId: number, id: number, dto: AcceptServiceRevisitDto) {
    const booking = await this.getCustomerBooking(customerId, id);
    if (booking.status !== ServiceBookingStatus.REVISIT_REQUESTED) {
      throw new BadRequestException("No revisit request is pending for this booking");
    }

    const scheduledAt = new Date(dto.scheduledAt);
    if (scheduledAt.getTime() < Date.now() + 30 * 60 * 1000) {
      throw new BadRequestException("Choose a revisit time at least 30 minutes from now");
    }

    return this.prisma.serviceBooking.update({
      where: { id },
      data: {
        status: ServiceBookingStatus.ACCEPTED,
        scheduledAt,
        revisitAcceptedAt: new Date(),
        acceptedAt: new Date(),
        startedAt: null,
      },
      include: { provider: { select: customerProviderSelect }, package: true },
    });
  }

  async reviewBooking(customerId: number, id: number, dto: ReviewServiceBookingDto) {
    const booking = await this.getCustomerBooking(customerId, id);
    if (booking.status !== ServiceBookingStatus.COMPLETED) {
      throw new BadRequestException("Only completed bookings can be reviewed");
    }
    if (booking.rating) throw new ConflictException("This booking has already been reviewed");
    return this.prisma.serviceBooking.update({
      where: { id },
      data: { rating: dto.rating, review: dto.review?.trim() || null },
    });
  }

  async getProviderProfile(userId: number) {
    const [profile, ratingStats, completedJobs, recentReviews] = await Promise.all([
      this.prisma.serviceProviderProfile.findUnique({
        where: { userId },
        include: { user: { select: providerUserSelect }, services: { include: { category: true } } },
      }),
      this.prisma.serviceBooking.aggregate({
        where: { providerId: userId, status: ServiceBookingStatus.COMPLETED, rating: { not: null } },
        _avg: { rating: true }, _count: { rating: true },
      }),
      this.prisma.serviceBooking.count({ where: { providerId: userId, status: ServiceBookingStatus.COMPLETED } }),
      this.prisma.serviceBooking.findMany({
        where: { providerId: userId, status: ServiceBookingStatus.COMPLETED, rating: { not: null } },
        select: { id: true, serviceName: true, rating: true, review: true, completedAt: true, customer: { select: { name: true } } },
        orderBy: { completedAt: "desc" }, take: 10,
      }),
    ]);
    if (!profile) throw new NotFoundException("Provider profile not found");
    return {
      ...profile,
      stats: {
        averageRating: ratingStats._avg.rating ? Number(ratingStats._avg.rating.toFixed(1)) : null,
        ratingCount: ratingStats._count.rating,
        completedJobs,
      },
      recentReviews,
    };
  }

  async upsertProviderProfile(userId: number, dto: UpsertProviderProfileDto) {
    const categoryIds = [...new Set(dto.categoryIds)];
    if (!categoryIds.length) throw new BadRequestException("Select at least one service category");
    const activeCount = await this.prisma.serviceCategory.count({
      where: { id: { in: categoryIds }, isActive: true },
    });
    if (activeCount !== categoryIds.length) throw new BadRequestException("One or more service categories are invalid");

    return this.prisma.$transaction(async (tx) => {
      const existing = await tx.serviceProviderProfile.findUnique({ where: { userId } });
      const profile = existing
        ? await tx.serviceProviderProfile.update({
            where: { userId },
            data: {
              experienceYears: dto.experienceYears,
              bio: dto.bio?.trim(),
              city: dto.city?.trim(),
              serviceRadiusKm: dto.serviceRadiusKm,
              ...(existing.status === ServiceProviderStatus.REJECTED
                ? { status: ServiceProviderStatus.PENDING, rejectionReason: null }
                : {}),
            },
          })
        : await tx.serviceProviderProfile.create({
            data: {
              userId,
              experienceYears: dto.experienceYears || 0,
              bio: dto.bio?.trim(),
              city: dto.city?.trim(),
              serviceRadiusKm: dto.serviceRadiusKm || 10,
            },
          });
      await tx.providerService.deleteMany({ where: { providerId: profile.id } });
      await tx.providerService.createMany({
        data: categoryIds.map((categoryId) => ({ providerId: profile.id, categoryId })),
      });
      return tx.serviceProviderProfile.findUnique({
        where: { id: profile.id },
        include: { services: { include: { category: true } } },
      });
    });
  }

  async setProviderAvailability(userId: number, isOnline: boolean) {
    const profile = await this.getProviderProfile(userId);
    if (profile.status !== ServiceProviderStatus.APPROVED) {
      throw new ForbiddenException("Admin approval is required before going online");
    }
    return this.prisma.serviceProviderProfile.update({ where: { userId }, data: { isOnline } });
  }

  private async requireApprovedProvider(userId: number) {
    const profile = await this.prisma.serviceProviderProfile.findUnique({
      where: { userId }, include: { services: true },
    });
    if (!profile || profile.status !== ServiceProviderStatus.APPROVED) {
      throw new ForbiddenException("Approved provider account required");
    }
    return profile;
  }

  async getAvailableJobs(userId: number) {
    const profile = await this.requireApprovedProvider(userId);
    if (!profile.isOnline) return [];
    return this.prisma.serviceBooking.findMany({
      where: {
        status: ServiceBookingStatus.PENDING,
        providerId: null,
        package: { categoryId: { in: profile.services.map((item) => item.categoryId) } },
      },
      select: {
        id: true, bookingNumber: true, categoryName: true, serviceName: true,
        scheduledAt: true, address: true, customerNote: true, providerEarning: true,
        createdAt: true,
      },
      orderBy: { scheduledAt: "asc" },
    });
  }

  getProviderJobs(userId: number) {
    return this.prisma.serviceBooking.findMany({
      where: { providerId: userId },
      select: {
        id: true, bookingNumber: true, categoryName: true, serviceName: true,
        scheduledAt: true, address: true, customerNote: true, providerEarning: true,
        status: true, acceptedAt: true, startedAt: true, completedAt: true,
        cancellationReason: true, cancelledAt: true,
        revisitReason: true, revisitRequestedAt: true, revisitAcceptedAt: true,
        rating: true, review: true,
        extension: true,
        customer: { select: { id: true, name: true, phone: true } },
      },
      orderBy: { scheduledAt: "desc" },
    });
  }

  async getProviderJobDetails(userId: number, id: number) {
    const booking = await this.prisma.serviceBooking.findFirst({
      where: { id, providerId: userId },
      select: {
        id: true, bookingNumber: true, categoryName: true, serviceName: true,
        scheduledAt: true, address: true, customerNote: true, providerEarning: true,
        status: true, acceptedAt: true, startedAt: true, completedAt: true,
        cancellationReason: true, revisitReason: true, revisitAcceptedAt: true,
        rating: true, review: true,
        extension: true,
        customer: { select: { id: true, name: true, phone: true, email: true } },
      },
    });
    if (!booking) throw new NotFoundException("Assigned job not found");
    return booking;
  }

  async createServiceExtension(
    userId: number,
    id: number,
    dto: CreateServiceExtensionDto,
    files: Record<string, Express.Multer.File[]>,
  ) {
    const booking = await this.getProviderJob(userId, id);
    if (booking.status !== ServiceBookingStatus.IN_PROGRESS && booking.status !== ServiceBookingStatus.COMPLETED) {
      throw new BadRequestException("Extended work can be recorded only after the inspection has started");
    }
    if (!`${booking.categoryName} ${booking.serviceName}`.toLowerCase().includes("inspection")) {
      throw new BadRequestException("Extended work is available only for inspection services");
    }
    const required = ["problemImage1", "problemImage2", "solvedImage1", "solvedImage2"];
    const missing = required.filter((field) => !files[field]?.[0]);
    if (missing.length) throw new BadRequestException("Two problem photos and two solved-work photos are required");

    const extension = await this.prisma.serviceExtension.create({
      data: {
        bookingId: id,
        serviceName: dto.serviceName.trim(),
        customerName: dto.customerName.trim(),
        problemImage1: `/uploads/service-extensions/${files.problemImage1[0].filename}`,
        problemImage2: `/uploads/service-extensions/${files.problemImage2[0].filename}`,
        solvedImage1: `/uploads/service-extensions/${files.solvedImage1[0].filename}`,
        solvedImage2: `/uploads/service-extensions/${files.solvedImage2[0].filename}`,
        durationMinutes: dto.durationMinutes,
        charge: dto.charge,
      },
    }).catch((error) => {
      if (error?.code === "P2002") throw new ConflictException("Extended work has already been submitted for this booking");
      throw error;
    });
    this.notifications.notifyAdmins(
      "SERVICE_EXTENSION_SUBMITTED",
      "Extended service submitted",
      `${dto.serviceName.trim()} was added to ${booking.bookingNumber} with a charge of Rs ${Number(dto.charge).toFixed(0)}.`,
      { bookingId: booking.id, extensionId: extension.id, screen: "Services" },
    ).catch(() => undefined);
    return extension;
  }

  async acceptJob(userId: number, id: number) {
    const profile = await this.requireApprovedProvider(userId);
    if (!profile.isOnline) throw new BadRequestException("Go online before accepting jobs");
    const booking = await this.prisma.serviceBooking.findUnique({
      where: { id }, include: { package: true },
    });
    if (!booking) throw new NotFoundException("Booking not found");
    if (!profile.services.some((item) => item.categoryId === booking.package.categoryId)) {
      throw new ForbiddenException("This job is outside your selected services");
    }
    const result = await this.prisma.serviceBooking.updateMany({
      where: { id, providerId: null, status: ServiceBookingStatus.PENDING },
      data: { providerId: userId, status: ServiceBookingStatus.ACCEPTED, acceptedAt: new Date() },
    });
    if (!result.count) throw new ConflictException("This job is no longer available");
    const accepted = await this.getProviderJob(userId, id);
    await this.notifications.notifyServiceBookingStatus(accepted).catch(() => undefined);
    return accepted;
  }

  private async getProviderJob(userId: number, id: number) {
    const booking = await this.prisma.serviceBooking.findFirst({ where: { id, providerId: userId } });
    if (!booking) throw new NotFoundException("Assigned job not found");
    return booking;
  }

  async updateJobStatus(userId: number, id: number, dto: UpdateProviderJobStatusDto) {
    const booking = await this.getProviderJob(userId, id);
    const allowed: Partial<Record<ServiceBookingStatus, ServiceBookingStatus[]>> = {
      ACCEPTED: [ServiceBookingStatus.EN_ROUTE, ServiceBookingStatus.REJECTED],
      EN_ROUTE: [ServiceBookingStatus.IN_PROGRESS],
      IN_PROGRESS: [ServiceBookingStatus.COMPLETED],
    };
    if (!allowed[booking.status]?.includes(dto.status)) {
      throw new BadRequestException(`Cannot change booking from ${booking.status} to ${dto.status}`);
    }
    if (dto.status === ServiceBookingStatus.COMPLETED && dto.completionOtp !== booking.completionOtp) {
      throw new BadRequestException("Incorrect completion OTP");
    }
    const data: Prisma.ServiceBookingUpdateInput = { status: dto.status };
    if (dto.status === ServiceBookingStatus.IN_PROGRESS) data.startedAt = new Date();
    if (dto.status === ServiceBookingStatus.COMPLETED) data.completedAt = new Date();
    if (dto.status === ServiceBookingStatus.REJECTED) {
      data.provider = { disconnect: true };
      data.status = ServiceBookingStatus.PENDING;
      data.acceptedAt = null;
    }
    const updated = await this.prisma.serviceBooking.update({ where: { id }, data });
    await this.notifications.notifyServiceBookingStatus(updated).catch(() => undefined);
    return updated;
  }

  async requestRevisit(userId: number, id: number, dto: RequestServiceRevisitDto) {
    const booking = await this.getProviderJob(userId, id);
    if (
      booking.status !== ServiceBookingStatus.EN_ROUTE &&
      booking.status !== ServiceBookingStatus.IN_PROGRESS
    ) {
      throw new BadRequestException("Revisit can be requested only after travel has started");
    }

    const updated = await this.prisma.serviceBooking.update({
      where: { id },
      data: {
        status: ServiceBookingStatus.REVISIT_REQUESTED,
        revisitReason: dto.reason?.trim() || "Customer was not available at the address",
        revisitRequestedAt: new Date(),
      },
    });
    await this.notifications.notifyServiceBookingStatus(updated).catch(() => undefined);
    return updated;
  }

  listBookingsForAdmin() {
    return this.prisma.serviceBooking.findMany({
      include: {
        customer: { select: { id: true, name: true, phone: true } },
        provider: { select: { id: true, name: true, phone: true } },
        package: true,
        extension: true,
      },
      orderBy: { updatedAt: "desc" },
      take: 100,
    });
  }

  listExtensionsForAdmin() {
    return this.prisma.serviceExtension.findMany({
      include: {
        booking: {
          include: {
            customer: { select: { id: true, name: true, phone: true } },
            provider: { select: { id: true, name: true, phone: true } },
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });
  }

  createCategory(dto: CreateServiceCategoryDto, image?: string) {
    return this.prisma.serviceCategory.create({ data: { ...dto, image: image ? `/services/images/${image}` : null } });
  }
  updateCategory(id: number, dto: UpdateServiceCategoryDto, image?: string) {
    return this.prisma.serviceCategory.update({ where: { id }, data: { ...dto, ...(image ? { image: `/services/images/${image}` } : {}) } });
  }
  createPackage(dto: CreateServicePackageDto) {
    return this.prisma.servicePackage.create({ data: dto });
  }
  updatePackage(id: number, dto: UpdateServicePackageDto) {
    return this.prisma.servicePackage.update({ where: { id }, data: dto });
  }
  listProviders(status?: ServiceProviderStatus) {
    return this.prisma.serviceProviderProfile.findMany({
      where: status ? { status } : {},
      include: { user: { select: providerUserSelect }, services: { include: { category: true } } },
      orderBy: { createdAt: "desc" },
    });
  }
  updateProviderApproval(id: number, dto: UpdateProviderApprovalDto) {
    if (
      dto.status !== ServiceProviderStatus.APPROVED &&
      dto.status !== ServiceProviderStatus.REJECTED &&
      dto.status !== ServiceProviderStatus.SUSPENDED
    ) {
      throw new BadRequestException("Admin must approve, reject, or suspend the provider");
    }
    return this.prisma.serviceProviderProfile.update({
      where: { id },
      data: {
        status: dto.status,
        isOnline: dto.status === ServiceProviderStatus.APPROVED ? undefined : false,
        rejectionReason: dto.status === ServiceProviderStatus.REJECTED ? dto.rejectionReason?.trim() : null,
        approvedAt: dto.status === ServiceProviderStatus.APPROVED ? new Date() : undefined,
      },
    });
  }
}
