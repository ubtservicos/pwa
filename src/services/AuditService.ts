import { supabase } from "@/lib/supabase";

export interface LogAdminActionParams {
  adminId?: string;
  adminNome?: string;
  adminEmail?: string;
  acao: string;
  categoria: "Financeiro" | "Usuarios" | "KYC" | "Marketplace" | "Conteudo" | "Operacoes" | "LGPD" | "Sistema" | "Seguranca" | "Analytics";
  modulo?: string;
  entidade?: string;
  registroId?: string;
  valorAnterior?: any;
  valorNovo?: any;
  motivo?: string;
  ip?: string;
  userAgent?: string;
  sessionId?: string;
  resultado?: "sucesso" | "falha";
  criticidade?: "INFO" | "BAIXA" | "MEDIA" | "ALTA" | "CRITICA";
  metadata?: Record<string, any>;
}

/**
 * AuditService — Centralized, non-blocking administrative audit logging.
 */
export const logAdminAction = (params: LogAdminActionParams): void => {
  setTimeout(async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();

      const rpcParams = {
        p_admin_id: params.adminId || user?.id || null,
        p_admin_nome: params.adminNome || user?.user_metadata?.name || null,
        p_admin_email: params.adminEmail || user?.email || null,
        p_acao: params.acao,
        p_categoria: params.categoria,
        p_modulo: params.modulo || null,
        p_entidade: params.entidade || null,
        p_registro_id: params.registroId || null,
        p_valor_anterior: params.valorAnterior ? JSON.parse(JSON.stringify(params.valorAnterior)) : null,
        p_valor_novo: params.valorNovo ? JSON.parse(JSON.stringify(params.valorNovo)) : null,
        p_motivo: params.motivo || null,
        p_ip: params.ip || null,
        p_user_agent: params.userAgent || (typeof navigator !== "undefined" ? navigator.userAgent : null),
        p_session_id: params.sessionId || null,
        p_resultado: params.resultado || "sucesso",
        p_criticidade: params.criticidade || "INFO",
        p_metadata: params.metadata || {},
      };

      const { error } = await supabase.rpc("log_admin_action", rpcParams);
      if (error) {
        console.warn("[AuditService] Erro ao gravar audit log via RPC:", error.message);
      }
    } catch (err) {
      console.error("[AuditService] Exception ao processar audit log:", err);
    }
  }, 0);
};
