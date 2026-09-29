import { createServerFn } from "@tanstack/react-start";

import { getProductBySlug } from "@/lib/products";

const ZEDY_API_BASE = "https://app.zedy.com.br/api/loja/v1";

function getZedyHeaders() {
  const token = process.env["ZEDY_API_TOKEN"];
  const storeId = process.env["ZEDY_STORE_ID"];
  if (!token || !storeId) throw new Error("ZEDY_API_TOKEN / ZEDY_STORE_ID não configurados");
  return {
    Authorization: `Bearer ${token}`,
    "X-Store-Id": storeId,
    "Content-Type": "application/json",
  };
}

interface CheckoutItemInput {
  slug: string;
  size: string;
  quantity: number;
}

export const createZedyCheckout = createServerFn({ method: "POST" })
  .validator((input: { items: CheckoutItemInput[] }) => input)
  .handler(async ({ data }) => {
    // DEBUG TEMPORÁRIO — remover depois de descobrir por que o checkout falha em produção.
    if (data.items.length === 0) return { ok: false as const, reason: "empty-items" };

    const zedyItems: { variantId: string; quantity: number }[] = [];
    for (const item of data.items) {
      const variantId = getProductBySlug(item.slug)?.zedyVariantIds?.[item.size];
      if (!variantId) {
        return { ok: false as const, reason: `no-variant:${item.slug}:${item.size}` };
      }
      zedyItems.push({ variantId, quantity: item.quantity });
    }

    try {
      let headers: Record<string, string>;
      try {
        headers = getZedyHeaders();
      } catch (err) {
        return { ok: false as const, reason: `headers-error:${(err as Error).message}` };
      }
      const response = await fetch(`${ZEDY_API_BASE}/cart/create-checkout`, {
        method: "POST",
        headers,
        body: JSON.stringify({ items: zedyItems }),
      });
      if (!response.ok) {
        const body = await response.text();
        return { ok: false as const, reason: `http-${response.status}:${body.slice(0, 200)}` };
      }
      const result = (await response.json()) as { checkoutUrl?: string | null };
      if (!result.checkoutUrl) {
        return { ok: false as const, reason: `no-checkout-url:${JSON.stringify(result)}` };
      }
      return { ok: true as const, checkoutUrl: result.checkoutUrl };
    } catch (err) {
      return { ok: false as const, reason: `exception:${(err as Error).message}` };
    }
  });
