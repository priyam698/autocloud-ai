import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import crypto from "crypto";

export async function POST(req: Request) {
  try {
    const rawBody = await req.text();
    const signature = req.headers.get("x-signature");
    const secret = process.env.LEMONSQUEEZY_WEBHOOK_SECRET;

    // 1. Validate Webhook Signature (Security Check)
    if (secret && signature) {
      const hmac = crypto.createHmac("sha256", secret);
      const digest = Buffer.from(hmac.update(rawBody).digest("hex"), "utf8");
      const signatureBuffer = Buffer.from(signature, "utf8");

      if (!crypto.timingSafeEqual(digest, signatureBuffer)) {
        return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
      }
    }

    const payload = JSON.parse(rawBody);
    const eventName = payload.meta?.event_name;

    // 2. Handle Successful Order / Purchase Event
    if (eventName === "order_created") {
      const customData = payload.meta?.custom_data || {};
      const customerEmail = payload.data?.attributes?.user_email;
      const productName = payload.data?.attributes?.first_order_item?.product_name || "Telegram AI Bot Runner";

      // Calculate 30-day expiration date
      const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();

      // 3. Insert newly purchased instance into Supabase deployments table
      const { data, error } = await supabase.from("deployments").insert([
        {
          template_name: productName,
          template_id: customData.template_id || "telegram-ai-bot",
          status: "RUNNING",
          organization_type: customData.organization_type || "Individual",
          organization_name: customData.organization_type === "Organization" ? customData.organization_name : "Individual Use",
          use_case_description: customData.use_case || "Automated AI Telegram Bot",
          user_email: customerEmail,
          expires_at: expiresAt,
          provisioned_at: new Date().toISOString(),
        },
      ]);

      if (error) {
        console.error("❌ Failed to insert instance into Supabase:", error.message);
        return NextResponse.json({ error: error.message }, { status: 500 });
      }

      console.log(`✅ Successfully provisioned instance for ${customerEmail}`);
    }

    return NextResponse.json({ success: true, event: eventName });
  } catch (err) {
    console.error("❌ Error processing Lemon Squeezy webhook:", err);
    return NextResponse.json({ error: "Webhook handler failed" }, { status: 500 });
  }
}