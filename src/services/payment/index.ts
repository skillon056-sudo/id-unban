import type { PaymentGateway } from "./gateway";
import { MockGateway } from "./mock";
import { SunpayGateway } from "./sunpay";
import { RupayexGateway, rupayexConfigured } from "./rupayex";
import { prisma } from "@/lib/db";

let instance: PaymentGateway | null = null;

// Sunpay first; if it can't open a checkout, the same order goes to Rupayex
// instead. PAYIN_FIRST="rupayex" flips the order — for when Sunpay hands out
// checkouts that never load UPI, which its API gives no sign of. Webhooks stay
// Sunpay's either way (orders already out there still settle); Rupayex calls
// back on /r/{orderId}.
function withFallback(primary: PaymentGateway, backup: RupayexGateway): PaymentGateway {
  return {
    name: primary.name,
    async createOrder(input) {
      const [first, second] =
        process.env.PAYIN_FIRST === "rupayex" ? [backup, primary] : [primary, backup];
      try {
        return await first.createOrder(input);
      } catch (err) {
        console.error(
          `[payment] ${first.name} failed order=${input.orderId}, switching to ${second.name}:`,
          err instanceof Error ? err.message : err,
        );
        return second.createOrder(input);
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
