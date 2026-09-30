import { randomUUID } from "node:crypto";

import { createServerFn } from "@tanstack/react-start";
import QRCode from "qrcode";

import { getProductBySlug } from "@/lib/products";
import { getSupabaseAdmin, type SagacepayOrderItem } from "@/lib/supabase-admin";

const SAGACEPAY_API_BASE = "https://sagacepay.com/api";

function getApiKey(): string {
  const key = process.env["SAGACEPAY_API_KEY"];
  if (!key) throw new Error("SAGACEPAY_API_KEY não configurada");
  return key;
}

function onlyDigits(value: string): string {
  return value.replace(/\D/g, "");
}

/** Valida CPF (11 dígitos) ou CNPJ (14 dígitos) pelos dígitos verificadores oficiais —
 * evita mandar documento claramente inválido pra SagacePay e só descobrir com um 400. */
export function isValidDocument(rawDocument: string): boolean {
  const digits = onlyDigits(rawDocument);
  if (/^(\d)\1*$/.test(digits)) return false; // todos os dígitos iguais nunca é válido

  if (digits.length === 11) {
    const n = digits.split("").map(Number);
    let sum = 0;
    for (let i = 0; i < 9; i++) sum += n[i]! * (10 - i);
    let check = (sum * 10) % 11;
    if (check === 10) check = 0;
    if (check !== n[9]) return false;
    sum = 0;
    for (let i = 0; i < 10; i++) sum += n[i]! * (11 - i);
    check = (sum * 10) % 11;
    if (check === 10) check = 0;
    return check === n[10];
  }

  if (digits.length === 14) {
    const n = digits.split("").map(Number);
    const w1 = [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
    let sum = 0;
    for (let i = 0; i < 12; i++) sum += n[i]! * w1[i]!;
    let rem = sum % 11;
    let check = rem < 2 ? 0 : 11 - rem;
    if (check !== n[12]) return false;
    const w2 = [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
    sum = 0;
    for (let i = 0; i < 13; i++) sum += n[i]! * w2[i]!;
    rem = sum % 11;
    check = rem < 2 ? 0 : 11 - rem;
    return check === n[13];
  }

  return false;
}

/** CEP só tem 8 dígitos, sem dígito verificador — não tem o que validar alem do tamanho. */
export function isValidCep(rawCep: string): boolean {
  return onlyDigits(rawCep).length === 8;
}

interface CheckoutItemInput {
  slug: string;
  size: string;
  quantity: number;
}

interface CreateCheckoutOrderInput {
  items: CheckoutItemInput[];
  customer: {
    name: string;
    email: string;
    phone: string;
    document: string;
  };
  address: {
    cep: string;
    street: string;
    number: string;
    complement: string;
    neighborhood: string;
    city: string;
    state: string;
  };
}

interface SagacepaySaleResponse {
  id: string;
  pixCode: string;
  pixQrCode: string;
}

type CreateCheckoutOrderResult =
  | { ok: true; orderId: string; pixCode: string; pixQrCodeDataUrl: string; amount: number }
  | { ok: false; reason: string };

/** Cria a cobrança Pix na SagacePay e grava o pedido localmente (sagacepay_orders) pra
 * podermos consultar o status depois sem chamar a API de novo a cada poll do cliente, e pro
 * webhook ter o que atualizar quando o pagamento confirmar. Preço sempre recalculado a
 * partir do catálogo local — nunca confia em valor vindo do navegador. */
export const createCheckoutOrder = createServerFn({ method: "POST" })
  .validator((input: CreateCheckoutOrderInput) => input)
  .handler(async ({ data }): Promise<CreateCheckoutOrderResult> => {
    if (data.items.length === 0) return { ok: false, reason: "Sacola vazia." };
    if (!data.customer.name.trim()) return { ok: false, reason: "Informe seu nome completo." };

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

    let amount = 0;
    const items: SagacepayOrderItem[] = [];
    for (const item of data.items) {
      const product = getProductBySlug(item.slug);
      if (!product || item.quantity <= 0) return { ok: false, reason: "Item inválido na sacola." };
      amount += product.price * item.quantity;
      items.push({
        slug: product.slug,
        title: product.title,
        size: item.size,
        quantity: item.quantity,
        price: product.price,
      });
    }

    const externalId = randomUUID();

    let apiKey: string;
    try {
      apiKey = getApiKey();
    } catch (error) {
      console.error(error);
      return {
        ok: false,
        reason: "Pagamento indisponível no momento. Tente novamente em instantes.",
      };
    }

    let sale: SagacepaySaleResponse;
    try {
      const response = await fetch(`${SAGACEPAY_API_BASE}/sales`, {
        method: "POST",
        headers: {
          "x-api-key": apiKey,
          "Content-Type": "application/json",
          "idempotency-key": externalId,
        },
        body: JSON.stringify({
          amount,
          customer: {
            document,
            name: data.customer.name.trim(),
            ...(data.customer.email.trim() ? { email: data.customer.email.trim() } : {}),
            ...(onlyDigits(data.customer.phone) ? { phone: onlyDigits(data.customer.phone) } : {}),
          },
          description: "Compra online",
          items: items.map((item) => ({
            description: "Produto",
            quantity: item.quantity,
            unitPrice: item.price,
            tangible: true,
          })),
          externalId,
        }),
      });
      if (!response.ok) {
        console.error("SagacePay /sales falhou:", response.status, await response.text());
        return {
          ok: false,
          reason: "Não foi possível gerar o Pix. Confira os dados e tente de novo.",
        };
      }
      sale = (await response.json()) as SagacepaySaleResponse;
    } catch (error) {
      console.error("SagacePay /sales sem resposta:", error);
      return { ok: false, reason: "Erro de conexão com o gateway de pagamento." };
    }

    // A URL de imagem da SagacePay (sale.pixQrCode) exige o header x-api-key pra carregar —
    // uma tag <img> do navegador não consegue mandar esse header, então geramos o QR code
    // nós mesmos a partir do "copia e cola" (pixCode) e mandamos como data URL.
    // SVG (JS puro) em vez de PNG: o gerador de PNG usa canvas/zlib e quebra no servidor publicado.
    const qrSvg = await QRCode.toString(sale.pixCode, { type: "svg", margin: 0 });
    const pixQrCodeDataUrl = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(qrSvg)}`;

    const admin = getSupabaseAdmin();
    if (admin) {
      const { error } = await admin.from("sagacepay_orders").insert({
        id: sale.id,
        external_id: externalId,
        status: "pending",
        amount,
        customer_name: data.customer.name.trim(),
        customer_email: data.customer.email.trim() || null,
        customer_phone: onlyDigits(data.customer.phone) || null,
        customer_document: document,
        address_cep: cep,
        address_street: data.address.street.trim(),
        address_number: data.address.number.trim(),
        address_complement: data.address.complement.trim() || null,
        address_neighborhood: data.address.neighborhood.trim(),
        address_city: data.address.city.trim(),
        address_state: state,
        items,
        pix_code: sale.pixCode,
        pix_qr_code: sale.pixQrCode,
      });
      if (error) console.error("Erro ao gravar pedido SagacePay:", error);
    }

    return { ok: true, orderId: sale.id, pixCode: sale.pixCode, pixQrCodeDataUrl, amount };
  });

/** Consulta o status guardado localmente (atualizado pelo webhook), não a API da SagacePay —
 * mais rápido pro polling do cliente e não precisa reexpor a x-api-key a cada checagem. */
export const getOrderStatus = createServerFn({ method: "POST" })
  .validator((input: { orderId: string }) => input)
  .handler(async ({ data }): Promise<{ status: string }> => {
    const admin = getSupabaseAdmin();
    if (!admin) return { status: "unknown" };
    const { data: row } = await admin
      .from("sagacepay_orders")
      .select("status")
      .eq("id", data.orderId)
      .single();
    return { status: row?.status ?? "unknown" };
  });
