import { useState, useEffect } from "react";
import {
  Plus,
  Trash2,
  Check,
  X,
  Calendar,
  MessageSquare,
  AlertTriangle,
  Send,
  Smartphone,
  Eye,
  RefreshCw,
  Waves,
  Sparkles,
  Search
} from "lucide-react";
import { Card, PrimaryButton, GhostButton, Pill } from "@/components/admin/ui";
import { useAdminToast } from "@/components/admin/AdminToast";

// Content types
type Tab = "banners" | "alerts" | "news" | "push";

interface Banner {
  id: string;
  title: string;
  subtitle: string;
  ctaText: string;
  bg: "Royal Blue" | "Emerald Green" | "Sunset Orange" | "Velvet Purple" | "Coral Red" | "Midnight Dark";
  link: string;
  active: boolean;
}

interface AlertConfig {
  active: boolean;
  level: "normal" | "medium" | "critical";
  message: string;
}

interface BeachConfig {
  name: string;
  status: "propicia" | "impropria";
}

interface Article {
  id: string;
  title: string;
  category: string;
  readTime: string;
  date: string;
}

interface PushLog {
  id: string;
  title: string;
  message: string;
  group: string;
  date: string;
  count: number;
}

const GRADIENTS = {
  "Royal Blue": "linear-gradient(135deg, #1E3A8A, #3B82F6)",
  "Emerald Green": "linear-gradient(135deg, #064E3B, #10B981)",
  "Sunset Orange": "linear-gradient(135deg, #78350F, #F59E0B)",
  "Velvet Purple": "linear-gradient(135deg, #581C87, #8B5CF6)",
  "Coral Red": "linear-gradient(135deg, #7F1D1D, #EF4444)",
  "Midnight Dark": "linear-gradient(135deg, #0F172A, #334155)"
};

// Initial default data if none exists in localStorage
const DEFAULT_BANNERS: Banner[] = [
  {
    id: "b1",
    title: "🎁 Prêmio Trabalhador 1/5",
    subtitle: "R$ 54.200 acumulados! Garanta já seus bilhetes.",
    ctaText: "Ver Bilhetes",
    bg: "Velvet Purple",
    link: "/admin/sorteio/1-5",
    active: true
  },
  {
    id: "b2",
    title: "🌱 UBT Reciclagem Seletiva",
    subtitle: "Agende sua coleta com o Côco & Cia e apoie ONGs locais.",
    ctaText: "Agendar Coleta",
    bg: "Emerald Green",
    link: "/app/coco",
    active: true
  }
];

const DEFAULT_ALERT: AlertConfig = {
  active: true,
  level: "medium",
  message: "Previsão de pancadas de chuva fortes em Ubatuba para este fim de semana. Atenção nas estradas!"
};

const DEFAULT_BEACHES: BeachConfig[] = [
  { name: "Praia Grande", status: "propicia" },
  { name: "Praia do Itaguá", status: "impropria" },
  { name: "Praia do Tenório", status: "propicia" },
  { name: "Praia das Toninhas", status: "propicia" },
  { name: "Praia do Perequê-Açu", status: "impropria" }
];

const DEFAULT_NEWS: Article[] = [
  {
    id: "n1",
    title: "Como funciona a doação de 2% para ONGs?",
    category: "Coletivo",
    readTime: "3 min",
    date: "18/06/2026"
  },
  {
    id: "n2",
    title: "Segurança total no mototáxi: dicas de uso",
    category: "Dicas",
    readTime: "4 min",
    date: "16/06/2026"
  }
];

const DEFAULT_PUSH_LOG: PushLog[] = [
  {
    id: "p1",
    title: "Sorteio de Maio concluído",
    message: "Confira se você foi o ganhador do prêmio do trabalhador!",
    group: "Todos",
    date: "01/05/2026 às 18:00",
    count: 1420
  }
];

export default function AdminConteudoPage() {
  const toast = useAdminToast();
  const [activeTab, setActiveTab] = useState<Tab>("banners");

  // State managed persistent values
  const [banners, setBanners] = useState<Banner[]>([]);
  const [alertConfig, setAlertConfig] = useState<AlertConfig>({ active: false, level: "normal", message: "" });
  const [beaches, setBeaches] = useState<BeachConfig[]>([]);
  const [news, setNews] = useState<Article[]>([]);
  const [pushLog, setPushLog] = useState<PushLog[]>([]);

  // Simulation values for slide show in preview
  const [activeSlideIdx, setActiveSlideIdx] = useState(0);

  // Form states
  // 1. Banners form
  const [newTitle, setNewTitle] = useState("");
  const [newSub, setNewSub] = useState("");
  const [newCta, setNewCta] = useState("Saber Mais");
  const [newBg, setNewBg] = useState<Banner["bg"]>("Royal Blue");
  const [newLink, setNewLink] = useState("/app/home");

  // 2. News form
  const [artTitle, setArtTitle] = useState("");
  const [artCategory, setArtCategory] = useState("Geral");
  const [artReadTime, setArtReadTime] = useState("3 min");

  // 3. Push form
  const [pushTitle, setPushTitle] = useState("");
  const [pushMessage, setPushMessage] = useState("");
  const [pushGroup, setPushGroup] = useState("Todos");

  // Initialize data on load
  useEffect(() => {
    const loadKey = <T,>(key: string, fallback: T): T => {
      const saved = localStorage.getItem(key);
      if (saved) {
        try { return JSON.parse(saved); } catch { return fallback; }
      }
      localStorage.setItem(key, JSON.stringify(fallback));
      return fallback;
    };

    setBanners(loadKey("ubt_banners", DEFAULT_BANNERS));
    setAlertConfig(loadKey("ubt_alerts", DEFAULT_ALERT));
    setBeaches(loadKey("ubt_beaches", DEFAULT_BEACHES));
    setNews(loadKey("ubt_news", DEFAULT_NEWS));
    setPushLog(loadKey("ubt_push_history", DEFAULT_PUSH_LOG));
  }, []);

  // Sync state changes with localStorage
  const saveBanners = (updated: Banner[]) => {
    setBanners(updated);
    localStorage.setItem("ubt_banners", JSON.stringify(updated));
  };

  const saveAlert = (updated: AlertConfig) => {
    setAlertConfig(updated);
    localStorage.setItem("ubt_alerts", JSON.stringify(updated));
  };

  const saveBeaches = (updated: BeachConfig[]) => {
    setBeaches(updated);
    localStorage.setItem("ubt_beaches", JSON.stringify(updated));
  };

  const saveNews = (updated: Article[]) => {
    setNews(updated);
    localStorage.setItem("ubt_news", JSON.stringify(updated));
  };

  // Actions
  // 1. Add banner
  const addBanner = () => {
    if (!newTitle.trim() || !newSub.trim()) return;
    const banner: Banner = {
      id: `banner_${Date.now()}`,
      title: newTitle,
      subtitle: newSub,
      ctaText: newCta,
      bg: newBg,
      link: newLink,
      active: true
    };
    const updated = [...banners, banner];
    saveBanners(updated);
    
    // reset form
    setNewTitle("");
    setNewSub("");
    setNewCta("Saber Mais");
    setNewLink("/app/home");
    toast.show("Banner adicionado com sucesso!");
  };

  const toggleBanner = (id: string) => {
    const updated = banners.map((b) => (b.id === id ? { ...b, active: !b.active } : b));
    saveBanners(updated);
  };

  const removeBanner = (id: string) => {
    const updated = banners.filter((b) => b.id !== id);
    saveBanners(updated);
    toast.show("Banner removido!");
  };

  // 2. Toggle Beach suitability
  const toggleBeachStatus = (name: string) => {
    const updated = beaches.map((b) =>
      b.name === name ? { ...b, status: b.status === "propicia" ? "impropria" : "propicia" as const } : b
    );
    saveBeaches(updated);
  };

  // 3. Add Article
  const addArticle = () => {
    if (!artTitle.trim()) return;
    const todayStr = new Date().toLocaleDateString("pt-BR");
    const article: Article = {
      id: `art_${Date.now()}`,
      title: artTitle,
      category: artCategory,
      readTime: artReadTime,
      date: todayStr
    };
    const updated = [...news, article];
    saveNews(updated);
    
    setArtTitle("");
    toast.show("Notícia/Guia publicado com sucesso!");
  };

  const removeArticle = (id: string) => {
    const updated = news.filter((n) => n.id !== id);
    saveNews(updated);
    toast.show("Guia removido!");
  };

  // 4. Send Push notification mock
  const sendPush = () => {
    if (!pushTitle.trim() || !pushMessage.trim()) return;
    
    const count = 
      pushGroup === "Todos" ? 1420 : 
      pushGroup === "Tomadores" ? 950 : 470;

    const todayHour = new Date().toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });
    
    const logItem: PushLog = {
      id: `push_${Date.now()}`,
      title: pushTitle,
      message: pushMessage,
      group: pushGroup,
      date: todayHour,
      count
    };

    const updated = [logItem, ...pushLog];
    setPushLog(updated);
    localStorage.setItem("ubt_push_history", JSON.stringify(updated));

    setPushTitle("");
    setPushMessage("");
    toast.show(`Push disparado com sucesso para ${count} usuários!`);
  };

  const clearPushLog = () => {
    setPushLog([]);
    localStorage.setItem("ubt_push_history", JSON.stringify([]));
  };

  const activeBanners = banners.filter(b => b.active);

  return (
    <div style={{ padding: 32 }}>
      {/* Title */}
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontFamily: "Syne", fontSize: 24, fontWeight: 700, color: "#0F172A", margin: 0 }}>Gerenciamento de Conteúdo</h1>
        <p style={{ fontFamily: "DM Sans", fontSize: 13, color: "#94A3B8", marginTop: 4 }}>
          Controle a central de boletins de praia, banners hero rotativos do Superapp, avisos climáticos de Ubatuba e notificações em tempo real.
        </p>
      </div>

      {/* Main Two Column layout */}
      <div style={{ display: "grid", gridTemplateColumns: "1.2fr 0.8fr", gap: 28, alignItems: "start" }}>
        
        {/* Left Side: CMS Controls */}
        <div>
          {/* Sub Navigation Tabs */}
          <div style={{ display: "flex", gap: 20, borderBottom: "1px solid #E2E8F0", marginBottom: 20 }}>
            {[
              { key: "banners", label: "Banners Rotativos" },
              { key: "alerts", label: "Boletins & Alertas" },
              { key: "news", label: "Notícias & Guias" },
              { key: "push", label: "Disparo de Push" }
            ].map((t) => {
              const active = activeTab === t.key;
              return (
                <button
                  key={t.key}
                  onClick={() => setActiveTab(t.key as Tab)}
                  style={{
                    background: "none",
                    border: "none",
                    borderBottom: active ? "2.5px solid #0DB87E" : "2.5px solid transparent",
                    padding: "10px 4px 12px",
                    fontFamily: "Syne",
                    fontSize: 14,
                    fontWeight: 700,
                    color: active ? "#0DB87E" : "#64748B",
                    cursor: "pointer",
                    transition: "all 0.2s"
                  }}
                >
                  {t.label}
                </button>
              );
            })}
          </div>

          {/* Abas Content: Banners */}
          {activeTab === "banners" && (
            <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
              {/* Creator Card */}
              <Card style={{ padding: 24 }}>
                <h3 style={{ fontFamily: "Syne", fontSize: 16, fontWeight: 700, color: "#0F172A", margin: "0 0 16px 0" }}>+ Adicionar Novo Banner Promocional</h3>
                
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, marginBottom: 14 }}>
                  <label>
                    <span style={{ fontFamily: "DM Sans", fontSize: 12, fontWeight: 600, color: "#475569" }}>Título do Banner</span>
                    <input
                      type="text"
                      placeholder="Ex: Prêmio Trabalhador 1/5"
                      value={newTitle}
                      onChange={e => setNewTitle(e.target.value)}
                      style={{ width: "100%", marginTop: 6, background: "#F1F5F9", border: "1px solid #E2E8F0", borderRadius: 10, padding: "10px 14px", fontFamily: "DM Sans", fontSize: 14, outline: "none" }}
                    />
                  </label>
                  <label>
                    <span style={{ fontFamily: "DM Sans", fontSize: 12, fontWeight: 600, color: "#475569" }}>Chamada/Texto de Botão (CTA)</span>
                    <input
                      type="text"
                      placeholder="Ex: Ver Bilhetes"
                      value={newCta}
                      onChange={e => setNewCta(e.target.value)}
                      style={{ width: "100%", marginTop: 6, background: "#F1F5F9", border: "1px solid #E2E8F0", borderRadius: 10, padding: "10px 14px", fontFamily: "DM Sans", fontSize: 14, outline: "none" }}
                    />
                  </label>
                </div>

                <div style={{ marginBottom: 14 }}>
                  <label>
                    <span style={{ fontFamily: "DM Sans", fontSize: 12, fontWeight: 600, color: "#475569" }}>Subtítulo / Descrição da Campanha</span>
                    <input
                      type="text"
                      placeholder="Ex: Participe e acumule prêmios com suas transações"
                      value={newSub}
                      onChange={e => setNewSub(e.target.value)}
                      style={{ width: "100%", marginTop: 6, background: "#F1F5F9", border: "1px solid #E2E8F0", borderRadius: 10, padding: "10px 14px", fontFamily: "DM Sans", fontSize: 14, outline: "none" }}
                    />
                  </label>
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, marginBottom: 20 }}>
                  <label>
                    <span style={{ fontFamily: "DM Sans", fontSize: 12, fontWeight: 600, color: "#475569" }}>Paleta de Cores (Gradiente)</span>
                    <select
                      value={newBg}
                      onChange={e => setNewBg(e.target.value as Banner["bg"])}
                      style={{ width: "100%", marginTop: 6, background: "#F1F5F9", border: "1px solid #E2E8F0", borderRadius: 10, padding: "10px 14px", fontFamily: "DM Sans", fontSize: 14, outline: "none", cursor: "pointer" }}
                    >
                      {Object.keys(GRADIENTS).map(g => (
                        <option key={g} value={g}>{g}</option>
                      ))}
                    </select>
                  </label>
                  <label>
                    <span style={{ fontFamily: "DM Sans", fontSize: 12, fontWeight: 600, color: "#475569" }}>Link de Navegação Interno</span>
                    <input
                      type="text"
                      placeholder="Ex: /app/mototaxi"
                      value={newLink}
                      onChange={e => setNewLink(e.target.value)}
                      style={{ width: "100%", marginTop: 6, background: "#F1F5F9", border: "1px solid #E2E8F0", borderRadius: 10, padding: "10px 14px", fontFamily: "DM Sans", fontSize: 14, outline: "none" }}
                    />
                  </label>
                </div>

                <PrimaryButton disabled={!newTitle || !newSub} onClick={addBanner} style={{ width: "100%" }}>
                  + Adicionar e Ativar Banner no App
                </PrimaryButton>
              </Card>

              {/* Banners List */}
              <Card style={{ padding: 24 }}>
                <h3 style={{ fontFamily: "Syne", fontSize: 16, fontWeight: 700, color: "#0F172A", margin: "0 0 16px 0" }}>Banners Habilitados no Slider</h3>
                <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                  {banners.map((b) => (
                    <div key={b.id} style={{ display: "flex", justifySelf: "stretch", background: "#F8FAFC", border: "1px solid #E2E8F0", borderRadius: 12, padding: 14, alignItems: "center", justifyContent: "space-between" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 14, minWidth: 0, flex: 1 }}>
                        {/* Tiny Color Preview */}
                        <div style={{ width: 44, height: 44, borderRadius: 8, background: GRADIENTS[b.bg], flexShrink: 0 }} />
                        <div style={{ minWidth: 0, flex: 1 }}>
                          <span style={{ fontFamily: "Syne", fontSize: 14, fontWeight: 700, color: "#0F172A", display: "block" }}>{b.title}</span>
                          <span style={{ fontFamily: "DM Sans", fontSize: 12, color: "#64748B", display: "block", textOverflow: "ellipsis", overflow: "hidden", whiteSpace: "nowrap" }}>{b.subtitle}</span>
                        </div>
                      </div>
                      
                      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                        <Pill bg={b.active ? "rgba(13,184,126,0.1)" : "#E2E8F0"} color={b.active ? "#0DB87E" : "#64748B"} size="sm">
                          {b.active ? "Ativo" : "Rascunho"}
                        </Pill>
                        
                        <div style={{ display: "flex", gap: 6 }}>
                          <button
                            onClick={() => toggleBanner(b.id)}
                            style={{
                              background: b.active ? "rgba(245,166,35,0.1)" : "rgba(13,184,126,0.1)",
                              border: "none",
                              color: b.active ? "#F5A623" : "#0DB87E",
                              fontFamily: "DM Sans",
                              fontSize: 12,
                              fontWeight: 600,
                              borderRadius: 6,
                              padding: "6px 10px",
                              cursor: "pointer"
                            }}
                          >
                            {b.active ? "Desativar" : "Ativar"}
                          </button>
                          <button
                            onClick={() => removeBanner(b.id)}
                            style={{
                              background: "rgba(232,64,64,0.08)",
                              border: "none",
                              color: "#E84040",
                              fontFamily: "DM Sans",
                              fontSize: 12,
                              fontWeight: 600,
                              borderRadius: 6,
                              padding: "6px 10px",
                              cursor: "pointer"
                            }}
                          >
                            <Trash2 size={13} />
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                  {banners.length === 0 && (
                    <p style={{ fontFamily: "DM Sans", fontSize: 13, color: "#94A3B8", textAlign: "center", padding: "20px 0" }}>Nenhum banner cadastrado no momento.</p>
                  )}
                </div>
              </Card>
            </div>
          )}

          {/* Abas Content: Alertas & Praias */}
          {activeTab === "alerts" && (
            <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
              {/* Climate Alert Card */}
              <Card style={{ padding: 24 }}>
                <h3 style={{ fontFamily: "Syne", fontSize: 16, fontWeight: 700, color: "#0F172A", margin: "0 0 16px 0" }}>Alerta Climático / Informativo Emergencial</h3>
                
                <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 14 }}>
                  <label style={{ display: "flex", alignItems: "center", gap: 8, fontFamily: "DM Sans", fontSize: 13, color: "#334155", cursor: "pointer" }}>
                    <input
                      type="checkbox"
                      checked={alertConfig.active}
                      onChange={e => saveAlert({ ...alertConfig, active: e.target.checked })}
                      style={{ width: 16, height: 16, accentColor: "#0DB87E" }}
                    />
                    Ativar alerta emergencial no aplicativo
                  </label>
                  
                  {alertConfig.active && (
                    <div style={{ display: "flex", gap: 6 }}>
                      {(["normal", "medium", "critical"] as AlertConfig["level"][]).map(lvl => {
                        const isSel = alertConfig.level === lvl;
                        const label = lvl === "normal" ? "Informativo" : lvl === "medium" ? "Aviso" : "Urgência (Crítico)";
                        const bg = lvl === "normal" ? "#2B6EE8" : lvl === "medium" ? "#F5A623" : "#E84040";
                        return (
                          <button
                            key={lvl}
                            onClick={() => saveAlert({ ...alertConfig, level: lvl })}
                            style={{
                              background: isSel ? bg : "#F1F5F9",
                              color: isSel ? "white" : "#64748B",
                              border: "none",
                              borderRadius: 6,
                              padding: "4px 10px",
                              fontSize: 11,
                              fontFamily: "DM Sans",
                              fontWeight: 600,
                              cursor: "pointer",
                              transition: "all 0.2s"
                            }}
                          >
                            {label}
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>

                <div style={{ marginBottom: 16 }}>
                  <label>
                    <span style={{ fontFamily: "DM Sans", fontSize: 12, fontWeight: 600, color: "#475569" }}>Mensagem do Alerta</span>
                    <textarea
                      placeholder="Descreva o alerta..."
                      value={alertConfig.message}
                      onChange={e => saveAlert({ ...alertConfig, message: e.target.value })}
                      style={{ width: "100%", height: 60, marginTop: 6, background: "#F1F5F9", border: "1px solid #E2E8F0", borderRadius: 10, padding: 10, fontFamily: "DM Sans", fontSize: 14, outline: "none", resize: "none" }}
                    />
                  </label>
                </div>
              </Card>

              {/* Beach Balneabilidade Card */}
              <Card style={{ padding: 24 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
                  <div>
                    <h3 style={{ fontFamily: "Syne", fontSize: 16, fontWeight: 700, color: "#0F172A", margin: 0 }}>Boletim de Balneabilidade das Praias</h3>
                    <p style={{ fontFamily: "DM Sans", fontSize: 12, color: "#94A3B8", marginTop: 2 }}>Atualize o índice de balneabilidade CETESB de Ubatuba.</p>
                  </div>
                  <Pill bg="rgba(43,110,232,0.08)" color="#2B6EE8" size="sm">Ubatuba Litoral</Pill>
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                  {beaches.map((b) => {
                    const isGood = b.status === "propicia";
                    return (
                      <div key={b.name} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", background: "#F8FAFC", border: "1px solid #E2E8F0", borderRadius: 10, padding: "12px 14px" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                          <Waves size={16} color={isGood ? "#0DB87E" : "#E84040"} />
                          <span style={{ fontFamily: "DM Sans", fontSize: 14, fontWeight: 600, color: "#334155" }}>{b.name}</span>
                        </div>
                        
                        <button
                          onClick={() => toggleBeachStatus(b.name)}
                          style={{
                            background: isGood ? "rgba(13,184,126,0.1)" : "rgba(232,64,64,0.1)",
                            color: isGood ? "#0DB87E" : "#E84040",
                            border: `1px solid ${isGood ? "rgba(13,184,126,0.2)" : "rgba(232,64,64,0.2)"}`,
                            borderRadius: 99,
                            padding: "4px 12px",
                            fontFamily: "DM Sans",
                            fontSize: 11,
                            fontWeight: 600,
                            cursor: "pointer",
                            transition: "all 0.2s"
                          }}
                        >
                          {isGood ? "● Propícia" : "● Imprópria"}
                        </button>
                      </div>
                    );
                  })}
                </div>
              </Card>
            </div>
          )}

          {/* Abas Content: Notícias & Guias */}
          {activeTab === "news" && (
            <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
              {/* Add News Article */}
              <Card style={{ padding: 24 }}>
                <h3 style={{ fontFamily: "Syne", fontSize: 16, fontWeight: 700, color: "#0F172A", margin: "0 0 16px 0" }}>+ Criar Novo Cartão de Dicas / Guias</h3>
                
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, marginBottom: 14 }}>
                  <label>
                    <span style={{ fontFamily: "DM Sans", fontSize: 12, fontWeight: 600, color: "#475569" }}>Título do Guia</span>
                    <input
                      type="text"
                      placeholder="Ex: Como configurar sua chave Pix"
                      value={artTitle}
                      onChange={e => setArtTitle(e.target.value)}
                      style={{ width: "100%", marginTop: 6, background: "#F1F5F9", border: "1px solid #E2E8F0", borderRadius: 10, padding: "10px 14px", fontFamily: "DM Sans", fontSize: 14, outline: "none" }}
                    />
                  </label>
                  <label>
                    <span style={{ fontFamily: "DM Sans", fontSize: 12, fontWeight: 600, color: "#475569" }}>Categoria</span>
                    <select
                      value={artCategory}
                      onChange={e => setArtCategory(e.target.value)}
                      style={{ width: "100%", marginTop: 6, background: "#F1F5F9", border: "1px solid #E2E8F0", borderRadius: 10, padding: "10px 14px", fontFamily: "DM Sans", fontSize: 14, outline: "none", cursor: "pointer" }}
                    >
                      <option value="Dicas">Dicas</option>
                      <option value="Coletivo">Coletivo</option>
                      <option value="Ajuda">Ajuda</option>
                      <option value="Cidade">Ubatuba</option>
                    </select>
                  </label>
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, marginBottom: 20 }}>
                  <label>
                    <span style={{ fontFamily: "DM Sans", fontSize: 12, fontWeight: 600, color: "#475569" }}>Tempo Estimado de Leitura</span>
                    <input
                      type="text"
                      placeholder="Ex: 3 min"
                      value={artReadTime}
                      onChange={e => setArtReadTime(e.target.value)}
                      style={{ width: "100%", marginTop: 6, background: "#F1F5F9", border: "1px solid #E2E8F0", borderRadius: 10, padding: "10px 14px", fontFamily: "DM Sans", fontSize: 14, outline: "none" }}
                    />
                  </label>
                </div>

                <PrimaryButton disabled={!artTitle.trim()} onClick={addArticle} style={{ width: "100%" }}>
                  + Adicionar Informativo ao App
                </PrimaryButton>
              </Card>

              {/* Published News List */}
              <Card style={{ padding: 24 }}>
                <h3 style={{ fontFamily: "Syne", fontSize: 16, fontWeight: 700, color: "#0F172A", margin: "0 0 16px 0" }}>Artigos e Dicas Publicados</h3>
                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                  {news.map((item) => (
                    <div key={item.id} style={{ display: "flex", justifySelf: "stretch", background: "#F8FAFC", border: "1px solid #E2E8F0", borderRadius: 12, padding: 14, alignItems: "center", justifyContent: "space-between" }}>
                      <div style={{ minWidth: 0, flex: 1 }}>
                        <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 4 }}>
                          <span style={{ fontSize: 11, fontFamily: "DM Sans", fontWeight: 700, color: "#0DB87E", textTransform: "uppercase" }}>{item.category}</span>
                          <span style={{ fontSize: 11, color: "#94A3B8" }}>• {item.readTime}</span>
                        </div>
                        <span style={{ fontFamily: "Syne", fontSize: 14, fontWeight: 700, color: "#0F172A", display: "block" }}>{item.title}</span>
                        <span style={{ fontFamily: "DM Sans", fontSize: 11, color: "#94A3B8", marginTop: 2, display: "block" }}>Postado em {item.date}</span>
                      </div>
                      
                      <button
                        onClick={() => removeArticle(item.id)}
                        style={{
                          background: "rgba(232,64,64,0.08)",
                          border: "none",
                          color: "#E84040",
                          fontFamily: "DM Sans",
                          fontSize: 12,
                          fontWeight: 600,
                          borderRadius: 6,
                          padding: "6px 10px",
                          cursor: "pointer",
                          marginLeft: 12
                        }}
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  ))}
                  {news.length === 0 && (
                    <p style={{ fontFamily: "DM Sans", fontSize: 13, color: "#94A3B8", textAlign: "center", padding: "20px 0" }}>Nenhuma notícia criada no momento.</p>
                  )}
                </div>
              </Card>
            </div>
          )}

          {/* Abas Content: Central de Push */}
          {activeTab === "push" && (
            <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
              {/* Sender Card */}
              <Card style={{ padding: 24 }}>
                <h3 style={{ fontFamily: "Syne", fontSize: 16, fontWeight: 700, color: "#0F172A", margin: "0 0 16px 0" }}>Disparador de Notificações Push</h3>
                
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, marginBottom: 14 }}>
                  <label>
                    <span style={{ fontFamily: "DM Sans", fontSize: 12, fontWeight: 600, color: "#475569" }}>Título do Push</span>
                    <input
                      type="text"
                      placeholder="Ex: Prêmio 1/11 Acumulado!"
                      value={pushTitle}
                      onChange={e => setPushTitle(e.target.value)}
                      style={{ width: "100%", marginTop: 6, background: "#F1F5F9", border: "1px solid #E2E8F0", borderRadius: 10, padding: "10px 14px", fontFamily: "DM Sans", fontSize: 14, outline: "none" }}
                    />
                  </label>
                  <label>
                    <span style={{ fontFamily: "DM Sans", fontSize: 12, fontWeight: 600, color: "#475569" }}>Grupo Destinatário</span>
                    <select
                      value={pushGroup}
                      onChange={e => setPushGroup(e.target.value)}
                      style={{ width: "100%", marginTop: 6, background: "#F1F5F9", border: "1px solid #E2E8F0", borderRadius: 10, padding: "10px 14px", fontFamily: "DM Sans", fontSize: 14, outline: "none", cursor: "pointer" }}
                    >
                      <option value="Todos">Todos os Clientes</option>
                      <option value="Tomadores">Somente Tomadores (Passageiros/Clientes)</option>
                      <option value="Prestadores">Somente Prestadores (Trabalhadores)</option>
                    </select>
                  </label>
                </div>

                <div style={{ marginBottom: 20 }}>
                  <label>
                    <span style={{ fontFamily: "DM Sans", fontSize: 12, fontWeight: 600, color: "#475569" }}>Mensagem da Notificação</span>
                    <textarea
                      placeholder="Escreva a notificação que será entregue nos smartphones dos usuários..."
                      value={pushMessage}
                      onChange={e => setPushMessage(e.target.value)}
                      style={{ width: "100%", height: 80, marginTop: 6, background: "#F1F5F9", border: "1px solid #E2E8F0", borderRadius: 10, padding: 12, fontFamily: "DM Sans", fontSize: 14, outline: "none", resize: "none" }}
                    />
                  </label>
                </div>

                <PrimaryButton disabled={!pushTitle || !pushMessage} onClick={sendPush} style={{ width: "100%" }}>
                  <span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}><Send size={14} /> Disparar Notificação Instantânea</span>
                </PrimaryButton>
              </Card>

              {/* Push Log Card */}
              <Card style={{ padding: 24 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
                  <h3 style={{ fontFamily: "Syne", fontSize: 16, fontWeight: 700, color: "#0F172A", margin: 0 }}>Histórico de Notificações Enviadas</h3>
                  {pushLog.length > 0 && (
                    <button onClick={clearPushLog} style={{ background: "none", border: "none", color: "#E84040", fontFamily: "DM Sans", fontSize: 12, fontWeight: 600, cursor: "pointer" }}>
                      Limpar Histórico
                    </button>
                  )}
                </div>

                <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                  {pushLog.map((log) => (
                    <div key={log.id} style={{ borderBottom: "1px solid #F1F5F9", paddingBottom: 12 }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                        <span style={{ fontFamily: "Syne", fontSize: 14, fontWeight: 700, color: "#334155" }}>{log.title}</span>
                        <span style={{ fontSize: 11, color: "#94A3B8", fontFamily: "DM Sans" }}>{log.date}</span>
                      </div>
                      <p style={{ fontFamily: "DM Sans", fontSize: 13, color: "#64748B", margin: "0 0 6px 0" }}>{log.message}</p>
                      <div style={{ display: "flex", gap: 8 }}>
                        <Pill bg="rgba(43,110,232,0.06)" color="#2B6EE8" size="sm">Grupo: {log.group}</Pill>
                        <Pill bg="rgba(13,184,126,0.06)" color="#0DB87E" size="sm">Entregue: {log.count} aparelhos</Pill>
                      </div>
                    </div>
                  ))}
                  {pushLog.length === 0 && (
                    <p style={{ fontFamily: "DM Sans", fontSize: 13, color: "#94A3B8", textAlign: "center", padding: "10px 0" }}>Nenhuma notificação enviada recentemente.</p>
                  )}
                </div>
              </Card>
            </div>
          )}
        </div>

        {/* Right Side: Interactive Mobile Device Live Simulator */}
        <div>
          {/* Section Header */}
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
            <Smartphone size={18} color="#0F172A" />
            <span style={{ fontFamily: "Syne", fontSize: 15, fontWeight: 700, color: "#0F172A" }}>Visualização do Superapp</span>
            <span style={{ animation: "ubt-blink 1.5s ease infinite", width: 6, height: 6, borderRadius: 999, background: "#0DB87E", marginLeft: 4 }} />
          </div>

          {/* Smartphone Container */}
          <div
            style={{
              width: "100%",
              maxWidth: 320,
              height: 560,
              background: "#080F25",
              borderRadius: 36,
              border: "10px solid #1E293B",
              boxShadow: "0 20px 45px rgba(15, 23, 42, 0.25)",
              position: "relative",
              overflow: "hidden",
              margin: "0 auto",
              display: "flex",
              flexDirection: "column"
            }}
          >
            {/* Camera notch */}
            <div style={{ position: "absolute", top: 0, left: "50%", transform: "translateX(-50%)", width: 90, height: 16, background: "#1E293B", borderRadius: "0 0 10px 10px", zIndex: 100 }} />
            
            {/* Status bar */}
            <div style={{ height: 26, background: "#0A1128", display: "flex", justifyContent: "space-between", padding: "8px 16px 0 16px", fontSize: 9, fontFamily: "DM Sans", color: "rgba(255,255,255,0.4)", zIndex: 90, flexShrink: 0 }}>
              <span>11:22</span>
              <div style={{ display: "flex", gap: 4 }}>
                <span>4G</span>
                <span>87%</span>
              </div>
            </div>

            {/* Inner Mobile Scroll Area */}
            <div style={{ flex: 1, overflowY: "auto", padding: "12px 14px", display: "flex", flexDirection: "column", gap: 14 }} className="no-scrollbar">
              
              {/* Emergency Alert (Live from alertConfig) */}
              {alertConfig.active && alertConfig.message.trim() && (
                <div
                  style={{
                    background: alertConfig.level === "critical" ? "rgba(232, 64, 64, 0.15)" : alertConfig.level === "medium" ? "rgba(245, 166, 35, 0.15)" : "rgba(43, 110, 232, 0.15)",
                    border: `1.5px solid ${alertConfig.level === "critical" ? "#E84040" : alertConfig.level === "medium" ? "#F5A623" : "#2B6EE8"}`,
                    borderRadius: 12,
                    padding: "8px 10px",
                    display: "flex",
                    gap: 6,
                    alignItems: "flex-start",
                    animation: alertConfig.level === "critical" ? "ubt-alert-pulse 2s infinite" : "none"
                  }}
                >
                  <AlertTriangle size={13} color={alertConfig.level === "critical" ? "#E84040" : alertConfig.level === "medium" ? "#F5A623" : "#2B6EE8"} style={{ flexShrink: 0, marginTop: 1 }} />
                  <span style={{ fontFamily: "DM Sans", fontSize: 10.5, color: "white", lineHeight: 1.3 }}>
                    {alertConfig.message}
                  </span>
                </div>
              )}

              {/* Client App Header Header Mock */}
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div>
                  <h4 style={{ fontFamily: "Syne", fontSize: 14, fontWeight: 700, color: "white", margin: 0 }}>Olá, Visitante 👋</h4>
                  <span style={{ fontFamily: "DM Sans", fontSize: 10, color: "rgba(255,255,255,0.4)" }}>Ubatuba, SP</span>
                </div>
                <div style={{ width: 24, height: 24, borderRadius: 999, background: "rgba(13,184,126,0.15)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 9, fontWeight: 700, color: "#0DB87E" }}>
                  VT
                </div>
              </div>

              {/* Banners Hero Slider Carrossel */}
              {activeBanners.length > 0 ? (
                <div style={{ position: "relative" }}>
                  {activeBanners.map((b, idx) => {
                    if (idx !== activeSlideIdx && activeBanners.length > 1) return null;
                    return (
                      <div
                        key={b.id}
                        style={{
                          background: GRADIENTS[b.bg],
                          borderRadius: 14,
                          padding: 14,
                          minHeight: 100,
                          display: "flex",
                          flexDirection: "column",
                          justifyContent: "space-between",
                          transition: "all 0.3s ease"
                        }}
                      >
                        <div>
                          <h4 style={{ fontFamily: "Syne", fontSize: 12, fontWeight: 800, color: "white", margin: 0 }}>{b.title}</h4>
                          <p style={{ fontFamily: "DM Sans", fontSize: 9.5, color: "rgba(255,255,255,0.75)", margin: "4px 0 0 0", lineHeight: 1.3 }}>{b.subtitle}</p>
                        </div>
                        <button
                          style={{
                            alignSelf: "flex-start",
                            marginTop: 10,
                            background: "white",
                            color: "#0F172A",
                            border: "none",
                            borderRadius: 6,
                            padding: "4px 10px",
                            fontFamily: "DM Sans",
                            fontSize: 9,
                            fontWeight: 700,
                            cursor: "pointer"
                          }}
                        >
                          {b.ctaText}
                        </button>
                      </div>
                    );
                  })}
                  {/* Slider controls indicators */}
                  {activeBanners.length > 1 && (
                    <div style={{ display: "flex", gap: 4, position: "absolute", bottom: 8, right: 12 }}>
                      {activeBanners.map((_, i) => (
                        <button
                          key={i}
                          onClick={() => setActiveSlideIdx(i)}
                          style={{
                            width: i === activeSlideIdx ? 12 : 5,
                            height: 5,
                            borderRadius: 99,
                            background: i === activeSlideIdx ? "white" : "rgba(255,255,255,0.4)",
                            border: "none",
                            padding: 0,
                            cursor: "pointer",
                            transition: "all 0.2s"
                          }}
                        />
                      ))}
                    </div>
                  )}
                </div>
              ) : (
                <div style={{ background: "rgba(255,255,255,0.03)", border: "1px dashed rgba(255,255,255,0.1)", borderRadius: 14, padding: 20, textAlign: "center" }}>
                  <span style={{ fontFamily: "DM Sans", fontSize: 11, color: "rgba(255,255,255,0.3)" }}>Carrossel de banners vazio</span>
                </div>
              )}

              {/* Beach quality widgets (CETESB flags) */}
              <div>
                <span style={{ fontFamily: "DM Sans", fontSize: 9, fontWeight: 700, color: "rgba(255,255,255,0.35)", uppercase: "true", letterSpacing: 0.5 }}>
                  BOLETIM DE PRAIAS (CETESB)
                </span>
                
                <div style={{ display: "flex", gap: 6, overflowX: "auto", marginTop: 6, paddingBottom: 4 }} className="no-scrollbar">
                  {beaches.map((b) => {
                    const isGood = b.status === "propicia";
                    return (
                      <div
                        key={b.name}
                        style={{
                          background: "rgba(255,255,255,0.04)",
                          border: "1px solid rgba(255,255,255,0.06)",
                          borderRadius: 8,
                          padding: "6px 8px",
                          flexShrink: 0,
                          display: "flex",
                          alignItems: "center",
                          gap: 6
                        }}
                      >
                        <span style={{ width: 6, height: 6, borderRadius: 99, background: isGood ? "#0DB87E" : "#E84040" }} />
                        <span style={{ fontFamily: "DM Sans", fontSize: 9.5, color: "rgba(255,255,255,0.8)", fontWeight: 500 }}>{b.name.replace("Praia do ", "").replace("Praia ", "")}</span>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Services Mock grid */}
              <div>
                <span style={{ fontFamily: "DM Sans", fontSize: 9, fontWeight: 700, color: "rgba(255,255,255,0.35)", uppercase: "true", letterSpacing: 0.5 }}>
                  SERVIÇOS
                </span>
                
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 6, marginTop: 6 }}>
                  {[
                    { label: "Mototaxi", icon: Sparkles },
                    { label: "Ambulantes", icon: Waves },
                    { label: "Diaristas", icon: Sparkles }
                  ].map((s, idx) => (
                    <div key={idx} style={{ background: "rgba(255,255,255,0.05)", borderRadius: 10, padding: 8, display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
                      <div style={{ width: 22, height: 22, borderRadius: 6, background: "rgba(13,184,126,0.12)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                        <s.icon size={11} color="#0DB87E" />
                      </div>
                      <span style={{ fontFamily: "DM Sans", fontSize: 8.5, color: "rgba(255,255,255,0.8)" }}>{s.label}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Learn / Articles Mock list (Notícias e Dicas) */}
              <div>
                <span style={{ fontFamily: "DM Sans", fontSize: 9, fontWeight: 700, color: "rgba(255,255,255,0.35)", uppercase: "true", letterSpacing: 0.5 }}>
                  DICAS E INFORMATIVOS
                </span>
                
                <div style={{ display: "flex", flexDirection: "column", gap: 6, marginTop: 6 }}>
                  {news.map((item) => (
                    <div
                      key={item.id}
                      style={{
                        background: "rgba(255,255,255,0.04)",
                        border: "1px solid rgba(255,255,255,0.06)",
                        borderRadius: 10,
                        padding: 10
                      }}
                    >
                      <div style={{ display: "flex", justifySelf: "stretch", justifyContent: "space-between", alignItems: "center", marginBottom: 3 }}>
                        <span style={{ fontSize: 7.5, fontFamily: "DM Sans", fontWeight: 700, color: "#0DB87E", textTransform: "uppercase" }}>{item.category}</span>
                        <span style={{ fontSize: 7.5, color: "rgba(255,255,255,0.3)" }}>{item.readTime}</span>
                      </div>
                      <span style={{ fontFamily: "Syne", fontSize: 10, fontWeight: 700, color: "white", display: "block" }}>{item.title}</span>
                    </div>
                  ))}
                  {news.length === 0 && (
                    <p style={{ fontFamily: "DM Sans", fontSize: 9, color: "rgba(255,255,255,0.3)", textAlign: "center", padding: "10px 0" }}>Boletim de notícias vazio.</p>
                  )}
                </div>
              </div>
            </div>
            
            {/* Phone bottom bar navigation mockup */}
            <div style={{ height: 48, background: "#0A1128", borderTop: "1px solid rgba(255,255,255,0.05)", display: "flex", alignItems: "center", justifySelf: "stretch", zIndex: 90, flexShrink: 0 }}>
              {["Início", "Carteira", "Suporte", "Ajustes"].map((n, idx) => (
                <div key={idx} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 2, cursor: "pointer" }}>
                  <div style={{ width: 4, height: 4, borderRadius: 99, background: idx === 0 ? "#0DB87E" : "transparent" }} />
                  <span style={{ fontFamily: "DM Sans", fontSize: 8, color: idx === 0 ? "#0DB87E" : "rgba(255,255,255,0.3)" }}>{n}</span>
                </div>
              ))}
            </div>
          </div>
          
          {/* Instructions note */}
          <div style={{ marginTop: 14, textAlign: "center" }}>
            <span style={{ fontFamily: "DM Sans", fontSize: 11, color: "#94A3B8" }}>
              💡 Altere as abas de Banners e Boletins para ver o celular atualizar.
            </span>
          </div>
        </div>
        
      </div>
      
      {/* Styles for animations */}
      <style>{`
        @keyframes ubt-alert-pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.8; }
        }
        @keyframes ubt-blink {
          0%, 100% { opacity: 1; transform: scale(1); }
          50% { opacity: 0.4; transform: scale(0.9); }
        }
      `}</style>
    </div>
  );
}
