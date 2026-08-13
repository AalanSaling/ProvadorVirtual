// supabase/functions/admin-products/index.ts
// Edge Function para gestão de catálogo por membros autenticados de uma Store (Owners e Managers)

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
    // 1. Extração do Token JWT do usuário
    const authHeader = req.headers.get("Authorization") || "";
    const token = authHeader.replace("Bearer ", "").trim();

    if (!token) {
      return new Response(
        JSON.stringify({ error: "Sessão não autenticada. É necessário estar logado." }),
        { status: 401, headers: { ...corsHeaders(req), "Content-Type": "application/json" } }
      );
    }

    // 2. Autenticação via Supabase Client
    const supabaseClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: `Bearer ${token}` } },
    });

    const { data: { user }, error: authErr } = await supabaseClient.auth.getUser(token);
    if (authErr || !user) {
      return new Response(
        JSON.stringify({ error: "Usuário não autenticado ou sessão expirada." }),
        { status: 401, headers: { ...corsHeaders(req), "Content-Type": "application/json" } }
      );
    }

    const body = await req.json();
    const { action, store_id, product, catalogImageBase64, tryOnImageBase64 } = body;

    if (!store_id) {
      return new Response(
        JSON.stringify({ error: "Identificador da loja (store_id) é obrigatório." }),
        { status: 400, headers: { ...corsHeaders(req), "Content-Type": "application/json" } }
      );
    }

    // 3. Verificação de Perfil/Função do Usuário na Loja
    const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const { data: memberData, error: memberErr } = await supabaseAdmin
      .from("store_members")
      .select("role")
      .eq("store_id", store_id)
      .eq("user_id", user.id)
      .maybeSingle();

    if (memberErr || !memberData) {
      return new Response(
        JSON.stringify({ error: "Acesso negado: Você não é membro registrado desta loja." }),
        { status: 403, headers: { ...corsHeaders(req), "Content-Type": "application/json" } }
      );
    }

    const userRole = memberData.role; // 'owner' ou 'manager'

    // 4. Execução de Ações conforme o Role
    if (action === "create" || action === "update") {
      if (!product || !product.name || !product.category || product.price === undefined || product.price < 0) {
        return new Response(
          JSON.stringify({ error: "Dados inválidos: nome, categoria e preço >= 0 são obrigatórios." }),
          { status: 400, headers: { ...corsHeaders(req), "Content-Type": "application/json" } }
        );
      }

      // Upload de imagem do catálogo se fornecida
      let catalogPath = product.image_url || "";
      if (catalogImageBase64) {
        catalogPath = await uploadImage(supabaseAdmin, catalogImageBase64, `catalog-${Date.now()}`);
      }

      // Upload de imagem de referência para Try-On se fornecida
      let tryOnPath = product.try_on_reference_url || "";
      if (tryOnImageBase64) {
        tryOnPath = await uploadImage(supabaseAdmin, tryOnImageBase64, `tryon-ref-${Date.now()}`);
      }

      const currency = product.currency || 'BRL';

      if (action === "create") {
        const { data: newProd, error: insertErr } = await supabaseAdmin
          .from("products")
          .insert({
            store_id,
            name: product.name,
            description: product.description || "",
            category: product.category,
            garment_type: product.garment_type || product.category,
            color: product.color || null,
            material: product.material || null,
            fit: product.fit || null,
            price: product.price,
            currency: currency,
            sizes: product.sizes || ["P", "M", "G"],
            stock: product.stock ?? 10,
            active: product.active ?? true,
          })
          .select()
          .single();

        if (insertErr) throw insertErr;

        // Registrar foto de catálogo em product_photos
        if (catalogPath) {
          await supabaseAdmin.from("product_photos").insert({
            product_id: newProd.id,
            storage_path: catalogPath,
            type: "catalog",
            sort_order: 0,
          });
        }

        // Registrar foto de referência de try-on em product_photos
        if (tryOnPath) {
          await supabaseAdmin.from("product_photos").insert({
            product_id: newProd.id,
            storage_path: tryOnPath,
            type: "try_on_reference",
            sort_order: 1,
          });
        }

        return new Response(
          JSON.stringify({ status: "success", product: newProd }),
          { status: 200, headers: { ...corsHeaders(req), "Content-Type": "application/json" } }
        );
      } else {
        // action === 'update'
        const { data: updatedProd, error: updateErr } = await supabaseAdmin
          .from("products")
          .update({
            name: product.name,
            description: product.description,
            category: product.category,
            garment_type: product.garment_type,
            color: product.color,
            material: product.material,
            fit: product.fit,
            price: product.price,
            currency: currency,
            sizes: product.sizes,
            stock: product.stock,
            active: product.active,
            updated_at: new Date().toISOString(),
          })
          .eq("id", product.id)
          .eq("store_id", store_id)
          .select()
          .single();

        if (updateErr) throw updateErr;

        if (catalogPath) {
          await supabaseAdmin.from("product_photos").insert({
            product_id: product.id,
            storage_path: catalogPath,
            type: "catalog",
            sort_order: 0,
          });
        }

        if (tryOnPath) {
          await supabaseAdmin.from("product_photos").insert({
            product_id: product.id,
            storage_path: tryOnPath,
            type: "try_on_reference",
            sort_order: 1,
          });
        }

        return new Response(
          JSON.stringify({ status: "success", product: updatedProd }),
          { status: 200, headers: { ...corsHeaders(req), "Content-Type": "application/json" } }
        );
      }
    } else if (action === "delete") {
      // Exclusão de produto requer role 'owner'
      if (userRole !== "owner") {
        return new Response(
          JSON.stringify({ error: "Apenas o proprietário (owner) pode excluir produtos do catálogo." }),
          { status: 403, headers: { ...corsHeaders(req), "Content-Type": "application/json" } }
        );
      }

      if (!product || !product.id) {
        return new Response(
          JSON.stringify({ error: "Identificador do produto é obrigatório para exclusão." }),
          { status: 400, headers: { ...corsHeaders(req), "Content-Type": "application/json" } }
        );
      }

      const { error: delErr } = await supabaseAdmin
        .from("products")
        .delete()
        .eq("id", product.id)
        .eq("store_id", store_id);

      if (delErr) throw delErr;

      return new Response(
        JSON.stringify({ status: "success", message: "Produto e fotos associadas excluídos com sucesso." }),
        { status: 200, headers: { ...corsHeaders(req), "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ error: "Ação não reconhecida." }),
      { status: 400, headers: { ...corsHeaders(req), "Content-Type": "application/json" } }
    );
  } catch (err: any) {
    return new Response(
      JSON.stringify({ error: err.message || "Erro interno na Edge Function admin-products." }),
      { status: 500, headers: { ...corsHeaders(req), "Content-Type": "application/json" } }
    );
  }
});

async function uploadImage(supabaseAdmin: any, base64Data: string, prefix: string): Promise<string> {
  const match = base64Data.match(/^data:(image\/(jpeg|png|webp));base64,(.+)$/);
  if (!match) return base64Data; // Retornar URL se já for uma URL

  const mimeType = match[1];
  const rawBase64 = match[3];
  const binaryStr = atob(rawBase64);
  const bytes = new Uint8Array(binaryStr.length);
  for (let i = 0; i < binaryStr.length; i++) {
    bytes[i] = binaryStr.charCodeAt(i);
  }

  const fileExt = mimeType.split("/")[1] || "jpg";
  const fileName = `${prefix}-${Math.random().toString(36).substring(7)}.${fileExt}`;

  const { error } = await supabaseAdmin.storage
    .from("product-images")
    .upload(fileName, bytes, { contentType: mimeType, upsert: true });

  if (error) throw new Error(`Falha no upload da imagem: ${error.message}`);

  const { data } = supabaseAdmin.storage
    .from("product-images")
    .getPublicUrl(fileName);

  return data.publicUrl;
}
