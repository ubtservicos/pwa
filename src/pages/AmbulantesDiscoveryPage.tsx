import { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import {
  ArrowLeft,
  Search,
  ShoppingBag,
  MapPin,
  ChevronRight,
  Sparkles,
  Compass,
  Store,
  Layers
} from "lucide-react";
import { supabase } from "@/lib/supabase";

export const CATEGORIAS_MACRO = [
  {
    nome: "Açaí",
    slug: "acai",
    emoji: "🍧",
    desc: "Tigelas, copos montados e barcas de praia",
    badge: "Refrescante",
    cor: "from-purple-900/40 to-purple-950/80",
    borderCor: "hover:border-purple-500/50"
  },
  {
    nome: "Bebidas",
    slug: "bebidas",
    emoji: "🥤",
    desc: "Água de coco na fruta, refrigerantes, sucos e cervejas",
    badge: "Geladas",
    cor: "from-cyan-900/40 to-cyan-950/80",
    borderCor: "hover:border-cyan-500/50"
  },
  {
    nome: "Churrasco",
    slug: "churrasco",
    emoji: "🍢",
    desc: "Espetinhos grelhados, queijo coalho e acompanhamentos",
    badge: "Na Brasa",
    cor: "from-orange-900/40 to-orange-950/80",
    borderCor: "hover:border-orange-500/50"
  },
  {
    nome: "Itens de Praia (Cadeiras, Mesas, Guarda-sóis)",
    slug: "itens-de-praia",
    emoji: "⛱️",
    desc: "Aluguel e venda de cadeiras, barracas e esteiras",
    badge: "Conforto",
    cor: "from-sky-900/40 to-sky-950/80",
    borderCor: "hover:border-sky-500/50"
  },
  {
    nome: "Milho",
    slug: "milho",
    emoji: "🌽",
    desc: "Milho verde cozido no prato ou palha, pamonha e curau",
    badge: "Tradicional",
    cor: "from-yellow-900/40 to-yellow-950/80",
    borderCor: "hover:border-yellow-500/50"
  },
  {
    nome: "Porções",
    slug: "porcoes",
    emoji: "🍤",
    desc: "Iscas de peixe, camarão crocante, lula e batata frita",
    badge: "Petiscos",
    cor: "from-amber-900/40 to-amber-950/80",
    borderCor: "hover:border-amber-500/50"
  },
  {
    nome: "Sobremesas",
    slug: "sobremesas",
    emoji: "🍰",
    desc: "Churros recheados, bolos de pote e doces artesanais",
    badge: "Guloseimas",
    cor: "from-pink-900/40 to-pink-950/80",
    borderCor: "hover:border-pink-500/50"
  },
  {
    nome: "Sorvete",
    slug: "sorvete",
    emoji: "🍦",
    desc: "Picolés artesanais, paletas mexicanas e potes",
    badge: "Artesanal",
    cor: "from-emerald-900/40 to-emerald-950/80",
    borderCor: "hover:border-emerald-500/50"
  },
  {
    nome: "Vestuário",
    slug: "vestuario",
    emoji: "🩳",
    desc: "Moda praia, cangas estampadas, biquínis e óculos",
    badge: "Moda Praia",
    cor: "from-indigo-900/40 to-indigo-950/80",
    borderCor: "hover:border-indigo-500/50"
  },
] as const;

export default function AmbulantesDiscoveryPage() {
  const navigate = useNavigate();

  const [busca, setBusca] = useState("");
  const [userLocationName, setUserLocationName] = useState("Ubatuba, SP");
  const [userCoords, setUserCoords] = useState<{ lat: number; lng: number } | null>(null);

  // Tenta obter geolocalização do cliente
  useEffect(() => {
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setUserCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        setUserLocationName("Praia Grande, Ubatuba");
      },
      () => {
        setUserLocationName("Ubatuba, SP");
      },
      { timeout: 5000 }
    );
  }, []);

  // Filtra as categorias caso o cliente digite na busca
  const categoriasFiltradas = useMemo(() => {
    if (!busca.trim()) return CATEGORIAS_MACRO;
    const q = busca.toLowerCase();
    return CATEGORIAS_MACRO.filter(
      (c) =>
        c.nome.toLowerCase().includes(q) ||
        c.desc.toLowerCase().includes(q) ||
        c.badge.toLowerCase().includes(q)
    );
  }, [busca]);

  return (
    <div className="min-h-screen bg-black text-white font-sans pb-28">
      {/* ========================================================================= */}
      {/* HEADER SUPERIOR DO TOMADOR                                               */}
      {/* ========================================================================= */}
      <header className="sticky top-0 z-30 bg-black/90 backdrop-blur-md border-b border-zinc-800 px-4 py-3.5 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => navigate("/app/home")}
            className="w-9 h-9 rounded-xl bg-zinc-900 border border-zinc-800 flex items-center justify-center text-zinc-300 hover:text-white transition cursor-pointer active:scale-95"
            aria-label="Voltar"
          >
            <ArrowLeft size={18} />
          </button>
          <div>
            <h1 className="text-base font-black tracking-tight text-white flex items-center gap-1.5">
              <span>Praia & Ambulantes</span>
              <span className="w-2 h-2 rounded-full bg-[#00FF66] shadow-[0_0_8px_#00FF66]" />
            </h1>
            <div className="flex items-center gap-1 text-xs text-zinc-400">
              <MapPin size={12} className="text-[#00FF66]" />
              <span className="truncate max-w-[180px]">{userLocationName}</span>
            </div>
          </div>
        </div>

        <button
          type="button"
          onClick={() => navigate("/app/ambulantes/carrinho")}
          className="w-9 h-9 rounded-xl bg-zinc-900 border border-zinc-800 flex items-center justify-center text-zinc-300 hover:text-white transition cursor-pointer"
          aria-label="Carrinho"
        >
          <ShoppingBag size={18} />
        </button>
      </header>

      <main className="max-w-2xl mx-auto px-4 pt-4 space-y-5">
        {/* ========================================================================= */}
        {/* BARRA DE BUSCA GENEROSA                                                  */}
        {/* ========================================================================= */}
        <div className="relative">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-400" size={18} />
          <input
            type="text"
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder="O que você quer pedir na praia hoje? (ex: Sorvete, Água de coco...)"
            className="w-full pl-10 pr-4 py-3 rounded-2xl bg-zinc-900 border border-zinc-800 text-sm text-white placeholder-zinc-500 focus:outline-none focus:border-[#00FF66] transition shadow-inner"
          />
          {busca && (
            <button
              type="button"
              onClick={() => setBusca("")}
              className="absolute right-3.5 top-1/2 -translate-y-1/2 text-xs text-zinc-400 hover:text-white font-bold"
            >
              Limpar
            </button>
          )}
        </div>

        {/* ========================================================================= */}
        {/* HERO BANNER: SHOPPING DA PRAIA                                           */}
        {/* ========================================================================= */}
        <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-zinc-900 via-zinc-900 to-zinc-950 border border-zinc-800 p-5 shadow-2xl">
          <div className="flex items-start justify-between relative z-10">
            <div className="max-w-[70%]">
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider bg-[#00FF66]/15 text-[#00FF66] border border-[#00FF66]/30 mb-2">
                <Sparkles size={11} /> Entrega na sua Cadeira
              </span>
              <h2 className="text-xl font-black text-white leading-tight">
                Peça direto da areia
              </h2>
              <p className="text-xs text-zinc-400 mt-1 leading-relaxed">
                Descubra ambulantes credenciados com estoque diário e receba onde estiver.
              </p>
            </div>
            <div className="w-14 h-14 rounded-2xl bg-[#00FF66]/10 border border-[#00FF66]/20 flex items-center justify-center text-3xl">
              🏖️
            </div>
          </div>
        </div>

        {/* ========================================================================= */}
        {/* MENU DE SHOPPING: BOXES DAS 9 MACRO CATEGORIAS (GRID GENEROSO)           */}
        {/* ========================================================================= */}
        <div>
          <div className="flex items-center justify-between mb-3 px-1">
            <h3 className="text-sm font-black uppercase tracking-wider text-zinc-400 flex items-center gap-1.5">
              <Layers size={15} className="text-[#00FF66]" />
              Categorias na Areia ({categoriasFiltradas.length})
            </h3>
            <span className="text-xs text-zinc-500 font-mono">Escolha para ver os ambulantes</span>
          </div>

          {categoriasFiltradas.length === 0 ? (
            <div className="p-8 rounded-2xl bg-zinc-900 border border-dashed border-zinc-800 text-center my-4">
              <p className="text-sm font-bold text-white mb-1">Nenhuma categoria encontrada para "{busca}"</p>
              <p className="text-xs text-zinc-400 mb-3">Tente buscar por termos mais genéricos como "sorvete", "bebidas" ou "açaí".</p>
              <button
                type="button"
                onClick={() => setBusca("")}
                className="px-4 py-2 rounded-xl text-xs font-bold bg-zinc-800 text-white hover:bg-zinc-700 transition cursor-pointer"
              >
                Limpar busca
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3.5">
              {categoriasFiltradas.map((cat) => (
                <div
                  key={cat.slug}
                  onClick={() => navigate(`/app/ambulantes/categoria/${cat.slug}`)}
                  className={`group relative p-4 rounded-2xl bg-gradient-to-b ${cat.cor} border border-zinc-800/90 ${cat.borderCor} hover:scale-[1.02] active:scale-[0.98] transition-all duration-200 cursor-pointer flex flex-col justify-between min-h-[148px] shadow-lg shadow-black/40`}
                >
                  {/* Topo do Card: Emoji e Badge */}
                  <div className="flex items-start justify-between">
                    <span className="text-3xl filter drop-shadow-md group-hover:scale-110 transition-transform">
                      {cat.emoji}
                    </span>
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-black/60 border border-white/10 text-zinc-300">
                      {cat.badge}
                    </span>
                  </div>

                  {/* Base do Card: Título e Descrição */}
                  <div className="mt-3">
                    <h4 className="text-sm font-black text-white group-hover:text-[#00FF66] transition-colors leading-tight line-clamp-1 mb-1">
                      {cat.nome}
                    </h4>
                    <p className="text-[11px] text-zinc-400 line-clamp-2 leading-relaxed">
                      {cat.desc}
                    </p>
                    <div className="mt-2.5 flex items-center justify-between pt-2 border-t border-white/5">
                      <span className="text-[10px] font-bold text-[#00FF66] flex items-center gap-0.5">
                        Ver ambulantes
                      </span>
                      <ChevronRight size={13} className="text-zinc-500 group-hover:text-[#00FF66] group-hover:translate-x-0.5 transition-all" />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
