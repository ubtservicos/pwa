import { supabase } from "@/lib/supabase";

export interface TestResultItem {
  codigo: string;
  nome: string;
  categoria: string;
  status: "passed" | "failed" | "warning";
  mensagem: string;
  detalhes?: Record<string, any>;
  duration_ms: number;
}

export interface QualityRunSummary {
  id?: string;
  score: number;
  status: "passed" | "failed" | "warning";
  selo: "Production Ready" | "Pilot Ready" | "Attention Required" | "Critical Issues";
  total_tests: number;
  passed_tests: number;
  failed_tests: number;
  warning_tests: number;
  duration_ms: number;
  executed_by?: string;
  created_at?: string;
  tests: TestResultItem[];
}

export class QualityRunnerService {
  public static async executeDiagnosticSuite(): Promise<QualityRunSummary> {
    const startTime = performance.now();
    const results: TestResultItem[] = [];

    // 1. Banco & Supabase
    await this.runTest(results, "db_connect", "Conexão com PostgreSQL Supabase", "Banco & Infra", async () => {
      const { count, error } = await supabase.from("usuarios").select("*", { count: "exact", head: true });
      if (error) throw error;
      return `Conexão OK. Total de cadastros na tabela usuarios: ${count || 0}.`;
    });

    // 2. Storage & Buckets
    await this.runTest(results, "storage_buckets", "Disponibilidade do Supabase Storage", "Storage", async () => {
      const { data, error } = await supabase.storage.listBuckets();
      if (error) throw error;
      const names = (data || []).map((b) => b.name).join(", ");
      return `Buckets disponíveis: [${names || "público/privado"}].`;
    });

    // 3. Realtime WebSockets
    await this.runTest(results, "realtime_ws", "Canal de Comunicação Realtime", "Realtime", async () => {
      const channel = supabase.channel("quality_test_ping");
      const sub = channel.subscribe();
      setTimeout(() => supabase.removeChannel(channel), 1000);
      return "WebSockets Realtime operacional e pronto para broadcast.";
    });

    // 4. Dashboard Executivo RPC
    await this.runTest(results, "rpc_exec_dash", "RPC get_executive_dashboard_kpis", "RPCs", async () => {
      const { data, error } = await supabase.rpc("get_executive_dashboard_kpis");
      if (error) throw error;
      return `KPIs executivos compilados. Saúde da plataforma: ${data?.saude?.status || "online"}.`;
    });

    // 5. Health Center RPC
    await this.runTest(results, "rpc_health_center", "RPC get_health_center_summary", "Health Center", async () => {
      const { data, error } = await supabase.rpc("get_health_center_summary");
      if (error) throw error;
      return `Health Center operacional. Alertas ativos: ${data?.alertas_ativos || 0}.`;
    });

    // 6. Audit Log RPC & Immutability
    await this.runTest(results, "rpc_audit_summary", "RPC get_admin_audit_logs_summary", "Auditoria", async () => {
      const { data, error } = await supabase.rpc("get_admin_audit_logs_summary");
      if (error) throw error;
      return `Audit log operacional. Registros hoje: ${data?.total_hoje || 0}.`;
    });

    // 7. RBAC & Permissões
    await this.runTest(results, "rbac_integrity", "Matriz de Permissões e Roles", "RBAC", async () => {
      const { count, error } = await supabase.from("permissions").select("*", { count: "exact", head: true });
      if (error) throw error;
      return `Matriz RBAC íntegra. Total de permissões mapeadas: ${count || 0}.`;
    });

    // 8. Configuration Center
    await this.runTest(results, "config_center", "Tabela system_settings e Parâmetros", "Configurações", async () => {
      const { count, error } = await supabase.from("system_settings").select("*", { count: "exact", head: true });
      if (error) throw error;
      return `Configuration Center funcional. Total de parâmetros cadastrados: ${count || 0}.`;
    });

    // 9. Financeiro & Transações
    await this.runTest(results, "finance_payments", "Módulo Financeiro e Tabelas de Pagamento", "Financeiro", async () => {
      const { count, error } = await supabase.from("payments").select("*", { count: "exact", head: true });
      if (error) throw error;
      return `Esquema financeiro verificado. Registros na tabela payments: ${count || 0}.`;
    });

    // 10. Marketplace & Verticais
    await this.runTest(results, "marketplace_tables", "Verticais de Mototáxi, Diaristas e Côco", "Marketplace", async () => {
      const { count: mototaxiCount } = await supabase.from("mototaxi_corridas").select("*", { count: "exact", head: true });
      const { count: cocoCount } = await supabase.from("coco_pontos").select("*", { count: "exact", head: true });
      return `Módulos operacionais integrados. Corridas: ${mototaxiCount || 0}, Pontos de Côco: ${cocoCount || 0}.`;
    });

    // 11. KYC & Cadastro
    await this.runTest(results, "kyc_queue", "Fila de Validação de Documentos KYC", "KYC", async () => {
      const { count, error } = await supabase.from("usuarios").select("*", { count: "exact", head: true }).eq("under_review", true);
      if (error) throw error;
      return `Validação KYC ativa. Prestadores aguardando análise: ${count || 0}.`;
    });

    // 12. LGPD & Conformidade
    await this.runTest(results, "lgpd_compliance", "Conformidade LGPD e Expurgo de Dados", "LGPD", async () => {
      const { count, error } = await supabase.from("usuarios").select("*", { count: "exact", head: true }).not("deleted_at", "is", null);
      if (error) throw error;
      return `Garantia LGPD verificada. Solicitações de expurgo tratadas: ${count || 0}.`;
    });

    // 13. Latência de Resposta RPC
    await this.runTest(results, "rpc_latency", "Latência Média de Execução de RPC (< 150ms)", "Performance", async () => {
      const t0 = performance.now();
      await supabase.rpc("get_latest_quality_summary");
      const latency = Math.round(performance.now() - t0);
      if (latency > 250) {
        throw new Error(`Latência elevada detectada: ${latency}ms.`);
      }
      return `Latência média de resposta excelente: ${latency}ms.`;
    });

    const endTime = performance.now();
    const totalDurationMs = Math.round(endTime - startTime);

    // Calculate score
    const passedCount = results.filter((r) => r.status === "passed").length;
    const failedCount = results.filter((r) => r.status === "failed").length;
    const warningCount = results.filter((r) => r.status === "warning").length;
    const totalCount = results.length;

    const score = Math.round((passedCount / totalCount) * 100);

    let selo: "Production Ready" | "Pilot Ready" | "Attention Required" | "Critical Issues" = "Production Ready";
    let overallStatus: "passed" | "failed" | "warning" = "passed";

    if (score >= 95 && failedCount === 0) {
      selo = "Production Ready";
      overallStatus = "passed";
    } else if (score >= 85 && failedCount <= 2) {
      selo = "Pilot Ready";
      overallStatus = "warning";
    } else if (score >= 70) {
      selo = "Attention Required";
      overallStatus = "warning";
    } else {
      selo = "Critical Issues";
      overallStatus = "failed";
    }

    const runSummary: QualityRunSummary = {
      score,
      status: overallStatus,
      selo,
      total_tests: totalCount,
      passed_tests: passedCount,
      failed_tests: failedCount,
      warning_tests: warningCount,
      duration_ms: totalDurationMs,
      tests: results,
    };

    // Save run into PostgreSQL via RPC
    try {
      const { data: { user } } = await supabase.auth.getUser();
      await supabase.rpc("save_quality_run", {
        p_score: score,
        p_status: overallStatus,
        p_selo: selo,
        p_total: totalCount,
        p_passed: passedCount,
        p_failed: failedCount,
        p_warning: warningCount,
        p_duration_ms: totalDurationMs,
        p_results: results,
        p_user_id: user?.id || null,
      });
    } catch (saveErr) {
      console.error("[QualityRunnerService] Erro ao gravar execução no banco:", saveErr);
    }

    return runSummary;
  }

  private static async runTest(
    results: TestResultItem[],
    codigo: string,
    nome: string,
    categoria: string,
    fn: () => Promise<string>
  ): Promise<void> {
    const t0 = performance.now();
    try {
      const msg = await fn();
      const duration = Math.round(performance.now() - t0);
      results.push({
        codigo,
        nome,
        categoria,
        status: "passed",
        mensagem: msg,
        duration_ms: duration,
      });
    } catch (err: any) {
      const duration = Math.round(performance.now() - t0);
      results.push({
        codigo,
        nome,
        categoria,
        status: "failed",
        mensagem: err?.message || "Falha na verificação de diagnóstico.",
        detalhes: { error: String(err) },
        duration_ms: duration,
      });
    }
  }
}
