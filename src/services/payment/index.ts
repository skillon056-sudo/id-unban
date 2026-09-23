import type { PaymentGateway } from "./gateway";
import { MockGateway } from "./mock";
import { SunpayGateway } from "./sunpay";
import { RupayexGateway, rupayexConfigured } from "./rupayex";
import { prisma } from "@/lib/db";

let instance: PaymentGateway | null = null;

// Sunpay first; if it can't open a checkout (e.g. "UPI not fetched"), the same
// order goes to Rupayex instead. Webhooks stay Sunpay's — Rupayex calls back
// on /r/{orderId}.
function withFallback(primary: PaymentGateway, backup: RupayexGateway): PaymentGateway {
  return {
    name: primary.name,
    async createOrder(input) {
      try {
        return await primary.createOrder(input);
      } catch (err) {
        console.error(
          `[payment] ${primary.name} failed order=${input.orderId}, switching to rupayex:`,
          err instanceof Error ? err.message : err,
        );
        return backup.createOrder(input);
      }
    },
    handleWebhook: (req) => primary.handleWebhook(req),
    async verifyPayment(orderId) {
      const p = await prisma.payment.findUnique({ where: { orderId }, select: { gatewayResponse: true } });
      const onRupayex = p?.gatewayResponse?.includes('"gateway":"rupayex"');
      return (onRupayex ? backup : primary).verifyPayment(orderId);
    },
  };
}

// Factory — selects the active gateway from PAYMENT_GATEWAY.
export function getGateway(): PaymentGateway {
  if (instance) return instance;
  const kind = (process.env.PAYMENT_GATEWAY || "mock").toLowerCase();
  if (kind === "rupayex") instance = new RupayexGateway();
  else if (kind === "sunpay")
    instance = rupayexConfigured()
      ? withFallback(new SunpayGateway(), new RupayexGateway())
      : new SunpayGateway();
  else instance = new MockGateway();
  return instance;
}

export * from "./gateway";
