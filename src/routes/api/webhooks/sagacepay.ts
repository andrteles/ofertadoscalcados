import { timingSafeEqual, createHmac } from "node:crypto";

import { createFileRoute } from "@tanstack/react-router";

import { getSupabaseAdmin, type SagacepayOrderItem } from "@/lib/supabase-admin";
import { trackTikTokPurchase } from "@/lib/tracking-webhook";

interface SagacepayWebhookPayload {
  event: string;
  data: {
    id: string;
    status: string;
    paidAt?: string;
    [key: string]: unknown;
  };
}

const MAX_AGE_SECONDS = 300;

function isValidSignature(
  timestamp: string,
  body: string,
  signature: string,
  secret: string,
): boolean {
  const expected = createHmac("sha256", secret).update(`${timestamp}.${body}`).digest("hex");
  const expectedBuf = Buffer.from(expected);
  const signatureBuf = Buffer.from(signature);
  if (expectedBuf.length !== signatureBuf.length) return false;
  return timingSafeEqual(expectedBuf, signatureBuf);
}

export const Route = createFileRoute("/api/webhooks/sagacepay")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const secret = process.env["SAGACEPAY_WEBHOOK_SECRET"];
        if (!secret) return new Response("Webhook não configurado", { status: 500 });

        const timestamp = request.headers.get("x-sagacepay-timestamp");
        const signature = request.headers.get("x-sagacepay-signature");
        const body = await request.text();
        if (!timestamp || !signature) return new Response("Unauthorized", { status: 401 });

        const age = Math.abs(Date.now() / 1000 - Number(timestamp));
        if (!Number.isFinite(age) || age > MAX_AGE_SECONDS) {
          return new Response("Unauthorized", { status: 401 });
        }
        if (!isValidSignature(timestamp, body, signature, secret)) {
          return new Response("Unauthorized", { status: 401 });
        }

        const payload = JSON.parse(body) as SagacepayWebhookPayload;

        const admin = getSupabaseAdmin();
        if (!admin) return new Response("Banco não configurado", { status: 500 });

        if (payload.event === "sale.paid") {
          // Só atualiza (e só dispara tracking) se ainda estava pending — reenvio do mesmo
          // evento (a SagacePay reenvia até receber 2xx) não deve disparar Purchase 2x.
          const { data: updated, error } = await admin
            .from("sagacepay_orders")
            .update({
              status: "paid",
              paid_at: payload.data.paidAt ?? new Date().toISOString(),
              updated_at: new Date().toISOString(),
            })
            .eq("id", payload.data.id)
            .eq("status", "pending")
            .select("id, external_id, customer_email, customer_phone, items")
            .single();

          if (!error && updated) {
            try {
              const items = updated["items"] as SagacepayOrderItem[];
              await trackTikTokPurchase({
                orderId: updated["external_id"] as string,
                customer: {
                  email: updated["customer_email"] as string | null,
                  phone: updated["customer_phone"] as string | null,
                },
                products: items.map((item) => ({
                  id: item.slug,
                  name: item.title,
                  quantity: item.quantity,
                  priceInCents: Math.round(item.price * 100),
                })),
              });
            } catch {
              // Nunca deixa uma falha no TikTok atrasar/quebrar o 2xx pra SagacePay.
            }
          }
        } else if (payload.event === "sale.failed" || payload.event === "sale.expired") {
          await admin
            .from("sagacepay_orders")
            .update({ status: payload.data.status, updated_at: new Date().toISOString() })
            .eq("id", payload.data.id)
            .eq("status", "pending");
        }

        return Response.json({ received: true });
      },
    },
  },
});
