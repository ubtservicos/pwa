import { useEffect, useState, useRef } from "react";
import { 
  Play, 
  X, 
  ChevronDown, 
  Check, 
  CheckCircle2, 
  Heart, 
  Award, 
  HelpCircle,
  Volume2, 
  VolumeX, 
  Send,
  ShieldCheck,
  Instagram,
  Facebook,
  MessageSquare,
  Bike,
  MapPin,
  ArrowRight,
  Users,
  Share2,
  Menu,
  UserPlus
} from "lucide-react";
import { trackEvent } from "@/services/AnalyticsService";
import { logSystem } from "@/services/LoggingService";
import { supabase } from "@/lib/supabase";
import { usePwaInstall } from "@/hooks/usePwaInstall";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { maskPhone } from "@/utils/masks";

interface FaqItemProps {
  question: string;
  answer: string;
}

const FAQ_ITEMS = [
  {
    question: "O que é a UBT?",
    answer: "A UBT é um ecossistema digital e superapp construído especificamente para fortalecer a economia local de Ubatuba. Conectamos prestadores de serviço locais (como diaristas, mototaxistas e ambulantes) diretamente aos consumidores e turistas, com taxas muito menores do que as grandes corporações e com um modelo revolucionário de cashback e repasse social."
  },
  {
    question: "Quando será lançada?",
    answer: "A primeira fase de testes e cadastro dos Fundadores está ativa agora. O lançamento público oficial da plataforma e dos aplicativos na App Store e Google Play está programado para o final deste ano."
  },
  {
    question: "Como funciona?",
    answer: "Os consumidores buscam, contratam e pagam serviços diretamente pelo aplicativo da UBT. O pagamento é processado com total segurança. A grande diferença é a distribuição de benefícios: a cada transação, percentuais do valor são distribuídos para impulsionar a comunidade (programa de indicações, prêmios e fundo das associações)."
  },
  {
    question: "Quanto custa?",
    answer: "O cadastro e a utilização do aplicativo são totalmente gratuitos para os consumidores. Para os prestadores de serviço, as taxas são as menores do mercado (até 70% menores que os apps corporativos tradicionais), destinadas exclusivamente à manutenção e distribuição de benefícios locais."
  },
  {
    question: "Como participar?",
    answer: "Inscreva-se hoje mesmo no Programa Fundadores preenchendo o formulário ao final desta página. Você receberá acesso prioritário ao aplicativo e convites exclusivos para as reuniões comunitárias de desenvolvimento."
  },
  {
    question: "Como indicar pessoas?",
    answer: "Ao se cadastrar na UBT, você recebe um link exclusivo de padrinho ou madrinha. Você pode enviar este link pelo WhatsApp ou gerar um QR Code. Sempre que novos usuários ou prestadores se cadastrarem com seu link, sua rede de indicações é registrada."
  },
  {
    question: "Como funciona o Programa Padrinho/Madrinha?",
    answer: "Para incentivar a colaboração orgânica, até 1% do valor de todas as transações realizadas pelos prestadores que você indicou é revertido diretamente para você como bônus de indicação, promovendo o crescimento mútuo na rede."
  },
  {
    question: "Como funcionam os prêmios?",
    answer: "Destinamos 1% do volume de vendas para o Fundo Trabalhador (com sorteio anual no dia 01 de maio) e 1% para o Fundo Consumidor (com sorteio anual no dia 01 de novembro). Todos os usuários ativos na plataforma concorrem automaticamente, gerando um ecossistema de incentivo à fidelidade local."
  },
  {
    question: "Como funciona a Côco & Cia?",
    answer: "Integrada ao superapp, a Côco & Cia é nossa vertical ecológica. Pelo mapa interactivo, qualquer morador ou turista pode marcar onde deixou recicláveis limpos nas praias ou residências. Nossa equipe dedicada de catadores parceiros recebe a notificação e faz a coleta rápida, unindo tecnologia à preservação do nosso ecossistema."
  }
];

function FaqItem({ question, answer }: FaqItemProps) {
  const [isOpen, setIsOpen] = useState(false);
  return (
    <div className="border-b border-white/5 py-5 transition-all">
      <button 
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex justify-between items-center text-left py-2 font-display font-bold text-lg hover:text-green transition-colors"
      >
        <span>{question}</span>
        <ChevronDown className={`w-5 h-5 transition-transform duration-300 ${isOpen ? "rotate-180 text-green" : "text-white/40"}`} />
      </button>
      <div className={`overflow-hidden transition-all duration-300 ${isOpen ? "max-h-[300px] mt-3 opacity-100" : "max-h-0 opacity-0"}`}>
        <p className="text-sm text-white/70 leading-relaxed font-sans pb-4">
          {answer}
        </p>
      </div>
    </div>
  );
}

// Particle structure for the canvas orchestrator
interface KineticParticle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  alpha: number;
  color: string;
}

// Helper functions for waitlist database anonymized fingerprinting
async function sha256(message: string): Promise<string> {
  try {
    const msgBuffer = new TextEncoder().encode(message);
    const hashBuffer = await crypto.subtle.digest("SHA-256", msgBuffer);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
  } catch (e) {
    let hash = 0;
    for (let i = 0; i < message.length; i++) {
      hash = (hash << 5) - hash + message.charCodeAt(i);
      hash |= 0;
    }
    return "fb_" + Math.abs(hash).toString(16) + Math.random().toString(36).substring(2, 10);
  }
}

function parseUserAgent(userAgent: string) {
  let device_type = "Desktop";
  if (/mobile/i.test(userAgent)) device_type = "Mobile";
  if (/tablet/i.test(userAgent)) device_type = "Tablet";
  
  let browser = "Outro";
  if (/chrome|crios/i.test(userAgent)) browser = "Chrome";
  else if (/firefox|fxios/i.test(userAgent)) browser = "Firefox";
  else if (/safari/i.test(userAgent) && !/chrome/i.test(userAgent)) browser = "Safari";
  else if (/edge|edg/i.test(userAgent)) browser = "Edge";
  
  let os = "Outro";
  if (/iphone|ipad|ipod/i.test(userAgent)) os = "iOS";
  else if (/windows/i.test(userAgent)) os = "Windows";
  else if (/macintosh|mac os x/i.test(userAgent)) os = "MacOS";
  else if (/android/i.test(userAgent)) os = "Android";

  return { device_type, browser, os };
}

const BAIRROS_LIST = [
  "Centro", "Itaguá", "Perequê-Açu", "Toninhas", "Praia Grande",
  "Estufa I", "Estufa II", "Ipiranguinha", "Mato Dentro", "Marafunda"
];

const PRAIAS_LIST = [
  "Praia Grande", "Tenório", "Toninhas", "Enseada", "Lázaro",
  "Perequê-Açu", "Vermelha do Norte", "Itamambuca", "Ubatumirim", "Felix"
];

const waitlistSchema = z.object({
  nome: z.string().min(3, "Mínimo 3 caracteres"),
  email: z.string().email("E-mail inválido"),
  telefone: z.string().min(10, "Telefone incompleto"),
  perfil: z.array(z.string()).min(1, "Selecione ao menos um perfil"),
  possuiContaMercadoPago: z.boolean({
    required_error: "Por favor, responda esta pergunta."
  }),
  regiao_atuacao: z.array(z.string()).optional().default([]),
  praias: z.array(z.string()).optional().default([]),
  bairros: z.array(z.string()).optional().default([]),
  acceptTerms: z.boolean().refine(v => v === true, "Você deve aceitar os termos"),
}).superRefine((data, ctx) => {
  const p = data.perfil || [];

  if (p.includes("associacao") || p.includes("mototaxista") || p.includes("diarista")) {
    if (!data.regiao_atuacao || data.regiao_atuacao.length === 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Selecione pelo menos uma região de atuação",
        path: ["regiao_atuacao"],
      });
    }
  }

  if (p.includes("ambulante")) {
    if (!data.praias || data.praias.length === 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Selecione pelo menos uma praia de atuação",
        path: ["praias"],
      });
    }
  }

  if (p.includes("morador")) {
    if (!data.bairros || data.bairros.length === 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Selecione o bairro de residência",
        path: ["bairros"],
      });
    }
    if (!data.praias || data.praias.length === 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Selecione pelo menos uma praia que costuma frequentar",
        path: ["praias"],
      });
    }
  }

  if (p.includes("turista")) {
    if (!data.bairros || data.bairros.length === 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Selecione o bairro que costuma se hospedar",
        path: ["bairros"],
      });
    }
    if (!data.praias || data.praias.length === 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Selecione pelo menos uma praia que costuma frequentar",
        path: ["praias"],
      });
    }
  }
});

type WaitlistFormData = z.infer<typeof waitlistSchema>;

export default function Index() {
  const { showInstallBtn, isStandalone, isIOS, hasNativePrompt, install } = usePwaInstall();
  const [showIosGuide, setShowIosGuide] = useState(false);
  const [showGenericGuide, setShowGenericGuide] = useState(false);
  const [isBannerDismissed, setIsBannerDismissed] = useState(false);

  const handlePwaInstallClick = async () => {
    trackEvent("pwa_install_click", "engagement");
    if (isIOS) {
      setShowIosGuide(true);
      return;
    }
    if (!hasNativePrompt) {
      setShowGenericGuide(true);
      return;
    }
    const outcome = await install();
    trackEvent("pwa_install_prompt_outcome", "engagement", { outcome });
  };

  const [isVideoModalOpen, setIsVideoModalOpen] = useState(false);
  const [activeVideoChapter, setActiveVideoChapter] = useState(0);
  const [activeChapter, setActiveChapter] = useState(0); // 0: Paraíso, 1: Quem Faz, 2: Conecta, 3: Ganham, 4: Fundador, 5: Iluminada
  const [isMuted, setIsMuted] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  
  // Waitlist Form States
  const [submitSuccess, setSubmitSuccess] = useState(false);
  const [submitError, setSubmitError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Modals for selection
  const [isBairroModalOpen, setIsBairroModalOpen] = useState(false);
  const [isPraiaModalOpen, setIsPraiaModalOpen] = useState(false);

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors },
  } = useForm<WaitlistFormData>({
    resolver: zodResolver(waitlistSchema),
    defaultValues: {
      nome: "",
      telefone: "",
      email: "",
      perfil: [],
      regiao_atuacao: [],
      praias: [],
      bairros: [],
      acceptTerms: false,
    },
  });

  const perfil = watch("perfil");
  const selectedBairros = watch("bairros") || [];
  const selectedPraias = watch("praias") || [];

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);

  // Live transactions mock for Chapter 3
  const [simulatedTransactions, setSimulatedTransactions] = useState([
    { id: 1, text: "Corrida iniciada em Itaguá", value: "Mototáxi", badge: "Ativo" },
    { id: 2, text: "Diarista contratada em Perequê-Açu", value: "Diaristas", badge: "Sucesso" },
    { id: 3, text: "1.2kg recicláveis marcados em Praia Grande", value: "Côco & Cia", badge: "Reciclagem" }
  ]);

  const VIDEO_PLAYLIST = [
    { title: "O Amanhecer em Ubatuba", file: "Cena02.mp4", description: "O sol nasce na baía litorânea sinalizando um novo dia na economia caiçara." },
    { title: "Serviço de Mototáxi", file: "Cena02.mp4", description: "Mobilidade e agilidade conectando a cidade com segurança." },
    { title: "Diaristas Locais", file: "Cena03.mp4", description: "Acolhimento e dedicação com dignidade e valorização do trabalho doméstico." },
    { title: "Momento Família na Praia", file: "Cena04.mp4", description: "Moradores e turistas vivenciando o lazer e o bem-estar do paraíso natural." },
    { title: "Ambulante de Coco", file: "Cena05.mp4", description: "A transação ágil da água de coco que fomenta a circulação de capital na orla." },
    { title: "Côco & Cia: Reciclagem", file: "Cena06.mp4", description: "Coleta sustentável e gestão inteligente de resíduos para manter Ubatuba limpa." },
    { title: "Treinamento na Associação", file: "Cena07.mp4", description: "A força coletiva e o suporte de rede oferecido pelas associações de moradores." },
    { title: "Golden Hour na Enseada", file: "Cena08.mp4", description: "O cair da tarde com a tonalidade quente e aconchegante sobre a costa." },
    { title: "O Retorno ao Lar", file: "Cena09.mp4", description: "A satisfação de voltar para casa após um dia de trabalho produtivo." },
    { title: "Notificação de Prêmios", file: "Cena10.mp4", description: "A distribuição transparente de incentivos e retorno financeiro." },
    { title: "Expansão da Rede", file: "Cena12.mp4", description: "A visualização de conexões e crescimento coletivo no mapa da cidade." },
    { title: "Fogueira de Encerramento", file: "Cena13.mp4", description: "A união dos fundadores celebrando o futuro sustentável da UBT." }
  ];

  // Dynamic Ambient Canvas Animation Orchestrator
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let animFrame: number;
    let width = (canvas.width = window.innerWidth);
    let height = (canvas.height = window.innerHeight);

    const handleResize = () => {
      width = canvas.width = window.innerWidth;
      height = canvas.height = window.innerHeight;
    };
    window.addEventListener("resize", handleResize);

    const particles: KineticParticle[] = [];
    const spawnCount = 45;

    const setupParticles = (chapterIndex: number) => {
      particles.length = 0;
      for (let i = 0; i < spawnCount; i++) {
        let x = Math.random() * width;
        let y = Math.random() * height;
        let vx = (Math.random() - 0.5) * 0.25;
        let vy = (Math.random() - 0.5) * 0.25;
        let size = Math.random() * 2.5 + 1;
        let alpha = Math.random() * 0.4 + 0.1;
        let color = "rgba(13, 184, 126, 0.3)"; // default green

        if (chapterIndex === 0) { // Hero - Blue/Green/White soft particles
          const rand = Math.random();
          color = rand < 0.45 ? "rgba(43, 110, 232, 0.25)" : rand < 0.9 ? "rgba(13, 184, 126, 0.25)" : "rgba(255, 255, 255, 0.2)";
          vy = -Math.random() * 0.25 - 0.05;
          vx = (Math.random() - 0.5) * 0.05;
        } else if (chapterIndex === 1) { // Quem Faz - Sea waves / wind flow
          color = "rgba(255, 255, 255, 0.15)";
          vx = Math.random() * 0.5 + 0.2;
          vy = Math.sin(x / 50) * 0.1;
        } else if (chapterIndex === 2) { // Conecta - Blue glowing constellation connections
          color = "rgba(43, 110, 232, 0.35)";
          vx = (Math.random() - 0.5) * 0.4;
          vy = (Math.random() - 0.5) * 0.4;
        } else if (chapterIndex === 3) { // Ganham - Floating green leaves
          color = "rgba(13, 184, 126, 0.25)";
          vy = Math.random() * 0.2 + 0.1;
          vx = (Math.random() - 0.5) * 0.2;
        } else if (chapterIndex === 4) { // Fundadores - Fire Sparks rising
          color = "rgba(232, 64, 64, 0.4)";
          vy = -Math.random() * 0.7 - 0.3;
          vx = (Math.random() - 0.5) * 0.3;
        } else if (chapterIndex === 5) { // Iluminada - Soft twinkling stars
          color = "rgba(255, 255, 255, 0.4)";
          vx = 0;
          vy = 0;
          alpha = Math.random() * 0.7;
        }

        particles.push({ x, y, vx, vy, size, alpha, color });
      }
    };

    setupParticles(activeChapter);

    const render = () => {
      ctx.clearRect(0, 0, width, height);

      // Chapter-specific background gradients
      if (activeChapter === 0) { // Hero - Tech Blue/Green radial gradient (no orange/amber)
        const grad = ctx.createRadialGradient(width * 0.5, height * 0.4, 0, width * 0.5, height * 0.4, Math.min(width, height) * 0.5);
        grad.addColorStop(0, "rgba(43, 110, 232, 0.09)");
        grad.addColorStop(0.5, "rgba(13, 184, 126, 0.04)");
        grad.addColorStop(1, "rgba(0,0,0,0)");
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.arc(width * 0.5, height * 0.4, Math.min(width, height) * 0.5, 0, Math.PI * 2);
        ctx.fill();
      } else if (activeChapter === 2) { // Conecta - constellation lines
        ctx.strokeStyle = "rgba(43, 110, 232, 0.05)";
        ctx.lineWidth = 1;
        for (let i = 0; i < particles.length; i++) {
          for (let j = i + 1; j < particles.length; j++) {
            const dist = Math.hypot(particles[i].x - particles[j].x, particles[i].y - particles[j].y);
            if (dist < 120) {
              ctx.beginPath();
              ctx.moveTo(particles[i].x, particles[i].y);
              ctx.lineTo(particles[j].x, particles[j].y);
              ctx.stroke();
            }
          }
        }
      }

      // Draw particles
      for (const p of particles) {
        ctx.save();
        ctx.globalAlpha = p.alpha;
        ctx.fillStyle = p.color;

        ctx.beginPath();
        if (activeChapter === 1) { // lines for waves
          ctx.arc(p.x, p.y + Math.sin(p.x / 40) * 8, p.size, 0, Math.PI * 2);
        } else {
          ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        }
        ctx.fill();
        ctx.restore();

        p.x += p.vx;
        p.y += p.vy;

        // wrap around boundaries
        if (p.x < 0) p.x = width;
        if (p.x > width) p.x = 0;
        if (p.y < 0) p.y = height;
        if (p.y > height) p.y = 0;

        // Twinkle stars on Chapter 5
        if (activeChapter === 5) {
          p.alpha += (Math.random() - 0.5) * 0.05;
          p.alpha = Math.max(0.1, Math.min(0.8, p.alpha));
        }
      }

      animFrame = requestAnimationFrame(render);
    };

    render();

    return () => {
      window.removeEventListener("resize", handleResize);
      cancelAnimationFrame(animFrame);
    };
  }, [activeChapter]);

  // Section Observer to trigger dynamic background chapter changes
  useEffect(() => {
    const sectionsMapping = [
      { id: "hero-cap", index: 0 },
      { id: "quem-faz-cap", index: 1 },
      { id: "conecta-cap", index: 2 },
      { id: "todos-ganham-cap", index: 3 },
      { id: "fundadores-cap", index: 4 },
      { id: "cadastro-fundadores-cap", index: 4 },
      { id: "iluminada-cap", index: 5 }
    ];

    const observerOptions = {
      root: null,
      threshold: 0.25
    };

    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          const matched = sectionsMapping.find(s => s.id === entry.target.id);
          if (matched) {
            setActiveChapter(matched.index);
            trackEvent("landing_chapter_scrolled", "ux", { chapter: matched.index });
          }
        }
      });
    }, observerOptions);

    sectionsMapping.forEach((sec) => {
      const el = document.getElementById(sec.id);
      if (el) observer.observe(el);
    });

    return () => {
      observer.disconnect();
    };
  }, []);

  // Interval simulation for Live Transactions in Chapter 3
  useEffect(() => {
    const list = [
      "Corrida iniciada em Itaguá",
      "Diarista contratada em Perequê-Açu",
      "1.2kg recicláveis marcados em Praia Grande",
      "Ambulante ativado em Tenório",
      "Novo padrinho registrado (+1% de repasse)",
      "Coleta finalizada em Toninhas",
      "Prêmio Consumidor acumulado: R$ 421.00",
      "Split financeiro: 2% transferido para Associação"
    ];
    const verticals = ["Mototáxi", "Diaristas", "Côco & Cia", "Ambulantes", "Financeiro"];
    const badges = ["Ativo", "Sucesso", "Reciclagem", "Indicação", "Split"];

    const interval = setInterval(() => {
      setSimulatedTransactions((prev) => {
        const nextText = list[Math.floor(Math.random() * list.length)];
        const nextVert = verticals[Math.floor(Math.random() * verticals.length)];
        const nextBadge = badges[Math.floor(Math.random() * badges.length)];
        const newItem = {
          id: Date.now(),
          text: nextText,
          value: nextVert,
          badge: nextBadge
        };
        return [newItem, prev[0], prev[1]];
      });
    }, 4500);

    return () => clearInterval(interval);
  }, []);

  const openVideoModal = (chapterIndex: number) => {
    setActiveVideoChapter(chapterIndex);
    setIsVideoModalOpen(true);
    trackEvent("landing_video_open", "marketing", { chapter: chapterIndex });
  };

  const closeVideoModal = () => {
    setIsVideoModalOpen(false);
    trackEvent("landing_video_close", "marketing");
  };

  const handleChapterSelect = (index: number) => {
    setActiveVideoChapter(index);
    trackEvent("landing_video_chapter_change", "marketing", { chapter: index });
  };

  const toggleMute = () => {
    if (videoRef.current) {
      videoRef.current.muted = !videoRef.current.muted;
      setIsMuted(videoRef.current.muted);
    }
  };

  const onSubmit = async (values: WaitlistFormData) => {
    setIsSubmitting(true);
    setSubmitError("");

    try {
      const { data: existing, error: checkError } = await supabase
        .from("waitlist")
        .select("id")
        .eq("email", values.email.trim())
        .maybeSingle();

      if (checkError) throw checkError;

      if (existing) {
        setSubmitError("Este e-mail já está cadastrado na nossa fila de fundadores!");
        setIsSubmitting(false);
        return;
      }

      const createdLocal = new Date().toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" });

      const ua = navigator.userAgent;
      const lang = navigator.language || "pt-BR";
      const screenRes = `${window.screen.width}x${window.screen.height}`;
      const seed = `${ua}-${lang}-${screenRes}`;
      const ipHashVal = await sha256(seed);
      const parsedUA = parseUserAgent(ua);

      const obsParts = [];
      obsParts.push(`Mercado Pago: ${values.possuiContaMercadoPago ? 'Sim' : 'Não'}`);
      if (values.regiao_atuacao && values.regiao_atuacao.length > 0) {
        obsParts.push(`Regiao: ${values.regiao_atuacao.join(", ")}`);
      }
      if (values.praias && values.praias.length > 0) {
        obsParts.push(`Praias: ${values.praias.join(", ")}`);
      }
      if (values.bairros && values.bairros.length > 0) {
        obsParts.push(`Bairros: ${values.bairros.join(", ")}`);
      }
      const obsText = obsParts.join(" | ");

      const { error: insertError } = await supabase
        .from("waitlist")
        .insert({
          nome: values.nome.trim(),
          email: values.email.trim(),
          telefone: values.telefone.trim(),
          cidade: "Ubatuba",
          perfil: values.perfil,
          consentimento_lgpd: true,
          status: "novo",
          created_at_local: createdLocal,
          origem: "direto",
          ip_hash: ipHashVal,
          device_type: parsedUA.device_type,
          browser: parsedUA.browser,
          os: parsedUA.os,
          bairro_moradia: values.bairros.length > 0 ? values.bairros.join(", ") : null,
          bairro_trabalho: values.regiao_atuacao.length > 0 ? values.regiao_atuacao.join(", ") : null,
          observacoes: obsText
        });

      if (insertError) throw insertError;

      setSubmitSuccess(true);
      trackEvent("landing_waitlist_success", "marketing", { perfil: values.perfil });
      logSystem("INFO", "WAITLIST", "founder_signup_success", "success");

    } catch (err: any) {
      console.error("Erro ao registrar no Supabase:", err);
      setSubmitError("Ocorreu um erro ao processar o seu cadastro. Por favor, tente novamente.");
      logSystem("ERROR", "WAITLIST", "founder_signup_error", err.message || "Insert failed");
    } finally {
      setIsSubmitting(false);
    }
  };

  const scrollToCta = () => {
    document.getElementById("fundadores-cap")?.scrollIntoView({ behavior: "smooth" });
    trackEvent("landing_cta_click", "marketing");
  };

  return (
    <div className="min-h-screen bg-[#09090B] text-white font-sans overflow-x-hidden selection:bg-green selection:text-navy">
      
      {/* Background Interactive Particles Overlay */}
      <canvas ref={canvasRef} className="fixed inset-0 z-0 pointer-events-none opacity-60" />

      {/* Screen rays overlay transitions */}
      <div className={`fixed inset-0 pointer-events-none z-10 transition-opacity duration-1000 ${activeChapter === 0 ? "opacity-30" : "opacity-0"}`}
           style={{ backgroundImage: "radial-gradient(ellipse at 50% 50%, rgba(43, 110, 232, 0.1) 0%, transparent 60%)" }} />

      {/* GLASSMORPHIC NAVBAR */}
      <nav className="fixed top-0 left-0 right-0 h-20 bg-black/40 backdrop-blur-xl border-b border-white/5 z-50 flex items-center justify-between px-6 md:px-12 transition-all">
        <div className="flex items-center gap-3 cursor-pointer" onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}>
          <img 
            src="/logo-02.png" 
            alt="UBT Logotipo Oficial" 
            className="h-9 sm:h-11 w-auto object-contain active:scale-95 transition-transform"
          />
          <span className="text-[9px] sm:text-[10px] font-mono text-white/50 leading-none uppercase tracking-wider max-w-[110px] ml-1 select-none">
            Unindo Brasil & Tecnologia
          </span>
        </div>

        {/* Menu Navigation & Hamburger */}
        <div className="flex items-center gap-4">
          <div className="hidden md:flex items-center gap-8 text-xs font-semibold text-white/60 tracking-wider uppercase">
            <a href="#quem-faz-cap" className="hover:text-green transition-colors">Quem Faz</a>
            <a href="#conecta-cap" className="hover:text-green transition-colors">Conexões</a>
            <a href="#todos-ganham-cap" className="hover:text-green transition-colors">Prêmios</a>
            <a href="#faq-section" className="hover:text-green transition-colors">FAQ</a>
          </div>
          
          <button 
            onClick={scrollToCta}
            className="hidden md:inline-block px-6 py-2.5 rounded-full bg-green hover:bg-green-dark hover:shadow-lg hover:shadow-green/20 hover:scale-[1.03] active:scale-95 text-navy font-display font-bold text-xs uppercase tracking-wider transition-all"
          >
            Seja um Fundador
          </button>

          {/* Hamburger Menu Icon for Mobile */}
          <button 
            onClick={() => setIsMobileMenuOpen(true)}
            className="md:hidden text-white hover:text-green transition-colors p-2" 
            aria-label="Abrir Menu"
          >
            <Menu className="w-6 h-6" />
          </button>
        </div>
      </nav>

      {/* PWA INSTALL BANNER */}
      {showInstallBtn && !isBannerDismissed && (
        <div className="fixed top-20 left-0 right-0 z-40 bg-[#0b1329]/90 backdrop-blur-xl border-b border-white/10 px-6 py-4 flex items-center justify-between gap-4 animate-fadeIn shadow-lg">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center border border-white/10 shrink-0">
              <img src="/favicon.png" className="w-6 h-6 object-contain" alt="UBT" />
            </div>
            <div>
              <h4 className="font-display font-bold text-xs sm:text-sm text-white">Tenha a UBT sempre à mão</h4>
              <p className="text-[11px] text-white/70 hidden sm:block">
                Instale a UBT no seu celular e acesse rapidamente a plataforma, como qualquer outro aplicativo.
              </p>
              <p className="text-[11px] text-white/70 sm:hidden">
                Instale a UBT no seu celular para acesso rápido.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={handlePwaInstallClick}
              className="px-5 py-2.5 rounded-full bg-green hover:bg-green-dark hover:scale-[1.03] active:scale-95 text-navy font-display font-bold text-xs uppercase tracking-wider transition-all"
            >
              Instalar UBT
            </button>
            <button
              onClick={() => setIsBannerDismissed(true)}
              className="p-2 text-white/60 hover:text-white transition-colors"
              aria-label="Dispensar instalação"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>
      )}

      {/* Mobile Menu Drawer */}
      {isMobileMenuOpen && (
        <div className="fixed inset-0 bg-black/95 z-[100] flex flex-col items-center justify-center gap-8 animate-fadeIn md:hidden">
          <button 
            onClick={() => setIsMobileMenuOpen(false)}
            className="absolute top-6 right-6 p-2 text-white hover:text-green transition-colors"
          >
            <X className="w-8 h-8" />
          </button>
          <a href="#quem-faz-cap" onClick={() => setIsMobileMenuOpen(false)} className="text-2xl font-display font-bold text-white hover:text-green">Quem Faz</a>
          <a href="#conecta-cap" onClick={() => setIsMobileMenuOpen(false)} className="text-2xl font-display font-bold text-white hover:text-green">Conexões</a>
          <a href="#todos-ganham-cap" onClick={() => setIsMobileMenuOpen(false)} className="text-2xl font-display font-bold text-white hover:text-green">Prêmios</a>
          <a href="#faq-section" onClick={() => setIsMobileMenuOpen(false)} className="text-2xl font-display font-bold text-white hover:text-green">FAQ</a>
          <button 
            onClick={() => { setIsMobileMenuOpen(false); scrollToCta(); }}
            className="mt-4 px-8 py-3.5 rounded-full bg-green text-navy font-display font-extrabold text-sm uppercase tracking-wider shadow-lg shadow-green/20"
          >
            Seja um Fundador
          </button>
        </div>
      )}

      {/* CHAPTER 1: HERO / O PARAÍSO */}
      <section id="hero-cap" className="relative h-[100svh] lg:h-screen flex items-center justify-start px-6 md:px-12 overflow-hidden w-full z-20">
        
        {/* 1 Background absoluto */}
        <img 
          src="/hero-2.0.png" 
          alt="Ubatuba Conectada" 
          className="absolute inset-0 w-full h-full object-cover z-0 brightness-[0.7] contrast-[1.05]"
        />

        {/* 2 Overlay */}
        <div className="absolute inset-0 z-10 bg-gradient-to-r from-black/85 via-black/40 to-transparent pointer-events-none" />

        {/* 3 Conteúdo */}
        <div className="max-w-[1200px] w-full mx-auto relative z-20 flex flex-col items-start justify-center text-left">
          
          {/* Título */}
          <h1 className="font-['Poppins'] font-black text-4xl sm:text-5xl lg:text-7xl text-white leading-[1.12] tracking-tight mb-4 max-w-3xl animate-fadeIn" style={{ animationDelay: "200ms" }}>
            Quando todos <br />
            <span className="text-[#22C55E]">ganham</span>,<br />
            a cidade inteira <br />
            <span className="text-[#005BFF]">cresce.</span>
          </h1>

          {/* Subtítulo */}
          <p className="text-white/85 text-base sm:text-lg md:text-xl font-['Poppins'] font-medium tracking-wide mb-6 max-w-md leading-relaxed animate-fadeIn" style={{ animationDelay: "300ms" }}>
            A plataforma oficial da economia<br />
            local de <span className="text-[#22C55E] font-semibold">Ubatuba.</span>
          </p>

          {/* Linha horizontal com gradiente */}
          <div className="w-24 h-1 bg-gradient-to-r from-[#005BFF] to-[#22C55E] rounded-full mb-8 animate-fadeIn" style={{ animationDelay: "350ms" }} />

          {/* Botões principal e secundário */}
          <div className="flex flex-col gap-4 w-full max-w-md mb-8 animate-fadeIn" style={{ animationDelay: "400ms" }}>
            
            {/* Botão principal */}
            <button
              onClick={scrollToCta}
              className="w-full h-16 rounded-2xl bg-gradient-to-r from-[#005BFF] to-[#22C55E] hover:from-[#00A3FF] hover:to-[#22C55E] font-['Poppins'] font-bold text-xs sm:text-sm tracking-widest uppercase transition-all shadow-[0_0_15px_rgba(0,91,255,0.2)] hover:shadow-[0_0_25px_rgba(34,197,94,0.35)] hover:scale-[1.02] active:scale-95 text-white flex items-center justify-between px-8 border border-white/10"
            >
              <div className="flex items-center gap-3">
                <UserPlus className="w-5 h-5" />
                <span>QUERO SER UM FUNDADOR</span>
              </div>
              <ArrowRight className="w-5 h-5" />
            </button>
            
            {/* Botão secundário */}
            <button
              onClick={() => openVideoModal(0)}
              className="hidden w-full h-16 rounded-2xl font-['Poppins'] font-bold text-xs sm:text-sm tracking-widest uppercase transition-all text-white items-center justify-center gap-3 hover:scale-[1.02] active:scale-95"
              style={{
                background: "linear-gradient(#09090B, #09090B) padding-box, linear-gradient(to right, #005BFF, #22C55E) border-box",
                border: "2px solid transparent"
              }}
            >
              <Play className="w-5 h-5 fill-current text-[#22C55E]" />
              <span>ASSISTIR AO FILME</span>
            </button>

          </div>

          {/* Localized connection status */}
          <div className="text-[10px] font-mono text-white/40 tracking-wider uppercase flex items-center justify-center gap-2 animate-fadeIn" style={{ animationDelay: "500ms" }}>
            <span className="w-1.5 h-1.5 rounded-full bg-[#22C55E] animate-pulse" />
            <span>Conectando a economia caiçara em tempo real</span>
          </div>

        </div>

        {/* Seta animada indicando continuidade */}
        <div className="absolute bottom-8 left-1/2 -translate-x-1/2 flex flex-col items-center gap-2 pointer-events-none z-20 animate-fadeIn" style={{ animationDelay: "600ms" }}>
          <div className="w-9 h-9 rounded-full border border-white/15 flex items-center justify-center bg-black/40 backdrop-blur-sm animate-bounce">
            <ChevronDown className="w-4.5 h-4.5 text-[#22C55E]" />
          </div>
          {/* Fading sequential dots */}
          <div className="flex flex-col gap-1 items-center">
            <span className="w-1 h-1 rounded-full bg-[#00A3FF] animate-pulse" style={{ animationDelay: "0ms" }} />
            <span className="w-1 h-1 rounded-full bg-[#00A3FF] animate-pulse" style={{ animationDelay: "200ms" }} />
            <span className="w-1 h-1 rounded-full bg-[#00A3FF] animate-pulse" style={{ animationDelay: "400ms" }} />
          </div>
        </div>

      </section>

      {/* CHAPTER 1.5: MENSAGEM DO RITMO */}
      <section className="px-6 md:px-12 bg-white/[0.01] border-y border-white/5 relative z-20" style={{ paddingTop: "2rem", paddingBottom: "0rem" }}>
        <div className="max-w-[800px] mx-auto text-center">
          <span className="text-[10px] tracking-[0.25em] font-mono text-green uppercase block mb-4">Filosofia UBT</span>
          <h2 className="font-display font-extrabold text-2xl md:text-4xl text-white leading-snug">
            “Quem faz Ubatuba acontecer merece uma tecnologia feita para ela.”
          </h2>
          <div className="w-16 h-0.5 bg-green/40 mx-auto mt-6" />
        </div>
      </section>

      {/* CHAPTER 2: QUEM FAZ A CIDADE ACONTECER (Alternating large showcases) */}
      <section id="quem-faz-cap" className="px-6 md:px-12 max-w-[1200px] mx-auto relative z-20" style={{ paddingTop: "1rem", paddingBottom: "1rem" }}>
        
        <div className="text-center max-w-xl mx-auto mb-8">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/5 border border-white/10 text-[9px] font-mono text-green uppercase tracking-widest mb-4">
            <span>Capítulo II</span>
            <span>•</span>
            <span>Protagonistas</span>
          </div>
          <h2 className="font-display font-extrabold text-3xl md:text-5xl text-white mb-4">Quem faz a cidade acontecer</h2>
          <p className="text-sm text-white/60 font-sans leading-relaxed">
            Pessoas reais de Ubatuba, representadas com dignidade e autonomia por meio da tecnologia.
          </p>
        </div>

        {/* Vertical Stack showcasing alternating cards */}
        <div className="flex flex-col gap-8">
          {[
            { 
              title: "Mototaxistas", 
              phrase: "Mobilidade rápida e integrada ao comércio e bairros.", 
              desc: "O transporte local ganha rotas seguras e controle total das chamadas pelo celular, reduzindo tarifas e impulsionando a eficiência urbana.",
              video: "Cena02.mp4", 
              img: "/characters/A01_Mototaxista/Corpo.jpg",
              align: "left"
            },
            { 
              title: "Diaristas", 
              phrase: "Segurança de agendamentos e valorização do trabalho doméstico.", 
              desc: "A contratação simples de profissionais diaristas locais garante flexibilidade de horários, pagamento rápido e apoio às associações.",
              video: "Cena03.mp4", 
              img: "/characters/A02_Diarista/Corpo.jpg",
              align: "right"
            },
            { 
              title: "Ambulantes da Praia", 
              phrase: "Inovação de vendas móveis na orla marítima.", 
              desc: "A transação ágil de bebidas e lanches integrada diretamente na carteira digital da UBT, facilitando o atendimento de banhistas e turistas sem ruídos.",
              video: "Cena05.mp4", 
              img: "/ambulante_praia.png",
              align: "left"
            },
            { 
              title: "Côco & Cia", 
              phrase: "Cooperativa de catadores de recicláveis em Ubatuba", 
              desc: "Moradores indicam onde deixaram seus resíduos recicláveis e catadores coletam. É a força da sustentabilidade da cidade. Obrigado!",
              video: "Cena06.mp4", 
              img: "/caminhao_reciclagem.png",
              align: "right"
            }
          ].map((item, idx) => (
            <div 
              key={idx} 
              className={`grid grid-cols-1 lg:grid-cols-12 gap-8 items-center ${
                item.align === "right" ? "lg:flex-row-reverse" : ""
              }`}
            >
              {/* Media viewport Column */}
              <div className={`lg:col-span-6 relative rounded-3xl overflow-hidden border border-white/5 bg-[#070B16] aspect-[4/3] ${
                item.align === "right" ? "lg:order-2" : "lg:order-1"
              }`}>
                <video 
                  src={`/videos/${item.video}`}
                  loop 
                  muted 
                  autoPlay 
                  playsInline 
                  className="w-full h-full object-cover opacity-60 hover:opacity-85 transition-opacity duration-700"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent z-10" />
                {/* Play button removed per UBT-COMM-003 */}
              </div>

              {/* Text Description Column */}
              <div className={`lg:col-span-6 flex flex-col items-start ${
                item.align === "right" ? "lg:order-1" : "lg:order-2"
              }`}>
                <h3 className="font-display font-extrabold text-2xl md:text-3xl text-white mb-2">{item.title}</h3>
                <p className="font-display font-bold text-base text-green leading-snug mb-4">{item.phrase}</p>
                <p className="text-sm text-white/70 leading-relaxed font-sans mb-6">{item.desc}</p>
                <button 
                  onClick={() => openVideoModal(idx + 1)}
                  className="hidden text-xs font-mono tracking-widest text-white/50 hover:text-green hover:underline transition-all flex items-center gap-1.5"
                >
                  Assistir Filme Conceito <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>

            </div>
          ))}
        </div>
      </section>

      {/* CHAPTER 3: A TECNOLOGIA CONECTA (Simulated Live Connections & Transaction Dashboard) */}
      <section id="conecta-cap" className="hidden px-6 md:px-12 border-y border-white/5 relative z-20" style={{ backgroundColor: "#083928", paddingTop: "2rem", paddingBottom: "2rem" }}>
        <div className="max-w-[1200px] mx-auto">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
            
            <div className="lg:col-span-5 flex flex-col items-start">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/5 border border-white/10 text-[9px] font-mono text-green uppercase tracking-widest mb-4">
                <span>Capítulo III</span>
                <span>•</span>
                <span>Tecnologia</span>
              </div>
              <h2 className="font-display font-extrabold text-3xl md:text-5xl text-white leading-tight mb-6">
                A tecnologia conecta
              </h2>
              <p className="text-sm text-white/70 leading-relaxed font-sans mb-8">
                Visualização do ecossistema inteligente da UBT em Ubatuba. Repasses de fundos, solicitações de mototáxi e agendamentos acontecendo de forma transparente e descentralizada.
              </p>
              
              <div className="flex gap-4 items-center">
                <div className="flex flex-col">
                  <span className="text-[10px] font-mono uppercase text-white/40">Taxa UBT</span>
                  <span className="text-xl font-display font-bold text-green">Mínima de App</span>
                </div>
                <div className="w-px h-8 bg-white/10" />
                <div className="flex flex-col">
                  <span className="text-[10px] font-mono uppercase text-white/40">Comunidade</span>
                  <span className="text-xl font-display font-bold text-blue">4% Divididos</span>
                </div>
              </div>
            </div>

            <div className="lg:col-span-7">
              {/* Dynamic Interactive Connection Dashboard Box */}
              <div className="p-6 md:p-8 rounded-3xl border border-white/10 bg-black/60 backdrop-blur-xl shadow-2xl relative overflow-hidden">
                <div className="absolute top-0 right-0 w-32 h-32 rounded-full bg-blue/10 blur-[50px] pointer-events-none" />
                <div className="flex items-center justify-between mb-6 pb-4 border-b border-white/5">
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-blue animate-pulse" />
                    <span className="text-xs font-mono uppercase tracking-widest text-white/60">UBT Live Network</span>
                  </div>
                  <span className="text-[9px] font-mono bg-white/5 border border-white/10 px-2 py-0.5 rounded text-white/50">
                    Simulação Ativa
                  </span>
                </div>

                <div className="flex flex-col gap-4">
                  {simulatedTransactions.map((tx) => (
                    <div 
                      key={tx.id} 
                      className="p-4 rounded-2xl bg-white/[0.02] border border-white/5 flex items-center justify-between transition-all duration-500 hover:bg-white/[0.04] animate-fadeIn"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-xl bg-blue/10 border border-blue/20 flex items-center justify-center text-blue">
                          <Bike className="w-4 h-4" />
                        </div>
                        <div>
                          <p className="text-xs text-white/80 font-semibold font-sans">{tx.text}</p>
                          <span className="text-[10px] text-white/40 font-mono">{tx.value}</span>
                        </div>
                      </div>
                      <span className={`text-[9px] font-mono px-2 py-0.5 rounded ${
                        tx.badge === "Ativo" ? "bg-green/10 text-green border border-green/20" :
                        tx.badge === "Reciclagem" ? "bg-amber/10 text-amber border border-amber/20" :
                        "bg-blue/10 text-blue border border-blue/20"
                      }`}>
                        {tx.badge}
                      </span>
                    </div>
                  ))}
                </div>

                <div className="mt-6 flex justify-between items-center text-[10px] font-mono text-white/40">
                  <div className="flex items-center gap-1.5">
                    <MapPin className="w-3.5 h-3.5 text-blue" />
                    <span>Litoral Norte, SP</span>
                  </div>
                  <span>Distribuição Garantida por RLS</span>
                </div>
              </div>
            </div>

          </div>
        </div>
      </section>

      {/* CHAPTER 4: TODOS GANHAM (Bento Grid layout) */}
      <section id="todos-ganham-cap" className="px-6 md:px-12 max-w-[1200px] mx-auto relative z-20" style={{ paddingTop: "1rem", paddingBottom: "1rem", backgroundColor: "rgb(8, 57, 40)" }}>
        
        <div className="text-center max-w-xl mx-auto mb-8">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/5 border border-white/10 text-[9px] font-mono text-green uppercase tracking-widest mb-4">
            <span>Capítulo IV</span>
            <span>•</span>
            <span>Retorno Comunitário</span>
          </div>
          <h2 className="font-display font-extrabold text-3xl md:text-5xl text-white mb-4">Todos ganham</h2>
          <p className="text-sm text-white/60 font-sans leading-relaxed">
            Cada transação na UBT gera recursos revertidos diretamente para fundos locais, associações e preservação.
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          
          {/* Card 1: Padrinho */}
          <div className="lg:col-span-2 p-8 rounded-3xl border border-[#0d5236]/30 bg-[#0a2e1f] shadow-xl hover:border-amber-500/40 transition-all duration-500 flex flex-col justify-between group">
            <div>
              <div className="flex justify-between items-center mb-6">
                <span className="text-[10px] tracking-widest font-mono text-amber-500 bg-amber-500/10 border border-amber-500/30 px-3 py-1 rounded-full">
                  Programa Padrinho / Madrinha
                </span>
              </div>
              <h3 className="font-display font-bold text-2xl text-white mb-4">
                Indique e participe do crescimento da sua comunidade.
              </h3>
              <p className="text-xs text-zinc-300 leading-relaxed font-sans mb-8">
                Cada usuário possui um link exclusivo. Compartilhe pelo WhatsApp, QR Code ou redes sociais. Sempre que um prestador indicado por você realizar vendas pela plataforma, você participa do crescimento dele conforme as regras da UBT.
              </p>
            </div>
            <p className="text-[10px] text-zinc-400 leading-relaxed font-sans p-4 rounded-xl bg-white/5 border border-[#0d5236]/30">
              O valor das vendas poderá ser destinado ao padrinho/madrinha, conforme a configuração vigente da plataforma e o regulamento aplicável.
            </p>
          </div>

          {/* Card 2: Prêmio Trabalhador */}
          <div className="p-8 rounded-3xl border border-[#0d5236]/30 bg-[#0a2e1f] shadow-xl hover:border-amber-500/40 transition-all duration-500 flex flex-col justify-between group">
            <div>
              <div className="flex justify-between items-center mb-6">
                <span className="text-[10px] tracking-widest font-mono text-amber-500 bg-amber-500/10 border border-amber-500/30 px-3 py-1 rounded-full">
                  Prêmio Trabalhador
                </span>
                <span className="text-2xl font-display font-bold text-amber-500">1%</span>
              </div>
              <h3 className="font-display font-bold text-xl text-white mb-4 transition-colors">
                Quem trabalha também pode ganhar.
              </h3>
              <p className="text-xs text-zinc-300 leading-relaxed font-sans mb-8">
                Parte das vendas realizadas pela plataforma forma um fundo destinado ao Prêmio Trabalhador. O sorteio acontece anualmente em 01 de maio.
              </p>
            </div>
            <div className="text-[10px] font-semibold text-amber-500 border-t border-[#0d5236]/30 pt-4 flex items-center gap-1">
              <Award className="w-4 h-4 text-amber-500" /> 1% das vendas compõe este fundo.
            </div>
          </div>

          {/* Card 3: Prêmio Consumidor */}
          <div className="p-8 rounded-3xl border border-[#0d5236]/30 bg-[#0a2e1f] shadow-xl hover:border-amber-500/40 transition-all duration-500 flex flex-col justify-between group">
            <div>
              <div className="flex justify-between items-center mb-6">
                <span className="text-[10px] tracking-widest font-mono text-amber-500 bg-amber-500/10 border border-amber-500/30 px-3 py-1 rounded-full">
                  Prêmio Consumidor
                </span>
                <span className="text-2xl font-display font-bold text-amber-500">1%</span>
              </div>
              <h3 className="font-display font-bold text-xl text-white mb-4 transition-colors">
                Quem compra também participa.
              </h3>
              <p className="text-xs text-zinc-300 leading-relaxed font-sans mb-8">
                Parte das vendas realizadas pela plataforma forma um fundo destinado ao Prêmio Consumidor. O sorteio acontece anualmente em 01 de novembro.
              </p>
            </div>
            <div className="text-[10px] font-semibold text-amber-500 border-t border-[#0d5236]/30 pt-4 flex items-center gap-1">
              <Award className="w-4 h-4 text-amber-500" /> 1% das vendas compõe este fundo.
            </div>
          </div>

          {/* Card 4: Associações */}
          <div className="p-8 rounded-3xl border border-[#0d5236]/30 bg-[#0a2e1f] shadow-xl hover:border-amber-500/40 transition-all duration-500 flex flex-col justify-between group">
            <div>
              <div className="flex justify-between items-center mb-6">
                <span className="text-[10px] tracking-widest font-mono text-amber-500 bg-amber-500/10 border border-amber-500/30 px-3 py-1 rounded-full">
                  Associações
                </span>
              </div>
              <h3 className="font-display font-bold text-xl text-white mb-4 transition-colors">
                Associações mais fortes.
              </h3>
              <p className="text-xs text-zinc-300 leading-relaxed font-sans mb-8">
                Parte das vendas fortalece financeiramente as associações participantes, permitindo maior apoio aos trabalhadores locais.
              </p>
            </div>
            <div className="text-[10px] font-semibold text-amber-500 border-t border-[#0d5236]/30 pt-4 flex items-center gap-1">
              <Users className="w-4 h-4 text-amber-500" /> 2% das vendas revertidos.
            </div>
          </div>

          {/* Card 5: Côco & Cia */}
          <div className="p-8 rounded-3xl border border-[#0d5236]/30 bg-[#0a2e1f] shadow-xl hover:border-amber-500/40 transition-all duration-500 flex flex-col justify-between group">
            <div>
              <div className="flex justify-between items-center mb-6">
                <span className="text-[10px] tracking-widest font-mono text-amber-500 bg-amber-500/10 border border-amber-500/30 px-3 py-1 rounded-full">
                  Côco & Cia
                </span>
                <span className="text-xs font-semibold text-amber-500 flex items-center gap-1">Ecologia</span>
              </div>
              <h3 className="font-display font-bold text-xl text-white mb-4 transition-colors">
                Tecnologia para cuidar da cidade.
              </h3>
              <p className="text-xs text-zinc-300 leading-relaxed font-sans mb-8">
                O cidadão poderá indicar pelo mapa onde deixou materiais recicláveis. A equipe da Côco & Cia realizará a coleta rápida.
              </p>
            </div>
            <div className="flex flex-wrap gap-2 text-[9px] font-mono text-amber-500/80 tracking-wider uppercase border-t border-[#0d5236]/30 pt-4">
              <span>Reciclagem</span>
              <span>•</span>
              <span>Ecologia</span>
              <span>•</span>
              <span>Parceria</span>
            </div>
          </div>

        </div>
      </section>

      {/* CHAPTER 5: SEJA UM FUNDADOR (Formulário Supabase no anoitecer) */}
      {/* CHAPTER 5: SEJA UM FUNDADOR (Apresentação Centrada) */}
      <section id="fundadores-cap" className="py-20 px-6 md:px-12 max-w-[1000px] mx-auto relative z-20 text-center flex flex-col items-center">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/5 border border-white/10 text-[9px] font-mono text-green uppercase tracking-widest mb-6">
          <span>Capítulo V</span>
          <span>•</span>
          <span>O Começo</span>
        </div>
        <h2 className="font-display font-extrabold text-white leading-[1.1] mb-6 max-w-2xl" style={{ fontSize: "1.6rem" }}>
          “Algumas pessoas poderão dizer que estavam aqui desde o começo.”
        </h2>
        <p className="text-sm text-white/75 leading-relaxed font-sans mb-8 max-w-xl mx-auto">
          O futuro da UBT começa com seus primeiros Fundadores. Inscreva-se hoje para se juntar ao movimento de fortalecimento econômico de Ubatuba.
        </p>
        <div className="flex flex-wrap justify-center gap-6 max-w-3xl">
          {[
            "Acesso antecipado prioritário ao superapp",
            "Taxa reduzida permanente vitalícia",
            "Canal de governança comunitária das assembleias"
          ].map((benefit, idx) => (
            <div key={idx} className="flex items-center gap-3 bg-white/5 border border-white/10 px-4 py-2.5 rounded-full">
              <div className="w-5 h-5 rounded-full bg-green/10 border border-green/20 flex items-center justify-center text-green shrink-0">
                <Check className="w-3.5 h-3.5" />
              </div>
              <span className="text-xs text-white/80 font-semibold font-sans">{benefit}</span>
            </div>
          ))}
        </div>
      </section>

      {/* SEÇÃO DO FORMULÁRIO DE CADASTRO (Quase largura inteira da tela com campos grandes) */}
      <section id="cadastro-fundadores-cap" className="pb-0 px-6 md:px-12 max-w-[1400px] mx-auto relative z-20">
        <div className="bg-[#0b1329]/30 border border-white/5 rounded-[40px] p-[0.1rem] backdrop-blur-xl shadow-2xl relative overflow-hidden">
          
          <div className="absolute -top-24 -right-24 w-64 h-64 rounded-full bg-green/10 blur-[90px] pointer-events-none" />

          {submitSuccess ? (
            <div className="text-center py-12 max-w-md mx-auto px-4">
              <div className="w-20 h-20 rounded-full bg-green/10 border border-green/30 flex items-center justify-center text-green mx-auto mb-8 animate-bounce">
                <CheckCircle2 size={40} />
              </div>
              <span className="text-[10px] tracking-[0.2em] font-mono text-green uppercase block mb-2">Sucesso no Cadastro</span>
              <h3 className="font-display font-extrabold text-3xl text-white mb-4">Você já é um Fundador da UBT! 🎉</h3>
              <p className="text-sm text-white/70 leading-relaxed font-sans mb-6">
                Parabéns, seu cadastro foi registrado com sucesso na nossa fila de espera pública. Juntos vamos construir uma Ubatuba muito mais próspera e conectada.
              </p>

              {/* PWA Install CTA within Success Modal */}
              <div className="mb-8 p-6 rounded-2xl bg-white/5 border border-white/10 text-center">
                {isStandalone ? (
                  <p className="text-xs text-green font-semibold font-sans">
                    A UBT já está instalada neste celular.
                  </p>
                ) : (
                  <>
                    <h4 className="font-display font-bold text-sm text-white mb-2">Deixe a UBT sempre à mão</h4>
                    <p className="text-xs text-white/60 mb-4 font-sans">Instale a UBT no seu celular para acesso rápido.</p>
                    <button
                      onClick={handlePwaInstallClick}
                      className="px-6 py-2.5 rounded-full bg-[#005BFF] hover:bg-[#005BFF]/90 hover:scale-[1.02] text-white font-display font-bold text-xs uppercase tracking-wider transition-all"
                    >
                      Instalar UBT
                    </button>
                  </>
                )}
              </div>

              <div className="p-4 rounded-xl bg-white/5 border border-white/5 text-[11px] text-white/40 leading-relaxed font-sans flex items-center gap-2">
                <ShieldCheck className="w-5 h-5 text-green shrink-0" />
                Seus dados estão protegidos nos termos estritos da Lei Geral de Proteção de Dados (LGPD).
              </div>
            </div>
          ) : (
            <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-6 p-2 md:p-8" noValidate>
              <div className="text-center mb-8">
                <h3 className="font-display font-bold text-2xl text-white mb-2 mt-[16px]">Cadastro de Fundador</h3>
                <p className="text-xs text-white/50 font-sans">Preencha as informações abaixo para garantir seus benefícios de pioneiro.</p>
              </div>

              {submitError && (
                <div className="p-3.5 rounded-xl bg-destructive/10 border border-destructive/20 text-xs text-destructive font-semibold leading-relaxed text-center">
                  {submitError}
                </div>
              )}

              {/* 1. Nome completo */}
              <div>
                <label className="block text-xs font-mono text-white/50 uppercase tracking-widest mb-2 pl-1">Nome Completo</label>
                <input 
                  type="text" 
                  placeholder="Ex: Carlos da Silva" 
                  {...register("nome")}
                  className="w-full px-6 py-5 rounded-2xl bg-white/5 border border-white/10 outline-none text-white text-base focus:border-green transition-all"
                />
                {errors.nome && (
                  <p className="mt-1 text-red-500 text-xs pl-1">{errors.nome.message}</p>
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                {/* 2. WhatsApp */}
                <div>
                  <label className="block text-xs font-mono text-white/50 uppercase tracking-widest mb-2 pl-1">WhatsApp</label>
                  <input 
                    type="tel" 
                    placeholder="Ex: (12) 99999-9999" 
                    {...register("telefone", {
                      onChange: (e) => {
                        setValue("telefone", maskPhone(e.target.value));
                      }
                    })}
                    className="w-full px-6 py-5 rounded-2xl bg-white/5 border border-white/10 outline-none text-white text-base focus:border-green transition-all"
                  />
                  {errors.telefone && (
                    <p className="mt-1 text-red-500 text-xs pl-1">{errors.telefone.message}</p>
                  )}
                </div>
                {/* 3. E-mail */}
                <div>
                  <label className="block text-xs font-mono text-white/50 uppercase tracking-widest mb-2 pl-1">E-mail</label>
                  <input 
                    type="email" 
                    placeholder="Ex: carlos@email.com" 
                    {...register("email")}
                    className="w-full px-6 py-5 rounded-2xl bg-white/5 border border-white/10 outline-none text-white text-base focus:border-green transition-all"
                  />
                  {errors.email && (
                    <p className="mt-1 text-red-500 text-xs pl-1">{errors.email.message}</p>
                  )}
                </div>
              </div>

              {/* 4. Seu perfil */}
              <div>
                <label className="block text-xs font-mono text-white/50 uppercase tracking-widest mb-3 pl-1">Seu Perfil</label>
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 p-4 rounded-2xl bg-white/5 border border-white/10">
                  {([
                    { id: "associacao", label: "Associação de Trabalhadores" },
                    { id: "mototaxista", label: "Mototaxista" },
                    { id: "diarista", label: "Diarista" },
                    { id: "ambulante", label: "Ambulante" },
                    { id: "cocoecia", label: "Côco & Cia (Ecologia)" },
                    { id: "morador", label: "Morador" },
                    { id: "turista", label: "Turista / Visitante" }
                  ] as const).map((perf) => {
                    const checked = perfil?.includes(perf.id);
                    return (
                      <label 
                        key={perf.id} 
                        className={`flex items-center gap-3 p-4 rounded-xl border cursor-pointer select-none transition-all ${
                          checked 
                            ? "bg-green/10 border-green text-green" 
                            : "bg-white/5 border-white/5 hover:border-white/20 text-white/70"
                        }`}
                      >
                        <input 
                          type="checkbox" 
                          value={perf.id}
                          checked={checked}
                          onChange={() => {
                            const next = checked
                              ? perfil.filter(p => p !== perf.id)
                              : [...perfil, perf.id];
                            setValue("perfil", next, { shouldValidate: true });
                          }}
                          className="h-5 w-5 accent-green shrink-0 cursor-pointer"
                        />
                        <span className="text-sm font-sans font-medium">{perf.label}</span>
                      </label>
                    );
                  })}
                </div>
                {errors.perfil && (
                  <p className="mt-1 text-red-500 text-xs pl-1">{errors.perfil.message}</p>
                )}
              </div>

              {/* 5. ÁREA CONDICIONAL DE ENDEREÇO */}
              {(perfil?.includes("associacao") || perfil?.includes("mototaxista") || perfil?.includes("diarista")) && (
                <div className="w-full">
                  <label className="block text-xs font-mono text-white/50 uppercase tracking-widest mb-3 pl-1">Região de atuação</label>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 p-4 rounded-2xl bg-white/5 border border-white/10">
                    {["Sul", "Norte", "Centro", "Oeste"].map((reg) => {
                      const selectedRegions = watch("regiao_atuacao") || [];
                      const checked = selectedRegions.includes(reg);
                      return (
                        <label 
                          key={reg} 
                          className={`flex items-center gap-3 p-3.5 rounded-xl border cursor-pointer select-none transition-all ${
                            checked 
                              ? "bg-green/10 border-green text-green" 
                              : "bg-white/5 border-white/5 hover:border-white/20 text-white/70"
                          }`}
                        >
                          <input 
                            type="checkbox" 
                            checked={checked}
                            onChange={() => {
                              const next = checked
                                ? selectedRegions.filter(r => r !== reg)
                                : [...selectedRegions, reg];
                              setValue("regiao_atuacao", next, { shouldValidate: true });
                            }}
                            className="h-5 w-5 accent-green shrink-0 cursor-pointer"
                          />
                          <span className="text-sm font-sans font-medium">{reg}</span>
                        </label>
                      );
                    })}
                  </div>
                  {errors.regiao_atuacao && (
                    <p className="mt-1 text-red-500 text-xs pl-1">{errors.regiao_atuacao.message}</p>
                  )}
                </div>
              )}

              {(perfil?.includes("morador") || perfil?.includes("turista") || perfil?.includes("ambulante")) && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* Bairros Column */}
                  {(perfil?.includes("morador") || perfil?.includes("turista")) && (
                    <div className="w-full">
                      <label className="block text-xs font-mono text-white/50 uppercase tracking-widest mb-2 pl-1">
                        {perfil?.includes("morador") ? "Bairro de residência" : "Bairro que costuma se hospedar"}
                      </label>
                      <button
                        type="button"
                        onClick={() => setIsBairroModalOpen(true)}
                        className="w-full text-left px-6 py-5 rounded-2xl bg-white/5 border border-white/10 outline-none text-white text-base hover:border-white/20 transition-all flex justify-between items-center"
                      >
                        <span>
                          {selectedBairros.length > 0
                            ? selectedBairros.join(", ")
                            : "Selecione o bairro..."}
                        </span>
                        <ChevronDown className="w-5 h-5 text-white/40" />
                      </button>
                      {errors.bairros && (
                        <p className="mt-1 text-red-500 text-xs pl-1">{errors.bairros.message}</p>
                      )}
                    </div>
                  )}

                  {/* Praias Column */}
                  {(perfil?.includes("ambulante") || perfil?.includes("morador") || perfil?.includes("turista")) && (
                    <div className="w-full">
                      <label className="block text-xs font-mono text-white/50 uppercase tracking-widest mb-2 pl-1">
                        {perfil?.includes("ambulante") ? "Praias de atuação" : "Praias que costuma frequentar"}
                      </label>
                      <button
                        type="button"
                        onClick={() => setIsPraiaModalOpen(true)}
                        className="w-full text-left px-6 py-5 rounded-2xl bg-white/5 border border-white/10 outline-none text-white text-base hover:border-white/20 transition-all flex justify-between items-center"
                      >
                        <span>
                          {selectedPraias.length > 0
                            ? selectedPraias.join(", ")
                            : "Selecione a(s) praia(s)..."}
                        </span>
                        <ChevronDown className="w-5 h-5 text-white/40" />
                      </button>
                      {errors.praias && (
                        <p className="mt-1 text-red-500 text-xs pl-1">{errors.praias.message}</p>
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* 6. Tem conta no Mercado Pago? */}
              <div>
                <label className="block text-xs font-mono text-white/50 uppercase tracking-widest mb-3 pl-1">Você já possui uma conta no Mercado Pago?</label>
                <div className="grid grid-cols-2 gap-4">
                  {[
                    { value: true, label: "Sim" },
                    { value: false, label: "Não" }
                  ].map((opt) => {
                    const selected = watch("possuiContaMercadoPago") === opt.value;
                    return (
                      <button
                        key={opt.label}
                        type="button"
                        onClick={() => setValue("possuiContaMercadoPago", opt.value, { shouldValidate: true })}
                        className={`flex items-center justify-center p-4 rounded-xl border font-sans font-medium text-sm transition-all ${
                          selected
                            ? "bg-green/10 border-green text-green"
                            : "bg-white/5 border-white/5 hover:border-white/20 text-white/70"
                        }`}
                      >
                        {opt.label}
                      </button>
                    );
                  })}
                </div>
                {errors.possuiContaMercadoPago && (
                  <p className="mt-1 text-red-500 text-xs pl-1">{errors.possuiContaMercadoPago.message}</p>
                )}
              </div>

              {/* 7. LGPD Accept Terms */}
              <div className="flex gap-3 items-start mt-2">
                <input 
                  type="checkbox" 
                  id="consent-lgpd" 
                  {...register("acceptTerms")}
                  className="mt-1 h-5 w-5 shrink-0 accent-green cursor-pointer" 
                />
                <label htmlFor="consent-lgpd" className="text-xs text-white/50 leading-relaxed font-sans cursor-pointer select-none">
                  Aceito os Termos de Uso e autorizo a coleta dos meus dados para fins exclusivos de desenvolvimento da UBT, conforme a LGPD.
                </label>
              </div>
              {errors.acceptTerms && (
                <p className="text-red-500 text-xs pl-1">{errors.acceptTerms.message}</p>
              )}

              <button
                type="submit"
                disabled={isSubmitting}
                className={`w-full py-5 mt-4 rounded-2xl font-display font-extrabold text-[0.6rem] tracking-wider uppercase flex items-center justify-center gap-3 transition-all ${
                  isSubmitting 
                    ? "bg-white/10 text-white/30 cursor-not-allowed" 
                    : "bg-green hover:bg-green-dark active:scale-95 text-navy shadow-lg shadow-green/20"
                }`}
              >
                {isSubmitting ? "Enviando..." : "Quero ser um Fundador"}
                <Send className="w-5 h-5" />
              </button>
            </form>
          )}

        </div>
      </section>

      {/* FAQ SECTION */}
      <section id="faq-section" className="py-24 px-6 md:px-12 max-w-[800px] mx-auto relative z-20">
        <div className="text-center max-w-xl mx-auto mb-16">
          <span className="text-[10px] tracking-[0.25em] font-mono text-green uppercase block mb-3">Dúvidas Frequentes</span>
          <h2 className="font-display font-extrabold text-3xl md:text-4xl text-white mb-4">Perguntas frequentes</h2>
        </div>
        <div className="flex flex-col gap-1 border-t border-white/5">
          {FAQ_ITEMS.map((item, idx) => (
            <FaqItem key={idx} question={item.question} answer={item.answer} />
          ))}
        </div>
      </section>

      {/* CHAPTER 6: FINAL / A CIDADE ILUMINADA */}
      <section id="iluminada-cap" className="hidden relative py-40 bg-black overflow-hidden flex items-center justify-center min-h-screen z-20">
        <video 
          src="/videos/Cena13.mp4" 
          loop 
          muted 
          autoPlay 
          playsInline 
          className="absolute inset-0 w-full h-full object-cover opacity-25 pointer-events-none"
        />
        <div className="absolute inset-0 bg-gradient-to-b from-[#09090B] via-transparent to-black z-10" />
        
        <div className="relative z-20 text-center px-6 max-w-2xl mx-auto flex flex-col items-center">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/5 border border-white/10 text-[9px] font-mono text-green uppercase tracking-widest mb-6">
            <span>Capítulo VI</span>
            <span>•</span>
            <span>A Cidade Iluminada</span>
          </div>
          <h2 className="font-display font-extrabold text-3xl md:text-5xl text-white mb-6 leading-tight">
            A tecnologia conecta discretamente toda a cidade.
          </h2>
          <p className="text-xs text-white/50 leading-relaxed font-sans max-w-md mb-8">
            As luzes se acendem em Ubatuba. Um futuro conectado onde a economia permanece local e sustentável.
          </p>
          <img 
            src="/logo-02.png" 
            alt="UBT Logotipo Oficial" 
            className="h-14 w-auto object-contain brightness-95 mt-4 opacity-80 animate-pulse"
          />
        </div>
      </section>

      {/* FOOTER */}
      <footer className="bg-black px-6 md:px-12 border-t border-white/5 relative z-20" style={{ paddingTop: 0, paddingBottom: 0 }}>
        <div className="max-w-[1200px] mx-auto flex flex-col md:flex-row items-center md:items-start justify-between gap-12">
          
          <div className="flex flex-col items-center md:items-start gap-4">
            <img 
              src="/logo-02.png" 
              alt="UBT Logotipo Oficial" 
              className="w-auto object-contain"
              style={{ height: "13rem" }}
            />
            <p className="text-xs text-white/40 font-sans max-w-xs text-center md:text-left leading-relaxed">
              Fortalecendo a economia caiçara através da tecnologia e da colaboração.
            </p>
          </div>

          <div className="flex flex-wrap justify-center gap-10 text-xs font-sans text-white/50">
            <div className="flex flex-col gap-3">
              <span className="text-[10px] font-mono text-white/30 uppercase tracking-widest">Legal</span>
              <a href="#" className="hover:text-white transition-colors">Termos de Uso</a>
              <a href="#" className="hover:text-white transition-colors">Políticas de Privacidade</a>
            </div>
            {/* Contato column removed per UBT-COMM-003 */}
            <div className="flex flex-col gap-3">
              <span className="text-[10px] font-mono text-white/30 uppercase tracking-widest">Redes Sociais</span>
              <a href="https://www.instagram.com/ubt_servicos" target="_blank" rel="noopener noreferrer" className="hover:text-white transition-colors flex items-center gap-1.5"><Instagram className="w-3.5 h-3.5" /> Instagram</a>
              <a href="https://www.facebook.com/share/1VTCFi4vLo/?mibextid=wwXIfr" target="_blank" rel="noopener noreferrer" className="hover:text-white transition-colors flex items-center gap-1.5"><Facebook className="w-3.5 h-3.5" /> Facebook</a>
              {/* WhatsApp link removed per UBT-COMM-003 */}
            </div>
          </div>

        </div>
        <div className="max-w-[1200px] mx-auto border-t border-white/5 mt-12 pt-8 text-center text-[10px] font-mono text-white/30">
          <span>&copy; {new Date().getFullYear()} UBT. Todos os direitos reservados.</span>
        </div>
      </footer>

      {/* Fullscreen Video Player Modal disabled per UBT-COMM-003 */}

      {/* iOS/Safari Install Guide Modal */}
      {showIosGuide && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-6 bg-black/85 backdrop-blur-sm animate-fadeIn">
          <div className="relative max-w-sm w-full bg-[#0b1329] border border-white/10 rounded-[32px] p-8 shadow-2xl text-center">
            <button
              onClick={() => setShowIosGuide(false)}
              className="absolute top-4 right-4 p-2 text-white/60 hover:text-white transition-colors"
            >
              <X className="w-6 h-6" />
            </button>
            
            <div className="w-16 h-16 rounded-full bg-[#005BFF]/10 border border-[#005BFF]/30 flex items-center justify-center text-[#005BFF] mx-auto mb-6">
              <Share2 className="w-8 h-8" />
            </div>

            <h3 className="font-display font-extrabold text-xl text-white mb-2">Como colocar a UBT no celular</h3>
            <p className="text-xs text-white/70 leading-relaxed mb-6 font-sans">
              Abra o menu de compartilhamento do Safari e escolha <strong>“Adicionar à Tela de Início”</strong> para colocar o ícone na tela inicial.
            </p>

            <div className="space-y-4 text-left text-xs text-white/80 mb-6 bg-white/5 p-4 rounded-2xl border border-white/5 font-sans">
              <div className="flex gap-3">
                <span className="font-mono text-green font-bold">1.</span>
                <p>Toque no botão de compartilhamento (ícone de quadrado com seta para cima) na barra inferior do Safari.</p>
              </div>
              <div className="flex gap-3">
                <span className="font-mono text-green font-bold">2.</span>
                <p>Role o menu de compartilhamento para baixo e toque em <strong>"Adicionar à Tela de Início"</strong>. 📲</p>
              </div>
            </div>

            <button
              onClick={() => setShowIosGuide(false)}
              className="w-full py-3 rounded-full bg-green text-navy font-display font-bold text-xs uppercase tracking-widest hover:bg-green-dark transition-colors"
            >
              Entendido
            </button>
          </div>
        </div>
      )}

      {/* Generic/Unsupported Install Guide Modal */}
      {showGenericGuide && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-6 bg-black/85 backdrop-blur-sm animate-fadeIn">
          <div className="relative max-w-sm w-full bg-[#0b1329] border border-white/10 rounded-[32px] p-8 shadow-2xl text-center">
            <button
              onClick={() => setShowGenericGuide(false)}
              className="absolute top-4 right-4 p-2 text-white/60 hover:text-white transition-colors"
            >
              <X className="w-6 h-6" />
            </button>
            
            <div className="w-16 h-16 rounded-full bg-[#005BFF]/10 border border-[#005BFF]/30 flex items-center justify-center text-[#005BFF] mx-auto mb-6">
              <HelpCircle className="w-8 h-8" />
            </div>

            <h3 className="font-display font-extrabold text-xl text-white mb-2">Como colocar a UBT no celular</h3>
            <p className="text-xs text-white/70 leading-relaxed mb-6 font-sans">
              Para instalar a UBT usando seu navegador atual:
            </p>

            <div className="space-y-4 text-left text-xs text-white/80 mb-6 bg-white/5 p-4 rounded-2xl border border-white/5 font-sans">
              <div className="flex gap-3">
                <span className="font-mono text-green font-bold">1.</span>
                <p>Clique no ícone de opções do navegador (três pontinhos no canto superior ou inferior).</p>
              </div>
              <div className="flex gap-3">
                <span className="font-mono text-green font-bold">2.</span>
                <p>Selecione a opção <strong>"Instalar aplicativo"</strong> ou <strong>"Adicionar à tela inicial"</strong>. 📲</p>
              </div>
            </div>

            <button
              onClick={() => setShowGenericGuide(false)}
              className="w-full py-3 rounded-full bg-green text-navy font-display font-bold text-xs uppercase tracking-widest hover:bg-green-dark transition-colors"
            >
              Entendido
            </button>
          </div>
        </div>
      )}


      {/* Modais de Seleção Bairros / Praias */}
      {isBairroModalOpen && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[9999] flex items-center justify-center p-4 animate-fadeIn">
          <div className="bg-[#0b1329] border border-white/10 rounded-3xl w-full max-w-lg p-6 max-h-[80vh] flex flex-col">
            <div className="flex justify-between items-center mb-4">
              <h4 className="font-display font-bold text-lg text-white">
                {perfil === "morador" ? "Bairro de residência" : "Bairro que costuma se hospedar"}
              </h4>
              <button
                type="button"
                onClick={() => setIsBairroModalOpen(false)}
                className="text-white/40 hover:text-white"
              >
                <X className="w-6 h-6" />
              </button>
            </div>
            
            <div className="flex-1 overflow-y-auto grid grid-cols-1 sm:grid-cols-2 gap-3 pr-2 scrollbar-none">
              {BAIRROS_LIST.map((b) => {
                const checked = selectedBairros.includes(b);
                return (
                  <label
                    key={b}
                    className={`flex items-center gap-3 p-3.5 rounded-xl border cursor-pointer select-none transition-all ${
                      checked
                        ? "bg-green/10 border-green text-green"
                        : "bg-white/5 border-white/5 hover:border-white/20 text-white/70"
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => {
                        const next = checked
                          ? selectedBairros.filter((x) => x !== b)
                          : [...selectedBairros, b];
                        setValue("bairros", next, { shouldValidate: true });
                      }}
                      className="h-5 w-5 accent-green shrink-0 cursor-pointer"
                    />
                    <span className="text-sm font-sans font-medium">{b}</span>
                  </label>
                );
              })}
            </div>
            
            <button
              type="button"
              onClick={() => setIsBairroModalOpen(false)}
              className="w-full mt-6 py-4 rounded-xl bg-green text-navy font-display font-bold text-sm hover:bg-green-dark transition-all"
            >
              Confirmar Seleção
            </button>
          </div>
        </div>
      )}

      {isPraiaModalOpen && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[9999] flex items-center justify-center p-4 animate-fadeIn">
          <div className="bg-[#0b1329] border border-white/10 rounded-3xl w-full max-w-lg p-6 max-h-[80vh] flex flex-col">
            <div className="flex justify-between items-center mb-4">
              <h4 className="font-display font-bold text-lg text-white">
                {perfil === "ambulante" ? "Praias de atuação" : "Praias que costuma frequentar"}
              </h4>
              <button
                type="button"
                onClick={() => setIsPraiaModalOpen(false)}
                className="text-white/40 hover:text-white"
              >
                <X className="w-6 h-6" />
              </button>
            </div>
            
            <div className="flex-1 overflow-y-auto grid grid-cols-1 sm:grid-cols-2 gap-3 pr-2 scrollbar-none">
              {PRAIAS_LIST.map((p) => {
                const checked = selectedPraias.includes(p);
                return (
                  <label
                    key={p}
                    className={`flex items-center gap-3 p-3.5 rounded-xl border cursor-pointer select-none transition-all ${
                      checked
                        ? "bg-green/10 border-green text-green"
                        : "bg-white/5 border-white/5 hover:border-white/20 text-white/70"
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => {
                        const next = checked
                          ? selectedPraias.filter((x) => x !== p)
                          : [...selectedPraias, p];
                        setValue("praias", next, { shouldValidate: true });
                      }}
                      className="h-5 w-5 accent-green shrink-0 cursor-pointer"
                    />
                    <span className="text-sm font-sans font-medium">{p}</span>
                  </label>
                );
              })}
            </div>
            
            <button
              type="button"
              onClick={() => setIsPraiaModalOpen(false)}
              className="w-full mt-6 py-4 rounded-xl bg-green text-navy font-display font-bold text-sm hover:bg-green-dark transition-all"
            >
              Confirmar Seleção
            </button>
          </div>
        </div>
      )}

      {/* Styled component styles for fade animations */}
      <style>{`
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(8px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .animate-fadeIn {
          animation: fadeIn 0.6s cubic-bezier(0.16, 1, 0.3, 1) forwards;
        }
        .scrollbar-none::-webkit-scrollbar {
          display: none;
        }
        .scrollbar-none {
          -ms-overflow-style: none;
          scrollbar-width: none;
        }
      `}</style>

    </div>
  );
}
