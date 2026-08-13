// supabase/functions/replicate-vton/index.ts
// Redirecionamento e Depreciação: O backend Express em /api/try-on/generate é a AUTORIDADE ÚNICA.

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const ALLOWED_ORIGIN = Deno.env.get("ALLOWED_ORIGIN") || "*";

function corsHeaders(req: Request) {
  const origin = req.headers.get("origin") || "";
  const allowOrigin = ALLOWED_ORIGIN === "*" ? "*" : (origin === ALLOWED_ORIGIN ? origin : ALLOWED_ORIGIN);
  return {
    "Access-Control-Allow-Origin": allowOrigin,
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
  };
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders(req) });
  }

  return new Response(
    JSON.stringify({
      error: "ENDPOINT_DEPRECATED",
      message: "Utilize o endpoint único do servidor backend Express em POST /api/try-on/generate.",
    }),
    { status: 410, headers: { ...corsHeaders(req), "Content-Type": "application/json" } }
  );
});
