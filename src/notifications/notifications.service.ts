import { BadRequestException, Injectable, Logger } from "@nestjs/common";
import { NotificationAudience, OrderStatus, Prisma, PushDevicePlatform, UserRole } from "@prisma/client";
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
        const parsed = JSON.parse(Buffer.from(encoded, "base64").toString("utf8"));
        credential = firebaseAdmin.credential.cert(parsed);
      } else if (json) {
        credential = firebaseAdmin.credential.cert(JSON.parse(json));
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
      this.logger.error(`Firebase initialization failed: ${(error as Error).message}`);
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
            imageUrl: payload.imageUrl || null,
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
        imageUrl: payload.imageUrl || null,
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

    const notifications = users.map((user) => ({
      userId: user.id,
      audience,
      type: "ADMIN_BROADCAST",
      title: payload.title,
      body: payload.body,
      imageUrl: payload.imageUrl || null,
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
        imageUrl: payload.imageUrl,
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
      await this.createAndSend({
        audience: NotificationAudience.DELIVERY_PARTNERS,
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

    const message = {
      notification: {
        title: payload.title,
        body: payload.body,
        ...(payload.imageUrl ? { imageUrl: payload.imageUrl } : {}),
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
          ...(payload.imageUrl ? { imageUrl: payload.imageUrl } : {}),
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

  private audienceWhere(audience: NotificationAudience): Prisma.UserWhereInput {
    if (audience === NotificationAudience.DELIVERY_PARTNERS) return { role: UserRole.DELIVERY_PARTNER };
    if (audience === NotificationAudience.USERS) return { role: UserRole.USER };
    if (audience === NotificationAudience.PROPERTY_OWNERS) return { properties: { some: {} } };
    return {};
  }
}
