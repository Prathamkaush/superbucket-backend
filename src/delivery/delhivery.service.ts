import { Injectable, BadRequestException, NotFoundException, ServiceUnavailableException } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import axios from "axios";
import { OrderStatus } from "@prisma/client";

function normalizeState(state: string): string {
  if (!state) return "";
  return state
    .toUpperCase()
    .replace(/\s+/g, " ")
    .trim();
}

function estimateDeliveryDays(rawState: string): number {
  const state = normalizeState(rawState);

  const north = [
    "DELHI",
    "NCT OF DELHI",
    "NEW DELHI",
    "HARYANA",
    "PUNJAB",
    "UTTAR PRADESH",
    "UTTARAKHAND",
    "RAJASTHAN",
    "HIMACHAL PRADESH",
    "JAMMU AND KASHMIR",
  ];

  const central = [
    "MADHYA PRADESH",
    "GUJARAT",
    "MAHARASHTRA",
    "CHHATTISGARH",
  ];

  const east = [
    "WEST BENGAL",
    "ODISHA",
    "BIHAR",
    "JHARKHAND",
    "ASSAM",
    "MEGHALAYA",
    "MANIPUR",
    "NAGALAND",
    "TRIPURA",
    "MIZORAM",
    "ARUNACHAL PRADESH",
  ];

  const south = [
    "KARNATAKA",
    "TAMIL NADU",
    "KERALA",
    "TELANGANA",
    "ANDHRA PRADESH",
    "GOA",
    "PUDUCHERRY",
  ];

  if (north.includes(state)) return 2;
  if (central.includes(state)) return 3;
  if (east.includes(state)) return 4;
  if (south.includes(state)) return 5;

  return 5; // safe fallback
}

@Injectable()
export class DelhiveryService {

  constructor(private prisma: PrismaService) {}

  /* ================= CREATE SHIPMENT ================= */
async createShipment(orderId: number) {
  const order = await this.prisma.order.findUnique({
    where: { id: orderId },
    include: {
      items: { include: { product: true } },
    },
  });

  if (!order) throw new BadRequestException("Order not found");
  if (order.status !== OrderStatus.CONFIRMED)
    throw new BadRequestException("Order must be CONFIRMED before shipping");
  if (order.trackingId)
    throw new BadRequestException("Shipment already created");

  const address: any = order.address;

  const shippingAddress = {
    name: address?.name,
    add: address?.addressLine1 || address?.street,
    city: address?.city,
    state: address?.state,
    pin: String(address?.pincode),
    phone: String(address?.phone),
  };

  // ✅ Calculate weight
  const totalWeightGrams = order.items.reduce(
    (sum, item) =>
      sum + Number(item.product.weight || 0.5) * 1000 * item.quantity,
    0
  );

  const totalWeightKg = Math.max(totalWeightGrams / 1000, 0.5);

  const shipmentData = {
    shipments: [
      {
        name: shippingAddress.name,
        add: shippingAddress.add,
        city: shippingAddress.city,
        state: shippingAddress.state,
        pin: shippingAddress.pin,
        phone: shippingAddress.phone,
        country: "India",
        order: String(order.id),
        payment_mode: order.paymentMethod === "COD" ? "COD" : "Prepaid",
        cod_amount:
          order.paymentMethod === "COD" ? String(order.totalAmount) : "0",
        quantity: String(order.items.reduce((s, i) => s + i.quantity, 0)),
        weight: totalWeightKg.toFixed(2),
        return_name: process.env.DELHIVERY_PICKUP_NAME,
        return_add: process.env.DELHIVERY_PICKUP_ADDRESS,
        return_city: process.env.DELHIVERY_PICKUP_CITY,
        return_state: process.env.DELHIVERY_PICKUP_STATE,
        return_pin: process.env.DELHIVERY_PICKUP_PIN,
        return_phone: process.env.DELHIVERY_PICKUP_PHONE,
      },
    ],
    pickup_location: {
      name: process.env.DELHIVERY_PICKUP_NAME,
      add: process.env.DELHIVERY_PICKUP_ADDRESS,
      pin: process.env.DELHIVERY_PICKUP_PIN,
      phone: process.env.DELHIVERY_PICKUP_PHONE,
      city: process.env.DELHIVERY_PICKUP_CITY,
      state: process.env.DELHIVERY_PICKUP_STATE,
      country: "India",
    },
  };

  const formData = new URLSearchParams();
  formData.append("format", "json");
  formData.append("data", JSON.stringify(shipmentData));

  const res = await axios.post(
    "https://track.delhivery.com/api/cmu/create.json",
    formData.toString(),
    {
      headers: {
        Authorization: `Token ${process.env.DELHIVERY_API_KEY}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
    }
  );

  const pkg = res.data?.packages?.[0];

  if (!pkg || pkg.status !== "Success") {
    throw new BadRequestException({
      message: "Delhivery rejected shipment",
      remarks: pkg?.remarks,
      serviceable: pkg?.serviceable,
      response: res.data,
    });
  }

  await this.prisma.order.update({
  where: { id: orderId },
  data: {
    status: OrderStatus.SHIPPED,
    shippedAt: new Date(),
    trackingId: pkg.waybill,
    courier: "DELHIVERY",
  },
});

  return { success: true, waybill: pkg.waybill };
}

async trackShipment(waybill: string) {
  if (!waybill) {
    throw new BadRequestException("Waybill not provided");
  }

  try {
    const res = await axios.get(
      `https://track.delhivery.com/api/v1/packages/json/?waybill=${waybill}`,
      {
        headers: {
          Authorization: `Token ${process.env.DELHIVERY_API_KEY}`,
        },
      }
    );

    const data = res.data;

    if (!data?.ShipmentData?.length) {
      throw new NotFoundException("Tracking data not found");
    }

    const shipment = data.ShipmentData[0].Shipment;
    const statusText = shipment?.Status?.Status || "";
    const normalizedStatus = statusText.toLowerCase();

    // ✅ Ensure SHIPPED status once tracking exists
    await this.prisma.order.updateMany({
  where: {
    trackingId: waybill,
    status: OrderStatus.CONFIRMED,
    shippedAt: null,
  },
  data: {
    status: OrderStatus.SHIPPED,
    shippedAt: new Date(),
  },
});

    // ✅ Auto mark delivered
    if (normalizedStatus.includes("delivered")) {
      await this.prisma.order.updateMany({
        where: {
          trackingId: waybill,
          status: { not: OrderStatus.DELIVERED},
        },
        data: {
          status: OrderStatus.DELIVERED,
          deliveredAt: shipment?.DeliveryDate
  ? new Date(shipment.DeliveryDate)
  : new Date(),
        },
      });
    }

    return {
      status: statusText,
      message: shipment?.Status?.Instructions || "",
      deliveredAt: shipment?.DeliveryDate || null,
      scans:
        shipment?.Scans?.map((s: any) => ({
          time: s?.ScanDetail?.ScanDateTime,
          location: s?.ScanDetail?.ScannedLocation,
          activity: s?.ScanDetail?.Instructions,
          status: s?.ScanDetail?.Status,
        })) || [],
    };
  } catch (err: any) {
    console.error("❌ DELHIVERY TRACKING ERROR:", err.response?.data || err.message);

    throw new ServiceUnavailableException({
      message: "Unable to fetch shipment tracking from Delhivery",
      error: err.response?.data || err.message,
    });
  }
}
async checkPincode(pincode: string) {
  if (!/^\d{6}$/.test(pincode)) {
    throw new BadRequestException("Invalid pincode format");
  }

  try {
    const res = await axios.get(
      "https://track.delhivery.com/c/api/pin-codes/json/",
      {
        params: { filter_codes: pincode },
        headers: {
          Authorization: `Token ${process.env.DELHIVERY_API_KEY}`,
        },
        timeout: 7000,
      }
    );

    console.log("📍 Pincode check response:", JSON.stringify(res.data, null, 2));

    const data = res.data?.delivery_codes?.[0]?.postal_code;

    if (!data) {
      return {
        serviceable: false,
        message: "Pincode not found in our delivery network",
      };
    }

    // Check if prepaid delivery is available
    if (data.pre_paid !== "Y") {
      return {
        serviceable: false,
        message: "Delivery not available at this pincode",
      };
    }

    const estimatedDays = estimateDeliveryDays(data.state_name || data.state);

    return {
      serviceable: true,
      city: data.city,
      state: data.state_name || data.state,
      cod: data.cod === "Y",
      estimatedDays,
      message: `Delivery in ${estimatedDays}–${estimatedDays + 1} days`,
    };
  } catch (error: any) {
    console.error("❌ Pincode check failed:", error.message);
    
    if (error.response?.status === 401) {
      throw new BadRequestException("Delivery service configuration error");
    }
    
    throw new BadRequestException("Unable to check pincode serviceability");
  }
}
}