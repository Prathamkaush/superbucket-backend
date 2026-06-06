import axios from "axios";

export async function checkDelhiveryServiceability(
  pickupPin: string,
  deliveryPin: string,
  isCOD: boolean
): Promise<{ serviceable: boolean; cod: boolean }> {
  try {
    const res = await axios.get(
      "https://track.delhivery.com/c/api/pin-codes/json/",
      {
        headers: {
          Authorization: `Token ${process.env.DELHIVERY_API_KEY}`,
        },
        params: {
          filter_codes: deliveryPin,
          pickup_pincode: pickupPin, // 🔥 THIS WAS MISSING
        },
        timeout: 5000,
      }
    );

    const codes = res.data?.delivery_codes;

    if (!Array.isArray(codes) || codes.length === 0) {
      return { serviceable: false, cod: false };
    }

    const pinData = codes[0]?.postal_code;

    const serviceable = pinData?.pre_paid === "Y";
    const codAvailable = pinData?.cod === "Y";

    console.log("📍 Serviceability check:", {
      pickupPin,
      deliveryPin,
      serviceable,
      cod: codAvailable,
    });

    return {
      serviceable,
      cod: codAvailable,
    };
  } catch (error) {
    console.error("❌ Serviceability check failed:", error);
    // Fail OPEN for prepaid, fail CLOSED for COD
    return { serviceable: true, cod: false };
  }
}


export async function getDelhiveryRate({
  pickupPin,
  deliveryPin,
  weightKg,
  cod,
  codAmount,
}: {
  pickupPin: string;
  deliveryPin: string;
  weightKg: number;
  cod: boolean;
  codAmount: number;
}) {
  // ✅ Check serviceability first
  const svc = await checkDelhiveryServiceability(
  pickupPin,
  deliveryPin,
  cod
);

if (!svc.serviceable) {
  throw new Error("Delivery not available to this pincode");
}

if (cod && !svc.cod) {
  throw new Error("COD not available for this pincode");
}

  // Convert to grams (Delhivery expects weight in grams)
  const weight = Math.max(Math.ceil(weightKg * 1000), 500);

  console.log("📦 Delhivery Rate Request:", {
    pickupPin,
    deliveryPin,
    weight,
    cod,
    codAmount
  });

  try {
    // ✅ Method 1: Try the serviceability check endpoint first
    const res = await axios.get(
      "https://track.delhivery.com/api/kinko/v1/invoice/charges/",
      {
        headers: {
          Authorization: `Token ${process.env.DELHIVERY_API_KEY}`,
          "Content-Type": "application/json",
        },
        params: {
          md: "S", // Mode: Surface
          ss: "Delivered", // Service Status
          d_pin: deliveryPin,
          o_pin: pickupPin,
          cgm: weight, // Charged weight in grams
          pt: cod ? "COD" : "Pre-paid",
          cod: cod ? "1" : "0",
        },
        timeout: 10000,
      }
    );

    console.log("📦 Delhivery Response:", JSON.stringify(res.data, null, 2));

    const data = res.data;

    // Check if it's an array response
    if (Array.isArray(data) && data.length === 0) {
      console.log("⚠️ Empty response, trying alternative endpoint...");
      return await getDelhiveryRateAlternative({
        pickupPin,
        deliveryPin,
        weightKg,
        cod,
        codAmount,
      });
    }

    // Parse different response formats
    let charge = null;

    if (Array.isArray(data) && data.length > 0) {
      charge = data[0]?.total_amount || data[0]?.freight_charge;
    } else if (data && typeof data === 'object') {
      charge =
        data.total_amount ||
        data.freight_charge ||
        data[0]?.total_amount ||
        data[0]?.freight_charge;
    }

    if (!charge || Number(charge) <= 0) {
      console.error("❌ Invalid charge. Raw response:", JSON.stringify(data));
      throw new Error("Invalid shipping charge from Delhivery");
    }

    console.log("✅ Shipping charge calculated:", charge);
    return Number(charge);
  } catch (error: any) {
    console.error("❌ Delhivery Rate Calculation Failed:", {
      message: error.message,
      response: error.response?.data,
      status: error.response?.status
    });
    
    // Try alternative endpoint if first fails
    if (error.response?.status !== 401) {
      try {
        return await getDelhiveryRateAlternative({
          pickupPin,
          deliveryPin,
          weightKg,
          cod,
          codAmount,
        });
      } catch (altError) {
        console.error("❌ Alternative endpoint also failed");
      }
    }
    
    throw error;
  }
}

// ✅ Alternative Delhivery endpoint
async function getDelhiveryRateAlternative({
  pickupPin,
  deliveryPin,
  weightKg,
  cod,
  codAmount,
}: {
  pickupPin: string;
  deliveryPin: string;
  weightKg: number;
  cod: boolean;
  codAmount: number;
}) {
  console.log("🔄 Trying alternative Delhivery endpoint...");

  const weight = Math.max(Math.ceil(weightKg * 1000), 500);

  try {
    const res = await axios.get(
      "https://track.delhivery.com/api/kinko/v1/invoice/charges/.json",
      {
        headers: {
          Authorization: `Token ${process.env.DELHIVERY_API_KEY}`,
        },
        params: {
          pickup_pin: pickupPin,
          delivery_pin: deliveryPin,
          weight: weight,
          cod: cod ? 1 : 0,
          cod_amount: cod ? codAmount : 0,
          ss: "Delivered",
          md: "S",
        },
        timeout: 10000,
      }
    );

    console.log("📦 Alternative Response:", JSON.stringify(res.data, null, 2));

    const data = res.data;

    if (!data || (Array.isArray(data) && data.length === 0)) {
      throw new Error("No rate data available");
    }

    // Try to extract charge from various possible locations
    const charge =
      data?.charges?.total_amount ||
      data?.charges?.total ||
      data?.total_amount ||
      data?.freight_charge ||
      (Array.isArray(data) && data[0]?.total_amount) ||
      (Array.isArray(data) && data[0]?.charge) ||
      null;

    if (!charge || Number(charge) <= 0) {
      throw new Error("Invalid shipping charge");
    }

    console.log("✅ Alternative endpoint charge:", charge);
    return Number(charge);
  } catch (error: any) {
    console.error("❌ Alternative endpoint failed:", error.message);
    throw error;
  }
}