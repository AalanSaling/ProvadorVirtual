// supabase/functions/cleanup-private-media/index.ts
// Edge Function para exclusão e higienização de fotos temporárias de usuários (Privacidade LGPD)

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
    "Access-Control-Allow-Methods": "POST, OPTIONS",
  };
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders(req) });
  }

  try {
    const authHeader = req.headers.get("Authorization") || "";
    const token = authHeader.replace("Bearer ", "").trim();

    if (!token) {
      return new Response(
        JSON.stringify({ error: "Não autorizado." }),
        { status: 401, headers: { ...corsHeaders(req), "Content-Type": "application/json" } }
      );
    }

    const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Limpar arquivos temporários com mais de 24h na pasta try-on-inputs
    const { data: files, error: listErr } = await supabaseAdmin.storage
      .from("try-on-inputs")
      .list();

    let removedCount = 0;
    if (files && files.length > 0) {
      const now = Date.now();
      const filesToRemove: string[] = [];

      for (const file of files) {
        const createdAt = new Date(file.created_at).getTime();
        // Se o arquivo tiver mais de 24h (86.400.000 ms)
        if (now - createdAt > 86400000) {
          filesToRemove.push(file.name);
        }
      }

      if (filesToRemove.length > 0) {
        const { error: removeErr } = await supabaseAdmin.storage
          .from("try-on-inputs")
          .remove(filesToRemove);

        if (!removeErr) {
          removedCount = filesToRemove.length;
        }
      }
    }

    return new Response(
      JSON.stringify({
        status: "success",
        message: `Higienização concluída. ${removedCount} arquivos temporários antigos foram removidos com segurança.`,
      }),
      { status: 200, headers: { ...corsHeaders(req), "Content-Type": "application/json" } }
    );
  } catch (err: any) {
    return new Response(
      JSON.stringify({ error: err.message || "Erro na limpeza de mídias privadas." }),
      { status: 500, headers: { ...corsHeaders(req), "Content-Type": "application/json" } }
    );
  }
});
