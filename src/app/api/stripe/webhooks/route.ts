import { headers } from "next/headers";
import { NextResponse } from "next/server";
import Stripe from "stripe";
import { Bot } from "grammy";
import { stripe } from "@/lib/stripe";
import { prisma } from "@/lib/prisma";
import { getPlanFromPriceId } from "@/lib/stripe-config";

const bot = new Bot(process.env.TELEGRAM_ADMIN_BOT_TOKEN!);
const ADMIN_CHAT_ID = "1610163233";

async function notifyAdmin(message: string) {
  try {
    await bot.api.sendMessage(ADMIN_CHAT_ID, message, { parse_mode: "Markdown" });
  } catch (error) {
    console.error("Failed to send admin Telegram notification:", error);
  }
}

async function getCustomerEmail(customerId: string): Promise<string> {
  try {
    const customer = await stripe.customers.retrieve(customerId);
    if (customer.deleted) return "Unknown";
    return customer.email || "Unknown";
  } catch {
    return "Unknown";
  }
}

export async function POST(request: Request) {
  const body = await request.text();
  const headersList = await headers();
  const signature = headersList.get("stripe-signature");

  if (!signature) {
    return NextResponse.json({ error: "Missing signature" }, { status: 400 });
  }

  let event: Stripe.Event;

  try {
    event = stripe.webhooks.constructEvent(
      body,
      signature,
      process.env.STRIPE_WEBHOOK_SECRET!
    );
  } catch (error) {
    console.error("Webhook signature verification failed:", error);
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;

        if (session.mode === "subscription" && session.subscription) {
          const subscription = await stripe.subscriptions.retrieve(
            session.subscription as string
          );

          const priceId = subscription.items.data[0]?.price.id;
          const plan = getPlanFromPriceId(priceId);
          const customerId = session.customer as string;
          const email = await getCustomerEmail(customerId);

          // Update user with subscription info
          await prisma.user.update({
            where: { stripeCustomerId: customerId },
            data: {
              plan,
              stripeSubscriptionId: subscription.id,
              stripePriceId: priceId,
            },
          });

          const hasTrial = subscription.trial_end !== null;
          const trialInfo = hasTrial
            ? `\n🎁 Trial until: ${new Date(subscription.trial_end! * 1000).toLocaleDateString()}`
            : "";

          await notifyAdmin(
            `🎉 *New Subscription!*\n\n` +
            `📧 ${email}\n` +
            `📦 Plan: ${plan || "Unknown"}${trialInfo}`
          );
        }
        break;
      }

      case "customer.subscription.created": {
        const subscription = event.data.object as Stripe.Subscription;
        const customerId = subscription.customer as string;
        const email = await getCustomerEmail(customerId);
        const priceId = subscription.items.data[0]?.price.id;
        const plan = getPlanFromPriceId(priceId);

        if (subscription.trial_end) {
          await notifyAdmin(
            `🆓 *New Trial Started!*\n\n` +
            `📧 ${email}\n` +
            `📦 Plan: ${plan || "Unknown"}\n` +
            `⏰ Trial ends: ${new Date(subscription.trial_end * 1000).toLocaleDateString()}`
          );
        }
        break;
      }

      case "customer.subscription.updated": {
        const subscription = event.data.object as Stripe.Subscription;
        const priceId = subscription.items.data[0]?.price.id;
        const plan = getPlanFromPriceId(priceId);
        const customerId = subscription.customer as string;
        const email = await getCustomerEmail(customerId);

        await prisma.user.update({
          where: { stripeCustomerId: customerId },
          data: {
            plan,
            stripePriceId: priceId,
          },
        });

        await notifyAdmin(
          `🔄 *Subscription Updated*\n\n` +
          `📧 ${email}\n` +
          `📦 Plan: ${plan || "Unknown"}`
        );
        break;
      }

      case "customer.subscription.deleted": {
        const subscription = event.data.object as Stripe.Subscription;
        const customerId = subscription.customer as string;
        const email = await getCustomerEmail(customerId);
        const priceId = subscription.items.data[0]?.price.id;
        const plan = getPlanFromPriceId(priceId);

        await prisma.user.update({
          where: { stripeCustomerId: customerId },
          data: {
            plan: null,
            stripeSubscriptionId: null,
            stripePriceId: null,
          },
        });

        await notifyAdmin(
          `❌ *Subscription Cancelled*\n\n` +
          `📧 ${email}\n` +
          `📦 Was on: ${plan || "Unknown"}`
        );
        break;
      }

      case "invoice.payment_succeeded": {
        const invoice = event.data.object as Stripe.Invoice;
        const customerId = invoice.customer as string;
        const email = await getCustomerEmail(customerId);
        const amount = (invoice.amount_paid / 100).toFixed(2);
        const currency = invoice.currency.toUpperCase();

        await notifyAdmin(
          `💰 *Payment Received!*\n\n` +
          `📧 ${email}\n` +
          `💵 Amount: ${amount} ${currency}`
        );
        break;
      }

      case "invoice.payment_failed": {
        const invoice = event.data.object as Stripe.Invoice;
        const customerId = invoice.customer as string;
        const email = await getCustomerEmail(customerId);
        const amount = (invoice.amount_due / 100).toFixed(2);
        const currency = invoice.currency.toUpperCase();

        await notifyAdmin(
          `⚠️ *Payment Failed!*\n\n` +
          `📧 ${email}\n` +
          `💵 Amount: ${amount} ${currency}\n` +
          `🔴 Action may be required`
        );
        break;
      }
    }

    return NextResponse.json({ received: true });
  } catch (error) {
    console.error("Webhook handler error:", error);
    return NextResponse.json(
      { error: "Webhook handler failed" },
      { status: 500 }
    );
  }
}
