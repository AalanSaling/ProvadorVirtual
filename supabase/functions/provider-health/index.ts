// supabase/functions/provider-health/index.ts
// Edge Function para verificação de status e disponibilidade dos Provedores de IA

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const ALLOWED_ORIGIN = Deno.env.get("ALLOWED_ORIGIN") || "*";
const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";

function corsHeaders(req: Request) {
  const origin = req.headers.get("origin") || "";
  const allowOrigin = ALLOWED_ORIGIN === "*" ? "*" : (origin === ALLOWED_ORIGIN ? origin : ALLOWED_ORIGIN);
  return {
    "Access-Control-Allow-Origin": allowOrigin,
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  };
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders(req) });
  }

  try {
    const perfectCorpConfigured = Boolean(Deno.env.get("PERFECTCORP_API_KEY"));
    const googleConfigured = Boolean(Deno.env.get("GOOGLE_API_KEY"));

    const url = new URL(req.url);
    const store_id = url.searchParams.get("store_id");

    let storeMode = "both";
    let storeEnabled = true;

    if (store_id) {
      const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
      const { data: settings } = await supabaseAdmin
        .from("store_ai_settings")
        .select("provider_mode, enabled")
        .eq("store_id", store_id)
        .maybeSingle();

      if (settings) {
        storeMode = settings.provider_mode;
        storeEnabled = settings.enabled;
      }
    }

    return new Response(
      JSON.stringify({
        status: "ok",
        store_id: store_id || null,
        store_enabled: storeEnabled,
        store_provider_mode: storeMode,
        providers: {
          perfectcorp: {
            configured: perfectCorpConfigured,
            status: perfectCorpConfigured ? "ready" : "unconfigured_secret",
          },
          google: {
            configured: googleConfigured,
            status: googleConfigured ? "ready" : "unconfigured_secret",
          },
        },
      }),
      { status: 200, headers: { ...corsHeaders(req), "Content-Type": "application/json" } }
    );
  } catch (err: any) {
    return new Response(
      JSON.stringify({ error: err.message || "Erro ao verificar saúde dos provedores." }),
      { status: 500, headers: { ...corsHeaders(req), "Content-Type": "application/json" } }
    );
  }
});
