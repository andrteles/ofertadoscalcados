import { createServerFn } from "@tanstack/react-start";
import { getRequestHeader, getRequestIP } from "@tanstack/react-start/server";

import { getProductBySlug } from "@/lib/products";
import {
  isValidCep,
  isValidDocument,
  sanitizeTrackingParameters,
  type CreateCheckoutOrderInput,
} from "@/lib/sagacepay";
import { getSupabaseAdmin, type SagacepayOrderItem } from "@/lib/supabase-admin";
import { sendUtmifyOrder } from "@/lib/utmify";

const HYPERCASH_API_BASE = "https://api.hypercashbrasil.com.br/api";

/** Mesmo fator mostrado nas opções de parcelamento do checkout (2x em diante). */
export const INSTALLMENT_INTEREST = 1.06;

function getSecretKey(): string {
  const key = process.env["HYPERCASH_SECRET_KEY"];
  if (!key) throw new Error("HYPERCASH_SECRET_KEY não configurada");
  return key;
}

function authHeader(secretKey: string): string {
  return `Basic ${btoa(`x:${secretKey}`)}`;
}

function onlyDigits(value: string): string {
  return value.replace(/\D/g, "");
}

export interface HypercashTransaction {
  id: string;
  status: string;
  amount: number;
  installments?: number;
  refusedReason?: string | null;
  paidAt?: string | null;
  card?: { brand?: string | null; lastDigits?: string | null } | null;
}

/** Consulta a transação direto na HyperCash. O webhook não tem assinatura, então o status
 * só é considerado verdadeiro depois de confirmado aqui com a chave secreta. */
export async function fetchHypercashTransaction(id: string): Promise<HypercashTransaction | null> {
  const response = await fetch(
    `${HYPERCASH_API_BASE}/user/transactions/${encodeURIComponent(id)}`,
    {
      headers: { Authorization: authHeader(getSecretKey()) },
      signal: AbortSignal.timeout(8000),
    },
  );
  if (!response.ok) {
    console.error("HyperCash consulta falhou:", response.status, await response.text());
    return null;
  }
  const body = (await response.json()) as { data?: HypercashTransaction };
  return body.data ?? null;
}

const APPROVED = new Set(["PAID", "AUTHORIZED"]);
const REFUSED = new Set(["REFUSED", "CANCELED"]);

/** Aplica o status da HyperCash no pedido local (idempotente: só mexe em pedido pending). */
export async function applyHypercashStatus(tx: HypercashTransaction): Promise<string> {
  const status = tx.status.toUpperCase();
  if (status === "PAID") {
    const { markOrderPaid } = await import("@/lib/order-paid");
    await markOrderPaid(tx.id, tx.paidAt ?? undefined);
    return "paid";
  }
  if (REFUSED.has(status)) {
    const admin = getSupabaseAdmin();
    if (admin) {
      const { data: failed } = await admin
        .from("sagacepay_orders")
        .update({ status: "failed", updated_at: new Date().toISOString() })
        .eq("id", tx.id)
        .eq("status", "pending")
        .select("*")
        .single();
      if (failed) {
        const { buildUtmifyOrder } = await import("@/lib/order-paid");
        const row = failed as unknown as Parameters<typeof buildUtmifyOrder>[0];
        await sendUtmifyOrder(buildUtmifyOrder(row, "refused", row.items));
      }
    }
    return "failed";
  }
  return "pending";
}

/** Só a chave pública (pk_) vai pro navegador, para o security.js tokenizar o cartão. */
export const getCardPublicKey = createServerFn({ method: "GET" }).handler(
  async (): Promise<{ publicKey: string | null }> => ({
    publicKey: process.env["HYPERCASH_PUBLIC_KEY"] || null,
  }),
);

type CreateCardOrderInput = CreateCheckoutOrderInput & {
  cardToken: string;
  installments: number;
};

type CreateCardOrderResult =
  | {
      ok: true;
      orderId: string;
      status: "paid" | "pending";
      amount: number;
      brand: string | null;
      lastDigits: string | null;
    }
  /** refused: o cartão foi recusado (a gaveta mostra a mensagem de recusa da referência). */
  | { ok: false; reason: string; refused?: true };

function refusedMessage(reason: string | null | undefined): string {
  const base = "Pagamento recusado pelo emissor do cartão.";
  return reason ? `${base} ${reason}` : `${base} Confira os dados ou use outro cartão.`;
}

/** Cobra o cartão já tokenizado no navegador (o número nunca passa pelo nosso servidor) e
 * grava o pedido em sagacepay_orders, igual ao Pix, pra aparecer em /pedidos e no webhook.
 * Preço sempre recalculado a partir do catálogo local. */
export const createCardOrder = createServerFn({ method: "POST" })
  .validator((input: CreateCardOrderInput) => input)
  .handler(async ({ data }): Promise<CreateCardOrderResult> => {
    if (data.items.length === 0) return { ok: false, reason: "Sacola vazia." };
    if (!data.cardToken) return { ok: false, reason: "Não foi possível validar o cartão." };
    if (!data.customer.name.trim()) return { ok: false, reason: "Informe seu nome completo." };
    const installments = Math.trunc(data.installments);
    if (!(installments >= 1 && installments <= 12)) {
      return { ok: false, reason: "Parcelamento inválido." };
    }

    const document = onlyDigits(data.customer.document);
    if (!isValidDocument(document)) return { ok: false, reason: "CPF/CNPJ inválido." };

    const cep = onlyDigits(data.address.cep);
    if (!isValidCep(cep)) return { ok: false, reason: "CEP inválido." };
    if (
      !data.address.street.trim() ||
      !data.address.number.trim() ||
      !data.address.neighborhood.trim() ||
      !data.address.city.trim()
    ) {
      return { ok: false, reason: "Preencha o endereço completo." };
    }
    const state = data.address.state.trim().toUpperCase();
    if (!/^[A-Z]{2}$/.test(state)) return { ok: false, reason: "UF inválida." };

    let subtotal = 0;
    const items: SagacepayOrderItem[] = [];
    for (const item of data.items) {
      const product = getProductBySlug(item.slug);
      if (!product || item.quantity <= 0) return { ok: false, reason: "Item inválido na sacola." };
      subtotal += product.price * item.quantity;
      items.push({
        slug: product.slug,
        title: product.title,
        size: item.size,
        quantity: item.quantity,
        price: product.price,
      });
    }

    const subtotalCents = items.reduce(
      (sum, item) => sum + Math.round(item.price * 100) * item.quantity,
      0,
    );
    const amountCents =
      installments === 1 ? subtotalCents : Math.round(subtotal * INSTALLMENT_INTEREST * 100);
    const interestCents = amountCents - subtotalCents;
    const amount = amountCents / 100;

    let secretKey: string;
    try {
      secretKey = getSecretKey();
    } catch (error) {
      console.error(error);
      return { ok: false, reason: "Pagamento com cartão indisponível no momento. Use o Pix." };
    }

    const externalId = crypto.randomUUID();
    const name = data.customer.name.trim();
    const email = data.customer.email.trim();
    const phone = onlyDigits(data.customer.phone);
    const address = {
      street: data.address.street.trim(),
      streetNumber: data.address.number.trim(),
      ...(data.address.complement.trim() ? { complement: data.address.complement.trim() } : {}),
      zipCode: cep,
      neighborhood: data.address.neighborhood.trim(),
      city: data.address.city.trim(),
      state,
      country: "BR",
    };
    const host = getRequestHeader("x-forwarded-host") || getRequestHeader("host");
    const ip = getRequestHeader("cf-connecting-ip") || getRequestIP({ xForwardedFor: true });

    let tx: HypercashTransaction;
    try {
      const response = await fetch(`${HYPERCASH_API_BASE}/user/transactions`, {
        method: "POST",
        headers: { Authorization: authHeader(secretKey), "Content-Type": "application/json" },
        body: JSON.stringify({
          amount: amountCents,
          currency: "BRL",
          paymentMethod: "CREDIT_CARD",
          card: { hash: data.cardToken },
          installments,
          customer: {
            name,
            email,
            phone,
            document: { number: document, type: document.length === 14 ? "CNPJ" : "CPF" },
            externalRef: externalId,
            address,
          },
          shipping: { fee: 0, address },
          items: [
            ...items.map((item) => ({
              title: item.title,
              unitPrice: Math.round(item.price * 100),
              quantity: item.quantity,
              tangible: true,
              externalRef: item.slug,
            })),
            ...(interestCents > 0
              ? [
                  {
                    title: "Juros do parcelamento",
                    unitPrice: interestCents,
                    quantity: 1,
                    tangible: false,
                    externalRef: "juros",
                  },
                ]
              : []),
          ],
          ...(host ? { postbackUrl: `https://${host}/api/webhooks/hypercash` } : {}),
          metadata: JSON.stringify({ externalId }),
          ...(ip ? { ip } : {}),
        }),
      });
      const body = (await response.json().catch(() => null)) as {
        data?: HypercashTransaction;
        message?: string;
      } | null;
      if (!response.ok || !body?.data) {
        console.error("HyperCash transação falhou:", response.status, JSON.stringify(body));
        return {
          ok: false,
          reason: "Não foi possível processar o cartão. Confira os dados e tente de novo.",
          refused: true,
        };
      }
      tx = body.data;
    } catch (error) {
      console.error("HyperCash sem resposta:", error);
      return { ok: false, reason: "Erro de conexão com o gateway de pagamento." };
    }

    const status = tx.status.toUpperCase();
    const refused = REFUSED.has(status);

    const trackingParameters = sanitizeTrackingParameters(data.trackingParameters);
    const createdAt = new Date();
    const admin = getSupabaseAdmin();
    if (admin) {
      const row = {
        id: tx.id,
        external_id: externalId,
        // Recusado também fica gravado (como "failed"), pra aparecer em /pedidos.
        status: refused ? "failed" : "pending",
        amount,
        customer_name: name,
        customer_email: email || null,
        customer_phone: phone || null,
        customer_document: document,
        address_cep: cep,
        address_street: address.street,
        address_number: address.streetNumber,
        address_complement: data.address.complement.trim() || null,
        address_neighborhood: address.neighborhood,
        address_city: address.city,
        address_state: state,
        items,
        pix_code: null,
        pix_qr_code: null,
      };
      let { error } = await admin
        .from("sagacepay_orders")
        .insert({ ...row, tracking_parameters: trackingParameters });
      if (error) ({ error } = await admin.from("sagacepay_orders").insert(row));
      if (error) console.error("Erro ao gravar pedido de cartão:", error);
    }

    if (refused) return { ok: false, reason: refusedMessage(tx.refusedReason), refused: true };

    await sendUtmifyOrder({
      orderId: externalId,
      status: "waiting_payment",
      createdAt,
      customer: { name, email: email || null, phone: phone || null, document },
      products: items.map((item) => ({
        id: item.slug,
        name: item.title,
        quantity: item.quantity,
        priceInCents: Math.round(item.price * 100),
      })),
      trackingParameters,
    });

    if (status === "PAID") await applyHypercashStatus(tx);

    return {
      ok: true,
      orderId: tx.id,
      status: APPROVED.has(status) ? "paid" : "pending",
      amount,
      brand: tx.card?.brand ?? null,
      lastDigits: tx.card?.lastDigits ?? null,
    };
  });

/** Usado pelo checkout enquanto o cartão está em análise: confere na HyperCash e atualiza. */
export const getCardOrderStatus = createServerFn({ method: "POST" })
  .validator((input: { orderId: string }) => input)
  .handler(async ({ data }): Promise<{ status: string; reason?: string }> => {
    try {
      const tx = await fetchHypercashTransaction(data.orderId);
      if (!tx) return { status: "unknown" };
      const status = await applyHypercashStatus(tx);
      if (APPROVED.has(tx.status.toUpperCase())) return { status: "paid" };
      return status === "failed"
        ? { status, reason: refusedMessage(tx.refusedReason) }
        : { status };
    } catch (error) {
      console.error("HyperCash consulta de status falhou:", error);
      return { status: "unknown" };
    }
  });

export interface HypercashDiagnosis {
  secretKey: string | null;
  publicKey: string | null;
  /** Resposta da listagem de transações: 200 = chave aceita, 401/403 = chave recusada. */
  listStatus: number | null;
  /** Envio de cartão sem dados (a HyperCash recusa antes de criar transação): 400 = conta pode
   * cobrar cartão, 403 = chave sem permissão pra cartão. */
  cardProbeStatus: number | null;
  cardProbeMessage: string;
  transactions: {
    id: string;
    createdAt: string;
    status: string;
    amount: number;
    refusedReason: string | null;
    customerName: string | null;
    lastDigits: string | null;
  }[];
}

/** Só o começo da chave (sk_live/pk_test...), pra conferir o tipo sem expor o segredo. */
function keyKind(key: string | undefined): string | null {
  if (!key) return null;
  return `${key.slice(0, key.indexOf("_", 3) > 0 ? key.indexOf("_", 3) + 1 : 3)}… (${key.length} caracteres)`;
}

/** Diagnóstico do /pedidos: não cria cobrança nenhuma. */
export async function diagnoseHypercash(): Promise<HypercashDiagnosis> {
  const secret = process.env["HYPERCASH_SECRET_KEY"];
  const result: HypercashDiagnosis = {
    secretKey: keyKind(secret),
    publicKey: keyKind(process.env["HYPERCASH_PUBLIC_KEY"]),
    listStatus: null,
    cardProbeStatus: null,
    cardProbeMessage: "",
    transactions: [],
  };
  if (!secret) return result;
  const headers = { Authorization: authHeader(secret), "Content-Type": "application/json" };

  try {
    const response = await fetch(
      `${HYPERCASH_API_BASE}/user/transactions?paymentMethods=CREDIT_CARD`,
      { headers, signal: AbortSignal.timeout(8000) },
    );
    result.listStatus = response.status;
    const body = (await response.json().catch(() => null)) as {
      data?: (HypercashTransaction & {
        createdAt?: string;
        customer?: { name?: string } | null;
      })[];
    } | null;
    result.transactions = (body?.data ?? []).slice(0, 10).map((tx) => ({
      id: tx.id,
      createdAt: tx.createdAt ?? "",
      status: tx.status,
      amount: tx.amount / 100,
      refusedReason: tx.refusedReason ?? null,
      customerName: tx.customer?.name ?? null,
      lastDigits: tx.card?.lastDigits ?? null,
    }));
  } catch (error) {
    console.error("HyperCash diagnóstico (listagem) falhou:", error);
  }

  try {
    const response = await fetch(`${HYPERCASH_API_BASE}/user/transactions`, {
      method: "POST",
      headers,
      body: JSON.stringify({ paymentMethod: "CREDIT_CARD" }),
      signal: AbortSignal.timeout(8000),
    });
    result.cardProbeStatus = response.status;
    result.cardProbeMessage = (await response.text()).slice(0, 400);
  } catch (error) {
    console.error("HyperCash diagnóstico (cartão) falhou:", error);
  }
  return result;
}
