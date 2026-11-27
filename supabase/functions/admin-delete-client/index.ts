import { serve } from "https://deno.land/std@0.208.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const supabaseUrl = Deno.env.get("SUPABASE_URL")?.trim() ?? "";
const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")?.trim() ?? "";
const anonKey = Deno.env.get("SUPABASE_ANON_KEY")?.trim() ?? "";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const SUPERADMIN_EMAILS = new Set(["ubt.servicos@gmail.com", "admin@ubt.app"]);
const ALLOWED_ADMIN_ROLES = new Set(["super_admin", "superadmin", "admin"]);

function corsHeaders(req: Request): Record<string, string> {
  const origin = req.headers.get("origin") || "*";
  return {
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Max-Age": "86400",
    "Vary": "Origin",
  };
}

function json(req: Request, status: number, body: Record<string, unknown>): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders(req), "Content-Type": "application/json" },
  });
}

serve(async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders(req) });
  }
  if (req.method !== "POST") {
    return json(req, 405, { success: false, error: "method_not_allowed", message: "Método não permitido." });
  }

  if (!supabaseUrl || !serviceRoleKey || !anonKey) {
    return json(req, 500, {
      success: false,
      error: "server_configuration_error",
      message: "Configuração obrigatória do Supabase ausente.",
    });
  }

  const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  try {
    // 1. Autenticar chamador
    const authorization = req.headers.get("authorization") || "";
    const jwt = authorization.replace(/^Bearer\s+/i, "").trim();
    if (!jwt) {
      return json(req, 401, { success: false, error: "missing_authorization", message: "Autenticação obrigatória." });
    }

    const { data: callerAuth, error: callerErr } = await supabaseAdmin.auth.getUser(jwt);
    if (callerErr || !callerAuth?.user) {
      return json(req, 401, { success: false, error: "invalid_session", message: "Sessão expirada ou inválida." });
    }

    const caller = callerAuth.user;
    const callerEmail = String(caller.email || "").trim().toLowerCase();

    // 2. Verificar permissão de admin / super_admin
    const [{ data: callerUserRow }, { data: callerProfileRow }] = await Promise.all([
      supabaseAdmin.from("usuarios").select("nome, role").eq("id", caller.id).maybeSingle(),
      supabaseAdmin.from("profiles").select("role").eq("id", caller.id).maybeSingle(),
    ]);

    const effectiveRole = String(callerUserRow?.role || callerProfileRow?.role || "").toLowerCase();
    const isSuperOrAdmin = SUPERADMIN_EMAILS.has(callerEmail) || ALLOWED_ADMIN_ROLES.has(effectiveRole);
    if (!isSuperOrAdmin) {
      return json(req, 403, {
        success: false,
        error: "forbidden",
        message: "Apenas administradores autorizados podem excluir clientes.",
      });
    }

    // 3. Validar payload
    const body = await req.json().catch(() => null);
    if (!body || typeof body !== "object") {
      return json(req, 400, { success: false, error: "invalid_body", message: "Corpo da requisição inválido." });
    }

    const targetUserId = String(body.target_user_id || "").trim();
    const adminPassword = String(body.admin_password || "");
    const reason = String(body.reason || "Exclusão definitiva via painel Superadmin").trim().slice(0, 500);

    if (!UUID_RE.test(targetUserId)) {
      return json(req, 400, { success: false, error: "invalid_user_id", message: "ID do cliente inválido." });
    }
    if (!adminPassword || adminPassword.length < 4) {
      return json(req, 400, {
        success: false,
        error: "missing_admin_password",
        message: "Digite sua senha de Superadmin para confirmar a exclusão.",
      });
    }
    if (targetUserId === caller.id) {
      return json(req, 400, {
        success: false,
        error: "self_delete_forbidden",
        message: "Não é permitido excluir a própria conta administrativa.",
      });
    }

    // 4. Validar senha atual do Superadmin via Supabase Auth
    if (!callerEmail) {
      return json(req, 400, {
        success: false,
        error: "admin_email_missing",
        message: "Sua conta administrativa não possui e-mail configurado para validação de senha.",
      });
    }

    const passwordVerifier = createClient(supabaseUrl, anonKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
    const { error: pwdError } = await passwordVerifier.auth.signInWithPassword({
      email: callerEmail,
      password: adminPassword,
    });
    if (pwdError) {
      return json(req, 401, {
        success: false,
        error: "invalid_admin_password",
        message: "Senha do Superadmin incorreta. Exclusão cancelada.",
      });
    }

    // 5. Capturar snapshot do cliente alvo antes da exclusão
    const { data: targetUser } = await supabaseAdmin
      .from("usuarios")
      .select("id, nome, email, telefone, referral_code, role, status")
      .eq("id", targetUserId)
      .maybeSingle();

    const targetEmail = String(targetUser?.email || "").trim().toLowerCase();
    const targetPhoneDigits = String(targetUser?.telefone || "").replace(/\D/g, "");

    // 6. Registrar trilha em admin_audit_logs
    await supabaseAdmin.from("admin_audit_logs").insert({
      admin_id: caller.id,
      admin_nome: callerUserRow?.nome || "Superadmin UBT",
      admin_email: callerEmail,
      acao: "deletar_cliente",
      categoria: "usuarios",
      modulo: "admin_clientes",
      entidade: "usuarios",
      registro_id: targetUserId,
      valor_anterior: targetUser || { id: targetUserId },
      valor_novo: null,
      motivo: reason,
      resultado: "em_andamento",
      criticidade: "critica",
      metadata: {
        target_email: targetEmail || null,
        target_slug: targetUser?.referral_code || null,
      },
    });

    // 7. Limpeza controlada de tabelas vinculadas (tratando tabelas opcionais/FKs)
    const cleanupSteps: Array<{ label: string; run: () => Promise<unknown> }> = [
      { label: "mp_customer_wallets", run: () => supabaseAdmin.from("mp_customer_wallets").delete().eq("user_id", targetUserId) },
      { label: "marketplace_accounts", run: () => supabaseAdmin.from("marketplace_accounts").delete().eq("user_id", targetUserId) },
      { label: "user_consents", run: () => supabaseAdmin.from("user_consents").delete().eq("user_id", targetUserId) },
      { label: "in_app_notifications", run: () => supabaseAdmin.from("in_app_notifications").delete().eq("user_id", targetUserId) },
      { label: "mototaxi_sessoes", run: () => supabaseAdmin.from("mototaxi_sessoes").delete().eq("prestador_id", targetUserId) },
      { label: "prestador_mototaxi", run: () => supabaseAdmin.from("prestador_mototaxi").delete().eq("user_id", targetUserId) },
      { label: "carro_sessoes", run: () => supabaseAdmin.from("carro_sessoes").delete().eq("prestador_id", targetUserId) },
      { label: "prestador_carro", run: () => supabaseAdmin.from("prestador_carro").delete().eq("user_id", targetUserId) },
      { label: "diarista_perfis", run: () => supabaseAdmin.from("diarista_perfis").delete().eq("user_id", targetUserId) },
      { label: "provider_associations", run: () => supabaseAdmin.from("provider_associations").delete().eq("provider_id", targetUserId) },
      { label: "associacao_membros", run: () => supabaseAdmin.from("associacao_membros").delete().eq("prestador_id", targetUserId) },
      { label: "coco_colaboradores", run: () => supabaseAdmin.from("coco_colaboradores").delete().eq("user_id", targetUserId) },
      { label: "padrinho_refs", run: () => supabaseAdmin.from("usuarios").update({ padrinho_id: null }).eq("padrinho_id", targetUserId) },
      { label: "waitlist_user_id", run: () => supabaseAdmin.from("waitlist").delete().eq("user_id", targetUserId) },
    ];

    if (targetEmail) {
      cleanupSteps.push({
        label: "waitlist_email",
        run: () => supabaseAdmin.from("waitlist").delete().eq("email", targetEmail),
      });
    }
    if (targetPhoneDigits.length >= 10) {
      cleanupSteps.push({
        label: "waitlist_phone",
        run: () => supabaseAdmin.from("waitlist").delete().eq("telefone", targetPhoneDigits),
      });
    }

    for (const step of cleanupSteps) {
      try {
        await step.run();
      } catch (cleanupErr) {
        console.warn(`[admin-delete-client] cleanup step ${step.label} warning:`, cleanupErr);
      }
    }

    // Remover de profiles e usuarios
    await supabaseAdmin.from("profiles").delete().eq("id", targetUserId);
    const { error: delUsuarioErr } = await supabaseAdmin.from("usuarios").delete().eq("id", targetUserId);
    if (delUsuarioErr) {
      return json(req, 409, {
        success: false,
        error: "integrity_constraint_error",
        message: `Não foi possível excluir o cadastro do cliente devido a vínculos existentes: ${delUsuarioErr.message}`,
      });
    }

    // 8. Remover do auth.users
    const { error: authDelErr } = await supabaseAdmin.auth.admin.deleteUser(targetUserId);
    if (authDelErr && !String(authDelErr.message || "").toLowerCase().includes("not found")) {
      return json(req, 500, {
        success: false,
        error: "auth_delete_failed",
        message: `Cadastro removido, mas houve falha ao excluir a conta de autenticação: ${authDelErr.message}`,
      });
    }

    await supabaseAdmin.from("admin_audit_logs").insert({
      admin_id: caller.id,
      admin_nome: callerUserRow?.nome || "Superadmin UBT",
      admin_email: callerEmail,
      acao: "deletar_cliente_concluido",
      categoria: "usuarios",
      modulo: "admin_clientes",
      entidade: "usuarios",
      registro_id: targetUserId,
      valor_anterior: targetUser || { id: targetUserId },
      valor_novo: { deleted: true },
      motivo: reason,
      resultado: "sucesso",
      criticidade: "critica",
    });

    return json(req, 200, {
      success: true,
      deleted_user_id: targetUserId,
      message: "Cliente excluído definitivamente com sucesso.",
    });
  } catch (err) {
    console.error("[admin-delete-client] unexpected error:", err);
    return json(req, 500, {
      success: false,
      error: "internal_error",
      message: err instanceof Error ? err.message : "Erro interno ao excluir cliente.",
    });
  }
});
