import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import { BusinessAdStatus, BusinessAdType, WalletTransactionType } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import {
  CreateBusinessAdDto,
  CreateHomeOfferDto,
  CreateBusinessAdPlanDto,
  ReviewBusinessAdDto,
  UpdateBusinessAdDto,
  UpdateBusinessAdPlanDto,
  UpdateHomeOfferDto,
  VerifyBusinessAdPaymentDto,
} from "./dto/home-offer.dto";
import { AppCacheService } from "../cache/app-cache.service";
import { PaymentsService } from "../payment/payments.service";
import { NotificationsService } from "../notifications/notifications.service";

@Injectable()
export class HomeOffersService {
  constructor(
    private prisma: PrismaService,
    private cache: AppCacheService,
    private payments: PaymentsService,
    private notifications: NotificationsService,
  ) {}

  getAdminOffers() {
    return this.prisma.homeOffer.findMany({
      orderBy: [{ sortOrder: "asc" }, { createdAt: "desc" }],
    });
  }

  async getActiveOffers() {
    const now = new Date();
    await this.expireAds();
    const offers = await this.cache.getOrSet("home-offers:active", 60, async () => {
      const [adminOffers, businessAds] = await Promise.all([
        this.prisma.homeOffer.findMany({
        where: {
          isActive: true,
          icon: { not: "business" },
          AND: [
            { OR: [{ startsAt: null }, { startsAt: { lte: now } }] },
            { OR: [{ expiresAt: null }, { expiresAt: { gte: now } }] },
          ],
        },
        orderBy: [{ sortOrder: "asc" }, { createdAt: "desc" }],
        take: 12,
        }),
        this.prisma.businessAd.findMany({
          where: { adType: BusinessAdType.BUSINESS, status: BusinessAdStatus.ACTIVE, startsAt: { lte: now }, expiresAt: { gt: now } },
          orderBy: { startsAt: "desc" },
          take: 8,
        }),
      ]);
      return [
        ...businessAds.map((ad) => ({
          id: `business-ad-${ad.id}`,
          businessAdId: ad.id,
          title: ad.businessName,
          subtitle: ad.offerText || ad.description,
          buttonLabel: "View details",
          code: ad.category,
          icon: "business",
          color: "#0B63CE",
          imageUrl: ad.imageUrl,
          description: ad.description,
          address: ad.address,
          phone: ad.phone,
          sortOrder: -10,
          isActive: true,
          startsAt: ad.startsAt,
          expiresAt: ad.expiresAt,
        })),
        ...adminOffers,
      ].slice(0, 12);
    });

    const viewedIds = offers.map((item: any) => item.businessAdId).filter(Boolean);
    if (viewedIds.length) {
      this.prisma.businessAd.updateMany({ where: { id: { in: viewedIds } }, data: { views: { increment: 1 } } }).catch(() => undefined);
    }
    return offers;
  }

  async create(dto: CreateHomeOfferDto, image?: string) {
    const offer = await this.prisma.homeOffer.create({ data: { ...this.toData(dto), imageUrl: image ? `/home-offers/images/${image}` : null } });
    await this.clearCache();
    return offer;
  }

  getActiveAdPlans() {
    return this.prisma.businessAdPlan.findMany({
      where: { isActive: true },
      orderBy: [{ sortOrder: "asc" }, { price: "asc" }],
    });
  }

  async getActiveLocalShops() {
    const now = new Date();
    await this.expireAds();
    return this.prisma.businessAd.findMany({
      where: {
        adType: BusinessAdType.LOCAL_SHOP,
        status: BusinessAdStatus.ACTIVE,
        startsAt: { lte: now },
        expiresAt: { gt: now },
      },
      select: {
        id: true,
        businessName: true,
        category: true,
        description: true,
        address: true,
        phone: true,
        offerText: true,
        imageUrl: true,
      },
      orderBy: { startsAt: "desc" },
    });
  }

  async createBusinessAd(userId: number, dto: CreateBusinessAdDto, image?: string) {
    const plan = await this.prisma.businessAdPlan.findFirst({ where: { id: dto.planId, isActive: true } });
    if (!plan) throw new BadRequestException("Selected advertising package is unavailable");
    const businessName = dto.businessName.trim();
    const offerText = dto.offer?.trim();
    const description = dto.description.trim();
    const category = dto.category?.trim();
    const phone = dto.phone.replace(/\D/g, "").slice(0, 10);
    if (!businessName || !description || !dto.address.trim()) throw new BadRequestException("Business name, description and address are required");
    if (phone.length !== 10) throw new BadRequestException("Enter a valid 10-digit phone number");

    const ad = await this.prisma.businessAd.create({
      data: {
        userId,
        planId: plan.id,
        adType: dto.adType === "LOCAL_SHOP" ? BusinessAdType.LOCAL_SHOP : BusinessAdType.BUSINESS,
        businessName,
        category: category || null,
        description,
        address: dto.address.trim(),
        phone,
        offerText: offerText || null,
        imageUrl: image ? `/uploads/business-ads/${image}` : null,
        priceSnapshot: plan.price,
        durationDaysSnapshot: plan.durationDays,
        status: BusinessAdStatus.PENDING_REVIEW,
      },
      include: { plan: true },
    });
    await this.clearCache();
    this.notifications.notifyAdmins(
      "ADMIN_BUSINESS_AD_SUBMITTED",
      "Business ad awaiting review",
      `${businessName} submitted a ${plan.durationDays}-day advertising campaign.`,
      { businessAdId: ad.id, screen: "BusinessAds" },
    ).catch(() => undefined);
    return this.withAdMeta(ad);
  }

  async getMyBusinessAds(userId: number) {
    await this.expireAds();
    const ads = await this.prisma.businessAd.findMany({
      where: { userId, status: { not: BusinessAdStatus.ARCHIVED } },
      include: { plan: true },
      orderBy: { createdAt: "desc" },
    });
    return ads.map((ad) => this.withAdMeta(ad));
  }

  async updateMyBusinessAd(userId: number, id: number, dto: UpdateBusinessAdDto, image?: string) {
    const ad = await this.requireOwnedAd(userId, id);
    if (ad.status === BusinessAdStatus.ACTIVE || ad.status === BusinessAdStatus.PAUSED || ad.status === BusinessAdStatus.EXPIRED) {
      throw new BadRequestException("Active or completed ads cannot be edited. Create a new campaign instead.");
    }
    let planData = {};
    if (dto.planId && dto.planId !== ad.planId) {
      const plan = await this.prisma.businessAdPlan.findFirst({ where: { id: dto.planId, isActive: true } });
      if (!plan) throw new BadRequestException("Selected advertising package is unavailable");
      planData = { planId: plan.id, priceSnapshot: plan.price, durationDaysSnapshot: plan.durationDays };
    }
    if (dto.phone !== undefined && dto.phone.replace(/\D/g, "").length !== 10) throw new BadRequestException("Enter a valid 10-digit phone number");
    const updated = await this.prisma.businessAd.update({
      where: { id },
      data: {
        ...planData,
        ...(dto.businessName !== undefined && { businessName: dto.businessName.trim() }),
        ...(dto.adType !== undefined && { adType: dto.adType === "LOCAL_SHOP" ? BusinessAdType.LOCAL_SHOP : BusinessAdType.BUSINESS }),
        ...(dto.category !== undefined && { category: dto.category?.trim() || null }),
        ...(dto.description !== undefined && { description: dto.description.trim() }),
        ...(dto.address !== undefined && { address: dto.address.trim() }),
        ...(dto.phone !== undefined && { phone: dto.phone.replace(/\D/g, "").slice(0, 10) }),
        ...(dto.offer !== undefined && { offerText: dto.offer?.trim() || null }),
        ...(image && { imageUrl: `/uploads/business-ads/${image}` }),
        status: BusinessAdStatus.PENDING_REVIEW,
        rejectionReason: null,
        approvedAt: null,
      },
      include: { plan: true },
    });
    await this.clearCache();
    return this.withAdMeta(updated);
  }

  async archiveMyBusinessAd(userId: number, id: number) {
    await this.requireOwnedAd(userId, id);
    await this.prisma.businessAd.update({ where: { id }, data: { status: BusinessAdStatus.ARCHIVED } });
    await this.clearCache();
    return { archived: true };
  }

  async payBusinessAdWithWallet(userId: number, id: number) {
    const ad = await this.requireOwnedAd(userId, id);
    this.requirePayable(ad);
    const amount = Number(ad.priceSnapshot);
    const activated = await this.prisma.$transaction(async (tx) => {
      const wallet = await tx.walletAccount.findUnique({ where: { userId } });
      if (!wallet || Number(wallet.balance) < amount) throw new BadRequestException("Insufficient wallet balance");
      await tx.walletAccount.update({ where: { id: wallet.id }, data: { balance: { decrement: amount } } });
      await tx.walletTransaction.create({ data: {
        walletId: wallet.id, userId, type: WalletTransactionType.DEBIT, amount,
        label: `Advertising campaign #${ad.id}`, reference: `business_ad_${ad.id}_${Date.now()}`,
      } });
      return this.activateAd(tx, ad.id, ad.durationDaysSnapshot, "WALLET", `wallet_business_ad_${ad.id}`);
    });
    await this.clearCache();
    this.notifications.createAndSend({
      userId,
      type: "BUSINESS_AD_ACTIVE",
      title: "Your advertisement is live",
      body: `${ad.businessName} is now advertised for ${ad.durationDaysSnapshot} days.`,
      data: { businessAdId: ad.id, screen: "MyBusinessAds" },
    }).catch(() => undefined);
    return this.withAdMeta(activated as any);
  }

  async createBusinessAdRazorpayOrder(userId: number, id: number) {
    const ad = await this.requireOwnedAd(userId, id);
    this.requirePayable(ad);
    const order = await this.payments.createOrder(Number(ad.priceSnapshot));
    await this.prisma.businessAd.update({ where: { id }, data: { razorpayOrderId: order.id } });
    return { razorpayOrderId: order.id, amount: order.amount, key: process.env.RAZORPAY_KEY_ID };
  }

  async verifyBusinessAdRazorpayPayment(userId: number, id: number, dto: VerifyBusinessAdPaymentDto) {
    const crypto = require("crypto");
    const ad = await this.requireOwnedAd(userId, id);
    this.requirePayable(ad);
    if (!ad.razorpayOrderId || ad.razorpayOrderId !== dto.razorpay_order_id) {
      throw new BadRequestException("Payment order does not match this advertisement");
    }
    const expected = crypto.createHmac("sha256", process.env.RAZORPAY_KEY_SECRET!).update(`${dto.razorpay_order_id}|${dto.razorpay_payment_id}`).digest("hex");
    if (expected !== dto.razorpay_signature) throw new BadRequestException("Invalid payment signature");
    const activated = await this.prisma.$transaction((tx) => this.activateAd(tx, ad.id, ad.durationDaysSnapshot, "RAZORPAY", dto.razorpay_payment_id));
    await this.clearCache();
    this.notifications.createAndSend({
      userId,
      type: "BUSINESS_AD_ACTIVE",
      title: "Your advertisement is live",
      body: `${ad.businessName} is now advertised for ${ad.durationDaysSnapshot} days.`,
      data: { businessAdId: ad.id, screen: "MyBusinessAds" },
    }).catch(() => undefined);
    return this.withAdMeta(activated as any);
  }

  async registerBusinessAdClick(id: number) {
    await this.prisma.businessAd.updateMany({ where: { id, status: BusinessAdStatus.ACTIVE }, data: { clicks: { increment: 1 } } });
    return { recorded: true };
  }

  async getAdminBusinessAds() {
    await this.expireAds();
    const ads = await this.prisma.businessAd.findMany({ include: { plan: true, user: { select: { id: true, name: true, email: true, phone: true } } }, orderBy: { createdAt: "desc" } });
    return ads.map((ad) => this.withAdMeta(ad));
  }

  async reviewBusinessAd(id: number, dto: ReviewBusinessAdDto) {
    const ad = await this.prisma.businessAd.findUnique({ where: { id } });
    if (!ad) throw new NotFoundException("Advertisement not found");
    if (ad.status !== BusinessAdStatus.PENDING_REVIEW) throw new BadRequestException("Only pending advertisements can be reviewed");
    if (dto.decision === "REJECTED" && !dto.reason?.trim()) throw new BadRequestException("Rejection reason is required");
    const updated = await this.prisma.businessAd.update({
      where: { id },
      data: dto.decision === "APPROVED"
        ? { status: BusinessAdStatus.APPROVED_AWAITING_PAYMENT, approvedAt: new Date(), rejectionReason: null }
        : { status: BusinessAdStatus.REJECTED, rejectionReason: dto.reason!.trim(), approvedAt: null },
      include: { plan: true, user: { select: { id: true, name: true, email: true, phone: true } } },
    });
    await this.clearCache();
    this.notifications.createAndSend({
      userId: ad.userId,
      type: dto.decision === "APPROVED" ? "BUSINESS_AD_APPROVED" : "BUSINESS_AD_REJECTED",
      title: dto.decision === "APPROVED" ? "Advertisement approved" : "Advertisement needs changes",
      body: dto.decision === "APPROVED"
        ? `${ad.businessName} was approved. Complete payment to start the campaign.`
        : dto.reason!.trim(),
      data: { businessAdId: ad.id, screen: "MyBusinessAds" },
    }).catch(() => undefined);
    return this.withAdMeta(updated);
  }

  async toggleBusinessAdPause(id: number) {
    const ad = await this.prisma.businessAd.findUnique({ where: { id } });
    if (!ad) throw new NotFoundException("Advertisement not found");
    if (ad.status !== BusinessAdStatus.ACTIVE && ad.status !== BusinessAdStatus.PAUSED) throw new BadRequestException("Only active ads can be paused or resumed");
    const updated = await this.prisma.businessAd.update({ where: { id }, data: { status: ad.status === BusinessAdStatus.ACTIVE ? BusinessAdStatus.PAUSED : BusinessAdStatus.ACTIVE }, include: { plan: true } });
    await this.clearCache();
    return this.withAdMeta(updated);
  }

  getAdminAdPlans() {
    return this.prisma.businessAdPlan.findMany({ orderBy: [{ sortOrder: "asc" }, { price: "asc" }] });
  }

  createAdPlan(dto: CreateBusinessAdPlanDto) {
    this.validatePlan(dto.price, dto.durationDays);
    return this.prisma.businessAdPlan.create({ data: { ...dto, name: dto.name.trim(), description: dto.description?.trim() || null } });
  }

  async updateAdPlan(id: number, dto: UpdateBusinessAdPlanDto) {
    if (dto.price !== undefined || dto.durationDays !== undefined) this.validatePlan(dto.price ?? 1, dto.durationDays ?? 1);
    return this.prisma.businessAdPlan.update({ where: { id }, data: { ...dto, ...(dto.name !== undefined && { name: dto.name.trim() }), ...(dto.description !== undefined && { description: dto.description?.trim() || null }) } });
  }

  async archiveAdminBusinessAd(id: number) {
    const result = await this.prisma.businessAd.updateMany({ where: { id }, data: { status: BusinessAdStatus.ARCHIVED } });
    if (!result.count) throw new NotFoundException("Advertisement not found");
    await this.clearCache();
    return { archived: true };
  }

  async update(id: number, dto: UpdateHomeOfferDto, image?: string) {
    await this.ensureExists(id);
    const offer = await this.prisma.homeOffer.update({
      where: { id },
      data: { ...this.toData(dto), ...(image ? { imageUrl: `/home-offers/images/${image}` } : {}) },
    });
    await this.clearCache();
    return offer;
  }

  async toggle(id: number) {
    const offer = await this.ensureExists(id);
    const updated = await this.prisma.homeOffer.update({
      where: { id },
      data: { isActive: !offer.isActive },
    });
    await this.clearCache();
    return updated;
  }

  async delete(id: number) {
    await this.ensureExists(id);
    const deleted = await this.prisma.homeOffer.delete({ where: { id } });
    await this.clearCache();
    return deleted;
  }

  private async requireOwnedAd(userId: number, id: number) {
    const ad = await this.prisma.businessAd.findFirst({ where: { id, userId }, include: { plan: true } });
    if (!ad) throw new NotFoundException("Advertisement not found");
    return ad;
  }

  private requirePayable(ad: { status: BusinessAdStatus; paidAt?: Date | null }) {
    if (ad.status !== BusinessAdStatus.APPROVED_AWAITING_PAYMENT || ad.paidAt) {
      throw new BadRequestException("This advertisement is not awaiting payment");
    }
  }

  private async activateAd(tx: any, id: number, durationDays: number, paymentMethod: string, paymentId: string) {
    const startsAt = new Date();
    const expiresAt = new Date(startsAt);
    expiresAt.setDate(expiresAt.getDate() + durationDays);
    const claimed = await tx.businessAd.updateMany({
      where: { id, status: BusinessAdStatus.APPROVED_AWAITING_PAYMENT, paidAt: null },
      data: { status: BusinessAdStatus.ACTIVE, startsAt, expiresAt, paidAt: startsAt, paymentMethod, paymentId },
    });
    if (!claimed.count) throw new BadRequestException("This advertisement payment was already processed");
    return tx.businessAd.findUnique({ where: { id }, include: { plan: true } });
  }

  private async expireAds() {
    await this.prisma.businessAd.updateMany({
      where: { status: { in: [BusinessAdStatus.ACTIVE, BusinessAdStatus.PAUSED] }, expiresAt: { lte: new Date() } },
      data: { status: BusinessAdStatus.EXPIRED },
    });
  }

  private withAdMeta<T extends { expiresAt?: Date | null; priceSnapshot: unknown; status: BusinessAdStatus }>(ad: T) {
    const expiresAt = ad.expiresAt ? new Date(ad.expiresAt) : null;
    const daysRemaining = expiresAt
      ? Math.max(0, Math.ceil((expiresAt.getTime() - Date.now()) / 86400000))
      : null;
    return { ...ad, priceSnapshot: Number(ad.priceSnapshot), daysRemaining };
  }

  private validatePlan(priceValue: number, durationValue: number) {
    const price = Number(priceValue);
    const duration = Number(durationValue);
    if (!Number.isFinite(price) || price <= 0) throw new BadRequestException("Plan price must be greater than zero");
    if (!Number.isInteger(duration) || duration < 1 || duration > 365) throw new BadRequestException("Plan duration must be between 1 and 365 days");
  }

  private clearCache() {
    return this.cache.deleteByPrefix("home-offers:");
  }

  private async ensureExists(id: number) {
    const offer = await this.prisma.homeOffer.findUnique({ where: { id } });
    if (!offer) throw new NotFoundException("Offer not found");
    return offer;
  }

  private toData(dto: CreateHomeOfferDto | UpdateHomeOfferDto) {
    return {
      ...(dto.title !== undefined && { title: dto.title.trim() }),
      ...(dto.subtitle !== undefined && { subtitle: dto.subtitle.trim() }),
      ...(dto.buttonLabel !== undefined && {
        buttonLabel: dto.buttonLabel?.trim() || "Claim",
      }),
      ...(dto.code !== undefined && { code: dto.code?.trim() || null }),
      ...(dto.phoneNumber !== undefined && {
        phoneNumber: dto.phoneNumber?.replace(/[^\d+]/g, "").trim() || null,
      }),
      ...(dto.whatsappNumber !== undefined && {
        whatsappNumber: dto.whatsappNumber?.replace(/[^\d+]/g, "").trim() || null,
      }),
      ...(dto.icon !== undefined && { icon: dto.icon?.trim() || "tag" }),
      ...(dto.color !== undefined && { color: dto.color?.trim() || "#E30613" }),
      ...(dto.sortOrder !== undefined && { sortOrder: Number(dto.sortOrder) || 0 }),
      ...(dto.isActive !== undefined && { isActive: Boolean(dto.isActive) }),
      ...(dto.startsAt !== undefined && {
        startsAt: dto.startsAt ? new Date(dto.startsAt) : null,
      }),
      ...(dto.expiresAt !== undefined && {
        expiresAt: dto.expiresAt ? new Date(dto.expiresAt) : null,
      }),
    };
  }
}
