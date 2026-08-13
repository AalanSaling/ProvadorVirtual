// supabase/functions/admin-products/index.ts
// Edge Function administrativa para CRUD de produtos com chave Service Role e senha Admin

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const ALLOWED_ORIGIN = Deno.env.get("ALLOWED_ORIGIN") || "*";
const ADMIN_PASSWORD = Deno.env.get("ADMIN_PASSWORD") || "admin123";
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

// Rate limiting (10 req/min, 20 req/dia por IP)
const ipRateMap = new Map<string, { minCount: number; minReset: number; dayCount: number; dayReset: number }>();

function checkRateLimit(ip: string): boolean {
  const now = Date.now();
  const entry = ipRateMap.get(ip) || {
    minCount: 0,
    minReset: now + 60_000,
    dayCount: 0,
    dayReset: now + 86_400_000,
  };

  if (now > entry.minReset) {
    entry.minCount = 0;
    entry.minReset = now + 60_000;
  }
  if (now > entry.dayReset) {
    entry.dayCount = 0;
    entry.dayReset = now + 86_400_000;
  }

  if (entry.minCount >= 10 || entry.dayCount >= 20) {
    return false;
  }

  entry.minCount++;
  entry.dayCount++;
  ipRateMap.set(ip, entry);
  return true;
}

// Comparação constante em tempo para proteger contra ataques de temporização
function timingSafeEqualStr(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let result = 0;
  for (let i = 0; i < a.length; i++) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return result === 0;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders(req) });
  }

  try {
    const clientIp = req.headers.get("x-forwarded-for")?.split(",")[0] || "unknown";
    if (!checkRateLimit(clientIp)) {
      return new Response(
        JSON.stringify({ error: "Limite de requisições de administração excedido." }),
        { status: 429, headers: { ...corsHeaders(req), "Content-Type": "application/json" } }
      );
    }

    // Autenticação Admin
    const authHeader = req.headers.get("Authorization") || "";
    const token = authHeader.replace("Bearer ", "").trim();

    if (!timingSafeEqualStr(token, ADMIN_PASSWORD)) {
      return new Response(
        JSON.stringify({ error: "Senha administrativa incorreta ou não fornecida." }),
        { status: 401, headers: { ...corsHeaders(req), "Content-Type": "application/json" } }
      );
    }

    const body = await req.json();
    const { action, product, imageBase64 } = body;

    const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    if (action === "create" || action === "update") {
      if (!product || !product.name || !product.category || product.price < 0) {
        return new Response(
          JSON.stringify({ error: "Dados inválidos: Nome, categoria e preço >= 0 são obrigatórios." }),
          { status: 400, headers: { ...corsHeaders(req), "Content-Type": "application/json" } }
        );
      }
    }

    let publicImageUrl = product?.image || "";

    // Upload de imagem em Base64 se fornecida
    if (imageBase64) {
      const match = imageBase64.match(/^data:(image\/(jpeg|png|webp));base64,(.+)$/);
      if (!match) {
        return new Response(
          JSON.stringify({ error: "Formato de imagem inválido. Deve ser JPEG, PNG ou WEBP em base64." }),
          { status: 400, headers: { ...corsHeaders(req), "Content-Type": "application/json" } }
        );
      }

      const mimeType = match[1];
      const base64Data = match[3];
      const approxBytes = (base64Data.length * 3) / 4;

      if (approxBytes > 8 * 1024 * 1024) {
        return new Response(
          JSON.stringify({ error: "Imagem de produto excede o limite de 8MB." }),
          { status: 400, headers: { ...corsHeaders(req), "Content-Type": "application/json" } }
        );
      }

      // Converter base64 para uint8array
      const binaryStr = atob(base64Data);
      const bytes = new Uint8Array(binaryStr.length);
      for (let i = 0; i < binaryStr.length; i++) {
        bytes[i] = binaryStr.charCodeAt(i);
      }

      const fileExt = mimeType.split("/")[1] || "jpg";
      const fileName = `product-${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;

      const { error: uploadErr } = await supabaseAdmin.storage
        .from("product-photos")
        .upload(fileName, bytes, { contentType: mimeType, upsert: true });

      if (uploadErr) {
        return new Response(
          JSON.stringify({ error: `Erro no upload da imagem: ${uploadErr.message}` }),
          { status: 500, headers: { ...corsHeaders(req), "Content-Type": "application/json" } }
        );
      }

      const { data: publicUrlData } = supabaseAdmin.storage
        .from("product-photos")
        .getPublicUrl(fileName);

      publicImageUrl = publicUrlData.publicUrl;
    }

    if (action === "create") {
      const { data, error } = await supabaseAdmin
        .from("products")
        .insert({
          name: product.name,
          category: product.category,
          price: product.price,
          description: product.description || "",
          image_url: publicImageUrl,
          sizes: product.sizes || ["P", "M", "G"],
          stock: product.stock || 10,
        })
        .select()
        .single();

      if (error) throw error;
      return new Response(
        JSON.stringify({ status: "success", product: data }),
        { status: 200, headers: { ...corsHeaders(req), "Content-Type": "application/json" } }
      );
    } else if (action === "update") {
      const { data, error } = await supabaseAdmin
        .from("products")
        .update({
          name: product.name,
          category: product.category,
          price: product.price,
          description: product.description,
          image_url: publicImageUrl,
          sizes: product.sizes,
          stock: product.stock,
        })
        .eq("id", product.id)
        .select()
        .single();

      if (error) throw error;
      return new Response(
        JSON.stringify({ status: "success", product: data }),
        { status: 200, headers: { ...corsHeaders(req), "Content-Type": "application/json" } }
      );
    } else if (action === "delete") {
      const { error } = await supabaseAdmin
        .from("products")
        .delete()
        .eq("id", product.id);

      if (error) throw error;
      return new Response(
        JSON.stringify({ status: "success", message: "Produto excluído com sucesso." }),
        { status: 200, headers: { ...corsHeaders(req), "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ error: "Ação não reconhecida." }),
      { status: 400, headers: { ...corsHeaders(req), "Content-Type": "application/json" } }
    );
  } catch (err: any) {
    return new Response(
      JSON.stringify({ error: err.message || "Erro interno na Edge Function de administração." }),
      { status: 500, headers: { ...corsHeaders(req), "Content-Type": "application/json" } }
    );
  }
});
