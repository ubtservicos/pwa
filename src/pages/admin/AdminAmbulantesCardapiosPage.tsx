import { useState, useEffect, useRef, useMemo } from "react";
import {
  Utensils,
  Plus,
  Pencil,
  Trash2,
  Search,
  Check,
  X,
  ShoppingBag,
  Percent,
  DollarSign,
  Filter,
  CheckCircle2,
  AlertCircle,
  Building2,
  ChevronRight,
  Layers,
  ArrowLeft,
  ChevronLeft,
  UploadCloud,
  PackagePlus,
  Image as ImageIcon,
  SlidersHorizontal,
  Home
} from "lucide-react";
import { useAdminToast } from "@/components/admin/AdminToast";
import { supabase } from "@/lib/supabase";

interface Fornecedor {
  id: string;
  nome_marca: string;
  logo_url?: string | null;
  ativo: boolean;
  total_produtos?: number;
}

interface ProdutoPadrao {
  id: string;
  id_fornecedor: string;
  nome_produto: string;
  descricao?: string | null;
  preco_sugerido: number;
  imagem_url?: string | null;
  categoria: string;
  ativo: boolean;
  fornecedores_padrao?: {
    id: string;
    nome_marca: string;
    logo_url?: string | null;
  } | null;
}

function resolveImageUrl(url?: string | null): string {
  if (!url) return "";
  if (url.startsWith("http://") || url.startsWith("https://") || url.startsWith("data:")) {
    return url;
  }
  const { data } = supabase.storage.from("catalogo-ambulantes").getPublicUrl(url);
  return data?.publicUrl || url;
}

export default function AdminAmbulantesCardapiosPage() {
  const toast = useAdminToast();

  // Dados do backend
  const [fornecedores, setFornecedores] = useState<Fornecedor[]>([]);
  const [produtos, setProdutos] = useState<ProdutoPadrao[]>([]);
  const [loading, setLoading] = useState(true);

  // Drill-down State: null = Nível 1 (Marcas), Fornecedor = Nível 2 (Produtos da Marca)
  const [selectedBrand, setSelectedBrand] = useState<Fornecedor | null>(null);

  // Filtros Nível 1 (Marcas)
  const [brandSearch, setBrandSearch] = useState("");
  const [brandStatusFilter, setBrandStatusFilter] = useState<"all" | "active" | "inactive">("all");

  // Filtros Nível 2 (Produtos da Marca)
  const [productSearch, setProductSearch] = useState("");
  const [selectedCategoria, setSelectedCategoria] = useState<string>("all");
  const [selectedProductStatus, setSelectedProductStatus] = useState<string>("all");

  // Seleção para ações em massa
  const [selectedProductIds, setSelectedProductIds] = useState<string[]>([]);

  // Modais
  const [isProductModalOpen, setIsProductModalOpen] = useState(false);
  const [isSupplierModalOpen, setIsSupplierModalOpen] = useState(false);
  const [isBulkPriceModalOpen, setIsBulkPriceModalOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  // Formulário de Produto
  const [editingProduct, setEditingProduct] = useState<ProdutoPadrao | null>(null);
  const [prodNome, setProdNome] = useState("");
  const [prodFornecedorId, setProdFornecedorId] = useState("");
  const [prodCategoria, setProdCategoria] = useState("Picolés de Fruta");
  const [prodPrecoSugerido, setProdPrecoSugerido] = useState("5.00");
  const [prodDescricao, setProdDescricao] = useState("");
  const [prodImagemUrl, setProdImagemUrl] = useState("");
  const [prodAtivo, setProdAtivo] = useState(true);
  const [uploadingImage, setUploadingImage] = useState(false);

  // Formulário de Fornecedor / Marca
  const [editingSupplier, setEditingSupplier] = useState<Fornecedor | null>(null);
  const [suppNome, setSuppNome] = useState("");
  const [suppLogoUrl, setSuppLogoUrl] = useState("");
  const [suppAtivo, setSuppAtivo] = useState(true);
  const [uploadingLogo, setUploadingLogo] = useState(false);

  // Reajuste em Massa
  const [bulkAdjustmentType, setBulkAdjustmentType] = useState<"percentual" | "nominal">("percentual");
  const [bulkAdjustmentValue, setBulkAdjustmentValue] = useState<string>("10");
  const [bulkTargetScope, setBulkTargetScope] = useState<"selected" | "brand">("brand");

  // Fallback de imagens quebradas
  const [brokenImages, setBrokenImages] = useState<Record<string, boolean>>({});

  const fileInputRef = useRef<HTMLInputElement>(null);
  const supplierLogoInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    loadAllData();
  }, []);

  const markImageAsBroken = (key: string) => {
    setBrokenImages((prev) => ({ ...prev, [key]: true }));
  };

  async function loadAllData() {
    try {
      setLoading(true);

      const [fRes, pRes] = await Promise.all([
        supabase.from("fornecedores_padrao").select("*").order("nome_marca"),
        supabase.from("produtos_padrao").select("*, fornecedores_padrao(id, nome_marca, logo_url)").order("nome_produto"),
      ]);

      if (fRes.error) throw fRes.error;
      if (pRes.error) throw pRes.error;

      const fList = (fRes.data || []).map((f) => ({
        ...f,
        total_produtos: (pRes.data || []).filter((p) => p.id_fornecedor === f.id).length,
      }));

      setFornecedores(fList);
      setProdutos(pRes.data || []);

      // Atualiza selectedBrand se estiver aberto
      if (selectedBrand) {
        const updatedSelected = fList.find((f) => f.id === selectedBrand.id);
        if (updatedSelected) setSelectedBrand(updatedSelected);
      }
    } catch (err: any) {
      console.error("Erro ao carregar dados do catálogo:", err);
      toast.show("Erro ao carregar catálogo: " + (err.message || "Falha na conexão"));
    } finally {
      setLoading(false);
    }
  }

  // Upload para o bucket catalogo-ambulantes (Produtos)
  const handleImageUpload = async (file: File) => {
    try {
      setUploadingImage(true);
      const fileExt = file.name.split(".").pop() || "jpg";
      const fileName = `produtos/${Date.now()}-${Math.random().toString(36).substring(2, 9)}.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from("catalogo-ambulantes")
        .upload(fileName, file, { cacheControl: "3600", upsert: true });

      if (uploadError) throw uploadError;

      const { data: urlData } = supabase.storage
        .from("catalogo-ambulantes")
        .getPublicUrl(fileName);

      setProdImagemUrl(urlData.publicUrl);
      toast.show("Foto do produto enviada com sucesso!");
    } catch (err: any) {
      console.error("Erro no upload da imagem:", err);
      toast.show("Falha no upload: " + (err.message || ""));
    } finally {
      setUploadingImage(false);
    }
  };

  // Upload para o bucket catalogo-ambulantes (Logos de Marcas)
  const handleSupplierLogoUpload = async (file: File) => {
    try {
      setUploadingLogo(true);
      const fileExt = file.name.split(".").pop() || "jpg";
      const fileName = `logos/${Date.now()}-${Math.random().toString(36).substring(2, 9)}.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from("catalogo-ambulantes")
        .upload(fileName, file, { cacheControl: "3600", upsert: true });

      if (uploadError) throw uploadError;

      const { data: urlData } = supabase.storage
        .from("catalogo-ambulantes")
        .getPublicUrl(fileName);

      setSuppLogoUrl(urlData.publicUrl);
      toast.show("Logotipo da marca enviado com sucesso!");
    } catch (err: any) {
      console.error("Erro no upload do logotipo:", err);
      toast.show("Falha no upload: " + (err.message || ""));
    } finally {
      setUploadingLogo(false);
    }
  };

  // Alternar ativação do produto
  const handleToggleProductStatus = async (prod: ProdutoPadrao) => {
    const newStatus = !prod.ativo;
    setProdutos((prev) =>
      prev.map((p) => (p.id === prod.id ? { ...p, ativo: newStatus } : p))
    );

    try {
      const { error } = await supabase
        .from("produtos_padrao")
        .update({ ativo: newStatus, updated_at: new Date().toISOString() })
        .eq("id", prod.id);

      if (error) throw error;
      toast.show(`Produto "${prod.nome_produto}" ${newStatus ? "ativado" : "desativado"}.`);
    } catch (err: any) {
      console.error("Erro ao alterar status:", err);
      toast.show("Erro ao atualizar status do produto.");
      loadAllData();
    }
  };

  // Salvar Produto (Novo ou Edição)
  const handleSaveProduct = async () => {
    const targetBrandId = prodFornecedorId || selectedBrand?.id;

    if (!prodNome.trim() || !targetBrandId || !prodPrecoSugerido) {
      toast.show("Preencha Nome, Fornecedor e Preço Sugerido.");
      return;
    }

    try {
      setSaving(true);
      const precoNumber = parseFloat(prodPrecoSugerido.replace(",", ".")) || 0;

      if (editingProduct) {
        const { error } = await supabase
          .from("produtos_padrao")
          .update({
            nome_produto: prodNome.trim(),
            id_fornecedor: targetBrandId,
            categoria: prodCategoria.trim() || "Geral",
            preco_sugerido: precoNumber,
            descricao: prodDescricao.trim() || null,
            imagem_url: prodImagemUrl.trim() || null,
            ativo: prodAtivo,
            updated_at: new Date().toISOString(),
          })
          .eq("id", editingProduct.id);

        if (error) throw error;
        toast.show("Produto atualizado com sucesso!");
      } else {
        const { error } = await supabase.from("produtos_padrao").insert({
          nome_produto: prodNome.trim(),
          id_fornecedor: targetBrandId,
          categoria: prodCategoria.trim() || "Geral",
          preco_sugerido: precoNumber,
          descricao: prodDescricao.trim() || null,
          imagem_url: prodImagemUrl.trim() || null,
          ativo: prodAtivo,
        });

        if (error) throw error;
        toast.show("Novo produto cadastrado com sucesso!");
      }

      setIsProductModalOpen(false);
      await loadAllData();
    } catch (err: any) {
      console.error("Erro ao salvar produto:", err);
      toast.show("Erro ao salvar produto: " + err.message);
    } finally {
      setSaving(false);
    }
  };

  // Excluir Produto
  const handleDeleteProduct = async (id: string, nome: string) => {
    if (!confirm(`Deseja realmente excluir o produto "${nome}"?`)) return;

    try {
      const { error } = await supabase.from("produtos_padrao").delete().eq("id", id);
      if (error) throw error;
      toast.show("Produto excluído com sucesso.");
      await loadAllData();
    } catch (err: any) {
      console.error("Erro ao excluir produto:", err);
      toast.show("Erro ao excluir: " + err.message);
    }
  };

  // Salvar Marca / Fornecedor
  const handleSaveSupplier = async () => {
    if (!suppNome.trim()) {
      toast.show("Preencha o nome da marca/fornecedor.");
      return;
    }

    try {
      setSaving(true);
      if (editingSupplier) {
        const { error } = await supabase
          .from("fornecedores_padrao")
          .update({
            nome_marca: suppNome.trim(),
            logo_url: suppLogoUrl.trim() || null,
            ativo: suppAtivo,
            updated_at: new Date().toISOString(),
          })
          .eq("id", editingSupplier.id);

        if (error) throw error;
        toast.show("Marca atualizada com sucesso!");
      } else {
        const { error } = await supabase.from("fornecedores_padrao").insert({
          nome_marca: suppNome.trim(),
          logo_url: suppLogoUrl.trim() || null,
          ativo: suppAtivo,
        });

        if (error) throw error;
        toast.show("Nova marca cadastrada com sucesso!");
      }

      setIsSupplierModalOpen(false);
      await loadAllData();
    } catch (err: any) {
      console.error("Erro ao salvar marca:", err);
      toast.show("Erro: " + err.message);
    } finally {
      setSaving(false);
    }
  };

  // Excluir Marca
  const handleDeleteSupplier = async (id: string, nome: string) => {
    if (!confirm(`Deseja realmente excluir a marca "${nome}" e todos os seus produtos associados?`)) return;

    try {
      const { error } = await supabase.from("fornecedores_padrao").delete().eq("id", id);
      if (error) throw error;
      toast.show("Marca excluída com sucesso.");
      if (selectedBrand?.id === id) {
        setSelectedBrand(null);
      }
      await loadAllData();
    } catch (err: any) {
      toast.show("Erro ao excluir marca: " + err.message);
    }
  };

  // Reajuste em Massa
  const handleApplyBulkAdjustment = async () => {
    const val = parseFloat(bulkAdjustmentValue.replace(",", "."));
    if (isNaN(val)) {
      toast.show("Informe um valor de reajuste válido.");
      return;
    }

    try {
      setSaving(true);
      let targetList: ProdutoPadrao[] = [];

      if (bulkTargetScope === "selected") {
        if (selectedProductIds.length === 0) {
          toast.show("Nenhum produto selecionado.");
          return;
        }
        targetList = produtos.filter((p) => selectedProductIds.includes(p.id));
      } else {
        const brandId = selectedBrand ? selectedBrand.id : fornecedores[0]?.id;
        if (!brandId) {
          toast.show("Selecione a marca para o reajuste.");
          return;
        }
        targetList = produtos.filter((p) => p.id_fornecedor === brandId);
      }

      if (targetList.length === 0) {
        toast.show("Nenhum produto afetado pelo filtro.");
        return;
      }

      const updates = targetList.map((prod) => {
        let newPrice = Number(prod.preco_sugerido);
        if (bulkAdjustmentType === "percentual") {
          newPrice = newPrice * (1 + val / 100);
        } else {
          newPrice = newPrice + val;
        }
        newPrice = Math.max(0.5, Math.round(newPrice * 100) / 100);

        return supabase
          .from("produtos_padrao")
          .update({ preco_sugerido: newPrice, updated_at: new Date().toISOString() })
          .eq("id", prod.id);
      });

      await Promise.all(updates);

      toast.show(`Reajuste aplicado a ${targetList.length} produtos!`);
      setIsBulkPriceModalOpen(false);
      setSelectedProductIds([]);
      await loadAllData();
    } catch (err: any) {
      console.error("Erro no reajuste em massa:", err);
      toast.show("Erro no reajuste: " + err.message);
    } finally {
      setSaving(false);
    }
  };

  // Abertura do modal de produto para adição dentro da marca ativa
  const handleOpenAddProductForBrand = (brandId?: string) => {
    const effectiveBrandId = brandId || selectedBrand?.id || fornecedores[0]?.id || "";
    setEditingProduct(null);
    setProdNome("");
    setProdFornecedorId(effectiveBrandId);
    setProdCategoria("Picolés de Fruta");
    setProdPrecoSugerido("5.00");
    setProdDescricao("");
    setProdImagemUrl("");
    setProdAtivo(true);
    setIsProductModalOpen(true);
  };

  const handleOpenEditProduct = (prod: ProdutoPadrao) => {
    setEditingProduct(prod);
    setProdNome(prod.nome_produto);
    setProdFornecedorId(prod.id_fornecedor);
    setProdCategoria(prod.categoria);
    setProdPrecoSugerido(Number(prod.preco_sugerido).toFixed(2));
    setProdDescricao(prod.descricao || "");
    setProdImagemUrl(prod.imagem_url || "");
    setProdAtivo(prod.ativo);
    setIsProductModalOpen(true);
  };

  // Filtragem de Marcas (Nível 1)
  const filteredBrands = useMemo(() => {
    return fornecedores.filter((b) => {
      const matchesSearch =
        brandSearch === "" ||
        b.nome_marca.toLowerCase().includes(brandSearch.toLowerCase());

      const matchesStatus =
        brandStatusFilter === "all" ||
        (brandStatusFilter === "active" && b.ativo) ||
        (brandStatusFilter === "inactive" && !b.ativo);

      return matchesSearch && matchesStatus;
    });
  }, [fornecedores, brandSearch, brandStatusFilter]);

  // Filtragem de Produtos da Marca Ativa (Nível 2)
  const brandProducts = useMemo(() => {
    if (!selectedBrand) return [];
    return produtos.filter((p) => p.id_fornecedor === selectedBrand.id);
  }, [produtos, selectedBrand]);

  const filteredBrandProducts = useMemo(() => {
    return brandProducts.filter((p) => {
      const matchesSearch =
        productSearch === "" ||
        p.nome_produto.toLowerCase().includes(productSearch.toLowerCase()) ||
        (p.descricao && p.descricao.toLowerCase().includes(productSearch.toLowerCase()));

      const matchesCategoria =
        selectedCategoria === "all" || p.categoria === selectedCategoria;

      const matchesStatus =
        selectedProductStatus === "all" ||
        (selectedProductStatus === "active" && p.ativo) ||
        (selectedProductStatus === "inactive" && !p.ativo);

      return matchesSearch && matchesCategoria && matchesStatus;
    });
  }, [brandProducts, productSearch, selectedCategoria, selectedProductStatus]);

  const brandCategories = useMemo(() => {
    return ["all", ...Array.from(new Set(brandProducts.map((p) => p.categoria).filter(Boolean)))];
  }, [brandProducts]);

  const handleSelectAll = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.checked) {
      setSelectedProductIds(filteredBrandProducts.map((p) => p.id));
    } else {
      setSelectedProductIds([]);
    }
  };

  const handleToggleSelectProduct = (id: string) => {
    setSelectedProductIds((prev) =>
      prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]
    );
  };

  return (
    <div
      style={{ padding: "1rem 3rem" }}
      className="space-y-6 max-w-7xl mx-auto py-4 px-12 pb-16 font-sans text-zinc-100"
    >
      {/* ========================================================================= */}
      {/* BREADCRUMB HIERÁRQUICO (DRILL-DOWN)                                       */}
      {/* ========================================================================= */}
      <nav aria-label="Breadcrumb" className="flex items-center gap-2 text-xs text-zinc-400">
        <button
          type="button"
          onClick={() => setSelectedBrand(null)}
          className="flex items-center gap-1.5 hover:text-white transition-colors cursor-pointer"
        >
          <Home size={14} className="text-zinc-500" />
          <span>Inicial</span>
        </button>

        <span className="text-zinc-600">/</span>

        <button
          type="button"
          onClick={() => setSelectedBrand(null)}
          className={`hover:text-white transition-colors cursor-pointer ${
            !selectedBrand ? "text-[#00FF66] font-semibold" : ""
          }`}
        >
          Marcas Cadastradas
        </button>

        {selectedBrand && (
          <>
            <span className="text-zinc-600">/</span>
            <span className="text-white font-bold bg-[#18181B] border border-[#27272A] px-2 py-0.5 rounded-lg">
              {selectedBrand.nome_marca}
            </span>
          </>
        )}
      </nav>

      {/* ========================================================================= */}
      {/* NÍVEL 1: VISÃO GERAL DE MARCAS E TIPOS DE PRODUTO                          */}
      {/* ========================================================================= */}
      {!selectedBrand ? (
        <div className="space-y-6 animate-in fade-in duration-200">
          {/* Top Header do Nível 1 */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2.5">
                <span className="p-2 rounded-xl bg-[#0DB87E]/20 text-[#00FF66] border border-[#0DB87E]/30">
                  <Utensils size={22} />
                </span>
                <h1 className="text-2xl font-bold font-display text-white">
                  Catálogo Padrão & Marcas Parceiras
                </h1>
              </div>
              <p className="text-xs text-zinc-400 mt-1 max-w-2xl">
                Selecione uma marca para gerenciar seus produtos oficiais ou cadastre novas indústrias e fornecedores homologados para os ambulantes de praia.
              </p>
            </div>

            {/* Ações de Gestão de Marcas */}
            <div className="flex flex-wrap items-center gap-2.5">
              <button
                type="button"
                onClick={() => {
                  setBulkTargetScope("brand");
                  setIsBulkPriceModalOpen(true);
                }}
                className="px-3.5 py-2 rounded-xl bg-[#18181B] border border-[#27272A] hover:border-[#0DB87E]/50 text-zinc-300 text-xs font-semibold flex items-center gap-2 transition-all hover:bg-[#27272A] cursor-pointer"
              >
                <Percent size={15} className="text-[#00FF66]" />
                <span>Reajuste em Massa</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setEditingSupplier(null);
                  setSuppNome("");
                  setSuppLogoUrl("");
                  setSuppAtivo(true);
                  setIsSupplierModalOpen(true);
                }}
                className="px-4 py-2 rounded-xl bg-[#0DB87E] hover:bg-[#00FF66] text-[#09090B] text-xs font-bold flex items-center gap-2 shadow-lg shadow-[#0DB87E]/20 transition-all active:scale-95 cursor-pointer"
              >
                <Plus size={16} />
                <span>Nova Marca / Fornecedor</span>
              </button>
            </div>
          </div>

          {/* Cards de Métricas Gerais */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="p-4 rounded-2xl bg-[#18181B] border border-[#27272A] flex items-center justify-between shadow-sm">
              <div>
                <p className="text-xs text-zinc-400 font-semibold uppercase tracking-wider">Marcas Parceiras</p>
                <h3 className="text-2xl font-bold text-white mt-1">{fornecedores.length}</h3>
              </div>
              <div className="w-10 h-10 rounded-xl bg-[#09090B] border border-[#27272A] flex items-center justify-center text-[#00FF66]">
                <Building2 size={20} />
              </div>
            </div>

            <div className="p-4 rounded-2xl bg-[#18181B] border border-[#27272A] flex items-center justify-between shadow-sm">
              <div>
                <p className="text-xs text-zinc-400 font-semibold uppercase tracking-wider">Total de Produtos</p>
                <h3 className="text-2xl font-bold text-white mt-1">{produtos.length}</h3>
              </div>
              <div className="w-10 h-10 rounded-xl bg-[#09090B] border border-[#27272A] flex items-center justify-center text-[#0DB87E]">
                <ShoppingBag size={20} />
              </div>
            </div>

            <div className="p-4 rounded-2xl bg-[#18181B] border border-[#27272A] flex items-center justify-between shadow-sm">
              <div>
                <p className="text-xs text-zinc-400 font-semibold uppercase tracking-wider">Produtos Ativos</p>
                <h3 className="text-2xl font-bold text-[#00FF66] mt-1">
                  {produtos.filter((p) => p.ativo).length}
                </h3>
              </div>
              <div className="w-10 h-10 rounded-xl bg-[#09090B] border border-[#27272A] flex items-center justify-center text-[#00FF66]">
                <CheckCircle2 size={20} />
              </div>
            </div>

            <div className="p-4 rounded-2xl bg-[#18181B] border border-[#27272A] flex items-center justify-between shadow-sm">
              <div>
                <p className="text-xs text-zinc-400 font-semibold uppercase tracking-wider">Preço Médio Sugerido</p>
                <h3 className="text-2xl font-bold text-white mt-1">
                  R${" "}
                  {produtos.length > 0
                    ? (
                        produtos.reduce((acc, p) => acc + Number(p.preco_sugerido), 0) /
                        produtos.length
                      ).toFixed(2)
                    : "0.00"}
                </h3>
              </div>
              <div className="w-10 h-10 rounded-xl bg-[#09090B] border border-[#27272A] flex items-center justify-center text-amber-400">
                <DollarSign size={20} />
              </div>
            </div>
          </div>

          {/* Barra de Filtros de Marcas */}
          <div className="p-3.5 rounded-2xl bg-[#18181B] border border-[#27272A] flex flex-col sm:flex-row items-center justify-between gap-3">
            <div className="relative flex-1 w-full">
              <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-500" />
              <input
                type="text"
                value={brandSearch}
                onChange={(e) => setBrandSearch(e.target.value)}
                placeholder="Buscar marca cadastrada..."
                className="w-full bg-[#09090B] border border-[#27272A] rounded-xl pl-9 pr-3.5 py-2 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-[#0DB87E]"
              />
            </div>

            <div className="flex items-center gap-2 w-full sm:w-auto">
              <select
                value={brandStatusFilter}
                onChange={(e: any) => setBrandStatusFilter(e.target.value)}
                className="bg-[#09090B] border border-[#27272A] rounded-xl px-3 py-2 text-xs text-zinc-300 focus:outline-none focus:border-[#0DB87E] w-full sm:w-auto"
              >
                <option value="all">Todas as Marcas</option>
                <option value="active">Somente Ativas</option>
                <option value="inactive">Somente Inativas</option>
              </select>
            </div>
          </div>

          {/* Grid de Cards das Marcas (Nível 1) */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredBrands.map((b) => {
              const brandProds = produtos.filter((p) => p.id_fornecedor === b.id);
              const resolvedLogo = resolveImageUrl(b.logo_url);
              const isBroken = brokenImages[b.id];

              return (
                <div
                  key={b.id}
                  className="rounded-2xl bg-[#18181B] border border-[#27272A] hover:border-[#0DB87E]/60 transition-all p-5 flex flex-col justify-between group shadow-lg shadow-black/40 hover:shadow-[#0DB87E]/5"
                >
                  <div>
                    {/* Header do Card */}
                    <div className="flex items-start justify-between gap-3">
                      <div className="w-14 h-14 rounded-2xl bg-[#09090B] border border-[#27272A] flex items-center justify-center overflow-hidden shrink-0">
                        {resolvedLogo && !isBroken ? (
                          <img
                            src={resolvedLogo}
                            alt={b.nome_marca}
                            onError={() => markImageAsBroken(b.id)}
                            className="w-full h-full object-contain p-1.5"
                          />
                        ) : (
                          <span className="w-full h-full flex items-center justify-center bg-[#0DB87E]/10 text-[#00FF66] font-extrabold text-base font-display">
                            {b.nome_marca ? b.nome_marca.slice(0, 2).toUpperCase() : "UBT"}
                          </span>
                        )}
                      </div>

                      <div className="flex items-center gap-1.5">
                        <span
                          className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider border ${
                            b.ativo
                              ? "bg-[#0DB87E]/15 text-[#00FF66] border-[#0DB87E]/30"
                              : "bg-zinc-800 text-zinc-400 border-zinc-700"
                          }`}
                        >
                          {b.ativo ? "Ativa" : "Inativa"}
                        </span>

                        <button
                          type="button"
                          onClick={() => {
                            setEditingSupplier(b);
                            setSuppNome(b.nome_marca);
                            setSuppLogoUrl(b.logo_url || "");
                            setSuppAtivo(b.ativo);
                            setIsSupplierModalOpen(true);
                          }}
                          className="w-7 h-7 rounded-lg bg-[#09090B] border border-[#27272A] flex items-center justify-center text-zinc-400 hover:text-white transition-colors cursor-pointer"
                          title="Editar Marca"
                        >
                          <Pencil size={13} />
                        </button>

                        <button
                          type="button"
                          onClick={() => handleDeleteSupplier(b.id, b.nome_marca)}
                          className="w-7 h-7 rounded-lg bg-red-950/30 border border-red-900/40 flex items-center justify-center text-red-400 hover:text-red-300 transition-colors cursor-pointer"
                          title="Excluir Marca"
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    </div>

                    {/* Informações da Marca */}
                    <div className="mt-4">
                      <h3 className="text-base font-bold text-white group-hover:text-[#00FF66] transition-colors">
                        {b.nome_marca}
                      </h3>
                      <p className="text-xs text-zinc-400 mt-1">
                        Catálogo oficial de fábrica homologado pela UBT.
                      </p>
                    </div>

                    <div className="mt-4 pt-3 border-t border-[#27272A] grid grid-cols-2 gap-2 text-xs">
                      <div>
                        <span className="text-zinc-500 block text-[10px] uppercase font-bold">Produtos</span>
                        <span className="text-white font-extrabold text-sm">{brandProds.length}</span>
                      </div>
                      <div>
                        <span className="text-zinc-500 block text-[10px] uppercase font-bold">Ativos</span>
                        <span className="text-[#00FF66] font-extrabold text-sm">
                          {brandProds.filter((p) => p.ativo).length}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Botão de Ação: Drill-down para o Nível 2 */}
                  <div className="mt-5 pt-3">
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedBrand(b);
                        setProductSearch("");
                        setSelectedCategoria("all");
                        setSelectedProductIds([]);
                      }}
                      className="w-full py-2.5 px-3 rounded-xl bg-[#09090B] hover:bg-[#0DB87E] text-zinc-300 hover:text-[#09090B] text-xs font-bold border border-[#27272A] hover:border-[#0DB87E] flex items-center justify-center gap-2 transition-all cursor-pointer group/btn"
                    >
                      <span>Gerenciar Produtos ({brandProds.length})</span>
                      <ChevronRight size={15} className="group-hover/btn:translate-x-0.5 transition-transform" />
                    </button>
                  </div>
                </div>
              );
            })}

            {filteredBrands.length === 0 && !loading && (
              <div className="col-span-full p-12 text-center bg-[#18181B] rounded-2xl border border-[#27272A] space-y-3">
                <Building2 size={36} className="text-zinc-600 mx-auto" />
                <h4 className="text-base font-bold text-white">Nenhuma marca parceira encontrada</h4>
                <p className="text-xs text-zinc-400 max-w-md mx-auto">
                  Cadastre as marcas industriais (ex: Frutverão, Kibon, Nestlé, Oggi) para disponibilizar o cardápio padrão aos ambulantes de praia.
                </p>
                <button
                  type="button"
                  onClick={() => {
                    setEditingSupplier(null);
                    setSuppNome("");
                    setSuppLogoUrl("");
                    setSuppAtivo(true);
                    setIsSupplierModalOpen(true);
                  }}
                  className="mt-2 px-4 py-2 rounded-xl bg-[#0DB87E] text-[#09090B] text-xs font-bold inline-flex items-center gap-2 cursor-pointer"
                >
                  <Plus size={15} />
                  <span>Cadastrar Primeira Marca</span>
                </button>
              </div>
            )}
          </div>
        </div>
      ) : (
        /* ========================================================================= */
        /* NÍVEL 2: PRODUTOS DA MARCA ESPECÍFICA (DRILL-DOWN)                        */
        /* ========================================================================= */
        <div className="space-y-6 animate-in fade-in duration-200">
          {/* Banner da Marca Selecionada */}
          <div className="p-5 rounded-2xl bg-[#18181B] border border-[#27272A] flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <button
                type="button"
                onClick={() => setSelectedBrand(null)}
                className="w-10 h-10 rounded-xl bg-[#09090B] border border-[#27272A] hover:border-[#0DB87E] flex items-center justify-center text-zinc-300 hover:text-white transition-all cursor-pointer"
                title="Voltar para Todas as Marcas"
              >
                <ArrowLeft size={18} />
              </button>

              <div className="w-14 h-14 rounded-2xl bg-[#09090B] border border-[#27272A] flex items-center justify-center overflow-hidden shrink-0">
                {resolveImageUrl(selectedBrand.logo_url) && !brokenImages[selectedBrand.id] ? (
                  <img
                    src={resolveImageUrl(selectedBrand.logo_url)}
                    alt={selectedBrand.nome_marca}
                    onError={() => markImageAsBroken(selectedBrand.id)}
                    className="w-full h-full object-contain p-1.5"
                  />
                ) : (
                  <span className="w-full h-full flex items-center justify-center bg-[#0DB87E]/10 text-[#00FF66] font-extrabold text-base">
                    {selectedBrand.nome_marca.slice(0, 2).toUpperCase()}
                  </span>
                )}
              </div>

              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-xl font-bold font-display text-white">
                    {selectedBrand.nome_marca}
                  </h2>
                  <span
                    className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider border ${
                      selectedBrand.ativo
                        ? "bg-[#0DB87E]/15 text-[#00FF66] border-[#0DB87E]/30"
                        : "bg-zinc-800 text-zinc-400 border-zinc-700"
                    }`}
                  >
                    {selectedBrand.ativo ? "Marca Ativa" : "Marca Pausada"}
                  </span>
                </div>
                <p className="text-xs text-zinc-400 mt-1">
                  Gerenciamento dos sabores e itens oficiais desta marca • {brandProducts.length} produtos cadastrados
                </p>
              </div>
            </div>

            {/* Ações secundárias da Marca */}
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  setEditingSupplier(selectedBrand);
                  setSuppNome(selectedBrand.nome_marca);
                  setSuppLogoUrl(selectedBrand.logo_url || "");
                  setSuppAtivo(selectedBrand.ativo);
                  setIsSupplierModalOpen(true);
                }}
                className="px-3 py-2 rounded-xl bg-[#09090B] border border-[#27272A] text-zinc-300 hover:text-white text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
              >
                <Pencil size={14} />
                <span>Editar Marca</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setBulkTargetScope("brand");
                  setIsBulkPriceModalOpen(true);
                }}
                className="px-3 py-2 rounded-xl bg-[#09090B] border border-[#27272A] text-zinc-300 hover:text-white text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
              >
                <Percent size={14} className="text-[#00FF66]" />
                <span>Reajustar Preços da Marca</span>
              </button>
            </div>
          </div>

          {/* ========================================================================= */}
          {/* BARRA DE FILTROS & BOTÃO PRINCIPAL "+ NOVO PRODUTO" (POSICIONAMENTO EXIGIDO) */}
          {/* ========================================================================= */}
          <div className="p-4 rounded-2xl bg-[#18181B] border border-[#27272A] flex flex-col md:flex-row items-center justify-between gap-3 shadow-md">
            {/* Lado Esquerdo: Busca e Filtros */}
            <div className="flex flex-1 flex-col sm:flex-row items-center gap-2.5 w-full">
              <div className="relative flex-1 w-full">
                <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-500" />
                <input
                  type="text"
                  value={productSearch}
                  onChange={(e) => setProductSearch(e.target.value)}
                  placeholder={`Buscar produtos em ${selectedBrand.nome_marca}...`}
                  className="w-full bg-[#09090B] border border-[#27272A] rounded-xl pl-9 pr-3.5 py-2 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-[#0DB87E]"
                />
              </div>

              <div className="flex items-center gap-2 w-full sm:w-auto">
                <select
                  value={selectedCategoria}
                  onChange={(e) => setSelectedCategoria(e.target.value)}
                  className="bg-[#09090B] border border-[#27272A] rounded-xl px-3 py-2 text-xs text-zinc-300 focus:outline-none focus:border-[#0DB87E] w-full sm:w-auto"
                >
                  <option value="all">Todas as Categorias</option>
                  {brandCategories.filter((c) => c !== "all").map((cat) => (
                    <option key={cat} value={cat}>
                      {cat}
                    </option>
                  ))}
                </select>

                <select
                  value={selectedProductStatus}
                  onChange={(e) => setSelectedProductStatus(e.target.value)}
                  className="bg-[#09090B] border border-[#27272A] rounded-xl px-3 py-2 text-xs text-zinc-300 focus:outline-none focus:border-[#0DB87E] w-full sm:w-auto"
                >
                  <option value="all">Todos os Status</option>
                  <option value="active">Somente Ativos</option>
                  <option value="inactive">Somente Inativos</option>
                </select>
              </div>
            </div>

            {/* Lado Direito: BOTÃO PRINCIPAL "+ NOVO PRODUTO" ACIMA DA TABELA */}
            <div className="w-full md:w-auto flex items-center justify-end">
              <button
                type="button"
                onClick={() => handleOpenAddProductForBrand(selectedBrand.id)}
                className="w-full md:w-auto px-4 py-2.5 rounded-xl bg-[#0DB87E] hover:bg-[#00FF66] text-[#09090B] text-xs font-bold flex items-center justify-center gap-2 shadow-lg shadow-[#0DB87E]/20 transition-all active:scale-95 cursor-pointer"
              >
                <Plus size={16} />
                <span>Novo Produto em {selectedBrand.nome_marca}</span>
              </button>
            </div>
          </div>

          {/* Tabela de Produtos da Marca */}
          <div className="rounded-2xl bg-[#18181B] border border-[#27272A] overflow-hidden shadow-xl">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-[#27272A] bg-[#09090B]/60 text-zinc-400 font-semibold uppercase tracking-wider">
                    <th className="p-3.5 w-10 text-center">
                      <input
                        type="checkbox"
                        checked={
                          filteredBrandProducts.length > 0 &&
                          selectedProductIds.length === filteredBrandProducts.length
                        }
                        onChange={handleSelectAll}
                        className="rounded border-[#27272A] text-[#0DB87E] focus:ring-0 cursor-pointer"
                      />
                    </th>
                    <th className="p-3.5">Produto</th>
                    <th className="p-3.5">Categoria</th>
                    <th className="p-3.5">Preço Sugerido</th>
                    <th className="p-3.5 text-center">Status</th>
                    <th className="p-3.5 text-right">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#27272A]">
                  {filteredBrandProducts.map((p) => {
                    const isSelected = selectedProductIds.includes(p.id);
                    const prodImg = resolveImageUrl(p.imagem_url);
                    const isImgBroken = brokenImages[p.id];

                    return (
                      <tr
                        key={p.id}
                        className={`hover:bg-[#27272A]/30 transition-colors ${
                          isSelected ? "bg-[#0DB87E]/5" : ""
                        }`}
                      >
                        <td className="p-3.5 text-center">
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => handleToggleSelectProduct(p.id)}
                            className="rounded border-[#27272A] text-[#0DB87E] focus:ring-0 cursor-pointer"
                          />
                        </td>
                        <td className="p-3.5">
                          <div className="flex items-center gap-3">
                            <div className="w-11 h-11 rounded-xl bg-[#09090B] border border-[#27272A] overflow-hidden flex items-center justify-center shrink-0">
                              {prodImg && !isImgBroken ? (
                                <img
                                  src={prodImg}
                                  alt={p.nome_produto}
                                  onError={() => markImageAsBroken(p.id)}
                                  className="w-full h-full object-cover"
                                />
                              ) : (
                                <span className="text-xl">🍦</span>
                              )}
                            </div>
                            <div className="min-w-0">
                              <p className="font-bold text-white text-xs truncate">{p.nome_produto}</p>
                              {p.descricao && (
                                <p className="text-[11px] text-zinc-400 truncate max-w-xs">{p.descricao}</p>
                              )}
                            </div>
                          </div>
                        </td>
                        <td className="p-3.5">
                          <span className="px-2 py-0.5 rounded bg-zinc-800 text-zinc-300 font-medium text-[11px]">
                            {p.categoria}
                          </span>
                        </td>
                        <td className="p-3.5">
                          <span className="font-extrabold text-white text-xs">
                            R$ {Number(p.preco_sugerido).toFixed(2)}
                          </span>
                        </td>
                        <td className="p-3.5 text-center">
                          <button
                            type="button"
                            onClick={() => handleToggleProductStatus(p)}
                            className={`px-2.5 py-1 rounded-full text-[10px] font-extrabold uppercase tracking-wider border cursor-pointer transition-all ${
                              p.ativo
                                ? "bg-[#0DB87E]/15 text-[#00FF66] border-[#0DB87E]/30 hover:bg-[#0DB87E]/25"
                                : "bg-zinc-800 text-zinc-400 border-zinc-700 hover:bg-zinc-700"
                            }`}
                          >
                            {p.ativo ? "Ativo" : "Inativo"}
                          </button>
                        </td>
                        <td className="p-3.5 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            <button
                              type="button"
                              onClick={() => handleOpenEditProduct(p)}
                              className="w-7 h-7 rounded-lg bg-[#09090B] border border-[#27272A] flex items-center justify-center text-zinc-400 hover:text-white transition-colors cursor-pointer"
                              title="Editar"
                            >
                              <Pencil size={13} />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDeleteProduct(p.id, p.nome_produto)}
                              className="w-7 h-7 rounded-lg bg-red-950/30 border border-red-900/40 flex items-center justify-center text-red-400 hover:text-red-300 transition-colors cursor-pointer"
                              title="Excluir"
                            >
                              <Trash2 size={13} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}

                  {filteredBrandProducts.length === 0 && (
                    <tr>
                      <td colSpan={6} className="p-10 text-center text-zinc-400 space-y-3">
                        <ShoppingBag size={32} className="text-zinc-600 mx-auto" />
                        <p className="text-xs font-semibold text-white">Nenhum produto cadastrado para esta marca.</p>
                        <button
                          type="button"
                          onClick={() => handleOpenAddProductForBrand(selectedBrand.id)}
                          className="px-3.5 py-2 rounded-xl bg-[#0DB87E] text-[#09090B] text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer"
                        >
                          <Plus size={14} />
                          <span>Adicionar Primeiro Produto</span>
                        </button>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {/* Rodapé da tabela com seleção de lote */}
            {selectedProductIds.length > 0 && (
              <div className="p-3 bg-[#0DB87E]/10 border-t border-[#0DB87E]/30 flex items-center justify-between">
                <span className="text-xs text-[#00FF66] font-semibold">
                  {selectedProductIds.length} produto(s) selecionado(s)
                </span>
                <button
                  type="button"
                  onClick={() => {
                    setBulkTargetScope("selected");
                    setIsBulkPriceModalOpen(true);
                  }}
                  className="px-3 py-1.5 rounded-lg bg-[#0DB87E] text-[#09090B] text-xs font-bold flex items-center gap-1.5 cursor-pointer"
                >
                  <Percent size={13} />
                  <span>Reajustar Preço dos Selecionados</span>
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL: PRODUTO (NOVO OU EDIÇÃO)                                           */}
      {/* ========================================================================= */}
      {isProductModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-lg bg-[#18181B] border border-[#27272A] rounded-2xl p-6 space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-[#27272A] pb-3">
              <h3 className="text-base font-bold text-white flex items-center gap-2 font-display">
                <ShoppingBag size={18} className="text-[#00FF66]" />
                {editingProduct ? "Editar Produto Homologado" : "Novo Produto Homologado"}
              </h3>
              <button
                type="button"
                onClick={() => setIsProductModalOpen(false)}
                className="w-8 h-8 rounded-lg bg-[#09090B] border border-[#27272A] flex items-center justify-center text-zinc-400 hover:text-white cursor-pointer"
              >
                <X size={16} />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-zinc-300 mb-1">
                  Marca / Fornecedor *
                </label>
                <select
                  value={prodFornecedorId}
                  onChange={(e) => setProdFornecedorId(e.target.value)}
                  className="w-full bg-[#09090B] border border-[#27272A] rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none focus:border-[#0DB87E]"
                >
                  {fornecedores.map((f) => (
                    <option key={f.id} value={f.id}>
                      {f.nome_marca}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-zinc-300 mb-1">
                  Nome do Produto / Sabor *
                </label>
                <input
                  type="text"
                  value={prodNome}
                  onChange={(e) => setProdNome(e.target.value)}
                  placeholder="Ex: Picolé de Manga, Picolé de Flocos"
                  className="w-full bg-[#09090B] border border-[#27272A] rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-[#0DB87E]"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-zinc-300 mb-1">
                    Categoria *
                  </label>
                  <input
                    type="text"
                    value={prodCategoria}
                    onChange={(e) => setProdCategoria(e.target.value)}
                    placeholder="Ex: Picolés, Massas, Bebidas"
                    className="w-full bg-[#09090B] border border-[#27272A] rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-[#0DB87E]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-zinc-300 mb-1">
                    Preço Sugerido (R$) *
                  </label>
                  <input
                    type="text"
                    value={prodPrecoSugerido}
                    onChange={(e) => setProdPrecoSugerido(e.target.value)}
                    placeholder="5.00"
                    className="w-full bg-[#09090B] border border-[#27272A] rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-[#0DB87E]"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-zinc-300 mb-1">
                  Descrição (Opcional)
                </label>
                <textarea
                  value={prodDescricao}
                  onChange={(e) => setProdDescricao(e.target.value)}
                  placeholder="Ingredientes, alérgenos ou destaques do produto..."
                  rows={2}
                  className="w-full bg-[#09090B] border border-[#27272A] rounded-xl px-3.5 py-2 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-[#0DB87E]"
                />
              </div>

              {/* Upload da Foto do Produto */}
              <div>
                <label className="block text-xs font-medium text-zinc-300 mb-1">
                  Foto Oficial do Produto
                </label>
                <div className="flex items-center gap-3">
                  <div className="w-14 h-14 rounded-xl bg-[#09090B] border border-[#27272A] overflow-hidden flex items-center justify-center shrink-0">
                    {prodImagemUrl ? (
                      <img src={prodImagemUrl} alt="Preview" className="w-full h-full object-cover" />
                    ) : (
                      <ImageIcon size={20} className="text-zinc-600" />
                    )}
                  </div>
                  <label className="flex-1 flex flex-col items-center justify-center border border-dashed border-[#27272A] rounded-xl p-3 bg-[#09090B] hover:border-[#0DB87E] cursor-pointer transition-all">
                    <UploadCloud size={18} className="text-zinc-400 mb-0.5" />
                    <span className="text-xs text-zinc-300 font-medium">
                      {uploadingImage ? "Enviando para o bucket..." : "Selecionar Imagem do Produto"}
                    </span>
                    <input
                      type="file"
                      ref={fileInputRef}
                      accept="image/*"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) handleImageUpload(file);
                      }}
                      className="hidden"
                    />
                  </label>
                </div>
              </div>

              <div className="flex items-center gap-2 pt-1">
                <input
                  type="checkbox"
                  id="prodAtivoCheck"
                  checked={prodAtivo}
                  onChange={(e) => setProdAtivo(e.target.checked)}
                  className="rounded border-[#27272A] text-[#0DB87E] focus:ring-0 cursor-pointer"
                />
                <label htmlFor="prodAtivoCheck" className="text-xs text-zinc-300 cursor-pointer">
                  Produto Ativo no Catálogo Oficial
                </label>
              </div>

              <div className="pt-3 flex gap-3 border-t border-[#27272A]">
                <button
                  type="button"
                  onClick={() => setIsProductModalOpen(false)}
                  className="flex-1 py-2.5 rounded-xl border border-[#27272A] bg-[#09090B] text-zinc-300 text-xs font-bold hover:bg-zinc-800 transition-all cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  disabled={saving || uploadingImage}
                  onClick={handleSaveProduct}
                  className="flex-1 py-2.5 rounded-xl bg-[#0DB87E] hover:bg-[#00FF66] text-[#09090B] text-xs font-bold transition-all cursor-pointer disabled:opacity-50"
                >
                  {saving ? "Salvando..." : "Salvar Produto"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL: MARCA / FORNECEDOR (NOVO OU EDIÇÃO)                                */}
      {/* ========================================================================= */}
      {isSupplierModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-[#18181B] border border-[#27272A] rounded-2xl p-6 space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-[#27272A] pb-3">
              <h3 className="text-base font-bold text-white flex items-center gap-2 font-display">
                <Building2 size={18} className="text-[#00FF66]" />
                {editingSupplier ? "Editar Marca Parceira" : "Nova Marca Parceira"}
              </h3>
              <button
                type="button"
                onClick={() => setIsSupplierModalOpen(false)}
                className="w-8 h-8 rounded-lg bg-[#09090B] border border-[#27272A] flex items-center justify-center text-zinc-400 hover:text-white cursor-pointer"
              >
                <X size={16} />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-zinc-300 mb-1">
                  Nome da Marca / Indústria *
                </label>
                <input
                  type="text"
                  value={suppNome}
                  onChange={(e) => setSuppNome(e.target.value)}
                  placeholder="Ex: Frutverão, Kibon, Nestlé, Oggi"
                  className="w-full bg-[#09090B] border border-[#27272A] rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-[#0DB87E]"
                />
              </div>

              {/* Upload do Logotipo */}
              <div>
                <label className="block text-xs font-medium text-zinc-300 mb-1">
                  Logotipo da Marca
                </label>
                <div className="flex items-center gap-3">
                  <div className="w-14 h-14 rounded-xl bg-[#09090B] border border-[#27272A] overflow-hidden flex items-center justify-center shrink-0">
                    {suppLogoUrl ? (
                      <img src={suppLogoUrl} alt="Logo" className="w-full h-full object-contain p-1" />
                    ) : (
                      <Building2 size={20} className="text-zinc-600" />
                    )}
                  </div>
                  <label className="flex-1 flex flex-col items-center justify-center border border-dashed border-[#27272A] rounded-xl p-3 bg-[#09090B] hover:border-[#0DB87E] cursor-pointer transition-all">
                    <UploadCloud size={18} className="text-zinc-400 mb-0.5" />
                    <span className="text-xs text-zinc-300 font-medium">
                      {uploadingLogo ? "Enviando logo..." : "Selecionar Logotipo"}
                    </span>
                    <input
                      type="file"
                      ref={supplierLogoInputRef}
                      accept="image/*"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) handleSupplierLogoUpload(file);
                      }}
                      className="hidden"
                    />
                  </label>
                </div>
              </div>

              <div className="flex items-center gap-2 pt-1">
                <input
                  type="checkbox"
                  id="suppAtivoCheck"
                  checked={suppAtivo}
                  onChange={(e) => setSuppAtivo(e.target.checked)}
                  className="rounded border-[#27272A] text-[#0DB87E] focus:ring-0 cursor-pointer"
                />
                <label htmlFor="suppAtivoCheck" className="text-xs text-zinc-300 cursor-pointer">
                  Marca Ativa e Disponível para Ambulantes
                </label>
              </div>

              <div className="pt-3 flex gap-3 border-t border-[#27272A]">
                <button
                  type="button"
                  onClick={() => setIsSupplierModalOpen(false)}
                  className="flex-1 py-2.5 rounded-xl border border-[#27272A] bg-[#09090B] text-zinc-300 text-xs font-bold hover:bg-zinc-800 transition-all cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  disabled={saving || uploadingLogo}
                  onClick={handleSaveSupplier}
                  className="flex-1 py-2.5 rounded-xl bg-[#0DB87E] hover:bg-[#00FF66] text-[#09090B] text-xs font-bold transition-all cursor-pointer disabled:opacity-50"
                >
                  {saving ? "Salvando..." : "Salvar Marca"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL: REAJUSTE EM MASSA DE PREÇOS                                        */}
      {/* ========================================================================= */}
      {isBulkPriceModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-[#18181B] border border-[#27272A] rounded-2xl p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-[#27272A] pb-3">
              <h3 className="text-base font-bold text-white flex items-center gap-2 font-display">
                <Percent size={18} className="text-[#00FF66]" />
                Reajuste de Preços em Massa
              </h3>
              <button
                type="button"
                onClick={() => setIsBulkPriceModalOpen(false)}
                className="w-8 h-8 rounded-lg bg-[#09090B] border border-[#27272A] flex items-center justify-center text-zinc-400 hover:text-white cursor-pointer"
              >
                <X size={16} />
              </button>
            </div>

            <div className="space-y-4 text-xs">
              <div>
                <label className="block font-medium text-zinc-300 mb-1">
                  Escopo de Aplicação
                </label>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setBulkTargetScope("brand")}
                    className={`flex-1 py-2 px-3 rounded-xl border font-bold transition-all cursor-pointer ${
                      bulkTargetScope === "brand"
                        ? "bg-[#0DB87E]/20 text-[#00FF66] border-[#0DB87E]"
                        : "bg-[#09090B] text-zinc-400 border-[#27272A]"
                    }`}
                  >
                    {selectedBrand ? selectedBrand.nome_marca : "Toda a Marca"}
                  </button>
                  <button
                    type="button"
                    onClick={() => setBulkTargetScope("selected")}
                    className={`flex-1 py-2 px-3 rounded-xl border font-bold transition-all cursor-pointer ${
                      bulkTargetScope === "selected"
                        ? "bg-[#0DB87E]/20 text-[#00FF66] border-[#0DB87E]"
                        : "bg-[#09090B] text-zinc-400 border-[#27272A]"
                    }`}
                  >
                    Itens Selecionados ({selectedProductIds.length})
                  </button>
                </div>
              </div>

              <div>
                <label className="block font-medium text-zinc-300 mb-1">
                  Tipo de Reajuste
                </label>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setBulkAdjustmentType("percentual")}
                    className={`flex-1 py-2 px-3 rounded-xl border font-bold transition-all cursor-pointer ${
                      bulkAdjustmentType === "percentual"
                        ? "bg-[#0DB87E]/20 text-[#00FF66] border-[#0DB87E]"
                        : "bg-[#09090B] text-zinc-400 border-[#27272A]"
                    }`}
                  >
                    Percentual (%)
                  </button>
                  <button
                    type="button"
                    onClick={() => setBulkAdjustmentType("nominal")}
                    className={`flex-1 py-2 px-3 rounded-xl border font-bold transition-all cursor-pointer ${
                      bulkAdjustmentType === "nominal"
                        ? "bg-[#0DB87E]/20 text-[#00FF66] border-[#0DB87E]"
                        : "bg-[#09090B] text-zinc-400 border-[#27272A]"
                    }`}
                  >
                    Valor Fixo (R$)
                  </button>
                </div>
              </div>

              <div>
                <label className="block font-medium text-zinc-300 mb-1">
                  {bulkAdjustmentType === "percentual" ? "Variação Percentual (%)" : "Variação em Reais (R$)"}
                </label>
                <input
                  type="text"
                  value={bulkAdjustmentValue}
                  onChange={(e) => setBulkAdjustmentValue(e.target.value)}
                  placeholder={bulkAdjustmentType === "percentual" ? "Ex: 10 ou -5" : "Ex: 1.50 ou -0.50"}
                  className="w-full bg-[#09090B] border border-[#27272A] rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-[#0DB87E]"
                />
                <p className="text-[10px] text-zinc-500 mt-1">
                  Use números positivos para acréscimo e negativos para redução.
                </p>
              </div>

              <div className="pt-3 flex gap-3 border-t border-[#27272A]">
                <button
                  type="button"
                  onClick={() => setIsBulkPriceModalOpen(false)}
                  className="flex-1 py-2.5 rounded-xl border border-[#27272A] bg-[#09090B] text-zinc-300 text-xs font-bold hover:bg-zinc-800 transition-all cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  disabled={saving}
                  onClick={handleApplyBulkAdjustment}
                  className="flex-1 py-2.5 rounded-xl bg-[#0DB87E] hover:bg-[#00FF66] text-[#09090B] text-xs font-bold transition-all cursor-pointer disabled:opacity-50"
                >
                  {saving ? "Aplicando..." : "Aplicar Reajuste"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
