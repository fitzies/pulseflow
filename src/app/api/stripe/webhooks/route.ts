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

const ENTITLED_SUBSCRIPTION_STATUSES = new Set<Stripe.Subscription.Status>([
  "active",
  "trialing",
  "past_due",
  "unpaid",
]);

async function reconcileCustomerSubscription(customerId: string) {
  return prisma.$transaction(async (tx) => {
    // Every webhook for a customer converges on Stripe's current state while
    // holding the same lock, so out-of-order events cannot overwrite a newer
    // subscription.
    await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtext(${customerId})::bigint)`;

    const subscriptions = await stripe.subscriptions.list({
      customer: customerId,
      status: "all",
      limit: 100,
    });
    const current = subscriptions.data
      .filter((subscription) => ENTITLED_SUBSCRIPTION_STATUSES.has(subscription.status))
      .sort((a, b) => b.created - a.created)[0] ?? null;

    const user = await tx.user.findUnique({
      where: { stripeCustomerId: customerId },
      select: {
        id: true,
        freeAutomationId: true,
        automations: {
          orderBy: [{ createdAt: "asc" }, { id: "asc" }],
          take: 1,
          select: { id: true },
        },
      },
    });
    if (!user) throw new Error(`No user found for Stripe customer ${customerId}`);

    if (!current) {
      await tx.user.update({
        where: { id: user.id },
        data: {
          plan: "FREE",
          freeAutomationId: user.freeAutomationId ?? user.automations[0]?.id ?? null,
          stripeSubscriptionId: null,
          stripePriceId: null,
        },
      });
      return { plan: "FREE" as const, subscription: null };
    }

    const priceId = current.items.data[0]?.price.id;
    const plan = getPlanFromPriceId(priceId);
    if (!plan) {
      throw new Error(`Unknown Stripe price ID on active subscription ${current.id}: ${priceId}`);
    }

    await tx.user.update({
      where: { id: user.id },
      data: {
        plan,
        stripeSubscriptionId: current.id,
        stripePriceId: priceId,
      },
    });

    return { plan, subscription: current };
  }, { maxWait: 5_000, timeout: 15_000 });
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
          const customerId = session.customer as string;
          const email = await getCustomerEmail(customerId);
          const current = await reconcileCustomerSubscription(customerId);
          const trialInfo = current.subscription?.trial_end
            ? `\n🎁 Trial until: ${new Date(current.subscription.trial_end * 1000).toLocaleDateString()}`
            : "";

          await notifyAdmin(
            `🎉 *New Subscription!*\n\n` +
            `📧 ${email}\n` +
            `📦 Plan: ${current.plan}${trialInfo}`
          );
        }
        break;
      }

      case "customer.subscription.created": {
        const subscription = event.data.object as Stripe.Subscription;
        const customerId = subscription.customer as string;
        const email = await getCustomerEmail(customerId);
        const current = await reconcileCustomerSubscription(customerId);

        if (subscription.trial_end) {
          await notifyAdmin(
            `🆓 *New Trial Started!*\n\n` +
            `📧 ${email}\n` +
            `📦 Plan: ${current.plan}\n` +
            `⏰ Trial ends: ${new Date(subscription.trial_end * 1000).toLocaleDateString()}`
          );
        }
        break;
      }

      case "customer.subscription.updated": {
        const subscription = event.data.object as Stripe.Subscription;
        const customerId = subscription.customer as string;
        const email = await getCustomerEmail(customerId);
        const current = await reconcileCustomerSubscription(customerId);

        await notifyAdmin(
          `🔄 *Subscription Updated*\n\n` +
          `📧 ${email}\n` +
          `📦 Plan: ${current.plan}`
        );
        break;
      }

      case "customer.subscription.deleted": {
        const subscription = event.data.object as Stripe.Subscription;
        const customerId = subscription.customer as string;
        const email = await getCustomerEmail(customerId);
        const current = await reconcileCustomerSubscription(customerId);

        if (current.subscription) {
          console.log(
            `Subscription ${subscription.id} was deleted; customer remains on ${current.subscription.id}`
          );
          break;
        }

        await notifyAdmin(
          `❌ *Subscription Cancelled*\n\n` +
          `📧 ${email}\n` +
          `📦 Downgraded to: FREE`
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
