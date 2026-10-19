import { useState, useEffect, useMemo } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  ArrowLeft,
  MapPin,
  SlidersHorizontal,
  ShoppingBag,
  Sparkles,
  ChevronRight,
  Package,
  Layers,
  ArrowUpDown,
  Check
} from "lucide-react";
import { supabase } from "@/lib/supabase";
import { CATEGORIAS_MACRO } from "./AmbulantesDiscoveryPage";
import { haversineKm, formatDist } from "@/utils/geo";

// Coordenadas padrão de fallback (Centro / Praia do Tenório - Ubatuba)
const DEFAULT_UBATUBA_COORDS = { lat: -23.4332, lng: -45.0834 };

interface ProdutoEstoqueResumo {
  id: string;
  nome: string;
  preco: number;
  quantidade: number;
  imagemUrl?: string | null;
}

interface AmbulanteCardData {
  id: string; // ID da sessão / prestador
  nome: string;
  modalidade: string;
  address: string;
  lat: number;
  lng: number;
  distanciaKm: number;
  distanciaTexto: string;
  isOnline: boolean;
  menorPreco: number;
  totalVariedade: number;
  produtos: ProdutoEstoqueResumo[];
}

type TipoOrdenacao = "proximo" | "menor_preco" | "variedade";

export default function AmbulantesCategoriaAmbulantesPage() {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();

  // Categoria ativa
  const categoria = useMemo(() => {
    if (!slug) return null;
    return (
      CATEGORIAS_MACRO.find((c) => c.slug.toLowerCase() === slug.toLowerCase()) ||
      CATEGORIAS_MACRO.find((c) => c.nome.toLowerCase() === slug.toLowerCase()) ||
      null
    );
  }, [slug]);

  // Estados locais
  const [loading, setLoading] = useState(true);
  const [ambulantes, setAmbulantes] = useState<AmbulanteCardData[]>([]);
  const [ordenacao, setOrdenacao] = useState<TipoOrdenacao>("proximo");
  const [showFilterModal, setShowFilterModal] = useState(false);
  const [userCoords, setUserCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [userLocationName, setUserLocationName] = useState("Ubatuba, SP");

  // 1. Geolocalização do Tomador
  useEffect(() => {
    if (!navigator.geolocation) {
      setUserCoords(DEFAULT_UBATUBA_COORDS);
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setUserCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        setUserLocationName("Sua localização atual");
      },
      () => {
        setUserCoords(DEFAULT_UBATUBA_COORDS);
        setUserLocationName("Praia Grande, Ubatuba");
      },
      { timeout: 5000 }
    );
  }, []);

  // 2. Consulta ao banco de dados real (estoque_ambulante)
  useEffect(() => {
    if (!categoria) {
      setLoading(false);
      return;
    }

    async function carregarAmbulantes() {
      try {
        setLoading(true);

        // Passo A: Buscar os produtos padrão ativos cadastrados nesta Categoria Macro
        const { data: produtosPadrao, error: errProd } = await supabase
          .from("produtos_padrao")
          .select("id, nome_produto, preco_sugerido, imagem_url, categoria")
          .eq("categoria", categoria.nome)
          .eq("ativo", true);

        if (errProd) throw errProd;

        if (!produtosPadrao || produtosPadrao.length === 0) {
          setAmbulantes([]);
          setLoading(false);
          return;
        }

        const produtosMap = new Map<string, { nome: string; precoSugerido: number; imagemUrl?: string }>();
        const produtoIds: string[] = [];
        produtosPadrao.forEach((p) => {
          produtosMap.set(p.id, {
            nome: p.nome_produto,
            precoSugerido: Number(p.preco_sugerido) || 0,
            imagemUrl: p.imagem_url,
          });
          produtoIds.push(p.id);
        });

        // Passo B: Buscar itens no estoque_ambulante que tenham quantidade > 0 e estejam disponíveis
        const { data: estoqueRows, error: errEstoque } = await supabase
          .from("estoque_ambulante")
          .select("id, id_ambulante, id_produto_padrao, preco_venda, quantidade, disponivel")
          .in("id_produto_padrao", produtoIds)
          .gt("quantidade", 0)
          .eq("disponivel", true);

        if (errEstoque) throw errEstoque;

        if (!estoqueRows || estoqueRows.length === 0) {
          setAmbulantes([]);
          setLoading(false);
          return;
        }

        // Agrupar produtos por id_ambulante
        const ambulanteEstoqueMap = new Map<string, ProdutoEstoqueResumo[]>();
        estoqueRows.forEach((row) => {
          const info = produtosMap.get(row.id_produto_padrao);
          if (!info) return;

          const precoFinal = Number(row.preco_venda) > 0 ? Number(row.preco_venda) : info.precoSugerido;
          const item: ProdutoEstoqueResumo = {
            id: row.id_produto_padrao,
            nome: info.nome,
            preco: precoFinal,
            quantidade: Number(row.quantidade),
            imagemUrl: info.imagemUrl,
          };

          const list = ambulanteEstoqueMap.get(row.id_ambulante) || [];
          list.push(item);
          ambulanteEstoqueMap.set(row.id_ambulante, list);
        });

        const distinctAmbulanteIds = Array.from(ambulanteEstoqueMap.keys());
        if (distinctAmbulanteIds.length === 0) {
          setAmbulantes([]);
          setLoading(false);
          return;
        }

        // Passo C: Buscar sessões e usuários cadastrados para esses ambulantes
        const [{ data: sessionsData }, { data: usuariosData }] = await Promise.all([
          supabase
            .from("ambulante_sessions")
            .select("id, modalidade, address, lat, lng, is_online")
            .in("id", distinctAmbulanteIds),
          supabase
            .from("usuarios")
            .select("id, nome, avatar_url")
            .in("id", distinctAmbulanteIds),
        ]);

        const sessionsMap = new Map<string, any>();
        if (sessionsData) {
          sessionsData.forEach((s) => sessionsMap.set(s.id, s));
        }

        const usuariosMap = new Map<string, any>();
        if (usuariosData) {
          usuariosData.forEach((u) => usuariosMap.set(u.id, u));
        }

        const clientLat = userCoords?.lat ?? DEFAULT_UBATUBA_COORDS.lat;
        const clientLng = userCoords?.lng ?? DEFAULT_UBATUBA_COORDS.lng;

        // Passo D: Montar os cards completos dos ambulantes com cálculo de distância
        const cards: AmbulanteCardData[] = distinctAmbulanteIds.map((ambId) => {
          const session = sessionsMap.get(ambId);
          const usuario = usuariosMap.get(ambId);
          const prods = ambulanteEstoqueMap.get(ambId) || [];

          const lat = session?.lat || DEFAULT_UBATUBA_COORDS.lat;
          const lng = session?.lng || DEFAULT_UBATUBA_COORDS.lng;
          const distKm = haversineKm(clientLat, clientLng, lat, lng);

          // Formatar distância amigável
          const distanciaTexto =
            distKm < 1 ? `${Math.round(distKm * 1000)}m de você` : `${distKm.toFixed(1)}km de você`;

          const menorPreco = prods.reduce(
            (min, p) => (p.preco < min ? p.preco : min),
            prods[0]?.preco ?? 0
          );

          return {
            id: ambId,
            nome: usuario?.nome || "Ambulante Credenciado",
            modalidade: session?.modalidade || "local_fixo",
            address: session?.address || "Praia de Ubatuba",
            lat,
            lng,
            distanciaKm: distKm,
            distanciaTexto,
            isOnline: session?.is_online !== false,
            menorPreco,
            totalVariedade: prods.length,
            produtos: prods,
          };
        });

        setAmbulantes(cards);
      } catch (err: any) {
        console.error("Erro ao carregar ambulantes da categoria:", err);
        setAmbulantes([]);
      } finally {
        setLoading(false);
      }
    }

    carregarAmbulantes();
  }, [categoria, userCoords]);

  // 3. Ordenação dinâmica
  const ambulantesOrdenados = useMemo(() => {
    const list = [...ambulantes];
    if (ordenacao === "proximo") {
      return list.sort((a, b) => a.distanciaKm - b.distanciaKm);
    }
    if (ordenacao === "menor_preco") {
      return list.sort((a, b) => a.menorPreco - b.menorPreco);
    }
    if (ordenacao === "variedade") {
      return list.sort((a, b) => b.totalVariedade - a.totalVariedade);
    }
    return list;
  }, [ambulantes, ordenacao]);

  if (!categoria) {
    return (
      <div className="min-h-screen bg-black text-white p-6 flex flex-col items-center justify-center text-center">
        <p className="text-lg font-bold mb-2">Categoria não encontrada</p>
        <p className="text-xs text-zinc-400 mb-6">A categoria informada não existe ou foi descontinuada.</p>
        <button
          onClick={() => navigate("/app/ambulantes")}
          className="px-5 py-2.5 rounded-xl bg-[#00FF66] text-black font-black text-sm"
        >
          Voltar para Categorias
        </button>
      </div>
    );
  }

  const getLabelOrdenacao = (tipo: TipoOrdenacao) => {
    switch (tipo) {
      case "proximo":
        return "Mais Próximo";
      case "menor_preco":
        return "Menor Preço";
      case "variedade":
        return "Maior Variedade";
    }
  };

  return (
    <div className="min-h-screen bg-black text-white font-sans pb-28">
      {/* ========================================================================= */}
      {/* HEADER FIXO SUPERIOR COM BOTÃO DE FILTRO                                  */}
      {/* ========================================================================= */}
      <header className="sticky top-0 z-30 bg-black/90 backdrop-blur-md border-b border-zinc-800 px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => navigate("/app/ambulantes")}
            className="w-9 h-9 rounded-xl bg-zinc-900 border border-zinc-800 flex items-center justify-center text-zinc-300 hover:text-white transition cursor-pointer active:scale-95"
            aria-label="Voltar para categorias"
          >
            <ArrowLeft size={18} />
          </button>
          <div className="flex items-center gap-2">
            <span className="text-2xl filter drop-shadow">{categoria.emoji}</span>
            <div>
              <h1 className="text-base font-black tracking-tight text-white line-clamp-1">
                {categoria.nome}
              </h1>
              <p className="text-[11px] text-zinc-400 flex items-center gap-1">
                <MapPin size={11} className="text-[#00FF66]" />
                <span className="truncate max-w-[170px]">{userLocationName}</span>
              </p>
            </div>
          </div>
        </div>

        {/* Botão de Filtro / Ordenação */}
        <div className="relative">
          <button
            type="button"
            onClick={() => setShowFilterModal(!showFilterModal)}
            className={`px-3 py-1.5 rounded-xl border flex items-center gap-1.5 text-xs font-bold transition cursor-pointer active:scale-95 ${
              showFilterModal
                ? "bg-[#00FF66] text-black border-[#00FF66]"
                : "bg-zinc-900 border-zinc-800 text-zinc-300 hover:text-white hover:border-zinc-700"
            }`}
            aria-label="Filtrar ambulantes"
          >
            <SlidersHorizontal size={14} className={showFilterModal ? "text-black" : "text-[#00FF66]"} />
            <span className="hidden sm:inline">{getLabelOrdenacao(ordenacao)}</span>
          </button>

          {/* Dropdown de Ordenação */}
          {showFilterModal && (
            <div className="absolute right-0 mt-2 w-48 rounded-2xl bg-zinc-900 border border-zinc-700 shadow-2xl p-2 z-50">
              <p className="text-[10px] font-black uppercase tracking-wider text-zinc-500 px-3 py-1.5">
                Ordenar por
              </p>
              {(["proximo", "menor_preco", "variedade"] as TipoOrdenacao[]).map((tipo) => (
                <button
                  key={tipo}
                  type="button"
                  onClick={() => {
                    setOrdenacao(tipo);
                    setShowFilterModal(false);
                  }}
                  className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-bold transition text-left cursor-pointer ${
                    ordenacao === tipo
                      ? "bg-[#00FF66]/15 text-[#00FF66] border border-[#00FF66]/30"
                      : "text-zinc-300 hover:bg-zinc-800 hover:text-white"
                  }`}
                >
                  <span>{getLabelOrdenacao(tipo)}</span>
                  {ordenacao === tipo && <Check size={14} className="text-[#00FF66]" />}
                </button>
              ))}
            </div>
          )}
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 pt-4 space-y-4">
        {/* ========================================================================= */}
        {/* SUBHEADER: RESUMO DE RESULTADOS E CRITÉRIO ATIVO                         */}
        {/* ========================================================================= */}
        <div className="flex items-center justify-between px-1">
          <p className="text-xs text-zinc-400">
            {loading ? (
              "Buscando estoque na areia..."
            ) : (
              <>
                <strong className="text-white font-black">{ambulantesOrdenados.length}</strong>{" "}
                {ambulantesOrdenados.length === 1 ? "ambulante encontrado" : "ambulantes encontrados"}
              </>
            )}
          </p>

          <div className="flex items-center gap-1.5 text-[11px] font-medium text-zinc-400 bg-zinc-900 border border-zinc-800/80 px-2.5 py-1 rounded-full">
            <ArrowUpDown size={11} className="text-[#00FF66]" />
            <span>{getLabelOrdenacao(ordenacao)}</span>
          </div>
        </div>

        {/* ========================================================================= */}
        {/* LISTAGEM DOS CARDS DE AMBULANTES OU SKELETON                             */}
        {/* ========================================================================= */}
        {loading ? (
          <div className="space-y-3.5">
            {[1, 2, 3].map((i) => (
              <div
                key={i}
                className="p-5 rounded-2xl bg-zinc-900/60 border border-zinc-800/80 animate-pulse space-y-3"
              >
                <div className="flex items-start justify-between">
                  <div className="h-5 w-40 bg-zinc-800 rounded-lg" />
                  <div className="h-5 w-24 bg-zinc-800 rounded-full" />
                </div>
                <div className="h-3 w-56 bg-zinc-800/70 rounded" />
                <div className="flex gap-2 pt-2">
                  <div className="h-6 w-20 bg-zinc-800 rounded-lg" />
                  <div className="h-6 w-24 bg-zinc-800 rounded-lg" />
                </div>
                <div className="h-10 w-full bg-zinc-800 rounded-xl mt-3" />
              </div>
            ))}
          </div>
        ) : ambulantesOrdenados.length === 0 ? (
          /* ========================================================================= */
          /* EMPTY STATE GENEROSO (SEM AMBULANTES NO MOMENTO)                          */
          /* ========================================================================= */
          <div className="my-8 p-8 rounded-3xl bg-zinc-900/60 border border-dashed border-zinc-800 text-center space-y-4">
            <div className="w-16 h-16 mx-auto rounded-3xl bg-zinc-800/80 border border-zinc-700/80 flex items-center justify-center text-3xl shadow-inner">
              {categoria.emoji}
            </div>
            <div>
              <h3 className="text-base font-black text-white">
                Nenhum ambulante com estoque ativo de {categoria.nome}
              </h3>
              <p className="text-xs text-zinc-400 mt-2 max-w-sm mx-auto leading-relaxed">
                Os ambulantes credenciados cadastram seus estoques conforme circulam pelas praias de Ubatuba. Volte em instantes ou veja outras categorias disponíveis agora.
              </p>
            </div>
            <div className="pt-2">
              <button
                type="button"
                onClick={() => navigate("/app/ambulantes")}
                className="px-5 py-2.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-white font-bold text-xs transition border border-zinc-700 cursor-pointer active:scale-95"
              >
                Explorar outras categorias
              </button>
            </div>
          </div>
        ) : (
          /* ========================================================================= */
          /* CARDS DOS AMBULANTES ATIVOS                                               */
          /* ========================================================================= */
          <div className="space-y-3.5">
            {ambulantesOrdenados.map((amb, index) => (
              <div
                key={amb.id}
                className="group relative rounded-2xl bg-zinc-900 border border-zinc-800/90 hover:border-[#00FF66]/50 p-4 transition-all duration-200 shadow-xl space-y-3"
              >
                {/* Topo do Card: Nome + Distância */}
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2.5">
                    <div className="w-10 h-10 rounded-xl bg-[#00FF66]/10 border border-[#00FF66]/30 flex items-center justify-center text-lg font-black text-[#00FF66]">
                      {amb.nome.charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <h4 className="text-sm font-black text-white group-hover:text-[#00FF66] transition-colors leading-tight">
                        {amb.nome}
                      </h4>
                      <div className="flex items-center gap-1.5 mt-0.5 text-xs text-zinc-400">
                        <MapPin size={12} className="text-zinc-500 shrink-0" />
                        <span className="truncate max-w-[190px]">{amb.address}</span>
                      </div>
                    </div>
                  </div>

                  {/* Badge de Distância (Destaque para o mais próximo) */}
                  <div
                    className={`px-2.5 py-1 rounded-full text-xs font-black tracking-tight shrink-0 flex items-center gap-1 ${
                      index === 0 && ordenacao === "proximo"
                        ? "bg-[#00FF66] text-black shadow-[0_0_10px_rgba(0,255,102,0.35)]"
                        : "bg-zinc-800 text-[#00FF66] border border-[#00FF66]/20"
                    }`}
                  >
                    <span>📍</span>
                    <span>{amb.distanciaTexto}</span>
                  </div>
                </div>

                {/* Linha de Menor Preço e Variedade */}
                <div className="flex items-center justify-between text-xs pt-1 border-t border-zinc-800/60">
                  <span className="text-zinc-400 font-medium">
                    A partir de{" "}
                    <strong className="text-[#00FF66] font-black text-sm">
                      R$ {amb.menorPreco.toFixed(2).replace(".", ",")}
                    </strong>
                  </span>
                  <span className="text-zinc-500 font-mono text-[11px]">
                    {amb.totalVariedade} {amb.totalVariedade === 1 ? "item disponível" : "itens disponíveis"}
                  </span>
                </div>

                {/* Prévia dos produtos em estoque (Chips com quantidade) */}
                <div className="flex flex-wrap gap-1.5 pt-0.5">
                  {amb.produtos.slice(0, 4).map((p) => (
                    <span
                      key={p.id}
                      className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-zinc-800/70 border border-zinc-700/60 text-[11px] text-zinc-300"
                    >
                      <span className="truncate max-w-[120px]">{p.nome}</span>
                      <strong className="text-[#00FF66] font-mono text-[10px]">
                        {p.quantidade} un
                      </strong>
                    </span>
                  ))}
                  {amb.produtos.length > 4 && (
                    <span className="inline-flex items-center px-2 py-1 rounded-lg bg-zinc-800/40 text-[10px] text-zinc-500 font-bold">
                      +{amb.produtos.length - 4} mais
                    </span>
                  )}
                </div>

                {/* Botão de Ação "Ver Cardápio & Pedir" */}
                <button
                  type="button"
                  onClick={() => navigate(`/app/ambulantes/${amb.id}`)}
                  className="w-full mt-2 py-2.5 px-4 rounded-xl bg-[#00FF66] hover:bg-[#00e65c] text-black font-black text-xs transition-all duration-150 flex items-center justify-center gap-2 cursor-pointer shadow-[0_0_15px_rgba(0,255,102,0.2)] active:scale-[0.99]"
                >
                  <ShoppingBag size={14} className="text-black" />
                  <span>Ver Cardápio & Pedir</span>
                  <ChevronRight size={14} className="text-black" />
                </button>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
