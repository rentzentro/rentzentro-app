import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';
import { supabase } from '../../../supabaseClient';

export const runtime = 'nodejs'; // required for Stripe signature verification

const stripeSecret = process.env.STRIPE_SECRET_KEY;
const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

if (!stripeSecret) console.error("❌ Missing STRIPE_SECRET_KEY!");
if (!webhookSecret) console.error("❌ Missing STRIPE_WEBHOOK_SECRET!");

const stripe = stripeSecret
  ? new Stripe(stripeSecret, {
      apiVersion: "2025-10-29.clover",
    })
  : (null as unknown as Stripe);

export async function POST(req: NextRequest) {
  if (!stripe || !webhookSecret) {
    return new NextResponse("Stripe not configured", { status: 500 });
  }

  // Must read RAW body for Stripe signature verification
  const body = await req.text();
  const sig = req.headers.get("stripe-signature");

  let event: Stripe.Event;

  try {
    if (!sig) throw new Error("Missing stripe-signature header");
    event = stripe.webhooks.constructEvent(body, sig, webhookSecret);
  } catch (err: any) {
    console.error("❌ Webhook signature failure:", err.message);
    return new NextResponse(`Webhook Error: ${err.message}`, { status: 400 });
  }

  console.log("🔔 Webhook received:", event.type);

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;

        const metadata = session.metadata || {};
        console.log("📎 Metadata:", metadata);

        const tenantId =
          Number(metadata.tenant_id || metadata.tenantId || metadata.tenant);
        const propertyId =
          Number(
            metadata.property_id ||
              metadata.propertyId ||
              metadata.property
          );

        const amountTotal = session.amount_total; // cents

        if (!tenantId || !propertyId || !amountTotal) {
          console.warn("⚠️ Missing metadata. Skipping insert.");
          break;
        }

        const amount = amountTotal / 100;
        const paidOn = new Date().toISOString();

        console.log("💾 Inserting payment:", {
          tenant_id: tenantId,
          property_id: propertyId,
          amount,
          method: "card",
        });

        const { error } = await supabase.from("payments").insert({
          tenant_id: tenantId,
          property_id: propertyId,
          amount,
          paid_on: paidOn,
          method: "card",
          note: "Stripe Checkout payment",
        });

        if (error) {
          console.error("❌ Supabase insert error:", error);
          return new NextResponse("Supabase error", { status: 500 });
        }

        console.log("✅ Payment recorded for tenant", tenantId);

        break;
      }

      default:
        console.log("ℹ️ Unhandled event:", event.type);
    }

    return new NextResponse("OK", { status: 200 });
  } catch (err: any) {
    console.error("❌ Webhook processing error:", err);
    return new NextResponse("Webhook error", { status: 500 });
  }
}
