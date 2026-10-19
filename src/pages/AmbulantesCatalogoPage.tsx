import { useState, useEffect, useRef, useMemo } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  ArrowLeft,
  Search,
  Plus,
  Minus,
  Sparkles,
  Store,
  ChevronRight,
  CheckCircle2,
  AlertCircle,
  UploadCloud,
  Trash2,
  Edit3,
  PackageCheck,
  PackagePlus,
  X,
  Layers,
  ImageOff
} from "lucide-react";
import { supabase } from "@/lib/supabase";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { Switch } from "@/components/ui/switch";

interface Fornecedor {
  id: string;
  nome_marca: string;
  logo_url?: string | null;
  ativo: boolean;
  total_produtos?: number;
}

interface ProdutoPadrao {
  id: string;
  id_fornecedor?: string | null;
  nome_produto: string;
  descricao?: string | null;
  preco_sugerido: number;
  imagem_url?: string | null;
  categoria: string;
  ativo: boolean;
  fornecedores_padrao?: {
    id?: string;
    nome_marca: string;
    logo_url?: string | null;
  } | null;
}

interface ItemEstoque {
  id?: string;
  id_produto_padrao: string;
  preco_venda: number;
  quantidade: number;
  disponivel: boolean;
}

type TabMode = "facilitado" | "livre";

// Gera slug amigável para URLs
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

// Resolução de imagem de storage ou URL pública
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
  const { marcaSlug } = useParams<{ marcaSlug?: string }>();
  const user = useCurrentUser();

  // Modo ativo: Facilitado (Marcas Parceiras) vs Livre (Produtos Próprios)
  const [activeTab, setActiveTab] = useState<TabMode>("facilitado");

  // Marca ativa derivada da rota ou da lista
  const [selectedBrand, setSelectedBrand] = useState<Fornecedor | null>(null);
  const [isOnline, setIsOnline] = useState(false);

  // Dados reais do banco de dados
  const [brands, setBrands] = useState<Fornecedor[]>([]);
  const [products, setProducts] = useState<ProdutoPadrao[]>([]);
  const [customProducts, setCustomProducts] = useState<ProdutoPadrao[]>([]);
  const [estoque, setEstoque] = useState<Record<string, ItemEstoque>>({});
  const [loading, setLoading] = useState(true);
  const [loadingProducts, setLoadingProducts] = useState(false);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [feedbackMsg, setFeedbackMsg] = useState<{ text: string; type: "success" | "error" } | null>(null);

  // Registro de imagens com falha de carregamento (evita ícones quebrados)
  const [brokenImages, setBrokenImages] = useState<Record<string, boolean>>({});

  // Filtros da marca ativa
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

  // Sincroniza marca ativa a partir do parâmetro de rota :marcaSlug
  useEffect(() => {
    if (!marcaSlug || brands.length === 0) {
      if (!marcaSlug) {
        setSelectedBrand(null);
        setProducts([]);
      }
      return;
    }

    const matched = brands.find(
      (b) => slugify(b.nome_marca) === marcaSlug.toLowerCase() || b.id === marcaSlug
    );

    if (matched) {
      setSelectedBrand(matched);
      loadBrandProducts(matched.id);
    } else {
      setSelectedBrand(null);
    }
  }, [marcaSlug, brands]);

  const showToast = (text: string, type: "success" | "error" = "success") => {
    setFeedbackMsg({ text, type });
    setTimeout(() => setFeedbackMsg(null), 3500);
  };

  const markImageAsBroken = (id: string) => {
    setBrokenImages((prev) => ({ ...prev, [id]: true }));
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

  // Carrega lista oficial de marcas da tabela fornecedores_padrao e estoque do prestador
  async function loadData() {
    try {
      setLoading(true);

      // 1. SELECT real na tabela fornecedores_padrao
      const { data: fornecedoresData, error: fError } = await supabase
        .from("fornecedores_padrao")
        .select("id, nome_marca, logo_url, ativo")
        .eq("ativo", true)
        .order("nome_marca");

      if (fError) throw fError;

      const brandList = (fornecedoresData || []).map((b) => ({
        ...b,
        total_produtos: 0,
      }));
      setBrands(brandList);

      // 2. Carregar estoque existente do ambulante
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
              preco_venda: Number(item.preco_venda),
              quantidade: Number(item.quantidade) || 0,
              disponivel: item.disponivel !== false,
            };
          });
          setEstoque(map);

          // 3. Carregar produtos próprios (sem fornecedor vinculado)
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
      console.error("Erro ao carregar dados do catálogo:", err);
      showToast("Falha ao carregar catálogo. Tente novamente.", "error");
    } finally {
      setLoading(false);
    }
  }

  // SELECT real na tabela produtos_padrao filtrando pelo id_fornecedor da marca
  async function loadBrandProducts(fornecedorId: string) {
    try {
      setLoadingProducts(true);
      const { data: produtosData, error: pError } = await supabase
        .from("produtos_padrao")
        .select("*, fornecedores_padrao(id, nome_marca, logo_url)")
        .eq("id_fornecedor", fornecedorId)
        .eq("ativo", true)
        .order("nome_produto");

      if (pError) throw pError;
      setProducts(produtosData || []);
    } catch (err: any) {
      console.error("Erro ao carregar produtos da marca:", err);
      showToast("Falha ao carregar produtos desta marca.", "error");
    } finally {
      setLoadingProducts(false);
    }
  }

  // Navega para a URL com o slug da marca
  const handleSelectBrand = (brand: Fornecedor) => {
    const slug = slugify(brand.nome_marca) || brand.id;
    navigate(`/app/prestador/ambulantes/cardapio/editar/${slug}`);
  };

  const handleClearSelectedBrand = () => {
    navigate("/app/prestador/ambulantes/cardapio/editar");
  };

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

    // Atualização otimista imediata
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
      console.error("Erro ao sincronizar estoque:", err);
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
      await supabase.from("estoque_ambulante").delete().eq("id_produto_padrao", prodId).eq("id_ambulante", user.uid);
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

  // Filtragem de produtos padrão da marca ativa
  const filteredProducts = useMemo(() => {
    return products.filter((p) => {
      const matchesCategory = selectedCategory === "Todas" || p.categoria === selectedCategory;
      const matchesSearch =
        searchQuery === "" ||
        p.nome_produto.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (p.descricao && p.descricao.toLowerCase().includes(searchQuery.toLowerCase()));

      return matchesCategory && matchesSearch;
    });
  }, [products, selectedCategory, searchQuery]);

  const categoriesList = useMemo(() => {
    return ["Todas", ...Array.from(new Set(products.map((p) => p.categoria).filter(Boolean)))];
  }, [products]);

  // Total de itens cadastrados no estoque com quantidade > 0
  const totalItensAtivos = Object.values(estoque).filter((i) => i.disponivel && i.quantidade > 0).length;
  const totalUnidades = Object.values(estoque).reduce(
    (acc, curr) => (curr.disponivel ? acc + curr.quantidade : acc),
    0
  );

  return (
    <div className="min-h-screen bg-[#09090B] text-zinc-100 font-sans pb-60">
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
                handleClearSelectedBrand();
              } else {
                navigate("/app/prestador/ambulantes/online");
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
                ? selectedBrand ? selectedBrand.nome_marca : "Catálogo de Marcas Parceiras"
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
              if (!selectedBrand && marcaSlug) {
                handleClearSelectedBrand();
              }
            }}
            className={`flex items-center justify-center gap-2 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
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
            className={`flex items-center justify-center gap-2 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
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
                  {brands.map((b) => {
                    const resolvedLogo = resolveImageUrl(b.logo_url);
                    const isBroken = brokenImages[b.id];

                    return (
                      <button
                        key={b.id}
                        type="button"
                        onClick={() => handleSelectBrand(b)}
                        className="p-4 rounded-2xl bg-[#18181B] border border-[#27272A] hover:border-[#0DB87E] flex items-center justify-between text-left transition-all active:scale-[0.99] group cursor-pointer shadow-lg shadow-black/40"
                      >
                        <div className="flex items-center gap-3.5">
                          <div className="w-12 h-12 rounded-xl bg-[#09090B] border border-[#27272A] flex items-center justify-center overflow-hidden shrink-0">
                            {resolvedLogo && !isBroken ? (
                              <img
                                src={resolvedLogo}
                                alt={b.nome_marca}
                                onError={() => markImageAsBroken(b.id)}
                                className="w-full h-full object-contain p-1"
                              />
                            ) : (
                              <span className="w-full h-full flex items-center justify-center bg-[#0DB87E]/10 text-[#00FF66] font-extrabold text-sm font-display">
                                {b.nome_marca ? b.nome_marca.slice(0, 2).toUpperCase() : "UBT"}
                              </span>
                            )}
                          </div>
                          <div>
                            <p className="text-sm font-bold text-white group-hover:text-[#00FF66] transition-colors">
                              {b.nome_marca}
                            </p>
                            <p className="text-xs text-zinc-400 mt-0.5">
                              Catálogo Oficial da Marca →
                            </p>
                          </div>
                        </div>
                        <ChevronRight size={18} className="text-zinc-500 group-hover:text-[#00FF66] transition-colors shrink-0" />
                      </button>
                    );
                  })}

                  {brands.length === 0 && !loading && (
                    <div className="col-span-full p-8 text-center bg-[#18181B] rounded-2xl border border-[#27272A]">
                      <Store size={32} className="text-zinc-600 mx-auto mb-2" />
                      <p className="text-sm font-semibold text-white">Nenhuma marca parceira cadastrada ainda.</p>
                      <p className="text-xs text-zinc-400 mt-1 max-w-sm mx-auto">
                        As marcas adicionadas no painel administrativo aparecerão aqui automaticamente para abastecimento diário.
                      </p>
                    </div>
                  )}
                </div>
              </>
            ) : (
              <>
                {/* Cabeçalho da Marca Selecionada com Slug */}
                <div className="flex items-center justify-between p-3.5 bg-[#18181B] border border-[#27272A] rounded-2xl">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-[#09090B] border border-[#27272A] flex items-center justify-center overflow-hidden shrink-0">
                      {resolveImageUrl(selectedBrand.logo_url) && !brokenImages[selectedBrand.id] ? (
                        <img
                          src={resolveImageUrl(selectedBrand.logo_url)}
                          alt={selectedBrand.nome_marca}
                          onError={() => markImageAsBroken(selectedBrand.id)}
                          className="w-full h-full object-contain p-1"
                        />
                      ) : (
                        <span className="w-full h-full flex items-center justify-center bg-[#0DB87E]/10 text-[#00FF66] font-extrabold text-xs">
                          {selectedBrand.nome_marca.slice(0, 2).toUpperCase()}
                        </span>
                      )}
                    </div>
                    <div>
                      <p className="text-sm font-bold text-white">{selectedBrand.nome_marca}</p>
                      <p className="text-xs text-zinc-400">Preencha as quantidades retiradas na fábrica</p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={handleClearSelectedBrand}
                    className="text-xs text-[#00FF66] hover:underline font-semibold cursor-pointer"
                  >
                    Trocar marca
                  </button>
                </div>

                {/* Filtro por Categoria */}
                {categoriesList.length > 2 && (
                  <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none">
                    {categoriesList.map((cat) => (
                      <button
                        key={cat}
                        type="button"
                        onClick={() => setSelectedCategory(cat)}
                        className={`px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all cursor-pointer ${
                          selectedCategory === cat
                            ? "bg-[#0DB87E] text-[#09090B]"
                            : "bg-[#18181B] text-zinc-400 hover:text-white border border-[#27272A]"
                        }`}
                      >
                        {cat}
                      </button>
                    ))}
                  </div>
                )}

                {/* Campo de Busca */}
                <div className="relative">
                  <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-500" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder={`Buscar sabores em ${selectedBrand.nome_marca}...`}
                    className="w-full bg-[#18181B] border border-[#27272A] rounded-xl pl-9 pr-3.5 py-2.5 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-[#0DB87E]"
                  />
                </div>

                {/* Grade de Produtos da Marca */}
                {loadingProducts ? (
                  <div className="p-8 text-center text-xs text-zinc-500">
                    Carregando cardápio de {selectedBrand.nome_marca}...
                  </div>
                ) : (
                  <div className="space-y-3">
                    {filteredProducts.map((p) => {
                      const est = estoque[p.id] || {
                        id_produto_padrao: p.id,
                        preco_venda: Number(p.preco_sugerido),
                        quantidade: 0,
                        disponivel: true,
                      };

                      const hasStock = est.quantidade > 0 && est.disponivel;
                      const prodImg = resolveImageUrl(p.imagem_url);
                      const isImgBroken = brokenImages[p.id];

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
                              {prodImg && !isImgBroken ? (
                                <img
                                  src={prodImg}
                                  alt={p.nome_produto}
                                  onError={() => markImageAsBroken(p.id)}
                                  className="w-full h-full object-cover"
                                />
                              ) : (
                                <span className="text-2xl">🍦</span>
                              )}
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-1.5 flex-wrap">
                                <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-zinc-800 text-zinc-300">
                                  {p.categoria || "Geral"}
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
                              disabled={est.quantidade <= 0 || savingId === p.id}
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
                              disabled={savingId === p.id}
                              className="w-8 h-8 rounded-lg bg-[#0DB87E]/20 border border-[#0DB87E]/40 text-[#00FF66] flex items-center justify-center active:scale-95 cursor-pointer hover:bg-[#0DB87E]/30"
                            >
                              <Plus size={14} />
                            </button>
                          </div>
                        </div>
                      );
                    })}

                    {filteredProducts.length === 0 && (
                      <div className="p-8 text-center bg-[#18181B] rounded-2xl border border-[#27272A]">
                        <p className="text-sm font-semibold text-white">Nenhum produto cadastrado para esta marca.</p>
                        <p className="text-xs text-zinc-400 mt-1">Cadastre produtos pelo painel de administração.</p>
                      </div>
                    )}
                  </div>
                )}
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
                const prodImg = resolveImageUrl(p.imagem_url);
                const isImgBroken = brokenImages[p.id];

                return (
                  <div
                    key={p.id}
                    className="p-4 rounded-2xl bg-[#18181B] border border-[#27272A] flex items-center justify-between gap-3"
                  >
                    <div className="flex items-center gap-3.5 flex-1 min-w-0">
                      <div className="w-14 h-14 rounded-xl bg-[#09090B] border border-[#27272A] overflow-hidden flex items-center justify-center shrink-0">
                        {prodImg && !isImgBroken ? (
                          <img
                            src={prodImg}
                            alt={p.nome_produto}
                            onError={() => markImageAsBroken(p.id)}
                            className="w-full h-full object-cover"
                          />
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
                        className="w-8 h-8 rounded-lg bg-[#09090B] border border-[#27272A] flex items-center justify-center text-zinc-300 hover:text-white cursor-pointer"
                        title="Editar produto"
                      >
                        <Edit3 size={14} />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDeleteCustomProduct(p.id)}
                        className="w-8 h-8 rounded-lg bg-red-950/40 border border-red-900/50 flex items-center justify-center text-red-400 hover:text-red-300 cursor-pointer"
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
                    className="mt-2 py-2 px-4 rounded-xl bg-[#0DB87E] text-[#09090B] text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer"
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
      {/* Posicionada a bottom-16 (64px) para flutuar acima da barra BottomNavLight */}
      {/* ========================================================================= */}
      <footer className="fixed bottom-16 left-0 right-0 z-40 bg-[#09090B]/95 backdrop-blur-md border-t border-[#27272A] p-3.5 shadow-2xl shadow-black">
        <div className="max-w-xl mx-auto flex items-center justify-between gap-4">
          <div>
            <p className="text-[11px] text-zinc-400">Total em estoque hoje</p>
            <p className="text-sm font-bold text-white">
              <span className="text-[#00FF66] font-extrabold">{totalItensAtivos}</span> itens ({totalUnidades} un.)
            </p>
          </div>

          <button
            type="button"
            onClick={() => navigate("/app/prestador/ambulantes/online")}
            className="py-2.5 px-4 rounded-xl bg-gradient-to-r from-[#0DB87E] to-[#00FF66] text-[#09090B] text-xs font-bold shadow-lg shadow-[#0DB87E]/20 hover:opacity-95 active:scale-95 flex items-center gap-2 cursor-pointer"
          >
            <PackageCheck size={16} />
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
                className="w-8 h-8 rounded-lg bg-[#09090B] border border-[#27272A] flex items-center justify-center text-zinc-400 hover:text-white cursor-pointer"
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
