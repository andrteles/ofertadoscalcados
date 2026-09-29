import { createFileRoute } from "@tanstack/react-router";

import { fetchPixelRow } from "@/lib/tracking";

// TEMPORÁRIO: só pra diagnosticar por que os pixels não estão disparando em
// produção. Remover depois de confirmar a causa.
export const Route = createFileRoute("/api/debug/pixel")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const url = new URL(request.url);
        if (url.searchParams.get("secret") !== process.env["CAMPAIGN_SECRET_TOKEN"]) {
          return new Response("Unauthorized", { status: 401 });
        }

        const row = await fetchPixelRow();

        return Response.json({
          env: {
            SUPABASE_URL: Boolean(process.env["SUPABASE_URL"]),
            SUPABASE_SERVICE_ROLE_KEY: Boolean(process.env["SUPABASE_SERVICE_ROLE_KEY"]),
            STORE_SUPABASE_URL: Boolean(process.env["STORE_SUPABASE_URL"]),
            STORE_SUPABASE_SERVICE_ROLE_KEY: Boolean(process.env["STORE_SUPABASE_SERVICE_ROLE_KEY"]),
          },
          pixelRow: row
            ? {
                hasUtmifyHtml: Boolean(row.utmify_html),
                hasTiktokPixelId: Boolean(row.tiktok_pixel_id),
                tiktokPixelId: row.tiktok_pixel_id,
                hasTiktokAccessToken: Boolean(row.tiktok_access_token),
              }
            : null,
        });
      },
    },
  },
});
