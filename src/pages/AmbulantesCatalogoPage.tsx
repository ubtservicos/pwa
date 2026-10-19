import { useState, useEffect, useRef } from "react";
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
  UploadCloud,
  Trash2,
  Edit3,
  Layers,
  PackageCheck,
  PackagePlus,
  X,
  Tag
} from "lucide-react";
import { supabase } from "@/lib/supabase";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { Switch } from "@/components/ui/switch";

interface Fornecedor {
  id: string;
  nome_marca: string;
  logo_url?: string;
  ativo: boolean;
  total_produtos?: number;
}

interface ProdutoPadrao {
  id: string;
  id_fornecedor?: string | null;
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

type TabMode = "facilitado" | "livre";

export default function AmbulantesCatalogoPage() {
  const navigate = useNavigate();
  const user = useCurrentUser();

  // Modo ativo: Facilitado (Marcas Parceiras) vs Livre (Produtos Próprios)
  const [activeTab, setActiveTab] = useState<TabMode>("facilitado");

  // Navigation state para o fluxo facilitado
  const [selectedBrand, setSelectedBrand] = useState<Fornecedor | null>(null);
  const [isOnline, setIsOnline] = useState(false);

  // Dados do backend
  const [brands, setBrands] = useState<Fornecedor[]>([]);
  const [products, setProducts] = useState<ProdutoPadrao[]>([]);
  const [customProducts, setCustomProducts] = useState<ProdutoPadrao[]>([]);
  const [estoque, setEstoque] = useState<Record<string, ItemEstoque>>({});
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [feedbackMsg, setFeedbackMsg] = useState<{ text: string; type: "success" | "error" } | null>(null);

  // Filtros do fluxo facilitado
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string>("Todas");

  // Estado do Modal de Criação / Edição do Fluxo Livre
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingCustomProduct, setEditingCustomProduct] = useState<ProdutoPadrao | null>(null);
  const [modalNome, setModalNome] = useState("");
  const [modalCategoria, setModalCategoria] = useState("Lanches");
  const [modalDescricao, setModalDescricao] = useState("");
  const [modalPreco, setModalPreco] = useState("10.00");
  const [modalQuantidade, setModalQuantidade] = useState("10");
  const [modalImagemUrl, setModalImagemUrl] = useState("");
  const [modalUploadingImage, setModalUploadingImage] = useState(false);
  const [modalSubmitting, setModalSubmitting] = useState(false);
  const customFileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    loadData();
    loadSessionStatus();
  }, [user.uid]);

  const showToast = (text: string, type: "success" | "error" = "success") => {
    setFeedbackMsg({ text, type });
    setTimeout(() => setFeedbackMsg(null), 3500);
  };

  async function loadSessionStatus() {
    if (!user.uid) return;
    try {
      const { data } = await supabase
        .from("ambulante_sessions")
        .select("is_online")
        .eq("id", user.uid)
        .maybeSingle();
      if (data) {
        setIsOnline(!!data.is_online);
      }
    } catch {
      // Ignora erro
    }
  }

  async function loadData() {
    try {
      setLoading(true);

      // 1. Carregar fornecedores parceiros cadastrados pela UBT
      const { data: fornecedoresData, error: fError } = await supabase
        .from("fornecedores_padrao")
        .select("*")
        .eq("ativo", true)
        .order("nome_marca");

      if (fError) throw fError;

      // 2. Carregar produtos padrão de marcas
      const { data: produtosData, error: pError } = await supabase
        .from("produtos_padrao")
        .select("*, fornecedores_padrao(nome_marca)")
        .not("id_fornecedor", "is", null)
        .eq("ativo", true)
        .order("nome_produto");

      if (pError) throw pError;

      // Contagem de produtos padrão por marca
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

          // 4. Carregar produtos próprios (criados pelo usuário no fluxo livre)
          const customIds = estoqueData.map((e) => e.id_produto_padrao);
          if (customIds.length > 0) {
            const { data: customData } = await supabase
              .from("produtos_padrao")
              .select("*")
              .is("id_fornecedor", null)
              .in("id", customIds);

            setCustomProducts(customData || []);
          }
        }
      }
    } catch (err: any) {
      console.error("Erro ao carregar catálogo de ambulantes:", err);
      showToast("Falha ao carregar catálogo. Tente novamente.", "error");
    } finally {
      setLoading(false);
    }
  }

  // Atualiza quantidade ou preço no estoque do ambulante
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
      showToast("Erro ao sincronizar estoque.", "error");
    } finally {
      setSavingId(null);
    }
  };

  // Alterna status Online/Offline na praia
  const handleToggleOnline = async (checked: boolean) => {
    setIsOnline(checked);
    if (!user.uid) return;
    try {
      await supabase
        .from("ambulante_sessions")
        .update({ is_online: checked })
        .eq("id", user.uid);
      showToast(checked ? "Você agora está ONLINE na praia!" : "Status alterado para OFFLINE.", "success");
    } catch {
      showToast("Não foi possível atualizar o status no servidor.", "error");
    }
  };

  // Upload de imagem de produto próprio para o bucket catalogo-ambulantes
  const handleCustomImageUpload = async (file: File) => {
    try {
      setModalUploadingImage(true);
      const fileExt = file.name.split(".").pop() || "jpg";
      const fileName = `custom/${user.uid || "anon"}_${Date.now()}.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from("catalogo-ambulantes")
        .upload(fileName, file, { upsert: true });

      if (uploadError) throw uploadError;

      const { data: urlData } = supabase.storage
        .from("catalogo-ambulantes")
        .getPublicUrl(fileName);

      if (urlData?.publicUrl) {
        setModalImagemUrl(urlData.publicUrl);
        showToast("Foto do produto enviada com sucesso!", "success");
      }
    } catch (err: any) {
      console.error("Erro no upload da foto:", err);
      showToast("Falha no upload da foto: " + (err.message || ""), "error");
    } finally {
      setModalUploadingImage(false);
    }
  };

  // Abertura do modal para criar ou editar produto do fluxo livre
  const openCreateModal = () => {
    setEditingCustomProduct(null);
    setModalNome("");
    setModalCategoria("Lanches");
    setModalDescricao("");
    setModalPreco("10.00");
    setModalQuantidade("10");
    setModalImagemUrl("");
    setIsModalOpen(true);
  };

  const openEditModal = (p: ProdutoPadrao) => {
    const est = estoque[p.id];
    setEditingCustomProduct(p);
    setModalNome(p.nome_produto);
    setModalCategoria(p.categoria || "Lanches");
    setModalDescricao(p.descricao || "");
    setModalPreco(est ? String(est.preco_venda) : String(p.preco_sugerido));
    setModalQuantidade(est ? String(est.quantidade) : "0");
    setModalImagemUrl(p.imagem_url || "");
    setIsModalOpen(true);
  };

  // Salvar produto do Fluxo Livre
  const handleSaveCustomProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user.uid) {
      showToast("Você precisa estar autenticado.", "error");
      return;
    }
    if (!modalNome.trim()) {
      showToast("Informe o título do produto.", "error");
      return;
    }

    const precoNum = Math.max(0, parseFloat(modalPreco.replace(",", ".")) || 0);
    const qtdNum = Math.max(0, parseInt(modalQuantidade, 10) || 0);

    setModalSubmitting(true);

    try {
      let prodId = editingCustomProduct?.id;

      if (!prodId) {
        // Criação de novo produto sem fornecedor vinculado (Fluxo Livre)
        const { data: newProd, error: createError } = await supabase
          .from("produtos_padrao")
          .insert({
            id_fornecedor: null,
            nome_produto: modalNome.trim(),
            categoria: modalCategoria.trim() || "Geral",
            descricao: modalDescricao.trim() || null,
            preco_sugerido: precoNum,
            imagem_url: modalImagemUrl || null,
            ativo: true,
          })
          .select()
          .single();

        if (createError) throw createError;
        prodId = newProd.id;

        setCustomProducts((prev) => [newProd, ...prev]);
      } else {
        // Atualização de produto próprio existente
        const { error: updateError } = await supabase
          .from("produtos_padrao")
          .update({
            nome_produto: modalNome.trim(),
            categoria: modalCategoria.trim() || "Geral",
            descricao: modalDescricao.trim() || null,
            preco_sugerido: precoNum,
            imagem_url: modalImagemUrl || null,
            updated_at: new Date().toISOString(),
          })
          .eq("id", prodId);

        if (updateError) throw updateError;

        setCustomProducts((prev) =>
          prev.map((p) =>
            p.id === prodId
              ? {
                  ...p,
                  nome_produto: modalNome.trim(),
                  categoria: modalCategoria.trim(),
                  descricao: modalDescricao.trim(),
                  preco_sugerido: precoNum,
                  imagem_url: modalImagemUrl || undefined,
                }
              : p
          )
        );
      }

      // Atualiza ou insere o item no estoque diário do prestador
      await handleUpdateEstoque(
        {
          id: prodId,
          nome_produto: modalNome.trim(),
          preco_sugerido: precoNum,
          categoria: modalCategoria.trim(),
          ativo: true,
        },
        precoNum,
        qtdNum,
        true
      );

      showToast("Produto próprio salvo com sucesso no seu cardápio!", "success");
      setIsModalOpen(false);
    } catch (err: any) {
      console.error("Erro ao salvar produto próprio:", err);
      showToast("Erro ao salvar produto: " + (err.message || ""), "error");
    } finally {
      setModalSubmitting(false);
    }
  };

  // Exclusão de produto próprio
  const handleDeleteCustomProduct = async (prodId: string) => {
    if (!confirm("Tem certeza que deseja remover este produto do seu cardápio?")) return;

    try {
      // 1. Remove do estoque
      await supabase.from("estoque_ambulante").delete().eq("id_produto_padrao", prodId).eq("id_ambulante", user.uid);
      // 2. Remove da lista local
      setCustomProducts((prev) => prev.filter((p) => p.id !== prodId));
      setEstoque((prev) => {
        const next = { ...prev };
        delete next[prodId];
        return next;
      });
      showToast("Produto removido com sucesso.", "success");
    } catch {
      showToast("Não foi possível excluir o produto.", "error");
    }
  };

  // Filtragem de produtos padrão (Fluxo Facilitado)
  const filteredProducts = products.filter((p) => {
    const matchesBrand = !selectedBrand || p.id_fornecedor === selectedBrand.id;
    const matchesCategory = selectedCategory === "Todas" || p.categoria === selectedCategory;
    const matchesSearch =
      searchQuery === "" ||
      p.nome_produto.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (p.descricao && p.descricao.toLowerCase().includes(searchQuery.toLowerCase()));

    return matchesBrand && matchesCategory && matchesSearch;
  });

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

  // Total de itens cadastrados no estoque com quantidade > 0
  const totalItensAtivos = Object.values(estoque).filter((i) => i.disponivel && i.quantidade > 0).length;
  const totalUnidades = Object.values(estoque).reduce(
    (acc, curr) => (curr.disponivel ? acc + curr.quantidade : acc),
    0
  );

  return (
    <div className="min-h-screen bg-[#09090B] text-zinc-100 font-sans pb-40">
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
              if (selectedBrand) {
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
            <h1 className="text-base font-bold tracking-tight text-white font-display">
              Gestão de Cardápio
            </h1>
            <p className="text-xs text-zinc-400">
              {activeTab === "facilitado"
                ? selectedBrand ? selectedBrand.nome_marca : "Catálogo de Marcas"
                : "Seus Produtos Próprios"}
            </p>
          </div>
        </div>

        {/* Toggle Switch Online / Offline */}
        <div className="flex items-center gap-2 bg-[#18181B] border border-[#27272A] px-2.5 py-1.5 rounded-xl">
          <div className="flex flex-col text-right">
            <span className="text-[11px] font-bold text-white leading-tight">
              {isOnline ? "Na Praia" : "Offline"}
            </span>
            <span className="text-[9px] text-[#00FF66] font-medium leading-none">
              {isOnline ? "Online" : "Pausado"}
            </span>
          </div>
          <Switch
            checked={isOnline}
            onCheckedChange={handleToggleOnline}
          />
        </div>
      </header>

      {/* SELETOR DE ESTRATÉGIA: FLUXO FACILITADO VS FLUXO LIVRE */}
      <div className="px-4 pt-4 max-w-xl mx-auto">
        <div className="grid grid-cols-2 p-1 bg-[#18181B] border border-[#27272A] rounded-2xl gap-1">
          <button
            type="button"
            onClick={() => {
              setActiveTab("facilitado");
              setSelectedBrand(null);
            }}
            className={`flex items-center justify-center gap-2 py-2.5 rounded-xl text-xs font-bold transition-all ${
              activeTab === "facilitado"
                ? "bg-[#0DB87E] text-[#09090B] shadow-md shadow-[#0DB87E]/20"
                : "text-zinc-400 hover:text-white"
            }`}
          >
            <Store size={15} />
            <span>Marcas Parceiras</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("livre")}
            className={`flex items-center justify-center gap-2 py-2.5 rounded-xl text-xs font-bold transition-all ${
              activeTab === "livre"
                ? "bg-[#0DB87E] text-[#09090B] shadow-md shadow-[#0DB87E]/20"
                : "text-zinc-400 hover:text-white"
            }`}
          >
            <Sparkles size={15} />
            <span>Produtos Próprios</span>
          </button>
        </div>
      </div>

      <main className="max-w-xl mx-auto px-4 pt-4 space-y-4">
        {/* ========================================================================= */}
        {/* TAB 1: FLUXO FACILITADO (CATÁLOGO PADRÃO / MARCAS DE FÁBRICA)             */}
        {/* ========================================================================= */}
        {activeTab === "facilitado" && (
          <div className="space-y-4">
            {!selectedBrand ? (
              <>
                <div className="bg-[#18181B] border border-[#27272A] rounded-2xl p-4">
                  <h2 className="text-sm font-bold text-white flex items-center gap-2">
                    <Store size={18} className="text-[#00FF66]" />
                    Selecione a Marca / Fábrica do seu Carrinho
                  </h2>
                  <p className="text-xs text-zinc-400 mt-1">
                    Não precisa cadastrar foto ou descrição. Escolha a marca e informe apenas as quantidades que colocou na caixa hoje.
                  </p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {brands.map((b) => (
                    <button
                      key={b.id}
                      type="button"
                      onClick={() => setSelectedBrand(b)}
                      className="p-4 rounded-2xl bg-[#18181B] border border-[#27272A] hover:border-[#0DB87E] flex items-center justify-between text-left transition-all active:scale-[0.99] group cursor-pointer shadow-lg shadow-black/40"
                    >
                      <div className="flex items-center gap-3.5">
                        <div className="w-12 h-12 rounded-xl bg-[#09090B] border border-[#27272A] flex items-center justify-center overflow-hidden shrink-0">
                          {b.logo_url ? (
                            <img src={b.logo_url} alt={b.nome_marca} className="w-full h-full object-contain p-1" />
                          ) : (
                            <span className="text-2xl">🍦</span>
                          )}
                        </div>
                        <div>
                          <p className="text-sm font-bold text-white group-hover:text-[#00FF66] transition-colors">
                            {b.nome_marca}
                          </p>
                          <p className="text-xs text-zinc-400 mt-0.5">
                            {b.total_produtos || 0} produtos no catálogo oficial
                          </p>
                        </div>
                      </div>
                      <ChevronRight size={18} className="text-zinc-500 group-hover:text-[#00FF66] transition-colors shrink-0" />
                    </button>
                  ))}

                  {brands.length === 0 && !loading && (
                    <div className="col-span-full p-8 text-center bg-[#18181B] rounded-2xl border border-[#27272A]">
                      <Store size={32} className="text-zinc-600 mx-auto mb-2" />
                      <p className="text-sm font-semibold text-white">Nenhuma marca parceira ativa no momento.</p>
                      <p className="text-xs text-zinc-400 mt-1">Cadastre seus itens na aba "Produtos Próprios".</p>
                    </div>
                  )}
                </div>
              </>
            ) : (
              <>
                {/* Cabeçalho da Marca Selecionada */}
                <div className="flex items-center justify-between p-3.5 bg-[#18181B] border border-[#27272A] rounded-2xl">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-[#09090B] border border-[#27272A] flex items-center justify-center overflow-hidden shrink-0">
                      {selectedBrand.logo_url ? (
                        <img src={selectedBrand.logo_url} alt={selectedBrand.nome_marca} className="w-full h-full object-contain p-1" />
                      ) : (
                        <span className="text-xl">🍦</span>
                      )}
                    </div>
                    <div>
                      <p className="text-sm font-bold text-white">{selectedBrand.nome_marca}</p>
                      <p className="text-xs text-zinc-400">Preencha o estoque diário dos sabores</p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setSelectedBrand(null)}
                    className="text-xs text-[#00FF66] hover:underline font-semibold"
                  >
                    Trocar marca
                  </button>
                </div>

                {/* Filtro por Categoria */}
                <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none">
                  {categoriesList.map((cat) => (
                    <button
                      key={cat}
                      type="button"
                      onClick={() => setSelectedCategory(cat)}
                      className={`px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all ${
                        selectedCategory === cat
                          ? "bg-[#0DB87E] text-[#09090B]"
                          : "bg-[#18181B] text-zinc-400 hover:text-white border border-[#27272A]"
                      }`}
                    >
                      {cat}
                    </button>
                  ))}
                </div>

                {/* Busca */}
                <div className="relative">
                  <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-500" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder={`Buscar em ${selectedBrand.nome_marca}...`}
                    className="w-full bg-[#18181B] border border-[#27272A] rounded-xl pl-9 pr-3.5 py-2.5 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-[#0DB87E]"
                  />
                </div>

                {/* Grade de Produtos da Marca */}
                <div className="space-y-3">
                  {filteredProducts.map((p) => {
                    const est = estoque[p.id] || {
                      id_produto_padrao: p.id,
                      preco_venda: Number(p.preco_sugerido),
                      quantidade: 0,
                      disponivel: true,
                    };

                    const hasStock = est.quantidade > 0 && est.disponivel;

                    return (
                      <div
                        key={p.id}
                        className={`p-3.5 rounded-2xl border transition-all flex items-center justify-between gap-3 ${
                          hasStock
                            ? "bg-[#18181B] border-[#0DB87E]/50 shadow-md shadow-[#0DB87E]/5"
                            : "bg-[#18181B]/70 border-[#27272A]"
                        }`}
                      >
                        <div className="flex items-center gap-3 flex-1 min-w-0">
                          <div className="w-14 h-14 rounded-xl bg-[#09090B] border border-[#27272A] overflow-hidden flex items-center justify-center shrink-0">
                            {p.imagem_url ? (
                              <img src={p.imagem_url} alt={p.nome_produto} className="w-full h-full object-cover" />
                            ) : (
                              <span className="text-2xl">🍦</span>
                            )}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-zinc-800 text-zinc-300">
                                {p.categoria}
                              </span>
                              {hasStock && (
                                <span className="text-[10px] font-extrabold px-1.5 py-0.5 rounded bg-[#0DB87E]/20 text-[#00FF66] border border-[#0DB87E]/30">
                                  {est.quantidade} un.
                                </span>
                              )}
                            </div>
                            <p className="text-xs font-bold text-white truncate mt-1">{p.nome_produto}</p>
                            <p className="text-[11px] text-zinc-400 mt-0.5">
                              Sugerido: <span className="text-zinc-300 font-semibold">R$ {Number(p.preco_sugerido).toFixed(2)}</span>
                            </p>
                          </div>
                        </div>

                        {/* Stepper Rápido de Quantidade Diária */}
                        <div className="flex items-center gap-2 shrink-0">
                          <button
                            type="button"
                            onClick={() => handleUpdateEstoque(p, est.preco_venda, Math.max(0, est.quantidade - 1), est.disponivel)}
                            disabled={est.quantidade <= 0}
                            className="w-8 h-8 rounded-lg bg-[#09090B] border border-[#27272A] flex items-center justify-center text-zinc-300 active:scale-95 disabled:opacity-30 disabled:pointer-events-none cursor-pointer"
                          >
                            <Minus size={14} />
                          </button>

                          <span className={`w-8 text-center text-xs font-bold ${hasStock ? "text-[#00FF66]" : "text-zinc-400"}`}>
                            {est.quantidade}
                          </span>

                          <button
                            type="button"
                            onClick={() => handleUpdateEstoque(p, est.preco_venda, est.quantidade + 1, true)}
                            className="w-8 h-8 rounded-lg bg-[#0DB87E]/20 border border-[#0DB87E]/40 text-[#00FF66] flex items-center justify-center active:scale-95 cursor-pointer hover:bg-[#0DB87E]/30"
                          >
                            <Plus size={14} />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </>
            )}
          </div>
        )}

        {/* ========================================================================= */}
        {/* TAB 2: FLUXO LIVRE (PRODUTOS PRÓPRIOS / CRUD COMPLETO)                    */}
        {/* ========================================================================= */}
        {activeTab === "livre" && (
          <div className="space-y-4">
            <div className="bg-[#18181B] border border-[#27272A] rounded-2xl p-4 flex items-center justify-between gap-3">
              <div>
                <h2 className="text-sm font-bold text-white flex items-center gap-2">
                  <Sparkles size={18} className="text-[#00FF66]" />
                  Produtos Próprios & Artesanais
                </h2>
                <p className="text-xs text-zinc-400 mt-1">
                  Cadastre itens exclusivos com título, descrição, fotos e preços definidos por você.
                </p>
              </div>

              <button
                type="button"
                onClick={openCreateModal}
                className="py-2 px-3 rounded-xl bg-gradient-to-r from-[#0DB87E] to-[#00FF66] text-[#09090B] text-xs font-bold flex items-center gap-1.5 shrink-0 shadow-lg shadow-[#0DB87E]/20 active:scale-95 cursor-pointer"
              >
                <Plus size={16} />
                <span>Novo Produto</span>
              </button>
            </div>

            {/* Lista de Produtos Próprios */}
            <div className="space-y-3">
              {customProducts.map((p) => {
                const est = estoque[p.id];
                const qtd = est?.quantidade ?? 0;
                const preco = est?.preco_venda ?? p.preco_sugerido;

                return (
                  <div
                    key={p.id}
                    className="p-4 rounded-2xl bg-[#18181B] border border-[#27272A] flex items-center justify-between gap-3"
                  >
                    <div className="flex items-center gap-3.5 flex-1 min-w-0">
                      <div className="w-14 h-14 rounded-xl bg-[#09090B] border border-[#27272A] overflow-hidden flex items-center justify-center shrink-0">
                        {p.imagem_url ? (
                          <img src={p.imagem_url} alt={p.nome_produto} className="w-full h-full object-cover" />
                        ) : (
                          <span className="text-2xl">🍽️</span>
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-[#0DB87E]/20 text-[#00FF66]">
                            {p.categoria || "Próprio"}
                          </span>
                          <span className="text-xs font-extrabold text-white">
                            R$ {Number(preco).toFixed(2)}
                          </span>
                        </div>
                        <p className="text-sm font-bold text-white truncate mt-1">{p.nome_produto}</p>
                        {p.descricao && (
                          <p className="text-xs text-zinc-400 truncate mt-0.5">{p.descricao}</p>
                        )}
                        <p className="text-[11px] text-[#00FF66] mt-1 font-semibold">
                          Estoque hoje: {qtd} unidades
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0">
                      <button
                        type="button"
                        onClick={() => openEditModal(p)}
                        className="w-8 h-8 rounded-lg bg-[#09090B] border border-[#27272A] flex items-center justify-center text-zinc-300 hover:text-white"
                        title="Editar produto"
                      >
                        <Edit3 size={14} />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDeleteCustomProduct(p.id)}
                        className="w-8 h-8 rounded-lg bg-red-950/40 border border-red-900/50 flex items-center justify-center text-red-400 hover:text-red-300"
                        title="Excluir produto"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                );
              })}

              {customProducts.length === 0 && !loading && (
                <div className="p-8 text-center bg-[#18181B] rounded-2xl border border-[#27272A] space-y-3">
                  <PackagePlus size={36} className="text-zinc-600 mx-auto" />
                  <p className="text-sm font-semibold text-white">Você ainda não tem produtos próprios cadastrados.</p>
                  <p className="text-xs text-zinc-400 max-w-sm mx-auto">
                    Ideal para quem faz açaí, milho, lanches, bebidas artesanais, artesanato ou oferece passeios e aluguel de cadeiras.
                  </p>
                  <button
                    type="button"
                    onClick={openCreateModal}
                    className="mt-2 py-2 px-4 rounded-xl bg-[#0DB87E] text-[#09090B] text-xs font-bold inline-flex items-center gap-1.5"
                  >
                    <Plus size={15} />
                    <span>Cadastrar Primeiro Produto Próprio</span>
                  </button>
                </div>
              )}
            </div>
          </div>
        )}
      </main>

      {/* ========================================================================= */}
      {/* BARRA FIXA INFERIOR DE RESUMO & CONEXÃO NA PRAIA                          */}
      {/* ========================================================================= */}
      <footer className="fixed bottom-0 left-0 right-0 z-40 bg-[#09090B]/95 backdrop-blur-md border-t border-[#27272A] p-4">
        <div className="max-w-xl mx-auto flex items-center justify-between gap-4">
          <div>
            <p className="text-xs text-zinc-400">Total em estoque hoje</p>
            <p className="text-sm font-bold text-white">
              <span className="text-[#00FF66] font-extrabold">{totalItensAtivos}</span> itens distintos ({totalUnidades} un.)
            </p>
          </div>

          <button
            type="button"
            onClick={() => navigate("/app/prestador/ambulantes/online")}
            className="py-3 px-5 rounded-xl bg-gradient-to-r from-[#0DB87E] to-[#00FF66] text-[#09090B] text-sm font-bold shadow-lg shadow-[#0DB87E]/20 hover:opacity-95 active:scale-95 flex items-center gap-2 cursor-pointer"
          >
            <PackageCheck size={18} />
            <span>Ir para a Praia (Online)</span>
          </button>
        </div>
      </footer>

      {/* ========================================================================= */}
      {/* MODAL DE CRIAÇÃO / EDIÇÃO DO FLUXO LIVRE                                  */}
      {/* ========================================================================= */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-[#18181B] border border-[#27272A] rounded-2xl p-5 space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-[#27272A] pb-3">
              <h3 className="text-base font-bold text-white flex items-center gap-2 font-display">
                <Sparkles size={18} className="text-[#00FF66]" />
                {editingCustomProduct ? "Editar Produto Próprio" : "Novo Produto Próprio"}
              </h3>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="w-8 h-8 rounded-lg bg-[#09090B] border border-[#27272A] flex items-center justify-center text-zinc-400 hover:text-white"
              >
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleSaveCustomProduct} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-zinc-300 mb-1">
                  Título / Nome do Produto *
                </label>
                <input
                  type="text"
                  value={modalNome}
                  onChange={(e) => setModalNome(e.target.value)}
                  placeholder="Ex: Açaí Turbinado 500ml, Pastel de Camarão"
                  required
                  className="w-full bg-[#09090B] border border-[#27272A] rounded-xl px-3.5 py-2.5 text-sm text-white placeholder-zinc-500 focus:outline-none focus:border-[#0DB87E]"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-zinc-300 mb-1">
                    Categoria / Subtítulo *
                  </label>
                  <input
                    type="text"
                    value={modalCategoria}
                    onChange={(e) => setModalCategoria(e.target.value)}
                    placeholder="Ex: Açaí, Lanches, Bebidas"
                    required
                    className="w-full bg-[#09090B] border border-[#27272A] rounded-xl px-3.5 py-2.5 text-sm text-white placeholder-zinc-500 focus:outline-none focus:border-[#0DB87E]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-zinc-300 mb-1">
                    Preço de Venda (R$) *
                  </label>
                  <input
                    type="text"
                    value={modalPreco}
                    onChange={(e) => setModalPreco(e.target.value)}
                    placeholder="0.00"
                    required
                    className="w-full bg-[#09090B] border border-[#27272A] rounded-xl px-3.5 py-2.5 text-sm text-white placeholder-zinc-500 focus:outline-none focus:border-[#0DB87E]"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-zinc-300 mb-1">
                  Estoque Disponível Hoje (Quantidade) *
                </label>
                <input
                  type="number"
                  min="0"
                  value={modalQuantidade}
                  onChange={(e) => setModalQuantidade(e.target.value)}
                  placeholder="10"
                  required
                  className="w-full bg-[#09090B] border border-[#27272A] rounded-xl px-3.5 py-2.5 text-sm text-white placeholder-zinc-500 focus:outline-none focus:border-[#0DB87E]"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-zinc-300 mb-1">
                  Descrição / Ingredientes (Opcional)
                </label>
                <textarea
                  value={modalDescricao}
                  onChange={(e) => setModalDescricao(e.target.value)}
                  placeholder="Ex: Leite condensado, morango, granola e leite ninho..."
                  rows={2}
                  className="w-full bg-[#09090B] border border-[#27272A] rounded-xl px-3.5 py-2 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-[#0DB87E]"
                />
              </div>

              {/* Upload de Foto */}
              <div>
                <label className="block text-xs font-medium text-zinc-300 mb-1">
                  Foto do Produto
                </label>
                <div className="flex items-center gap-3">
                  <div className="w-14 h-14 rounded-xl bg-[#09090B] border border-[#27272A] overflow-hidden flex items-center justify-center shrink-0">
                    {modalImagemUrl ? (
                      <img src={modalImagemUrl} alt="Preview" className="w-full h-full object-cover" />
                    ) : (
                      <span className="text-xl">📸</span>
                    )}
                  </div>
                  <label className="flex-1 flex flex-col items-center justify-center border border-dashed border-[#27272A] rounded-xl p-3 bg-[#09090B] hover:border-[#0DB87E] cursor-pointer transition-all">
                    <UploadCloud size={18} className="text-zinc-400 mb-0.5" />
                    <span className="text-xs text-zinc-300 font-medium">
                      {modalUploadingImage ? "Enviando..." : "Selecionar Foto"}
                    </span>
                    <input
                      type="file"
                      ref={customFileInputRef}
                      accept="image/*"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) handleCustomImageUpload(file);
                      }}
                      className="hidden"
                    />
                  </label>
                </div>
              </div>

              <div className="pt-2 flex gap-3">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="flex-1 py-2.5 rounded-xl border border-[#27272A] bg-[#09090B] text-zinc-300 text-xs font-bold hover:bg-zinc-800 transition-all cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={modalSubmitting || modalUploadingImage}
                  className="flex-1 py-2.5 rounded-xl bg-gradient-to-r from-[#0DB87E] to-[#00FF66] text-[#09090B] text-xs font-bold hover:opacity-95 transition-all cursor-pointer disabled:opacity-50"
                >
                  {modalSubmitting ? "Salvando..." : "Salvar no Cardápio"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
