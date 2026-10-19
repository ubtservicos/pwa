import { useState, useEffect, useMemo } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  ArrowLeft,
  Search,
  Plus,
  Minus,
  Sparkles,
  ChevronRight,
  CheckCircle2,
  AlertCircle,
  PackageCheck,
  ShoppingBag,
  RotateCcw,
  Check,
  Info
} from "lucide-react";
import { supabase } from "@/lib/supabase";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { Switch } from "@/components/ui/switch";

export interface Fornecedor {
  id: string;
  nome_marca: string;
  logo_url?: string | null;
  ativo: boolean;
}

export interface ProdutoPadrao {
  id: string;
  id_fornecedor?: string | null;
  nome_produto: string;
  descricao?: string | null;
  preco_sugerido: number;
  imagem_url?: string | null;
  categoria: string;
  subcategoria?: string | null;
  ativo: boolean;
  fornecedores_padrao?: {
    id: string;
    nome_marca: string;
    logo_url?: string | null;
  } | null;
}

export interface ItemEstoque {
  id?: string;
  id_produto_padrao: string;
  preco_venda: number;
  quantidade: number;
  disponivel: boolean;
}

// 9 Macro Categorias em ordem alfabética estrita
export const CATEGORIAS_MACRO = [
  { nome: "Açaí", emoji: "🍧", desc: "Tigelas, copos montados, açaí no quilo e barcas de praia." },
  { nome: "Bebidas", emoji: "🥤", desc: "Água de coco na fruta, refrigerantes, cervejas, sucos e energéticos." },
  { nome: "Churrasco", emoji: "🍢", desc: "Espetinhos grelhados (carne, frango, queijo coalho e molhos)." },
  { nome: "Itens de Praia (Cadeiras, Mesas, Guarda-sóis)", emoji: "⛱️", desc: "Aluguel diário e venda de cadeiras, guarda-sóis, mesas e esteiras." },
  { nome: "Milho", emoji: "🌽", desc: "Milho verde cozido no prato/palha, pamonha fresca, curau e bolos." },
  { nome: "Porções", emoji: "🍤", desc: "Frutos do mar, camarão frito, iscas de peixe, lula à doré e batata." },
  { nome: "Sobremesas", emoji: "🍰", desc: "Churros recheados, salada de frutas, tortas caseiras e doces artesanais." },
  { nome: "Sorvete", emoji: "🍦", desc: "Picolés artesanais, paletas mexicanas, sorvetes de massa e potes." },
  { nome: "Vestuário", emoji: "🩳", desc: "Moda praia, cangas estampadas de Ubatuba, biquínis, chapéus e óculos." },
] as const;

export function slugify(text: string): string {
  return text
    .toString()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .replace(/\s+/g, "-")
    .replace(/[^\w-]+/g, "")
    .replace(/--+/g, "-");
}

function resolveImageUrl(url?: string | null): string {
  if (!url) return "";
  if (url.startsWith("http://") || url.startsWith("https://") || url.startsWith("data:")) {
    return url;
  }
  const { data } = supabase.storage.from("catalogo-ambulantes").getPublicUrl(url);
  return data?.publicUrl || url;
}

export default function AmbulantesCatalogoPage() {
  const navigate = useNavigate();
  const { categoriaSlug, marcaSlug } = useParams<{ categoriaSlug?: string; marcaSlug?: string }>();
  const activeSlug = categoriaSlug || marcaSlug;
  const user = useCurrentUser();

  // Estados principais
  const [selectedCategoria, setSelectedCategoria] = useState<string | null>(null);
  const [products, setProducts] = useState<ProdutoPadrao[]>([]);
  const [estoque, setEstoque] = useState<Record<string, ItemEstoque>>({});
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [feedbackMsg, setFeedbackMsg] = useState<{ text: string; type: "success" | "error" } | null>(null);

  // Filtros de Nível 2
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedSubcategoria, setSelectedSubcategoria] = useState<string>("Todas");

  // Rastreamento de imagens quebradas para fallback elegante
  const [brokenImages, setBrokenImages] = useState<Record<string, boolean>>({});

  const showToast = (text: string, type: "success" | "error" = "success") => {
    setFeedbackMsg({ text, type });
    setTimeout(() => setFeedbackMsg(null), 3000);
  };

  // Carrega catálogo padrão e estoque diário do prestador
  useEffect(() => {
    loadAllData();
  }, [user.uid]);

  // Sincroniza categoria ativa com o parâmetro de rota
  useEffect(() => {
    if (!activeSlug) {
      setSelectedCategoria(null);
      return;
    }

    const matched = CATEGORIAS_MACRO.find((cat) => {
      const s = slugify(cat.nome);
      return s === activeSlug.toLowerCase() || s.startsWith(activeSlug.toLowerCase()) || activeSlug.toLowerCase().startsWith(s);
    });

    if (matched) {
      setSelectedCategoria(matched.nome);
      setSelectedSubcategoria("Todas");
      setSearchQuery("");
    } else {
      setSelectedCategoria(null);
    }
  }, [activeSlug]);

  async function loadAllData() {
    try {
      setLoading(true);

      // 1. Carrega produtos padrão ativos da tabela produtos_padrao
      const { data: produtosData, error: pError } = await supabase
        .from("produtos_padrao")
        .select(`
          id,
          id_fornecedor,
          nome_produto,
          descricao,
          preco_sugerido,
          imagem_url,
          categoria,
          subcategoria,
          ativo,
          fornecedores_padrao (
            id,
            nome_marca,
            logo_url
          )
        `)
        .eq("ativo", true)
        .order("nome_produto");

      if (pError) throw pError;
      setProducts((produtosData as unknown as ProdutoPadrao[]) || []);

      // 2. Carrega estoque atual do prestador da tabela estoque_ambulante
      if (user.uid) {
        const { data: estoqueData, error: eError } = await supabase
          .from("estoque_ambulante")
          .select("id, id_produto_padrao, preco_venda, quantidade, disponivel")
          .eq("id_ambulante", user.uid);

        if (!eError && estoqueData) {
          const map: Record<string, ItemEstoque> = {};
          estoqueData.forEach((item) => {
            map[item.id_produto_padrao] = {
              id: item.id,
              id_produto_padrao: item.id_produto_padrao,
              preco_venda: Number(item.preco_venda || 0),
              quantidade: Number(item.quantidade || 0),
              disponivel: item.disponivel !== false,
            };
          });
          setEstoque(map);
        }
      }
    } catch (err: any) {
      console.error("Erro ao carregar dados do catálogo:", err);
      showToast("Não foi possível carregar os produtos. Tente recarregar a página.", "error");
    } finally {
      setLoading(false);
    }
  }

  // Atualiza quantidade ou disponibilidade do produto com persistência no Supabase
  const updateItemEstoque = async (
    produto: ProdutoPadrao,
    novaQtd: number,
    disponivel: boolean
  ) => {
    if (!user.uid) {
      showToast("Faça login para salvar o estoque.", "error");
      return;
    }

    const clampedQtd = Math.max(0, novaQtd);
    const precoVenda = produto.preco_sugerido || 0;

    // Atualização otimista imediata
    setEstoque((prev) => ({
      ...prev,
      [produto.id]: {
        id_produto_padrao: produto.id,
        quantidade: clampedQtd,
        preco_venda: precoVenda,
        disponivel: disponivel,
      },
    }));

    setSavingId(produto.id);

    try {
      const { error } = await supabase.from("estoque_ambulante").upsert(
        {
          id_ambulante: user.uid,
          id_produto_padrao: produto.id,
          quantidade: clampedQtd,
          preco_venda: precoVenda,
          disponivel: disponivel,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "id_ambulante,id_produto_padrao" }
      );

      if (error) throw error;
    } catch (err: any) {
      console.error("Erro ao salvar estoque no Supabase:", err);
      showToast("Erro ao sincronizar com o banco.", "error");
    } finally {
      setTimeout(() => setSavingId(null), 400);
    }
  };

  // Métricas gerais de estoque do ambulante
  const totalItensCarrinho = useMemo(() => {
    return Object.values(estoque).reduce((acc, curr) => acc + (curr.quantidade > 0 ? curr.quantidade : 0), 0);
  }, [estoque]);

  const categoriasComEstoque = useMemo(() => {
    const catsSet = new Set<string>();
    Object.entries(estoque).forEach(([prodId, item]) => {
      if (item.quantidade > 0) {
        const prod = products.find((p) => p.id === prodId);
        if (prod?.categoria) {
          catsSet.add(prod.categoria);
        }
      }
    });
    return catsSet;
  }, [estoque, products]);

  // Contagem de unidades por categoria
  const contagemPorCategoria = useMemo(() => {
    const map: Record<string, number> = {};
    CATEGORIAS_MACRO.forEach((c) => {
      map[c.nome] = 0;
    });

    Object.entries(estoque).forEach(([prodId, item]) => {
      if (item.quantidade > 0) {
        const prod = products.find((p) => p.id === prodId);
        if (prod?.categoria && map[prod.categoria] !== undefined) {
          map[prod.categoria] += item.quantidade;
        }
      }
    });
    return map;
  }, [estoque, products]);

  // Produtos filtrados da categoria ativa (Nível 2)
  const produtosDaCategoria = useMemo(() => {
    if (!selectedCategoria) return [];
    return products.filter((p) => p.categoria === selectedCategoria);
  }, [products, selectedCategoria]);

  // Subcategorias disponíveis para filtro
  const subcategoriasDisponiveis = useMemo(() => {
    const subs = new Set<string>();
    produtosDaCategoria.forEach((p) => {
      if (p.subcategoria && p.subcategoria.trim()) {
        subs.add(p.subcategoria.trim());
      }
    });
    return ["Todas", ...Array.from(subs).sort()];
  }, [produtosDaCategoria]);

  // Produtos finais exibidos no Nível 2
  const produtosExibidos = useMemo(() => {
    return produtosDaCategoria.filter((p) => {
      const matchSearch =
        searchQuery.trim() === "" ||
        p.nome_produto.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (p.descricao && p.descricao.toLowerCase().includes(searchQuery.toLowerCase())) ||
        (p.fornecedores_padrao?.nome_marca && p.fornecedores_padrao.nome_marca.toLowerCase().includes(searchQuery.toLowerCase())) ||
        (p.subcategoria && p.subcategoria.toLowerCase().includes(searchQuery.toLowerCase()));

      const matchSubcat =
        selectedSubcategoria === "Todas" ||
        (p.subcategoria && p.subcategoria.trim() === selectedSubcategoria);

      return matchSearch && matchSubcat;
    });
  }, [produtosDaCategoria, searchQuery, selectedSubcategoria]);

  const macroAtiva = useMemo(() => {
    if (!selectedCategoria) return null;
    return CATEGORIAS_MACRO.find((c) => c.nome === selectedCategoria) || null;
  }, [selectedCategoria]);

  return (
    <div className="min-h-screen pb-28 text-white font-sans bg-black">
      {/* Toast Feedback */}
      {feedbackMsg && (
        <div className="fixed top-5 left-1/2 -translate-x-1/2 z-50 animate-in fade-in slide-in-from-top-4 duration-200">
          <div
            className={`flex items-center gap-2 px-4 py-2.5 rounded-full text-xs font-semibold shadow-2xl backdrop-blur-md border ${
              feedbackMsg.type === "success"
                ? "bg-zinc-900 text-[#00FF66] border-[#00FF66]/40 shadow-[#00FF66]/10"
                : "bg-zinc-900 text-red-400 border-red-500/40"
            }`}
          >
            {feedbackMsg.type === "success" ? <CheckCircle2 size={16} /> : <AlertCircle size={16} />}
            <span>{feedbackMsg.text}</span>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* NÍVEL 1: LISTA DAS 9 CATEGORIAS MACRO (ORDEM ALFABÉTICA - GAMER/BETS)    */}
      {/* ========================================================================= */}
      {!selectedCategoria ? (
        <div className="max-w-2xl mx-auto px-4 pt-6">
          {/* Header Superior */}
          <div className="flex items-center justify-between mb-5">
            <button
              type="button"
              onClick={() => navigate("/app/prestador/ambulantes/online")}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold text-zinc-300 hover:text-white bg-zinc-900 border border-zinc-800 transition cursor-pointer"
            >
              <ArrowLeft size={14} />
              Voltar ao Radar
            </button>
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-[#00FF66] shadow-[0_0_8px_#00FF66] animate-pulse" />
              <span className="text-xs font-black text-[#00FF66] uppercase tracking-wider">
                Gestão Diária
              </span>
            </div>
          </div>

          <div className="mb-6">
            <h1 className="text-2xl font-black tracking-tight text-white mb-1.5 flex items-center gap-2">
              <ShoppingBag className="text-[#00FF66]" size={24} />
              Meu Cardápio de Praia
            </h1>
            <p className="text-sm text-zinc-400">
              Selecione o tipo de produto para informar os sabores e quantidades que você tem no carrinho hoje.
            </p>
          </div>

          {/* Card Resumo do Carrinho - Gamer / Bets Style */}
          <div
            className="p-5 rounded-2xl mb-6 relative overflow-hidden bg-zinc-900 border border-[#00FF66]/30 shadow-[0_4px_24px_rgba(0,255,102,0.08)]"
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs uppercase font-extrabold text-zinc-400 tracking-wider mb-1">
                  Estoque Total Hoje
                </p>
                <div className="flex items-baseline gap-2">
                  <span className="text-3xl font-black text-white">
                    {totalItensCarrinho}
                  </span>
                  <span className="text-sm text-zinc-400">
                    {totalItensCarrinho === 1 ? "item carregado" : "itens carregados"}
                  </span>
                </div>
                <p className="text-xs text-[#00FF66] mt-1 font-bold">
                  {categoriasComEstoque.size} de {CATEGORIAS_MACRO.length} categorias ativas
                </p>
              </div>

              <button
                type="button"
                onClick={() => navigate("/app/prestador/ambulantes/online")}
                className="px-4 py-2.5 rounded-xl font-black text-xs bg-[#00FF66] text-black hover:bg-[#00FF66]/90 transition shadow-lg shadow-[#00FF66]/25 cursor-pointer uppercase tracking-wider"
              >
                Ver no Radar
              </button>
            </div>
          </div>

          {/* Grid das 9 Categorias Macro */}
          <div className="space-y-3">
            <div className="flex items-center justify-between px-1 mb-1">
              <span className="text-xs font-black uppercase tracking-wider text-zinc-400">
                Categorias Oficiais ({CATEGORIAS_MACRO.length})
              </span>
              <span className="text-xs text-zinc-500 font-mono">Ordem Alfabética</span>
            </div>

            {CATEGORIAS_MACRO.map((cat, idx) => {
              const qtdHoje = contagemPorCategoria[cat.nome] || 0;
              const hasEstoque = qtdHoje > 0;

              return (
                <div
                  key={cat.nome}
                  onClick={() => {
                    navigate(`/app/prestador/ambulantes/cardapio/${slugify(cat.nome)}`);
                  }}
                  className={`group relative p-4 rounded-2xl border transition-all duration-200 cursor-pointer flex items-center gap-4 ${
                    hasEstoque
                      ? "bg-zinc-900 border-[#00FF66]/50 shadow-[0_0_15px_rgba(0,255,102,0.08)]"
                      : "bg-zinc-900/70 border-zinc-800 hover:border-zinc-700 hover:bg-zinc-900"
                  }`}
                >
                  {/* Ícone Grande */}
                  <div
                    className={`w-14 h-14 rounded-2xl flex items-center justify-center text-2xl flex-shrink-0 transition-transform group-hover:scale-105 ${
                      hasEstoque
                        ? "bg-[#00FF66]/15 border border-[#00FF66]/40 text-[#00FF66]"
                        : "bg-zinc-950 border border-zinc-800"
                    }`}
                  >
                    {cat.emoji}
                  </div>

                  {/* Informações da Categoria */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-xs font-mono text-zinc-500 font-bold">
                        {String(idx + 1).padStart(2, "0")}.
                      </span>
                      <h2 className="text-base font-black text-white truncate group-hover:text-[#00FF66] transition-colors">
                        {cat.nome}
                      </h2>
                    </div>
                    <p className="text-xs text-zinc-400 line-clamp-1 mb-2">
                      {cat.desc}
                    </p>

                    {/* Badge de Quantidade no Carrinho Hoje */}
                    <div>
                      {hasEstoque ? (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-extrabold bg-[#00FF66]/15 text-[#00FF66] border border-[#00FF66]/30">
                          <Check size={12} strokeWidth={3} />
                          {qtdHoje} {qtdHoje === 1 ? "unidade hoje" : "unidades hoje"}
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] text-zinc-500 bg-zinc-950 border border-zinc-800 font-mono">
                          0 no carrinho
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Seta de Drill-down */}
                  <div className="w-8 h-8 rounded-full bg-zinc-950 border border-zinc-800 flex items-center justify-center text-zinc-400 group-hover:text-black group-hover:bg-[#00FF66] group-hover:border-[#00FF66] transition-all flex-shrink-0">
                    <ChevronRight size={18} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ) : (
        /* ========================================================================= */
        /* NÍVEL 2: PRODUTOS E GESTÃO DE ESTOQUE DIÁRIO (GAMER / BETS STYLE)        */
        /* ========================================================================= */
        <div className="max-w-2xl mx-auto px-4 pt-6">
          {/* Header Superior com Breadcrumb e Voltar */}
          <div className="flex items-center justify-between mb-4">
            <button
              type="button"
              onClick={() => {
                navigate("/app/prestador/ambulantes/cardapio");
              }}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold text-zinc-300 hover:text-white bg-zinc-900 border border-zinc-800 transition cursor-pointer"
            >
              <ArrowLeft size={14} />
              Categorias Macro
            </button>

            <span className="text-xs font-bold text-zinc-400">
              {produtosExibidos.length} {produtosExibidos.length === 1 ? "produto" : "produtos"}
            </span>
          </div>

          {/* Título da Categoria Macro Selecionada */}
          <div className="p-4 rounded-2xl bg-zinc-900 border border-zinc-800 mb-5">
            <div className="flex items-center gap-3">
              <span className="text-3xl">{macroAtiva?.emoji || "📦"}</span>
              <div className="flex-1 min-w-0">
                <h1 className="text-xl font-black text-white truncate">
                  {selectedCategoria}
                </h1>
                <p className="text-xs text-zinc-400 line-clamp-1">
                  {macroAtiva?.desc || "Defina as quantidades que você possui no carrinho hoje."}
                </p>
              </div>
            </div>
          </div>

          {/* Barra de Busca Rápida */}
          <div className="relative mb-3">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-400" size={16} />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={`Buscar produto ou sabor em ${selectedCategoria}...`}
              className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-zinc-900 border border-zinc-800 text-sm text-white placeholder-zinc-500 focus:outline-none focus:border-[#00FF66] transition"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery("")}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-zinc-400 hover:text-white"
              >
                Limpar
              </button>
            )}
          </div>

          {/* Chips de Subcategoria */}
          {subcategoriasDisponiveis.length > 2 && (
            <div className="flex items-center gap-2 overflow-x-auto pb-3 mb-4 scrollbar-none">
              {subcategoriasDisponiveis.map((sub) => {
                const isSelected = selectedSubcategoria === sub;
                return (
                  <button
                    key={sub}
                    type="button"
                    onClick={() => setSelectedSubcategoria(sub)}
                    className={`px-3 py-1 rounded-full text-xs font-bold whitespace-nowrap transition cursor-pointer ${
                      isSelected
                        ? "bg-[#00FF66] text-black shadow-md shadow-[#00FF66]/20"
                        : "bg-zinc-900 text-zinc-300 border border-zinc-800 hover:border-zinc-700"
                    }`}
                  >
                    {sub}
                  </button>
                );
              })}
            </div>
          )}

          {/* Lista de Produtos da Categoria */}
          {produtosExibidos.length === 0 ? (
            <div className="p-8 rounded-2xl bg-zinc-900/50 border border-dashed border-zinc-800 text-center my-6">
              <div className="w-12 h-12 rounded-full bg-zinc-950 border border-zinc-800 flex items-center justify-center mx-auto mb-3 text-2xl">
                {macroAtiva?.emoji || "🔍"}
              </div>
              <h3 className="text-base font-bold text-white mb-1">
                Nenhum produto encontrado
              </h3>
              <p className="text-xs text-zinc-400 max-w-sm mx-auto mb-4">
                {searchQuery || selectedSubcategoria !== "Todas"
                  ? "Tente ajustar o termo de busca ou limpar os filtros de subcategoria."
                  : "A UBT ainda não cadastrou produtos padrão nesta categoria macro no painel administrativo."}
              </p>
              {(searchQuery || selectedSubcategoria !== "Todas") && (
                <button
                  type="button"
                  onClick={() => {
                    setSearchQuery("");
                    setSelectedSubcategoria("Todas");
                  }}
                  className="px-4 py-2 rounded-xl text-xs font-bold bg-zinc-800 text-white hover:bg-zinc-700 transition cursor-pointer"
                >
                  Limpar Filtros
                </button>
              )}
            </div>
          ) : (
            <div className="space-y-3">
              {produtosExibidos.map((prod) => {
                const itemEstoque = estoque[prod.id] || {
                  id_produto_padrao: prod.id,
                  quantidade: 0,
                  preco_venda: prod.preco_sugerido,
                  disponivel: true,
                };

                const qtdAtual = itemEstoque.quantidade;
                const isDisponivel = itemEstoque.disponivel !== false;
                const hasEstoque = qtdAtual > 0;
                const imgResolved = resolveImageUrl(prod.imagem_url);
                const isBroken = brokenImages[prod.id];
                const isSaving = savingId === prod.id;

                return (
                  <div
                    key={prod.id}
                    className={`p-4 rounded-2xl border transition-all ${
                      hasEstoque
                        ? "bg-zinc-900 border-[#00FF66]/50 shadow-[0_0_12px_rgba(0,255,102,0.06)]"
                        : "bg-zinc-900/60 border-zinc-800"
                    }`}
                  >
                    <div className="flex gap-3.5 items-start">
                      {/* Foto / Thumbnail do Produto */}
                      <div className="w-16 h-16 rounded-xl bg-zinc-950 border border-zinc-800 flex items-center justify-center overflow-hidden flex-shrink-0 relative">
                        {imgResolved && !isBroken ? (
                          <img
                            src={imgResolved}
                            alt={prod.nome_produto}
                            className="w-full h-full object-cover"
                            onError={() => setBrokenImages((prev) => ({ ...prev, [prod.id]: true }))}
                          />
                        ) : (
                          <span className="text-2xl">{macroAtiva?.emoji || "📦"}</span>
                        )}
                        {isSaving && (
                          <div className="absolute inset-0 bg-black/80 backdrop-blur-xs flex items-center justify-center">
                            <span className="w-4 h-4 border-2 border-[#00FF66] border-t-transparent rounded-full animate-spin" />
                          </div>
                        )}
                      </div>

                      {/* Informações Textuais */}
                      <div className="flex-1 min-w-0">
                        <div className="flex flex-wrap items-center gap-1.5 mb-1">
                          {/* Marca Parceira */}
                          {prod.fornecedores_padrao?.nome_marca && (
                            <span className="px-2 py-0.5 rounded-md text-[10px] font-black bg-[#00FF66]/15 text-[#00FF66] border border-[#00FF66]/30 uppercase tracking-wider">
                              {prod.fornecedores_padrao.nome_marca}
                            </span>
                          )}

                          {/* Subcategoria */}
                          {prod.subcategoria && (
                            <span className="px-2 py-0.5 rounded-md text-[10px] font-medium bg-zinc-950 text-zinc-400 border border-zinc-800">
                              {prod.subcategoria}
                            </span>
                          )}
                        </div>

                        <h3 className="text-sm font-black text-white truncate mb-0.5">
                          {prod.nome_produto}
                        </h3>

                        {prod.descricao && (
                          <p className="text-xs text-zinc-400 line-clamp-1 mb-1.5">
                            {prod.descricao}
                          </p>
                        )}

                        <div className="flex items-center gap-2">
                          <span className="text-xs font-black text-[#00FF66]">
                            R$ {(prod.preco_sugerido || 0).toFixed(2)}
                          </span>
                          <span className="text-[11px] text-zinc-500">
                            (preço sugerido)
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Controles de Estoque Diário e Disponibilidade */}
                    <div className="mt-3.5 pt-3 border-t border-zinc-800/80 flex flex-wrap items-center justify-between gap-3">
                      {/* Toggle Disponível no App */}
                      <div className="flex items-center gap-2">
                        <Switch
                          checked={isDisponivel}
                          onCheckedChange={(checked) => {
                            updateItemEstoque(prod, qtdAtual, checked);
                          }}
                        />
                        <span className="text-xs font-medium text-zinc-300">
                          {isDisponivel ? "Visível no app" : "Pausado"}
                        </span>
                      </div>

                      {/* Controles Rápidos: - Qtd + e Atalhos */}
                      <div className="flex items-center gap-1.5">
                        {/* Botão Menos */}
                        <button
                          type="button"
                          onClick={() => {
                            updateItemEstoque(prod, Math.max(0, qtdAtual - 1), isDisponivel);
                          }}
                          disabled={qtdAtual <= 0}
                          className="w-8 h-8 rounded-lg bg-zinc-800 hover:bg-zinc-700 disabled:opacity-30 disabled:cursor-not-allowed flex items-center justify-center text-white transition cursor-pointer"
                        >
                          <Minus size={14} />
                        </button>

                        {/* Visor Numérico de Quantidade */}
                        <div
                          className={`min-w-10 h-8 px-2 rounded-lg flex items-center justify-center font-mono font-black text-sm border ${
                            hasEstoque
                              ? "bg-[#00FF66]/15 text-[#00FF66] border-[#00FF66]/40"
                              : "bg-zinc-950 text-zinc-500 border-zinc-800"
                          }`}
                        >
                          {qtdAtual}
                        </div>

                        {/* Botão Mais */}
                        <button
                          type="button"
                          onClick={() => {
                            updateItemEstoque(prod, qtdAtual + 1, isDisponivel);
                          }}
                          className="w-8 h-8 rounded-lg bg-[#00FF66] text-black hover:bg-[#00FF66]/90 flex items-center justify-center font-black transition cursor-pointer shadow-sm shadow-[#00FF66]/30"
                        >
                          <Plus size={14} strokeWidth={3} />
                        </button>

                        {/* Atalhos Rápidos de Lote (+5, +10) */}
                        <button
                          type="button"
                          onClick={() => {
                            updateItemEstoque(prod, qtdAtual + 5, isDisponivel);
                          }}
                          className="px-2 h-8 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-[11px] font-black text-zinc-200 border border-zinc-700 transition cursor-pointer"
                          title="Adicionar 5 unidades"
                        >
                          +5
                        </button>

                        <button
                          type="button"
                          onClick={() => {
                            updateItemEstoque(prod, qtdAtual + 10, isDisponivel);
                          }}
                          className="px-2 h-8 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-[11px] font-black text-zinc-200 border border-zinc-700 transition cursor-pointer"
                          title="Adicionar 10 unidades"
                        >
                          +10
                        </button>

                        {/* Botão Zerar Estoque (se > 0) */}
                        {hasEstoque && (
                          <button
                            type="button"
                            onClick={() => {
                              updateItemEstoque(prod, 0, isDisponivel);
                            }}
                            className="w-8 h-8 rounded-lg bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/20 flex items-center justify-center text-xs transition cursor-pointer"
                            title="Zerar estoque deste item"
                          >
                            <RotateCcw size={13} />
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* BARRA FIXA DE AÇÃO NO RODAPÉ - GAMER / BETS STYLE                        */}
      {/* ========================================================================= */}
      <div className="fixed bottom-0 left-0 right-0 z-40 bg-zinc-950/95 backdrop-blur-md border-t border-zinc-800 p-3.5">
        <div className="max-w-2xl mx-auto flex items-center justify-between gap-3">
          <div>
            <p className="text-xs text-zinc-400 font-medium">Carrinho hoje</p>
            <p className="text-sm font-black text-white">
              {totalItensCarrinho} {totalItensCarrinho === 1 ? "unidade" : "unidades"}
            </p>
          </div>

          <button
            type="button"
            onClick={() => navigate("/app/prestador/ambulantes/online")}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl font-black text-xs bg-[#00FF66] text-black hover:bg-[#00FF66]/90 transition shadow-lg shadow-[#00FF66]/25 cursor-pointer uppercase tracking-wider"
          >
            <Check size={16} strokeWidth={3} />
            Concluir e Voltar ao Radar
          </button>
        </div>
      </div>
    </div>
  );
}
