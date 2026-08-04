import React from "react";
import { HelpCircle } from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

export const TOOLTIP_DICTIONARY: Record<string, string> = {
  "admin.dashboard.gmv": "Volume Bruto de Mercadorias (GMV) transacionado no dia.",
  "admin.dashboard.receita_ubt": "Receita líquida das taxas operacionais coletadas pela UBT hoje.",
  "admin.dashboard.pedidos": "Quantidade total de pedidos e corridas abertas no dia de hoje.",
  "admin.dashboard.tempo_resposta": "Latência média de processamento do backend em milissegundos.",
  
  "admin.health.alertas_criticos": "Total de alertas técnicos ou de negócio classificados como CRÍTICO.",
  "admin.health.alertas_ativos": "Quantidade de incidentes não resolvidos sob monitoramento.",
  "admin.health.tempo_resolucao": "Tempo médio dos operadores no fechamento de alertas do sistema.",
  
  "admin.operacoes.corridas_ativas": "Quantidade de pedidos de ambulantes e corridas em andamento/aceitos.",
  "admin.operacoes.ghost_ride_alerts": "Corridas em andamento com desvio GPS ou sem deslocamento físico.",
  
  "admin.audit.total_hoje": "Total de eventos de auditoria capturados e persistidos nas últimas 24h.",
  "admin.audit.acoes_criticas": "Operações realizadas por administradores com alto impacto (ex. exclusões).",
  
  "admin.antifraude.criticos_pendentes": "Alertas pendentes de fraude com bloqueio preventivo de repasses.",
  
  "admin.analytics.eventos_capturados": "Métricas e cliques coletados para análise de funil e marketing.",
  "admin.analytics.usuarios_ativos": "Mapeamento de usuários logados trafegando dados na plataforma.",
  "admin.analytics.pedidos_criados": "Volume de solicitações iniciadas no marketplace da plataforma.",
  
  "admin.security.score": "Percentual geral de conformidade de segurança e políticas RLS.",
  "admin.security.riscos_criticos": "Riscos de alta gravidade descobertos no banco ou API sem resolução.",
  
  "admin.configuracoes.centro_configuracoes": "Parâmetros globais de taxas, limites e comportamentos de regras."
};

interface HelpTooltipProps {
  concept: keyof typeof TOOLTIP_DICTIONARY | string;
  className?: string;
}

export function HelpTooltip({ concept, className }: HelpTooltipProps) {
  const text = TOOLTIP_DICTIONARY[concept] || "Ajuda contextual UBT.";
  
  return (
    <TooltipProvider>
      <Tooltip delayDuration={200}>
        <TooltipTrigger asChild>
          <button
            type="button"
            className="inline-flex items-center justify-center text-slate-400 hover:text-slate-600 focus:text-slate-600 outline-none transition-colors rounded-full p-0.5 ml-1.5 align-middle select-none cursor-help"
            aria-label={`Ajuda contextual: ${text}`}
          >
            <HelpCircle size={14} className={className} />
          </button>
        </TooltipTrigger>
        <TooltipContent
          side="top"
          align="center"
          sideOffset={6}
          className="z-[9999] max-w-[260px] bg-slate-900 text-white border border-slate-800 text-xs font-normal px-3 py-2 rounded-lg shadow-xl"
        >
          <p className="leading-relaxed">{text}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
