import { BadRequestException, Injectable, Logger } from "@nestjs/common";
import {
  NotificationAudience,
  OrderStatus,
  Prisma,
  PushDevicePlatform,
  ServiceBookingStatus,
  ServiceProviderStatus,
  UserRole,
} from "@prisma/client";
import * as firebaseAdmin from "firebase-admin";
import { PrismaService } from "../prisma/prisma.service";

type NotificationPayload = {
  userId?: number;
  audience?: NotificationAudience;
  type: string;
  title: string;
  body: string;
  imageUrl?: string | null;
  data?: Record<string, string | number | boolean | null | undefined>;
  createdById?: number;
};

const STATUS_COPY: Record<OrderStatus, { title: string; body: (id: number) => string }> = {
  PENDING: {
    title: "Order received",
    body: (id) => `Your order #${id} has been received successfully.`,
  },
  CONFIRMED: {
    title: "Order confirmed",
    body: (id) => `Your order #${id} has been confirmed and is being prepared.`,
  },
  SHIPPED: {
    title: "Order out for delivery",
    body: (id) => `Your order #${id} is ready for pickup and delivery.`,
  },
  DELIVERED: {
    title: "Order delivered",
    body: (id) => `Your order #${id} was delivered successfully.`,
  },
  CANCELLED: {
    title: "Order cancelled",
    body: (id) => `Your order #${id} was cancelled.`,
  },
};

const MAX_NOTIFICATION_IMAGE_URL_LENGTH = 2048;

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);
  private firebaseReady = false;

  constructor(private readonly prisma: PrismaService) {
    this.initFirebase();
  }

  private initFirebase() {
    if (firebaseAdmin.apps.length) {
      this.firebaseReady = true;
      return;
    }

    const encoded = process.env.FIREBASE_SERVICE_ACCOUNT;
    const json = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
    const projectId = process.env.FIREBASE_PROJECT_ID;
    const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
    const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, "\n");

    try {
      let credential: firebaseAdmin.credential.Credential | undefined;

      if (encoded) {
        credential = firebaseAdmin.credential.cert(parseFirebaseServiceAccount(encoded, true));
      } else if (json) {
        credential = firebaseAdmin.credential.cert(parseFirebaseServiceAccount(json));
      } else if (projectId && clientEmail && privateKey) {
        credential = firebaseAdmin.credential.cert({ projectId, clientEmail, privateKey });
      }

      if (!credential) {
        this.logger.warn("Firebase service account is not configured. Notifications will be stored but push send is disabled.");
        return;
      }

      firebaseAdmin.initializeApp({ credential });
      this.firebaseReady = true;
    } catch (error) {
      this.firebaseReady = false;
      this.logger.error(
        `Firebase initialization failed: ${(error as Error).message}. Check FIREBASE_SERVICE_ACCOUNT_JSON or FIREBASE_SERVICE_ACCOUNT formatting.`,
      );
    }
  }

  async registerDeviceToken(userId: number, dto: { token: string; platform?: string; app?: string }) {
    const token = dto.token.trim();
    if (!token) throw new BadRequestException("Device token is required");

    return this.prisma.pushDeviceToken.upsert({
      where: { token },
      update: {
        userId,
        platform: (dto.platform || "ANDROID") as PushDevicePlatform,
        app: dto.app || null,
        isActive: true,
        lastSeenAt: new Date(),
      },
      create: {
        userId,
        token,
        platform: (dto.platform || "ANDROID") as PushDevicePlatform,
        app: dto.app || null,
      },
    });
  }

  async listMine(userId: number, page = 1, limit = 30) {
    const take = Math.min(Math.max(limit, 1), 50);
    const skip = (Math.max(page, 1) - 1) * take;
    const [items, total, unread] = await Promise.all([
      this.prisma.notification.findMany({
        where: { userId },
        orderBy: { createdAt: "desc" },
        skip,
        take,
      }),
      this.prisma.notification.count({ where: { userId } }),
      this.prisma.notification.count({ where: { userId, readAt: null } }),
    ]);

    return { items, total, unread, page, limit: take };
  }

  async markRead(userId: number, id: number) {
    return this.prisma.notification.updateMany({
      where: { id, userId, readAt: null },
      data: { readAt: new Date() },
    });
  }

  async markAllRead(userId: number) {
    return this.prisma.notification.updateMany({
      where: { userId, readAt: null },
      data: { readAt: new Date() },
    });
  }

  async deleteMine(userId: number, id: number) {
    if (!Number.isInteger(id) || id <= 0) throw new BadRequestException("Invalid notification id");
    const result = await this.prisma.notification.deleteMany({ where: { id, userId } });
    if (!result.count) throw new BadRequestException("Notification not found");
    return { deleted: true };
  }

  async createAndSend(payload: NotificationPayload) {
    if (!payload.userId && payload.audience) {
      const users = await this.findAudienceUsers(payload.audience);
      if (users.length) {
        await this.prisma.notification.createMany({
          data: users.map((user) => ({
            userId: user.id,
            audience: payload.audience,
            type: payload.type,
            title: payload.title,
            body: payload.body,
            imageUrl: normalizeImageUrl(payload.imageUrl),
            data: (payload.data || undefined) as Prisma.InputJsonValue | undefined,
            sentAt: new Date(),
            createdById: payload.createdById,
          })),
        });
      }
      await this.sendPush(payload);
      return { recipients: users.length };
    }

    const notification = await this.prisma.notification.create({
      data: {
        userId: payload.userId,
        audience: payload.audience,
        type: payload.type,
        title: payload.title,
        body: payload.body,
        imageUrl: normalizeImageUrl(payload.imageUrl),
        data: (payload.data || undefined) as Prisma.InputJsonValue | undefined,
        sentAt: new Date(),
        createdById: payload.createdById,
      },
    });

    await this.sendPush(payload);
    return notification;
  }

  async adminBroadcast(
    actorId: number,
    payload: { title: string; body: string; imageUrl?: string; audience?: NotificationAudience },
  ) {
    const audience = payload.audience || NotificationAudience.ALL;
    const users = await this.findAudienceUsers(audience);
    const imageUrl = normalizeImageUrl(payload.imageUrl);

    const notifications = users.map((user) => ({
      userId: user.id,
      audience,
      type: "ADMIN_BROADCAST",
      title: payload.title,
      body: payload.body,
      imageUrl,
      data: { audience },
      createdById: actorId,
      sentAt: new Date(),
    }));

    if (notifications.length) {
      await this.prisma.notification.createMany({ data: notifications });
      await this.sendPush({
        audience,
        type: "ADMIN_BROADCAST",
        title: payload.title,
        body: payload.body,
        imageUrl,
        data: { audience },
      });
    }

    return { message: "Notification sent", audience, recipients: users.length };
  }

  async notifyOrderCreated(userId: number, order: { id: number; finalAmount?: any }) {
    return this.createAndSend({
      userId,
      type: "ORDER_CREATED",
      title: "Order placed successfully",
      body: `Your order #${order.id} has been placed successfully.`,
      data: { orderId: order.id, screen: "OrderTracking" },
    });
  }

  async notifyServiceBookingCreated(booking: {
    id: number;
    bookingNumber: string;
    customerId: number;
    providerId?: number | null;
    categoryId: number;
    serviceName: string;
  }) {
    await this.createAndSend({
      userId: booking.customerId,
      type: "SERVICE_BOOKING_CREATED",
      title: "Service booked successfully",
      body: `${booking.serviceName} (${booking.bookingNumber}) has been booked successfully.`,
      data: { bookingId: booking.id, screen: "ServiceBookingDetail" },
    });

    if (booking.providerId) {
      return this.notifyUsers([booking.providerId], {
        type: "SERVICE_JOB_ASSIGNED",
        title: "New service job assigned",
        body: `${booking.serviceName} (${booking.bookingNumber}) has been assigned to you.`,
        data: { bookingId: booking.id, screen: "Jobs" },
      });
    }

    const providers = await this.prisma.serviceProviderProfile.findMany({
      where: {
        status: ServiceProviderStatus.APPROVED,
        isOnline: true,
        services: { some: { categoryId: booking.categoryId } },
      },
      select: { userId: true },
    });

    return this.notifyUsers(
      providers.map((provider) => provider.userId),
      {
        type: "SERVICE_JOB_AVAILABLE",
        title: "New service job available",
        body: `${booking.serviceName} (${booking.bookingNumber}) is available to accept.`,
        data: { bookingId: booking.id, screen: "AvailableJobs" },
      },
    );
  }

  async notifyServiceBookingStatus(booking: {
    id: number;
    bookingNumber: string;
    customerId: number;
    serviceName: string;
    status: ServiceBookingStatus;
  }) {
    const copy: Partial<Record<ServiceBookingStatus, { title: string; body: string }>> = {
      ACCEPTED: {
        title: "Service provider assigned",
        body: `A provider accepted ${booking.serviceName} (${booking.bookingNumber}).`,
      },
      EN_ROUTE: {
        title: "Provider is on the way",
        body: `Your provider is travelling to you for ${booking.serviceName}.`,
      },
      IN_PROGRESS: {
        title: "Service started",
        body: `${booking.serviceName} is now in progress.`,
      },
      REVISIT_REQUESTED: {
        title: "Revisit requested",
        body: `Your provider requested a revisit for ${booking.serviceName}.`,
      },
      COMPLETED: {
        title: "Service completed",
        body: `${booking.serviceName} (${booking.bookingNumber}) has been completed.`,
      },
      CANCELLED: {
        title: "Service booking cancelled",
        body: `${booking.serviceName} (${booking.bookingNumber}) was cancelled.`,
      },
    };
    const message = copy[booking.status];
    if (!message) return { recipients: 0 };

    return this.createAndSend({
      userId: booking.customerId,
      type: `SERVICE_BOOKING_${booking.status}`,
      title: message.title,
      body: message.body,
      data: {
        bookingId: booking.id,
        screen: "ServiceBookingDetail",
        status: booking.status,
      },
    });
  }

  async notifyOrderStatus(order: { id: number; userId: number; status: OrderStatus }) {
    const copy = STATUS_COPY[order.status];
    await this.createAndSend({
      userId: order.userId,
      type: `ORDER_${order.status}`,
      title: copy.title,
      body: copy.body(order.id),
      data: { orderId: order.id, screen: "OrderTracking", status: order.status },
    });

    if (order.status === OrderStatus.SHIPPED) {
      await this.notifyDeliveryPartnersForOrder(order.id, {
        type: "DELIVERY_ORDER_READY",
        title: "New delivery available",
        body: `Order #${order.id} is ready for pickup.`,
        data: { orderId: order.id, screen: "Deliveries" },
      });
    }
  }

  async notifyWalletCredit(userId: number, amount: number) {
    return this.createAndSend({
      userId,
      type: "WALLET_CREDIT",
      title: "Wallet credited",
      body: `Rs ${amount.toFixed(2)} added to your wallet successfully.`,
      data: { amount, screen: "Wallet" },
    });
  }

  async notifyPropertyLead(ownerId: number, propertyId: number, propertyTitle: string) {
    return this.createAndSend({
      userId: ownerId,
      type: "PROPERTY_LEAD",
      title: "New property lead",
      body: `Someone is interested in ${propertyTitle}.`,
      data: { propertyId, screen: "RenterPortal" },
    });
  }

  async notifyPropertyStatus(userId: number, propertyId: number, approved: boolean) {
    return this.createAndSend({
      userId,
      type: approved ? "PROPERTY_APPROVED" : "PROPERTY_REJECTED",
      title: approved ? "Property approved" : "Property needs changes",
      body: approved ? "Your property listing is now live." : "Your property listing was rejected by admin.",
      data: { propertyId, screen: "RenterPortal" },
    });
  }

  async notifyAdmins(type: string, title: string, body: string, data: NotificationPayload["data"] = {}) {
    const admins = await this.prisma.user.findMany({
      where: { role: UserRole.ADMIN },
      select: { id: true },
    });

    return this.notifyUsers(
      admins.map((admin) => admin.id),
      { type, title, body, data },
    );
  }

  async notifyNewUser(user: { id: number; name?: string | null; email?: string | null; phone?: string | null }) {
    return this.notifyAdmins(
      "ADMIN_NEW_USER",
      "New user joined",
      `${user.name || user.email || user.phone || "A new user"} joined IntiSeva.`,
      { userId: user.id, screen: "Users" },
    );
  }

  async notifyStaffCreated(staff: { id: number; name?: string | null; role: UserRole }, actorId?: number) {
    const admins = await this.prisma.user.findMany({
      where: { role: UserRole.ADMIN },
      select: { id: true },
    });
    const recipients = new Set(admins.map((admin) => admin.id));
    if (actorId) recipients.add(actorId);

    return this.notifyUsers(Array.from(recipients), {
      type: `ADMIN_${staff.role}_CREATED`,
      title: `${staff.role.replace("_", " ")} created`,
      body: `${staff.name || "A staff member"} was added as ${staff.role.replace("_", " ").toLowerCase()}.`,
      data: { staffId: staff.id, screen: "Staff", role: staff.role },
    });
  }

  async notifyNewOrderForStaff(order: {
    id: number;
    finalAmount?: unknown;
    shopId?: number | null;
    deliveryMode?: string | null;
    scheduledDeliveryAt?: Date | string | null;
    deliverySlotLabel?: string | null;
  }) {
    const deliveryLabel = order.deliveryMode === "SCHEDULED"
      ? order.deliverySlotLabel || (order.scheduledDeliveryAt
          ? new Date(order.scheduledDeliveryAt).toLocaleString("en-IN")
          : "the selected delivery slot")
      : "instant delivery";

    await this.notifyAdmins(
      "ADMIN_NEW_ORDER",
      "New order received",
      `Order #${order.id} has been placed for ${deliveryLabel}.`,
      { orderId: order.id, screen: "Orders" },
    );

    if (!order.shopId) {
      return { recipients: 0 };
    }

    const [pickers, shop] = await Promise.all([
      this.prisma.user.findMany({
        where: { role: UserRole.PICKER, staffShopId: order.shopId },
        select: { id: true },
      }),
      this.prisma.shop.findUnique({
        where: { id: order.shopId },
        select: { ownerId: true },
      }),
    ]);
    const recipients = pickers.map((picker) => picker.id);
    if (shop?.ownerId) recipients.push(shop.ownerId);

    return this.notifyUsers(
      recipients,
      {
        type: "PICKER_NEW_ORDER",
        title: order.deliveryMode === "SCHEDULED" ? "New scheduled order" : "New order ready",
        body: `Order #${order.id} is for ${deliveryLabel}.`,
        data: { orderId: order.id, screen: "Orders" },
      },
    );
  }

  async notifyDeliveryPartnersForOrder(
    orderId: number,
    payload: Omit<NotificationPayload, "userId" | "audience">,
  ) {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      select: { shopId: true },
    });
    if (!order?.shopId) return { recipients: 0 };

    const partners = await this.prisma.user.findMany({
      where: {
        role: UserRole.DELIVERY_PARTNER,
        isVerified: true,
        staffShopId: order.shopId,
      },
      select: { id: true },
    });

    return this.notifyUsers(
      partners.map((partner) => partner.id),
      payload,
    );
  }

  async notifyNearbyProperty(property: {
    id: number;
    ownerId: number;
    title: string;
    pincode?: string | null;
    mode?: string | null;
    price?: unknown;
  }) {
    if (!/^\d{6}$/.test(property.pincode || "")) {
      return { recipients: 0 };
    }

    const pincodePrefix = property.pincode!.slice(0, 3);
    const users = await this.prisma.user.findMany({
      where: {
        id: { not: property.ownerId },
        role: UserRole.USER,
        addresses: {
          some: {
            pincode: { startsWith: pincodePrefix },
          },
        },
      },
      select: { id: true },
    });

    if (!users.length) {
      return { recipients: 0 };
    }

    const price = Number(property.price || 0).toLocaleString("en-IN", { maximumFractionDigits: 0 });
    const rentSuffix = property.mode === "RENT" ? "/mo" : "";
    const payload: NotificationPayload = {
      type: "PROPERTY_NEARBY",
      title: "New property near you",
      body: `${property.title} is now available near your saved address for Rs ${price}${rentSuffix}.`,
      data: {
        propertyId: property.id,
        screen: "RentalDetail",
        pincode: property.pincode,
      },
    };

    await this.prisma.notification.createMany({
      data: users.map((user) => ({
        userId: user.id,
        type: payload.type,
        title: payload.title,
        body: payload.body,
        data: payload.data as Prisma.InputJsonValue,
        sentAt: new Date(),
      })),
    });

    await this.sendPushToUsers(users.map((user) => user.id), payload);
    return { recipients: users.length };
  }

  private async findAudienceUsers(audience: NotificationAudience) {
    if (audience === NotificationAudience.DELIVERY_PARTNERS) {
      return this.prisma.user.findMany({ where: { role: UserRole.DELIVERY_PARTNER }, select: { id: true } });
    }
    if (audience === NotificationAudience.PROPERTY_OWNERS) {
      return this.prisma.user.findMany({
        where: { properties: { some: {} } },
        select: { id: true },
      });
    }
    if (audience === NotificationAudience.USERS) {
      return this.prisma.user.findMany({ where: { role: UserRole.USER }, select: { id: true } });
    }
    return this.prisma.user.findMany({ select: { id: true } });
  }

  private async sendPush(payload: NotificationPayload) {
    if (!this.firebaseReady) return;

    const where = payload.userId
      ? { userId: payload.userId, isActive: true }
      : { isActive: true, user: this.audienceWhere(payload.audience || NotificationAudience.ALL) };

    const tokens = await this.prisma.pushDeviceToken.findMany({
      where,
      select: { token: true },
    });

    if (!tokens.length) return;

    const pushImageUrl = publicImageUrl(payload.imageUrl);
    const message = {
      notification: {
        title: payload.title,
        body: payload.body,
        ...(pushImageUrl ? { imageUrl: pushImageUrl } : {}),
      },
      data: Object.fromEntries(
        Object.entries({
          type: payload.type,
          ...(payload.data || {}),
        }).map(([key, value]) => [key, value == null ? "" : String(value)]),
      ),
      android: {
        priority: "high" as const,
        notification: {
          channelId: "default",
          ...(pushImageUrl ? { imageUrl: pushImageUrl } : {}),
        },
      },
      tokens: tokens.map((item) => item.token),
    };

    const response = await firebaseAdmin.messaging().sendEachForMulticast(message);
    const inactiveTokens = response.responses
      .map((item, index) => ({ item, token: tokens[index]?.token }))
      .filter(({ item }) => !item.success)
      .filter(({ item }) => {
        const code = item.error?.code || "";
        return code.includes("registration-token-not-registered") || code.includes("invalid-registration-token");
      })
      .map(({ token }) => token)
      .filter(Boolean) as string[];

    if (inactiveTokens.length) {
      await this.prisma.pushDeviceToken.updateMany({
        where: { token: { in: inactiveTokens } },
        data: { isActive: false },
      });
    }
  }

  private async sendPushToUsers(userIds: number[], payload: NotificationPayload) {
    if (!this.firebaseReady || !userIds.length) return;

    const tokens = await this.prisma.pushDeviceToken.findMany({
      where: {
        userId: { in: userIds },
        isActive: true,
      },
      select: { token: true },
    });

    if (!tokens.length) return;

    const pushImageUrl = publicImageUrl(payload.imageUrl);
    const message = {
      notification: {
        title: payload.title,
        body: payload.body,
        ...(pushImageUrl ? { imageUrl: pushImageUrl } : {}),
      },
      data: Object.fromEntries(
        Object.entries({
          type: payload.type,
          ...(payload.data || {}),
        }).map(([key, value]) => [key, value == null ? "" : String(value)]),
      ),
      android: {
        priority: "high" as const,
        notification: {
          channelId: "default",
          ...(pushImageUrl ? { imageUrl: pushImageUrl } : {}),
        },
      },
      tokens: tokens.map((item) => item.token),
    };

    const response = await firebaseAdmin.messaging().sendEachForMulticast(message);
    const inactiveTokens = response.responses
      .map((item, index) => ({ item, token: tokens[index]?.token }))
      .filter(({ item }) => !item.success)
      .filter(({ item }) => {
        const code = item.error?.code || "";
        return code.includes("registration-token-not-registered") || code.includes("invalid-registration-token");
      })
      .map(({ token }) => token)
      .filter(Boolean) as string[];

    if (inactiveTokens.length) {
      await this.prisma.pushDeviceToken.updateMany({
        where: { token: { in: inactiveTokens } },
        data: { isActive: false },
      });
    }
  }

  private async notifyUsers(userIds: number[], payload: Omit<NotificationPayload, "userId">) {
    const recipients = Array.from(new Set(userIds)).filter(Boolean);
    if (!recipients.length) {
      return { recipients: 0 };
    }

    const imageUrl = normalizeImageUrl(payload.imageUrl);
    await this.prisma.notification.createMany({
      data: recipients.map((userId) => ({
        userId,
        type: payload.type,
        title: payload.title,
        body: payload.body,
        imageUrl,
        data: (payload.data || undefined) as Prisma.InputJsonValue | undefined,
        sentAt: new Date(),
        createdById: payload.createdById,
      })),
    });

    await this.sendPushToUsers(recipients, { ...payload, imageUrl });
    return { recipients: recipients.length };
  }

  private audienceWhere(audience: NotificationAudience): Prisma.UserWhereInput {
    if (audience === NotificationAudience.DELIVERY_PARTNERS) return { role: UserRole.DELIVERY_PARTNER };
    if (audience === NotificationAudience.USERS) return { role: UserRole.USER };
    if (audience === NotificationAudience.PROPERTY_OWNERS) return { properties: { some: {} } };
    return {};
  }
}

function normalizeImageUrl(value?: string | null) {
  const imageUrl = typeof value === "string" ? value.trim() : "";
  if (!imageUrl) return null;
  return imageUrl.slice(0, MAX_NOTIFICATION_IMAGE_URL_LENGTH);
}

function publicImageUrl(value?: string | null) {
  const normalized = normalizeImageUrl(value);
  const imageUrl = normalized?.replace(/^\/uploads\/notifications\//, "/notification-images/");
  if (!imageUrl || /^https?:\/\//i.test(imageUrl)) return imageUrl;
  const baseUrl = (process.env.PUBLIC_API_URL || process.env.API_URL || "https://apiv1.freeqr.live").replace(/\/$/, "");
  return `${baseUrl}${imageUrl.startsWith("/") ? "" : "/"}${imageUrl}`;
}

function parseFirebaseServiceAccount(value: string, preferBase64 = false) {
  const trimmed = value.trim();
  const candidates = preferBase64
    ? [Buffer.from(trimmed, "base64").toString("utf8"), trimmed]
    : [trimmed, Buffer.from(trimmed, "base64").toString("utf8")];

  for (const candidate of candidates) {
    try {
      return JSON.parse(candidate);
    } catch {
      // Try the next supported encoding.
    }
  }

  throw new Error("Firebase service account must be valid JSON or base64-encoded JSON");
}
