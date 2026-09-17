import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import {
  ArrowLeft,
  Search,
  Plus,
  Minus,
  Check,
  Sparkles,
  ShoppingBag,
  Store,
  ChevronRight,
  Filter,
  CheckCircle2,
  AlertCircle,
  Flame,
  Info
} from "lucide-react";
import { supabase } from "@/lib/supabase";
import { useCurrentUser } from "@/hooks/useCurrentUser";

interface Fornecedor {
  id: string;
  nome_marca: string;
  logo_url?: string;
  ativo: boolean;
  total_produtos?: number;
}

interface ProdutoPadrao {
  id: string;
  id_fornecedor: string;
  nome_produto: string;
  descricao?: string;
  preco_sugerido: number;
  imagem_url?: string;
  categoria: string;
  ativo: boolean;
  fornecedores_padrao?: {
    nome_marca: string;
  };
}

interface ItemEstoque {
  id?: string;
  id_produto_padrao: string;
  preco_venda: number;
  quantidade: number;
  disponivel: boolean;
}

export default function AmbulantesCatalogoPage() {
  const navigate = useNavigate();
  const user = useCurrentUser();

  // Navigation steps
  const [step, setStep] = useState<1 | 2>(1);
  const [selectedBrand, setSelectedBrand] = useState<Fornecedor | null>(null);

  // Data states
  const [brands, setBrands] = useState<Fornecedor[]>([]);
  const [products, setProducts] = useState<ProdutoPadrao[]>([]);
  const [estoque, setEstoque] = useState<Record<string, ItemEstoque>>({});
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [feedbackMsg, setFeedbackMsg] = useState<{ text: string; type: "success" | "error" } | null>(null);

  // Filters
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string>("Todas");

  useEffect(() => {
    loadData();
  }, [user.uid]);

  const showToast = (text: string, type: "success" | "error" = "success") => {
    setFeedbackMsg({ text, type });
    setTimeout(() => setFeedbackMsg(null), 3000);
  };

  async function loadData() {
    try {
      setLoading(true);

      // 1. Carregar fornecedores
      const { data: fornecedoresData, error: fError } = await supabase
        .from("fornecedores_padrao")
        .select("*")
        .eq("ativo", true)
        .order("nome_marca");

      if (fError) throw fError;

      // 2. Carregar produtos padrão
      const { data: produtosData, error: pError } = await supabase
        .from("produtos_padrao")
        .select("*, fornecedores_padrao(nome_marca)")
        .eq("ativo", true)
        .order("nome_produto");

      if (pError) throw pError;

      // Contagem de produtos por marca
      const brandList = (fornecedoresData || []).map((b) => {
        const count = (produtosData || []).filter((p) => p.id_fornecedor === b.id).length;
        return { ...b, total_produtos: count };
      });
      setBrands(brandList);
      setProducts(produtosData || []);

      // 3. Carregar estoque do ambulante autenticado
      if (user.uid) {
        const { data: estoqueData, error: eError } = await supabase
          .from("estoque_ambulante")
          .select("*")
          .eq("id_ambulante", user.uid);

        if (!eError && estoqueData) {
          const map: Record<string, ItemEstoque> = {};
          estoqueData.forEach((item) => {
            map[item.id_produto_padrao] = {
              id: item.id,
              id_produto_padrao: item.id_produto_padrao,
              preco_venda: Number(item.preco_venda),
              quantidade: Number(item.quantidade) || 0,
              disponivel: item.disponivel !== false,
            };
          });
          setEstoque(map);
        }
      }
    } catch (err: any) {
      console.error("Erro ao carregar catálogo de ambulantes:", err);
      showToast("Falha ao carregar catálogo. Tente novamente.", "error");
    } finally {
      setLoading(false);
    }
  }

  // Atualiza ou insere item no estoque do ambulante
  const handleUpdateEstoque = async (
    produto: ProdutoPadrao,
    newPreco?: number,
    newQtd?: number,
    newDisponivel?: boolean
  ) => {
    if (!user.uid) {
      showToast("Você precisa estar autenticado.", "error");
      return;
    }

    const current = estoque[produto.id] || {
      id_produto_padrao: produto.id,
      preco_venda: Number(produto.preco_sugerido),
      quantidade: 0,
      disponivel: true,
    };

    const precoVenda = newPreco !== undefined ? Math.max(0, newPreco) : current.preco_venda;
    const quantidade = newQtd !== undefined ? Math.max(0, newQtd) : current.quantidade;
    const disponivel = newDisponivel !== undefined ? newDisponivel : current.disponivel;

    // Atualização otimista
    setEstoque((prev) => ({
      ...prev,
      [produto.id]: {
        ...current,
        preco_venda: precoVenda,
        quantidade,
        disponivel,
      },
    }));

    setSavingId(produto.id);

    try {
      const { data, error } = await supabase
        .from("estoque_ambulante")
        .upsert(
          {
            id_ambulante: user.uid,
            id_produto_padrao: produto.id,
            preco_venda: precoVenda,
            quantidade,
            disponivel,
            updated_at: new Date().toISOString(),
          },
          { onConflict: "id_ambulante,id_produto_padrao" }
        )
        .select()
        .single();

      if (error) throw error;

      if (data) {
        setEstoque((prev) => ({
          ...prev,
          [produto.id]: {
            id: data.id,
            id_produto_padrao: data.id_produto_padrao,
            preco_venda: Number(data.preco_venda),
            quantidade: Number(data.quantidade),
            disponivel: data.disponivel,
          },
        }));
      }
    } catch (err: any) {
      console.error("Erro ao salvar no estoque:", err);
      showToast("Erro ao sincronizar produto.", "error");
    } finally {
      setSavingId(null);
    }
  };

  // Filtragem de produtos para o Passo 2
  const filteredProducts = products.filter((p) => {
    const matchesBrand = !selectedBrand || p.id_fornecedor === selectedBrand.id;
    const matchesCategory = selectedCategory === "Todas" || p.categoria === selectedCategory;
    const matchesSearch =
      searchQuery === "" ||
      p.nome_produto.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (p.descricao && p.descricao.toLowerCase().includes(searchQuery.toLowerCase()));

    return matchesBrand && matchesCategory && matchesSearch;
  });

  // Categorias disponíveis para a marca selecionada
  const categoriesList = [
    "Todas",
    ...Array.from(
      new Set(
        products
          .filter((p) => !selectedBrand || p.id_fornecedor === selectedBrand.id)
          .map((p) => p.categoria)
      )
    ),
  ];

  const totalSelectedItems = Object.values(estoque).filter((i) => i.disponivel && i.quantidade > 0).length;

  return (
    <div className="min-h-screen bg-[#09090B] text-zinc-100 font-sans pb-32">
      {/* Toast Feedback */}
      {feedbackMsg && (
        <div
          className={`fixed top-4 left-1/2 -translate-x-1/2 z-50 px-4 py-2.5 rounded-xl shadow-2xl flex items-center gap-2 text-sm font-semibold border ${
            feedbackMsg.type === "success"
              ? "bg-[#0DB87E]/20 text-[#00FF66] border-[#0DB87E]/50"
              : "bg-red-950/80 text-red-300 border-red-800"
          }`}
        >
          {feedbackMsg.type === "success" ? <CheckCircle2 size={16} /> : <AlertCircle size={16} />}
          {feedbackMsg.text}
        </div>
      )}

      {/* Header Sticky */}
      <header className="sticky top-0 z-40 bg-[#09090B]/90 backdrop-blur-md border-b border-[#27272A] px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => {
              if (step === 2) {
                setStep(1);
                setSelectedBrand(null);
              } else {
                navigate(-1);
              }
            }}
            className="w-9 h-9 rounded-xl bg-[#18181B] border border-[#27272A] flex items-center justify-center text-zinc-300 active:scale-95 transition-all"
            aria-label="Voltar"
          >
            <ArrowLeft size={18} />
          </button>
          <div>
            <h1 className="text-base font-bold tracking-tight text-white flex items-center gap-1.5 font-display">
              <span>Cardápio do Ambulante</span>
              <span className="text-[10px] uppercase font-bold tracking-widest px-1.5 py-0.5 rounded bg-[#0DB87E]/20 text-[#00FF66] border border-[#0DB87E]/40">
                Gamer Dark
              </span>
            </h1>
            <p className="text-xs text-zinc-400">
              {step === 1 ? "Selecione uma marca parceira" : selectedBrand?.nome_marca || "Todos os Produtos"}
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={() => navigate("/app/prestador/ambulantes/online")}
          className="text-xs font-bold text-[#00FF66] bg-[#18181B] border border-[#0DB87E]/40 hover:bg-[#0DB87E]/10 px-3 py-1.5 rounded-lg flex items-center gap-1.5 transition-all active:scale-95"
        >
          <Store size={14} />
          <span>Ficar Online</span>
        </button>
      </header>

      {/* Main Content */}
      <main className="max-w-md mx-auto px-4 pt-4">
        {/* ========================================================================= */}
        {/* PASSO 1: SELEÇÃO DE MARCAS PARCEIRAS (HIGH CONTRAST GRID) */}
        {/* ========================================================================= */}
        {step === 1 && (
          <div className="space-y-4">
            {/* Banner Informativo */}
            <div className="p-4 rounded-2xl bg-gradient-to-br from-[#18181B] via-[#121215] to-[#0D1815] border border-[#27272A] relative overflow-hidden">
              <div className="absolute top-0 right-0 w-32 h-32 bg-[#0DB87E]/10 rounded-full blur-2xl pointer-events-none" />
              <div className="flex items-start gap-3 relative z-10">
                <div className="w-10 h-10 rounded-xl bg-[#0DB87E]/20 border border-[#0DB87E]/40 flex items-center justify-center shrink-0 text-[#00FF66]">
                  <Sparkles size={20} />
                </div>
                <div>
                  <h2 className="text-sm font-bold text-white font-display">
                    Cardápio Oficial UBT & Marcas
                  </h2>
                  <p className="text-xs text-zinc-400 mt-1 leading-relaxed">
                    Escolha as marcas que você vende na praia para carregar os produtos padrão com fotos e preços sugeridos.
                  </p>
                </div>
              </div>
            </div>

            {/* Grid de Marcas */}
            <div>
              <div className="flex items-center justify-between mb-3 px-1">
                <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-400 flex items-center gap-1.5">
                  <Flame size={14} className="text-[#00FF66]" />
                  <span>Marcas Parceiras Cadastradas</span>
                </h3>
                <span className="text-xs text-zinc-500 font-medium">
                  {brands.length} marcas
                </span>
              </div>

              {loading ? (
                <div className="grid grid-cols-2 gap-3">
                  {[1, 2, 3, 4, 5, 6].map((i) => (
                    <div key={i} className="h-32 rounded-2xl bg-[#18181B] animate-pulse border border-[#27272A]" />
                  ))}
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-3">
                  {brands.map((brand) => (
                    <button
                      key={brand.id}
                      type="button"
                      onClick={() => {
                        setSelectedBrand(brand);
                        setStep(2);
                        setSelectedCategory("Todas");
                        setSearchQuery("");
                      }}
                      className="group relative p-4 rounded-2xl bg-[#18181B] border border-[#27272A] hover:border-[#0DB87E] active:scale-[0.98] transition-all flex flex-col items-center text-center justify-between min-h-[140px] shadow-lg shadow-black/40 hover:shadow-[#0DB87E]/10"
                    >
                      {/* Logo / Thumbnail */}
                      <div className="w-14 h-14 rounded-2xl bg-[#09090B] border border-[#27272A] overflow-hidden flex items-center justify-center p-1 group-hover:border-[#0DB87E]/60 transition-colors">
                        {brand.logo_url ? (
                          <img
                            src={brand.logo_url}
                            alt={brand.nome_marca}
                            className="w-full h-full object-cover rounded-xl"
                            loading="lazy"
                          />
                        ) : (
                          <ShoppingBag size={24} className="text-[#0DB87E]" />
                        )}
                      </div>

                      {/* Info */}
                      <div className="w-full mt-2">
                        <h4 className="text-sm font-bold text-white group-hover:text-[#00FF66] transition-colors truncate">
                          {brand.nome_marca}
                        </h4>
                        <p className="text-[11px] text-zinc-400 mt-0.5 flex items-center justify-center gap-1">
                          <span className="inline-block w-1.5 h-1.5 rounded-full bg-[#00FF66]" />
                          <span>{brand.total_produtos || 0} itens disponíveis</span>
                        </p>
                      </div>

                      {/* Badge Acessar */}
                      <div className="w-full pt-2 mt-1 border-t border-[#27272A]/80 flex items-center justify-center gap-1 text-[11px] font-semibold text-zinc-400 group-hover:text-[#00FF66]">
                        <span>Configurar</span>
                        <ChevronRight size={12} />
                      </div>
                    </button>
                  ))}

                  {/* Botão Outra Marca / Todos os Produtos */}
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedBrand(null);
                      setStep(2);
                      setSelectedCategory("Todas");
                      setSearchQuery("");
                    }}
                    className="group relative p-4 rounded-2xl bg-gradient-to-br from-[#18181B] to-[#121215] border-2 border-dashed border-[#27272A] hover:border-[#00FF66] active:scale-[0.98] transition-all flex flex-col items-center text-center justify-center min-h-[140px]"
                  >
                    <div className="w-12 h-12 rounded-2xl bg-[#09090B] border border-[#27272A] flex items-center justify-center text-[#00FF66] group-hover:scale-110 transition-transform">
                      <Plus size={24} />
                    </div>
                    <span className="text-xs font-bold text-white mt-2 group-hover:text-[#00FF66] transition-colors">
                      Outra Marca / Geral
                    </span>
                    <span className="text-[10px] text-zinc-500 mt-0.5">
                      Ver catálogo completo
                    </span>
                  </button>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* PASSO 2: LISTA ESTILO DELIVERY COM CONTROLES RÁPIDOS [ - ] [ 0 ] [ + ] */}
        {/* ========================================================================= */}
        {step === 2 && (
          <div className="space-y-4">
            {/* Header da Marca Selecionada */}
            <div className="p-3.5 rounded-2xl bg-[#18181B] border border-[#27272A] flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-[#09090B] border border-[#27272A] flex items-center justify-center overflow-hidden">
                  {selectedBrand?.logo_url ? (
                    <img
                      src={selectedBrand.logo_url}
                      alt={selectedBrand.nome_marca}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <ShoppingBag size={18} className="text-[#0DB87E]" />
                  )}
                </div>
                <div>
                  <h2 className="text-sm font-bold text-white truncate">
                    {selectedBrand ? selectedBrand.nome_marca : "Catálogo Completo"}
                  </h2>
                  <p className="text-[11px] text-zinc-400">
                    {filteredProducts.length} itens encontrados
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => {
                  setStep(1);
                  setSelectedBrand(null);
                }}
                className="text-xs font-semibold text-zinc-400 hover:text-white px-2.5 py-1 rounded-lg bg-[#09090B] border border-[#27272A]"
              >
                Trocar Marca
              </button>
            </div>

            {/* Barra de Busca */}
            <div className="relative">
              <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-500" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Buscar picolé, sabor, açaí..."
                className="w-full bg-[#18181B] border border-[#27272A] rounded-xl pl-9 pr-4 py-2.5 text-sm text-white placeholder-zinc-500 focus:outline-none focus:border-[#0DB87E] transition-colors"
              />
            </div>

            {/* Filtro de Categorias (Pills Horizontais) */}
            <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none">
              {categoriesList.map((cat) => (
                <button
                  key={cat}
                  type="button"
                  onClick={() => setSelectedCategory(cat)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all ${
                    selectedCategory === cat
                      ? "bg-[#0DB87E] text-[#09090B] font-bold shadow-md shadow-[#0DB87E]/20"
                      : "bg-[#18181B] text-zinc-400 border border-[#27272A] hover:text-white"
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>

            {/* Lista de Produtos (Estilo Delivery) */}
            <div className="space-y-3">
              {filteredProducts.length === 0 ? (
                <div className="p-8 rounded-2xl bg-[#18181B] border border-[#27272A] text-center">
                  <ShoppingBag size={32} className="mx-auto text-zinc-600 mb-2" />
                  <p className="text-sm font-semibold text-zinc-300">Nenhum produto encontrado</p>
                  <p className="text-xs text-zinc-500 mt-1">Tente ajustar a busca ou a categoria selecionada.</p>
                </div>
              ) : (
                filteredProducts.map((produto) => {
                  const itemEstoque = estoque[produto.id] || {
                    id_produto_padrao: produto.id,
                    preco_venda: Number(produto.preco_sugerido),
                    quantidade: 0,
                    disponivel: true,
                  };
                  const isSaved = savingId === produto.id;
                  const isSelected = itemEstoque.quantidade > 0 && itemEstoque.disponivel;

                  return (
                    <div
                      key={produto.id}
                      className={`p-3.5 rounded-2xl border transition-all ${
                        isSelected
                          ? "bg-[#18181B] border-[#0DB87E]/60 shadow-lg shadow-[#0DB87E]/5"
                          : "bg-[#121215] border-[#27272A] opacity-90"
                      }`}
                    >
                      <div className="flex gap-3">
                        {/* Foto Miniatura */}
                        <div className="w-20 h-20 rounded-xl bg-[#09090B] border border-[#27272A] overflow-hidden shrink-0 relative">
                          {produto.imagem_url ? (
                            <img
                              src={produto.imagem_url}
                              alt={produto.nome_produto}
                              className="w-full h-full object-cover"
                              loading="lazy"
                            />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center text-zinc-600">
                              <ShoppingBag size={24} />
                            </div>
                          )}
                          {isSelected && (
                            <div className="absolute top-1 right-1 w-5 h-5 rounded-full bg-[#00FF66] text-[#09090B] flex items-center justify-center font-bold text-[10px] shadow">
                              ✓
                            </div>
                          )}
                        </div>

                        {/* Dados do Produto */}
                        <div className="flex-1 min-w-0 flex flex-col justify-between">
                          <div>
                            <div className="flex items-start justify-between gap-1">
                              <h4 className="text-sm font-bold text-white leading-tight truncate">
                                {produto.nome_produto}
                              </h4>
                              <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-zinc-800 text-zinc-400 shrink-0">
                                {produto.categoria}
                              </span>
                            </div>

                            {produto.descricao && (
                              <p className="text-[11px] text-zinc-400 mt-1 line-clamp-2 leading-relaxed">
                                {produto.descricao}
                              </p>
                            )}
                          </div>

                          <div className="flex items-center gap-2 mt-2">
                            <span className="text-[11px] text-zinc-500 font-medium">
                              Sugerido: R$ {Number(produto.preco_sugerido).toFixed(2)}
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Controles de Preço e Quantidade [ - ] [ count ] [ + ] */}
                      <div className="mt-3 pt-3 border-t border-[#27272A] flex items-center justify-between gap-2">
                        {/* Preço de Venda do Ambulante */}
                        <div className="flex items-center gap-1.5">
                          <label className="text-xs text-zinc-400 font-medium whitespace-nowrap">
                            Meu Preço:
                          </label>
                          <div className="flex items-center bg-[#09090B] border border-[#27272A] rounded-lg px-2 py-1 focus-within:border-[#0DB87E]">
                            <span className="text-xs font-bold text-[#00FF66] mr-1">R$</span>
                            <input
                              type="number"
                              step="0.50"
                              min="0"
                              value={itemEstoque.preco_venda}
                              onChange={(e) => {
                                const val = parseFloat(e.target.value) || 0;
                                handleUpdateEstoque(produto, val, undefined, undefined);
                              }}
                              className="w-16 bg-transparent text-xs font-bold text-white focus:outline-none"
                            />
                          </div>
                        </div>

                        {/* Controle Rápido Stepper [ - ] [ 0 ] [ + ] */}
                        <div className="flex items-center gap-1 bg-[#09090B] border border-[#27272A] rounded-xl p-1">
                          <button
                            type="button"
                            onClick={() => {
                              const newQtd = Math.max(0, itemEstoque.quantidade - 1);
                              handleUpdateEstoque(produto, undefined, newQtd, newQtd > 0);
                            }}
                            className="w-8 h-8 rounded-lg bg-[#18181B] hover:bg-[#27272A] text-zinc-300 flex items-center justify-center active:scale-95 transition-all"
                            aria-label="Diminuir"
                          >
                            <Minus size={14} />
                          </button>

                          <span className={`w-8 text-center text-xs font-bold ${itemEstoque.quantidade > 0 ? "text-[#00FF66]" : "text-zinc-500"}`}>
                            {itemEstoque.quantidade}
                          </span>

                          <button
                            type="button"
                            onClick={() => {
                              const newQtd = itemEstoque.quantidade + 1;
                              handleUpdateEstoque(produto, undefined, newQtd, true);
                            }}
                            className="w-8 h-8 rounded-lg bg-[#0DB87E] hover:bg-[#00FF66] text-[#09090B] font-bold flex items-center justify-center active:scale-95 transition-all shadow-md shadow-[#0DB87E]/20"
                            aria-label="Aumentar"
                          >
                            <Plus size={14} />
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        )}
      </main>

      {/* Floating Bottom Summary Bar */}
      <footer className="fixed bottom-0 left-0 right-0 z-40 bg-[#09090B]/95 backdrop-blur-lg border-t border-[#27272A] p-4">
        <div className="max-w-md mx-auto flex items-center justify-between gap-3">
          <div>
            <p className="text-xs text-zinc-400">Total no seu estoque</p>
            <p className="text-sm font-bold text-white flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-[#00FF66] animate-pulse" />
              <span>{totalSelectedItems} produtos ativos</span>
            </p>
          </div>

          <button
            type="button"
            onClick={() => navigate("/app/prestador/ambulantes/online")}
            className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-[#0DB87E] to-[#00FF66] text-[#09090B] font-display font-extrabold text-sm flex items-center gap-2 shadow-lg shadow-[#0DB87E]/20 active:scale-95 transition-all"
          >
            <span>Ir para a Praia</span>
            <ChevronRight size={16} />
          </button>
        </div>
      </footer>
    </div>
  );
}
