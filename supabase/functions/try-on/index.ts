// supabase/functions/try-on/index.ts
// Edge Function para inicialização e validação de gerações de Virtual Try-On

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const ALLOWED_ORIGIN = Deno.env.get("ALLOWED_ORIGIN") || "*";
const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY") || "";

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
    // 1. Verificar Autenticação do Usuário
    const authHeader = req.headers.get("Authorization") || "";
    const token = authHeader.replace("Bearer ", "").trim();

    if (!token) {
      return new Response(
        JSON.stringify({ error: "Sessão não autenticada." }),
        { status: 401, headers: { ...corsHeaders(req), "Content-Type": "application/json" } }
      );
    }

    const supabaseClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: `Bearer ${token}` } },
    });

    const { data: { user }, error: authErr } = await supabaseClient.auth.getUser(token);
    if (authErr || !user) {
      return new Response(
        JSON.stringify({ error: "Usuário não autenticado." }),
        { status: 401, headers: { ...corsHeaders(req), "Content-Type": "application/json" } }
      );
    }

    const body = await req.json();
    const { product_id, store_id, source_photo_path, requested_provider } = body;

    if (!product_id || !store_id || !source_photo_path) {
      return new Response(
        JSON.stringify({ error: "Parâmetros obrigatórios ausentes: product_id, store_id e source_photo_path." }),
        { status: 400, headers: { ...corsHeaders(req), "Content-Type": "application/json" } }
      );
    }

    const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // 2. Rate Limiting Persistente no Banco de Dados
    const rateLimitKey = `user:${user.id}:try_on`;
    const { data: rateCheck, error: rateErr } = await supabaseAdmin.rpc("check_rate_limit", {
      p_key: rateLimitKey,
      p_max_limit: 5, // Ex: máx 5 requisições por minuto por usuário
      p_window_seconds: 60,
    });

    if (rateErr || rateCheck === false) {
      return new Response(
        JSON.stringify({ error: "Limite de gerações excedido. Por favor, aguarde um momento antes de tentar novamente." }),
        { status: 429, headers: { ...corsHeaders(req), "Content-Type": "application/json" } }
      );
    }

    // 3. Validação do Produto e Foto de Referência para Try-On
    const { data: productData, error: prodErr } = await supabaseAdmin
      .from("products")
      .select("id, name, active, category")
      .eq("id", product_id)
      .eq("store_id", store_id)
      .single();

    if (prodErr || !productData || !productData.active) {
      return new Response(
        JSON.stringify({ error: "Produto indisponível ou inativo para provador virtual." }),
        { status: 400, headers: { ...corsHeaders(req), "Content-Type": "application/json" } }
      );
    }

    // Verificar se o produto possui imagem de referência do tipo 'try_on_reference'
    const { data: photoData } = await supabaseAdmin
      .from("product_photos")
      .select("storage_path")
      .eq("product_id", product_id)
      .eq("type", "try_on_reference")
      .maybeSingle();

    if (!photoData || !photoData.storage_path) {
      return new Response(
        JSON.stringify({ error: "Este produto não possui uma foto de referência de IA configurada e não permite provador virtual." }),
        { status: 422, headers: { ...corsHeaders(req), "Content-Type": "application/json" } }
      );
    }

    // 4. Buscar Configuração de Provedor de IA da Loja
    const { data: storeSettings } = await supabaseAdmin
      .from("store_ai_settings")
      .select("provider_mode, enabled")
      .eq("store_id", store_id)
      .maybeSingle();

    if (storeSettings && !storeSettings.enabled) {
      return new Response(
        JSON.stringify({ error: "O recurso de Provador Virtual está temporariamente desativado para esta loja." }),
        { status: 403, headers: { ...corsHeaders(req), "Content-Type": "application/json" } }
      );
    }

    const providerMode = requested_provider || storeSettings?.provider_mode || "both";

    // 5. Registrar Solicitação na Tabela try_on_generations
    const { data: genRecord, error: genErr } = await supabaseAdmin
      .from("try_on_generations")
      .insert({
        user_id: user.id,
        store_id,
        product_id,
        provider: providerMode,
        status: "queued",
        source_photo_path,
      })
      .select()
      .single();

    if (genErr) throw genErr;

    return new Response(
      JSON.stringify({
        status: "queued",
        generation_id: genRecord.id,
        provider: providerMode,
        message: "Solicitação registrada na fila do provador virtual com sucesso.",
      }),
      { status: 200, headers: { ...corsHeaders(req), "Content-Type": "application/json" } }
    );
  } catch (err: any) {
    return new Response(
      JSON.stringify({ error: err.message || "Erro interno no serviço de provador." }),
      { status: 500, headers: { ...corsHeaders(req), "Content-Type": "application/json" } }
    );
  }
});
