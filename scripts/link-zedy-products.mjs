#!/usr/bin/env node
// Vincula src/data/products.json aos produtos já cadastrados na Zedy.
// Só faz leitura na API da Zedy (GET /products paginado) — não cria nada, sem risco de escrita em produção.
//
// Diferente do outletdascriancas: o CSV da Democrata não tem Variant SKU real, então não
// dá pra casar por SKU. Em vez disso:
//   1. Casamos cada produto local com o produto da Zedy pelo TÍTULO normalizado
//      (minúsculo, sem acento, trim) — confirmado manualmente que os títulos batem.
//   2. Dentro de cada produto, a Zedy não guarda o tamanho por variante (selectedOptions
//      vem vazio pra todo produto com tamanho, e o title da variante é sempre "Default
//      Title" — provavelmente perda de dado na importação de origem). O que SOBREVIVE e
//      é confiável: o campo `id` de cada variante, que a Zedy atribui sequencialmente na
//      ordem de importação. Confirmado em 8 produtos de amostra (botas 37-44, cinto
//      80-125): ordenando as variantes por `id` ascendente, o SKU sintético
//      "shopify-variant-<num>" de cada uma forma uma sequência aritmética perfeita
//      (diferença constante de -32768 entre variantes consecutivas), e a contagem de
//      variantes sempre bate com options[0].values.length — ou seja, a ordem por `id`
//      ascendente corresponde 1:1, posicionalmente, à ordem de options[0].values (que é
//      a mesma ordem, ascendente, do array `sizes` de cada produto local).
//   3. Se a contagem de variantes não bater com a contagem de tamanhos locais, ou se o
//      título não achar par (ou achar mais de um), o produto é pulado e logado pra
//      revisão manual — nunca adivinha.
//
// Uso:
//   node --env-file=.env scripts/link-zedy-products.mjs --limit 5
//   node --env-file=.env scripts/link-zedy-products.mjs

import { writeFile, appendFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

const PRODUCTS_PATH = fileURLToPath(new URL("../src/data/products.json", import.meta.url));
const LOG_PATH = fileURLToPath(new URL("../scripts/link-zedy-products.log", import.meta.url));
const ZEDY_API_BASE = "https://app.zedy.com.br/api/loja/v1";
const PER_PAGE = 50;

const token = process.env.ZEDY_API_TOKEN;
const storeId = process.env.ZEDY_STORE_ID;
if (!token || !storeId) {
  console.error("ZEDY_API_TOKEN / ZEDY_STORE_ID não configurados (rode com --env-file=.env)");
  process.exit(1);
}

const limitArg = process.argv.find((arg) => arg.startsWith("--limit"));
const limit = limitArg
  ? Number(limitArg.split("=")[1] ?? process.argv[process.argv.indexOf(limitArg) + 1])
  : Infinity;

const headers = {
  Authorization: `Bearer ${token}`,
  "X-Store-Id": storeId,
  "Content-Type": "application/json",
};

async function log(line) {
  const entry = `[${new Date().toISOString()}] ${line}\n`;
  process.stdout.write(entry);
  await appendFile(LOG_PATH, entry);
}

function normalizeTitle(title) {
  return title
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .trim()
    .replace(/\s+/g, " ");
}

function isFullySynced(product) {
  if (!product.zedyVariantIds) return false;
  return product.sizes.every((size) => Boolean(product.zedyVariantIds[size]));
}

async function saveProducts(products) {
  await writeFile(PRODUCTS_PATH, `${JSON.stringify(products, null, 2)}\n`, "utf8");
}

/** Busca todas as páginas de /products na Zedy e monta um mapa título normalizado -> produto(s). */
async function buildTitleMap() {
  const titleMap = new Map();
  let page = 1;
  for (;;) {
    const response = await fetch(`${ZEDY_API_BASE}/products?page=${page}&per_page=${PER_PAGE}`, {
      headers,
    });
    if (!response.ok) {
      throw new Error(
        `HTTP ${response.status} ao listar produtos (página ${page}): ${await response.text()}`,
      );
    }
    const { products, pagination } = await response.json();
    if (!products || products.length === 0) break;

    for (const product of products) {
      const key = normalizeTitle(product.title);
      const existing = titleMap.get(key);
      if (existing) existing.push(product);
      else titleMap.set(key, [product]);
    }

    await log(`Página ${page}/${pagination?.totalPages ?? "?"}: ${products.length} produtos da Zedy lidos`);
    if (products.length < PER_PAGE) break;
    page += 1;
  }
  return titleMap;
}

async function main() {
  const raw = await import(PRODUCTS_PATH, { with: { type: "json" } });
  const products = raw.default;

  const pending = products.filter((p) => !isFullySynced(p));
  await log(
    `${products.length} produtos no total, ${pending.length} pendentes, limite desta execução: ${limit === Infinity ? "sem limite" : limit}`,
  );

  await log("Buscando catálogo completo da Zedy pra montar o mapa título -> produto...");
  const titleMap = await buildTitleMap();
  await log(`Mapa pronto: ${titleMap.size} títulos distintos na Zedy.`);

  let linked = 0;
  for (const product of pending) {
    if (linked >= limit) break;

    const key = normalizeTitle(product.title);
    let matches = titleMap.get(key);
    if (!matches) {
      await log(`PULADO ${product.slug}: nenhum produto na Zedy com título "${product.title}"`);
      continue;
    }
    if (matches.length > 1) {
      // Alguns títulos se repetem na fonte (produtos diferentes com o mesmo nome, ex.
      // cores distintas exportadas com título idêntico por engano). Segundo critério de
      // desempate: preço da primeira variante, que na maioria dos casos é único dentro do
      // grupo de mesmo título — só usa se resolver pra exatamente 1 candidato.
      const byPrice = matches.filter((m) => Number(m.variants[0]?.price) === Number(product.price));
      if (byPrice.length === 1) {
        matches = byPrice;
      } else {
        await log(
          `PULADO ${product.slug}: ${matches.length} produtos na Zedy com o mesmo título "${product.title}" (ids: ${matches.map((m) => m.id).join(", ")}) — preço também não desempata, ambíguo, revisar à mão`,
        );
        continue;
      }
    }

    const zedyProduct = matches[0];
    // Alguns produtos têm variantes "lixo" fora do padrão de importação (SKU vazio ou
    // fora do formato shopify-variant-<id>) — provável edição manual solta na Zedy, sem
    // relação com um tamanho real. Ignoramos qualquer variante que não siga o padrão
    // quando o produto tem mais de uma variante esperada (produto de tamanho único usa o
    // próprio slug como SKU, então essa checagem só entra pra multi-variante).
    const rawVariants =
      product.sizes.length > 1
        ? zedyProduct.variants.filter((v) => /^shopify-variant-\d+$/.test(v.sku ?? ""))
        : zedyProduct.variants;
    const sortedVariants = [...rawVariants].sort((a, b) => Number(a.id) - Number(b.id));

    if (sortedVariants.length !== product.sizes.length) {
      await log(
        `ERRO ${product.slug}: ${product.sizes.length} tamanho(s) local(is) [${product.sizes.join(", ")}] vs ${sortedVariants.length} variante(s) na Zedy (produto ${zedyProduct.id}) — contagem não bate, pulando`,
      );
      continue;
    }

    const variantIds = {};
    product.sizes.forEach((size, index) => {
      variantIds[size] = sortedVariants[index].id;
    });

    product.zedyVariantIds = variantIds;
    linked += 1;
    await log(`OK  ${product.slug} (zedy ${zedyProduct.id}) -> ${JSON.stringify(variantIds)}`);
  }

  await saveProducts(products);
  await log(`Finalizado: ${linked} produtos vinculados nesta execução.`);
}

main().catch(async (err) => {
  await log(`FALHA GERAL: ${err.stack ?? err.message}`);
  process.exit(1);
});
