import type { PaymentGateway } from "./gateway";
import { MockGateway } from "./mock";
import { SunpayGateway } from "./sunpay";

let instance: PaymentGateway | null = null;

// Factory — selects the active gateway from PAYMENT_GATEWAY.
export function getGateway(): PaymentGateway {
  if (instance) return instance;
  const kind = (process.env.PAYMENT_GATEWAY || "mock").toLowerCase();
  instance = kind === "sunpay" ? new SunpayGateway() : new MockGateway();
  return instance;
}

export * from "./gateway";
