import { createClient, type SupabaseClient } from "@supabase/supabase-js";

/** A tabela zedy_webhook_events precisa ser criada manualmente via SQL editor
 * do Supabase (ver supabase/migrations/) — os tipos gerados ainda não a
 * conhecem, por isso o tipo é definido aqui à mão, batendo com a migration. */
export type ZedyWebhookEventRow = {
  order_id: string;
  event_type: string;
  payload: unknown;
  processed_at: string;
};

/** A tabela pixel_settings também precisa ser criada manualmente via SQL
 * editor do Supabase (ver supabase/migrations/) — mesmo motivo do tipo acima. */
export type PixelSettingsRow = {
  id: number;
  utmify_html: string | null;
  tiktok_pixel_id: string | null;
  tiktok_access_token: string | null;
  password_hash: string | null;
  updated_at: string;
};

let cached: SupabaseClient | null = null;

/** Cliente com a service_role key do Supabase da loja: só deve ser usado
 * dentro de server functions, nunca importado em código que roda no
 * navegador. Retorna null se as chaves não estiverem configuradas. */
export function getSupabaseAdmin(): SupabaseClient | null {
  // A loja usa um projeto Supabase externo (do cliente), não o banco interno
  // do Lovable Cloud — os nomes SUPABASE_* são reservados/gerenciados, por
  // isso os valores do projeto externo vivem em STORE_SUPABASE_*.
  const url = process.env["STORE_SUPABASE_URL"] || process.env["SUPABASE_URL"];
  const key =
    process.env["STORE_SUPABASE_SERVICE_ROLE_KEY"] ||
    process.env["SUPABASE_SERVICE_ROLE_KEY"];
  if (!url || !key) return null;
  if (!cached) {
    cached = createClient(url, key, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
  }
  return cached;
}
