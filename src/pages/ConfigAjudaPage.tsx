import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { ChevronDown, FileText, Shield, X } from "lucide-react";
import { useTheme } from "@/hooks/useTheme";
import PageHeader from "@/components/settings/PageHeader";
import SettingsGroup from "@/components/settings/SettingsGroup";
import SectionHeader from "@/components/settings/SectionHeader";
import SettingsRow from "@/components/settings/SettingsRow";

const FAQS = [
  {
    q: "Como funciona o split de pagamento?",
    a: "Você recebe 90% de cada serviço realizado. Os 10% restantes são distribuídos entre a UBT (4%), sua comunidade profissional (2%), prêmios para trabalhadores e consumidores (3% total) e seu padrinho ou madrinha (1%).",
  },
  {
    q: "Como sou avaliado na plataforma?",
    a: "Ao final de cada serviço, o outro usuário pode te avaliar com 1 a 5 estrelas e deixar um comentário opcional. Sua média de avaliações fica visível no seu perfil e influencia sua posição nas buscas.",
  },
  {
    q: "O que é o KYC e por que preciso fazer?",
    a: "KYC (Know Your Customer) é a verificação de identidade obrigatória para Prestadores. Você envia foto da CNH e uma selfie segurando o documento. A análise é feita em até 10 minutos e você é notificado por push.",
  },
  {
    q: "Como funcionam os sorteios?",
    a: "A cada serviço realizado, você ganha uma participação automática no próximo sorteio. Os sorteios acontecem em 01/05 e 01/12 de cada ano, com prêmio de R$ 10.000 para trabalhadores e R$ 10.000 para consumidores.",
  },
  {
    q: "Como aciono a emergência durante um serviço?",
    a: "Durante qualquer serviço ativo, toque no botão vermelho 'Emergência' no canto inferior da tela. Você poderá ligar diretamente para o 190 ou enviar um alerta para seu contato de emergência cadastrado.",
  },
];

const DOC_TEXT = {
  termos: [
    "Bem-vindo à UBT — O Superapp do Trabalhador. Estes Termos de Uso regulam o acesso e a utilização da plataforma. Ao criar uma conta, você concorda integralmente com as condições aqui descritas.",
    "A UBT busca ampliar oportunidades de trabalho e geração de renda para a comunidade local, respeitando princípios de inclusão e responsabilidade social.",
    "O processo de credenciamento considera a documentação exigida para cada atividade, a regularidade operacional e o comportamento dentro da plataforma.",
    "A segurança dos usuários é reforçada por mecanismos de verificação documental, avaliações da comunidade, monitoramento operacional, auditoria antifraude e moderação contínua.",
    "A UBT mantém política de tolerância zero para fraude, violência, assédio ou qualquer atividade ilegal.",
    "A UBT atua como intermediadora entre Tomadores e Prestadores de serviços, oferecendo a infraestrutura tecnológica para conectar as partes. Não nos responsabilizamos pela qualidade ou execução dos serviços, mas asseguramos canais de mediação e suporte.",
    "É proibido o uso da plataforma para atividades ilícitas, fraude, ou que violem a dignidade de outros usuários. O descumprimento poderá resultar em suspensão imediata da conta.",
    "A UBT poderá atualizar estes Termos a qualquer momento, comunicando os usuários por meio do aplicativo. O uso contínuo após a alteração configura aceitação das novas condições.",
  ],
  privacidade: [
    "Esta Política de Privacidade descreve como a UBT coleta, usa e protege seus dados pessoais. Levamos a sério sua privacidade e seguimos rigorosamente a Lei Geral de Proteção de Dados (LGPD).",
    "Coletamos dados de cadastro (nome, CPF, telefone, e-mail), localização durante o uso ativo do app e informações de pagamento. Esses dados são utilizados exclusivamente para viabilizar os serviços oferecidos.",
    "Seus dados nunca são vendidos a terceiros. Compartilhamos apenas o estritamente necessário com prestadores parceiros (ex.: nome e localização do Tomador para o Prestador aceitar uma corrida).",
    "Você pode solicitar a exclusão da sua conta e de todos os seus dados a qualquer momento, pelo canal de suporte dentro do aplicativo. O processo é concluído em até 15 dias úteis.",
  ],
};

const ConfigAjudaPage = () => {
  const t = useTheme();
  const navigate = useNavigate();
  const [openFaq, setOpenFaq] = useState<number | null>(null);
  const [docModal, setDocModal] = useState<"termos" | "privacidade" | null>(null);

  return (
    <div style={{ background: t.bg, minHeight: "100svh" }}>
      <div style={{ padding: "8px 24px 80px" }}>
        <PageHeader title="Ajuda & Sobre" onBack={() => navigate("/app/config")} />

        <SectionHeader>PERGUNTAS FREQUENTES</SectionHeader>
        <SettingsGroup>
          {FAQS.map((faq, i) => (
            <div
              key={i}
              style={{
                borderBottom: i < FAQS.length - 1 ? `1px solid ${t.border}` : "none",
              }}
            >
              <button
                type="button"
                onClick={() => setOpenFaq(openFaq === i ? null : i)}
                style={{
                  width: "100%",
                  padding: "16px 20px",
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  background: "none",
                  border: "none",
                  cursor: "pointer",
                }}
              >
                <span
                  style={{
                    fontFamily: "DM Sans",
                    fontSize: 15,
                    fontWeight: 500,
                    color: t.text,
                    textAlign: "left",
                    flex: 1,
                    marginRight: 12,
                  }}
                >
                  {faq.q}
                </span>
                <ChevronDown
                  size={18}
                  color={t.muted}
                  style={{
                    transform: openFaq === i ? "rotate(180deg)" : "rotate(0)",
                    transition: "transform 250ms",
                    flexShrink: 0,
                  }}
                />
              </button>
              {openFaq === i && (
                <div style={{ padding: "0 20px 16px" }}>
                  <p style={{ fontFamily: "DM Sans", fontSize: 14, color: t.subtle, lineHeight: 1.6, margin: 0 }}>
                    {faq.a}
                  </p>
                </div>
              )}
            </div>
          ))}
        </SettingsGroup>

        <div style={{ marginTop: 24 }}>
          <SectionHeader>DOCUMENTOS</SectionHeader>
        </div>
        <SettingsGroup>
          <SettingsRow icon={FileText} label="Termos de uso" onClick={() => setDocModal("termos")} />
          <SettingsRow
            icon={Shield}
            label="Política de privacidade"
            onClick={() => setDocModal("privacidade")}
            isLast
          />
        </SettingsGroup>

        <div style={{ marginTop: 24 }}>
          <SectionHeader>SOBRE O APP</SectionHeader>
        </div>
        <SettingsGroup>
          <div
            style={{
              padding: "16px 20px",
              display: "flex",
              alignItems: "center",
              borderBottom: `1px solid ${t.border}`,
            }}
          >
            <span style={{ fontFamily: "Syne", fontSize: 16, fontWeight: 700, color: t.text }}>UBT.</span>
            <span
              style={{
                fontFamily: "DM Sans",
                fontSize: 12,
                color: t.subtle,
                marginLeft: "auto",
              }}
            >
              O Superapp do Trabalhador
            </span>
          </div>
          <div
            style={{
              padding: "16px 20px",
              display: "flex",
              justifyContent: "space-between",
              borderBottom: `1px solid ${t.border}`,
            }}
          >
            <span style={{ fontFamily: "DM Sans", fontSize: 14, color: t.text }}>Versão</span>
            <span style={{ fontFamily: "DM Sans", fontSize: 14, color: t.muted }}>1.0.0 (MVP)</span>
          </div>
          <div
            style={{
              padding: "16px 20px",
              display: "flex",
              justifyContent: "space-between",
              borderBottom: `1px solid ${t.border}`,
            }}
          >
            <span style={{ fontFamily: "DM Sans", fontSize: 14, color: t.text }}>Ambiente</span>
            <span style={{ fontFamily: "DM Sans", fontSize: 14, color: t.muted }}>Plataforma UBT</span>
          </div>
          <div style={{ padding: "16px 20px", textAlign: "center" }}>
            <span style={{ fontFamily: "DM Sans", fontSize: 13, color: t.subtle }}>
              Desenvolvido em Ubatuba, SP
            </span>
          </div>
        </SettingsGroup>
      </div>

      {docModal && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 200,
            display: "flex",
            alignItems: "flex-end",
            justifyContent: "center",
          }}
        >
          <div
            onClick={() => setDocModal(null)}
            style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,0.5)" }}
          />
          <div
            style={{
              position: "relative",
              width: "100%",
              maxWidth: 480,
              height: "75vh",
              background: t.surface,
              borderRadius: "24px 24px 0 0",
              display: "flex",
              flexDirection: "column",
              animation: "ubt-sheet-up 280ms ease-out",
            }}
          >
            <div style={{ padding: "16px 20px 8px", flexShrink: 0 }}>
              <div
                style={{
                  width: 40,
                  height: 4,
                  background: t.border,
                  borderRadius: 999,
                  margin: "0 auto 12px",
                }}
              />
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <h2 style={{ fontFamily: "Syne", fontSize: 18, fontWeight: 700, color: t.text, margin: 0 }}>
                  {docModal === "termos" ? "Termos de Uso" : "Política de Privacidade"}
                </h2>
                <button
                  type="button"
                  onClick={() => setDocModal(null)}
                  style={{ background: "none", border: "none", cursor: "pointer", padding: 4, display: "flex" }}
                >
                  <X size={22} color={t.text} />
                </button>
              </div>
            </div>
            <div style={{ flex: 1, overflowY: "auto", padding: "8px 20px" }}>
              {DOC_TEXT[docModal].map((p, i) => (
                <p
                  key={i}
                  style={{ fontFamily: "DM Sans", fontSize: 14, color: t.subtle, lineHeight: 1.7, marginBottom: 14 }}
                >
                  {p}
                </p>
              ))}
            </div>
            <div
              style={{
                padding: 16,
                borderTop: `1px solid ${t.border}`,
                textAlign: "center",
                flexShrink: 0,
              }}
            >
              <span style={{ fontFamily: "DM Sans", fontSize: 11, color: t.muted }}>
                Última atualização: Janeiro de 2025
              </span>
            </div>
          </div>
          <style>{`@keyframes ubt-sheet-up { from { transform: translateY(100%); } to { transform: translateY(0); } }`}</style>
        </div>
      )}
    </div>
  );
};

export default ConfigAjudaPage;
