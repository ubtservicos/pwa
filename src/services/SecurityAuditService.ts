import { supabase } from "@/lib/supabase";

export interface SecurityFinding {
  id: string;
  categoria: string;
  criticidade: "INFO" | "BAIXA" | "MEDIA" | "ALTA" | "CRITICA";
  titulo: string;
  descricao: string;
  impacto?: string;
  probabilidade?: "BAIXA" | "MEDIA" | "ALTA";
  risco?: "BAIXO" | "MEDIO" | "ALTO" | "EXTREMO";
  acao?: string;
  status: "open" | "resolving" | "resolved" | "ignored";
  responsavel?: string;
  created_at: string;
  resolved_at?: string;
  metadata?: Record<string, any>;
}

export interface SecuritySummaryData {
  score: number;
  selo: "Production Secure" | "Pilot Secure" | "Attention Required" | "Critical Risk";
  riscos_criticos: number;
  riscos_medios: number;
  riscos_baixos: number;
  riscos_resolvidos: number;
  riscos_abertos: number;
  findings: SecurityFinding[];
}

export class SecurityAuditServiceManager {
  public async getSummary(): Promise<SecuritySummaryData | null> {
    try {
      const { data, error } = await supabase.rpc("get_security_summary");
      if (error) throw error;
      return data as SecuritySummaryData;
    } catch (err) {
      console.error("[SecurityAuditService] Erro ao carregar resumo de segurança:", err);
      return null;
    }
  }

  public async runAudit(): Promise<boolean> {
    try {
      const { error } = await supabase.rpc("run_security_audit");
      if (error) throw error;
      return true;
    } catch (err) {
      console.error("[SecurityAuditService] Erro ao executar auditoria de segurança:", err);
      return false;
    }
  }

  public async resolveFinding(findingId: string, motivo?: string): Promise<boolean> {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      const { error } = await supabase.rpc("resolve_security_finding", {
        p_finding_id: findingId,
        p_user_id: user?.id || null,
        p_motivo: motivo || "Risco mitigado/resolvido via BackOffice Security Center",
      });

      if (error) throw error;
      return true;
    } catch (err) {
      console.error("[SecurityAuditService] Erro ao resolver ocorrência de segurança:", err);
      return false;
    }
  }
}

export const SecurityAuditService = new SecurityAuditServiceManager();
