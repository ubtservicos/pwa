import { useState, useEffect, useRef } from "react";
import {
  Utensils,
  Plus,
  Pencil,
  Trash2,
  Search,
  Check,
  X,
  ShoppingBag,
  RefreshCw,
  UploadCloud,
  Percent,
  DollarSign,
  Filter,
  CheckCircle2,
  AlertCircle,
  Building2,
  Eye,
  SlidersHorizontal,
  ChevronDown,
  Layers,
  ArrowUpDown,
  Image as ImageIcon
} from "lucide-react";
import { Card, Pill } from "@/components/admin/ui";
import { useAdminToast } from "@/components/admin/AdminToast";
import { supabase } from "@/lib/supabase";

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
    id: string;
    nome_marca: string;
    logo_url?: string;
  };
}

export default function AdminAmbulantesCardapiosPage() {
  const toast = useAdminToast();

  // Data states
  const [fornecedores, setFornecedores] = useState<Fornecedor[]>([]);
  const [produtos, setProdutos] = useState<ProdutoPadrao[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [search, setSearch] = useState("");
  const [selectedFornecedorId, setSelectedFornecedorId] = useState<string>("all");
  const [selectedCategoria, setSelectedCategoria] = useState<string>("all");
  const [selectedStatus, setSelectedStatus] = useState<string>("all");

  // Selection for bulk actions
  const [selectedProductIds, setSelectedProductIds] = useState<string[]>([]);

  // Modals
  const [isProductModalOpen, setIsProductModalOpen] = useState(false);
  const [isSupplierModalOpen, setIsSupplierModalOpen] = useState(false);
  const [isBulkPriceModalOpen, setIsBulkPriceModalOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  // Form State - Produto
  const [editingProduct, setEditingProduct] = useState<ProdutoPadrao | null>(null);
  const [prodNome, setProdNome] = useState("");
  const [prodFornecedorId, setProdFornecedorId] = useState("");
  const [prodCategoria, setProdCategoria] = useState("");
  const [prodPrecoSugerido, setProdPrecoSugerido] = useState("");
  const [prodDescricao, setProdDescricao] = useState("");
  const [prodImagemUrl, setProdImagemUrl] = useState("");
  const [prodAtivo, setProdAtivo] = useState(true);
  const [uploadingImage, setUploadingImage] = useState(false);

  // Form State - Fornecedor
  const [editingSupplier, setEditingSupplier] = useState<Fornecedor | null>(null);
  const [suppNome, setSuppNome] = useState("");
  const [suppLogoUrl, setSuppLogoUrl] = useState("");
  const [suppAtivo, setSuppAtivo] = useState(true);

  // Bulk price form
  const [bulkAdjustmentType, setBulkAdjustmentType] = useState<"percentual" | "nominal">("percentual");
  const [bulkAdjustmentValue, setBulkAdjustmentValue] = useState<string>("10");
  const [bulkTargetScope, setBulkTargetScope] = useState<"selected" | "brand">("selected");
  const [bulkTargetBrandId, setBulkTargetBrandId] = useState<string>("");

  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    loadAllData();
  }, []);

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
    } catch (err: any) {
      console.error("Erro ao carregar dados do catálogo:", err);
      toast.show("Erro ao carregar catálogo: " + (err.message || "Falha na conexão"));
    } finally {
      setLoading(false);
    }
  }

  const [uploadingLogo, setUploadingLogo] = useState(false);
  const supplierLogoInputRef = useRef<HTMLInputElement>(null);

  // Upload direto para o bucket catalogo-ambulantes (Produtos)
  const handleImageUpload = async (file: File) => {
    try {
      setUploadingImage(true);
      const fileExt = file.name.split(".").pop() || "jpg";
      const fileName = `produtos/${Date.now()}-${Math.random().toString(36).substring(2, 9)}.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from("catalogo-ambulantes")
        .upload(fileName, file, {
          cacheControl: "3600",
          upsert: true,
        });

      if (uploadError) throw uploadError;

      const { data: urlData } = supabase.storage
        .from("catalogo-ambulantes")
        .getPublicUrl(fileName);

      setProdImagemUrl(urlData.publicUrl);
      toast.show("Imagem do produto carregada no bucket com sucesso!");
    } catch (err: any) {
      console.error("Erro no upload da imagem:", err);
      toast.show("Falha no upload: " + (err.message || "Erro desconhecido"));
    } finally {
      setUploadingImage(false);
    }
  };

  // Upload direto para o bucket catalogo-ambulantes (Logos de Fornecedor)
  const handleSupplierLogoUpload = async (file: File) => {
    try {
      setUploadingLogo(true);
      const fileExt = file.name.split(".").pop() || "jpg";
      const fileName = `logos/${Date.now()}-${Math.random().toString(36).substring(2, 9)}.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from("catalogo-ambulantes")
        .upload(fileName, file, {
          cacheControl: "3600",
          upsert: true,
        });

      if (uploadError) throw uploadError;

      const { data: urlData } = supabase.storage
        .from("catalogo-ambulantes")
        .getPublicUrl(fileName);

      setSuppLogoUrl(urlData.publicUrl);
      toast.show("Logotipo da marca carregado no bucket com sucesso!");
    } catch (err: any) {
      console.error("Erro no upload do logotipo:", err);
      toast.show("Falha no upload: " + (err.message || "Erro desconhecido"));
    } finally {
      setUploadingLogo(false);
    }
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleImageUpload(e.dataTransfer.files[0]);
    }
  };

  // Toggle rápido de ativação
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

  // Salvar Produto
  const handleSaveProduct = async () => {
    if (!prodNome.trim() || !prodFornecedorId || !prodPrecoSugerido) {
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
            id_fornecedor: prodFornecedorId,
            categoria: prodCategoria.trim() || "Geral",
            preco_sugerido: precoNumber,
            descricao: prodDescricao.trim(),
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
          id_fornecedor: prodFornecedorId,
          categoria: prodCategoria.trim() || "Geral",
          preco_sugerido: precoNumber,
          descricao: prodDescricao.trim(),
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
        if (!bulkTargetBrandId) {
          toast.show("Selecione a marca para o reajuste.");
          return;
        }
        targetList = produtos.filter((p) => p.id_fornecedor === bulkTargetBrandId);
      }

      if (targetList.length === 0) {
        toast.show("Nenhum produto afetado pelo filtro.");
        return;
      }

      // Processar updates
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

      toast.show(`Reajuste aplicado com sucesso a ${targetList.length} produtos!`);
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

  // Salvar Fornecedor
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
        toast.show("Fornecedor atualizado com sucesso!");
      } else {
        const { error } = await supabase.from("fornecedores_padrao").insert({
          nome_marca: suppNome.trim(),
          logo_url: suppLogoUrl.trim() || null,
          ativo: suppAtivo,
        });

        if (error) throw error;
        toast.show("Novo fornecedor cadastrado com sucesso!");
      }

      setIsSupplierModalOpen(false);
      await loadAllData();
    } catch (err: any) {
      console.error("Erro ao salvar fornecedor:", err);
      toast.show("Erro: " + err.message);
    } finally {
      setSaving(false);
    }
  };

  // Abrir modal de produto para adição
  const handleOpenAddProduct = () => {
    setEditingProduct(null);
    setProdNome("");
    setProdFornecedorId(fornecedores[0]?.id || "");
    setProdCategoria("Picolés de Fruta");
    setProdPrecoSugerido("5.00");
    setProdDescricao("");
    setProdImagemUrl("");
    setProdAtivo(true);
    setIsProductModalOpen(true);
  };

  // Abrir modal de produto para edição
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

  // Filtragem de Produtos
  const filteredProducts = produtos.filter((p) => {
    const matchesSearch =
      search === "" ||
      p.nome_produto.toLowerCase().includes(search.toLowerCase()) ||
      (p.descricao && p.descricao.toLowerCase().includes(search.toLowerCase())) ||
      (p.fornecedores_padrao?.nome_marca &&
        p.fornecedores_padrao.nome_marca.toLowerCase().includes(search.toLowerCase()));

    const matchesFornecedor =
      selectedFornecedorId === "all" || p.id_fornecedor === selectedFornecedorId;

    const matchesCategoria =
      selectedCategoria === "all" || p.categoria === selectedCategoria;

    const matchesStatus =
      selectedStatus === "all" ||
      (selectedStatus === "active" && p.ativo) ||
      (selectedStatus === "inactive" && !p.ativo);

    return matchesSearch && matchesFornecedor && matchesCategoria && matchesStatus;
  });

  const categoriesList = Array.from(new Set(produtos.map((p) => p.categoria)));

  const handleSelectAll = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.checked) {
      setSelectedProductIds(filteredProducts.map((p) => p.id));
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
    <div className="space-y-6 max-w-7xl mx-auto pb-16">
      {/* Top Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="p-2 rounded-xl bg-[#0DB87E]/20 text-[#00FF66] border border-[#0DB87E]/30">
              <Utensils size={22} />
            </span>
            <h1 className="text-2xl font-bold font-display text-white">
              Gestão de Cardápios & Marcas (Ambulantes)
            </h1>
          </div>
          <p className="text-sm text-zinc-400 mt-1">
            Catálogo padrão integrado com fornecedores homologados, regras de preços e estoque sincronizado em tempo real.
          </p>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-wrap items-center gap-2.5">
          <button
            type="button"
            onClick={() => {
              setBulkTargetScope(selectedProductIds.length > 0 ? "selected" : "brand");
              setBulkTargetBrandId(fornecedores[0]?.id || "");
              setIsBulkPriceModalOpen(true);
            }}
            className="px-4 py-2 rounded-xl bg-[#18181B] border border-[#27272A] hover:border-[#0DB87E]/50 text-zinc-200 text-sm font-semibold flex items-center gap-2 transition-all hover:bg-[#27272A]"
          >
            <Percent size={16} className="text-[#00FF66]" />
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
            className="px-4 py-2 rounded-xl bg-[#18181B] border border-[#27272A] hover:border-zinc-500 text-zinc-200 text-sm font-semibold flex items-center gap-2 transition-all"
          >
            <Building2 size={16} />
            <span>Gerenciar Marcas</span>
          </button>

          <button
            type="button"
            onClick={handleOpenAddProduct}
            className="px-4 py-2 rounded-xl bg-[#0DB87E] hover:bg-[#00FF66] text-[#09090B] text-sm font-bold flex items-center gap-2 shadow-lg shadow-[#0DB87E]/20 transition-all active:scale-95"
          >
            <Plus size={16} />
            <span>Novo Produto</span>
          </button>
        </div>
      </div>

      {/* Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="p-4 rounded-2xl bg-[#18181B] border border-[#27272A] flex items-center justify-between">
          <div>
            <p className="text-xs text-zinc-400 font-semibold uppercase tracking-wider">Marcas Parceiras</p>
            <h3 className="text-2xl font-bold text-white mt-1">{fornecedores.length}</h3>
          </div>
          <div className="w-10 h-10 rounded-xl bg-[#09090B] border border-[#27272A] flex items-center justify-center text-[#00FF66]">
            <Building2 size={20} />
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-[#18181B] border border-[#27272A] flex items-center justify-between">
          <div>
            <p className="text-xs text-zinc-400 font-semibold uppercase tracking-wider">Total de Produtos</p>
            <h3 className="text-2xl font-bold text-white mt-1">{produtos.length}</h3>
          </div>
          <div className="w-10 h-10 rounded-xl bg-[#09090B] border border-[#27272A] flex items-center justify-center text-[#0DB87E]">
            <ShoppingBag size={20} />
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-[#18181B] border border-[#27272A] flex items-center justify-between">
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

        <div className="p-4 rounded-2xl bg-[#18181B] border border-[#27272A] flex items-center justify-between">
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

      {/* Filters Bar */}
      <div className="p-4 rounded-2xl bg-[#18181B] border border-[#27272A] flex flex-col md:flex-row items-center justify-between gap-3">
        <div className="flex flex-1 items-center gap-3 w-full">
          {/* Search */}
          <div className="relative flex-1">
            <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-500" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar por produto, marca ou descrição..."
              className="w-full bg-[#09090B] border border-[#27272A] rounded-xl pl-9 pr-4 py-2 text-sm text-white placeholder-zinc-500 focus:outline-none focus:border-[#0DB87E]"
            />
          </div>

          {/* Filter Fornecedor */}
          <select
            value={selectedFornecedorId}
            onChange={(e) => setSelectedFornecedorId(e.target.value)}
            className="bg-[#09090B] border border-[#27272A] rounded-xl px-3 py-2 text-sm text-zinc-200 focus:outline-none focus:border-[#0DB87E]"
          >
            <option value="all">Todas as Marcas</option>
            {fornecedores.map((f) => (
              <option key={f.id} value={f.id}>
                {f.nome_marca} ({f.total_produtos})
              </option>
            ))}
          </select>

          {/* Filter Categoria */}
          <select
            value={selectedCategoria}
            onChange={(e) => setSelectedCategoria(e.target.value)}
            className="bg-[#09090B] border border-[#27272A] rounded-xl px-3 py-2 text-sm text-zinc-200 focus:outline-none focus:border-[#0DB87E]"
          >
            <option value="all">Todas as Categorias</option>
            {categoriesList.map((cat) => (
              <option key={cat} value={cat}>
                {cat}
              </option>
            ))}
          </select>

          {/* Filter Status */}
          <select
            value={selectedStatus}
            onChange={(e) => setSelectedStatus(e.target.value)}
            className="bg-[#09090B] border border-[#27272A] rounded-xl px-3 py-2 text-sm text-zinc-200 focus:outline-none focus:border-[#0DB87E]"
          >
            <option value="all">Todos os Status</option>
            <option value="active">Apenas Ativos</option>
            <option value="inactive">Apenas Inativos</option>
          </select>
        </div>

        {/* Reload */}
        <button
          type="button"
          onClick={loadAllData}
          className="p-2.5 rounded-xl bg-[#09090B] border border-[#27272A] text-zinc-400 hover:text-white transition-colors"
          title="Recarregar"
        >
          <RefreshCw size={16} className={loading ? "animate-spin" : ""} />
        </button>
      </div>

      {/* Selected Items Floating Bar */}
      {selectedProductIds.length > 0 && (
        <div className="p-3.5 rounded-2xl bg-[#0DB87E]/10 border border-[#0DB87E]/30 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-[#00FF66] animate-pulse" />
            <span className="text-sm font-semibold text-white">
              {selectedProductIds.length} produtos selecionados
            </span>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => {
                setBulkTargetScope("selected");
                setIsBulkPriceModalOpen(true);
              }}
              className="px-3 py-1.5 rounded-lg bg-[#0DB87E] text-[#09090B] text-xs font-bold hover:bg-[#00FF66] flex items-center gap-1"
            >
              <Percent size={13} />
              <span>Reajustar Preços Selecionados</span>
            </button>
            <button
              type="button"
              onClick={() => setSelectedProductIds([])}
              className="px-3 py-1.5 rounded-lg bg-[#18181B] text-zinc-400 text-xs font-semibold hover:text-white border border-[#27272A]"
            >
              Limpar Seleção
            </button>
          </div>
        </div>
      )}

      {/* Data Table */}
      <div className="rounded-2xl bg-[#18181B] border border-[#27272A] overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-zinc-200">
            <thead className="bg-[#09090B] text-xs uppercase font-bold text-zinc-400 border-b border-[#27272A]">
              <tr>
                <th className="p-4 w-10 text-center">
                  <input
                    type="checkbox"
                    checked={
                      filteredProducts.length > 0 &&
                      selectedProductIds.length === filteredProducts.length
                    }
                    onChange={handleSelectAll}
                    className="rounded border-[#27272A] bg-[#18181B] text-[#0DB87E] focus:ring-0 cursor-pointer"
                  />
                </th>
                <th className="p-4">Produto</th>
                <th className="p-4">Marca / Fornecedor</th>
                <th className="p-4">Categoria</th>
                <th className="p-4">Preço Sugerido</th>
                <th className="p-4 text-center">Status Global</th>
                <th className="p-4 text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#27272A]">
              {loading ? (
                <tr>
                  <td colSpan={7} className="p-8 text-center text-zinc-500">
                    <RefreshCw size={24} className="animate-spin mx-auto mb-2 text-[#0DB87E]" />
                    Carregando catálogo de ambulantes...
                  </td>
                </tr>
              ) : filteredProducts.length === 0 ? (
                <tr>
                  <td colSpan={7} className="p-8 text-center text-zinc-500">
                    Nenhum produto encontrado com os filtros selecionados.
                  </td>
                </tr>
              ) : (
                filteredProducts.map((prod) => {
                  const isSelected = selectedProductIds.includes(prod.id);
                  return (
                    <tr
                      key={prod.id}
                      className={`hover:bg-[#121215] transition-colors ${
                        isSelected ? "bg-[#0DB87E]/5" : ""
                      }`}
                    >
                      {/* Checkbox */}
                      <td className="p-4 text-center">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => handleToggleSelectProduct(prod.id)}
                          className="rounded border-[#27272A] bg-[#18181B] text-[#0DB87E] focus:ring-0 cursor-pointer"
                        />
                      </td>

                      {/* Imagem + Nome + Descrição */}
                      <td className="p-4">
                        <div className="flex items-center gap-3">
                          <div className="w-12 h-12 rounded-xl bg-[#09090B] border border-[#27272A] overflow-hidden shrink-0">
                            {prod.imagem_url ? (
                              <img
                                src={prod.imagem_url}
                                alt={prod.nome_produto}
                                className="w-full h-full object-cover"
                              />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center text-zinc-600">
                                <ShoppingBag size={18} />
                              </div>
                            )}
                          </div>
                          <div>
                            <p className="font-bold text-white leading-tight">
                              {prod.nome_produto}
                            </p>
                            {prod.descricao && (
                              <p className="text-xs text-zinc-400 mt-0.5 line-clamp-1">
                                {prod.descricao}
                              </p>
                            )}
                          </div>
                        </div>
                      </td>

                      {/* Fornecedor */}
                      <td className="p-4">
                        <div className="flex items-center gap-2">
                          {prod.fornecedores_padrao?.logo_url && (
                            <img
                              src={prod.fornecedores_padrao.logo_url}
                              alt=""
                              className="w-5 h-5 rounded-full object-cover"
                            />
                          )}
                          <span className="font-medium text-zinc-300">
                            {prod.fornecedores_padrao?.nome_marca || "Sem Marca"}
                          </span>
                        </div>
                      </td>

                      {/* Categoria */}
                      <td className="p-4">
                        <span className="text-xs px-2.5 py-1 rounded-full bg-zinc-800 text-zinc-300 border border-zinc-700 font-medium">
                          {prod.categoria}
                        </span>
                      </td>

                      {/* Preço Sugerido */}
                      <td className="p-4">
                        <span className="text-sm font-bold text-[#00FF66]">
                          R$ {Number(prod.preco_sugerido).toFixed(2)}
                        </span>
                      </td>

                      {/* Status Toggle */}
                      <td className="p-4 text-center">
                        <button
                          type="button"
                          onClick={() => handleToggleProductStatus(prod)}
                          className={`px-3 py-1 rounded-full text-xs font-bold transition-all border ${
                            prod.ativo
                              ? "bg-[#0DB87E]/20 text-[#00FF66] border-[#0DB87E]/50 hover:bg-[#0DB87E]/30"
                              : "bg-red-950/40 text-red-400 border-red-800 hover:bg-red-950/60"
                          }`}
                        >
                          {prod.ativo ? "Ativo" : "Inativo"}
                        </button>
                      </td>

                      {/* Ações */}
                      <td className="p-4 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            type="button"
                            onClick={() => handleOpenEditProduct(prod)}
                            className="p-1.5 rounded-lg bg-[#09090B] border border-[#27272A] text-zinc-300 hover:text-white hover:border-[#0DB87E] transition-all"
                            title="Editar"
                          >
                            <Pencil size={15} />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeleteProduct(prod.id, prod.nome_produto)}
                            className="p-1.5 rounded-lg bg-[#09090B] border border-[#27272A] text-red-400 hover:text-red-300 hover:border-red-600 transition-all"
                            title="Excluir"
                          >
                            <Trash2 size={15} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* MODAL: CRIAR / EDITAR PRODUTO PADRÃO + DRAG & DROP UPLOAD */}
      {/* ========================================================================= */}
      {isProductModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div
            className="w-full max-w-xl bg-[#18181B] border border-[#27272A] rounded-2xl p-6 shadow-2xl relative max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between pb-4 border-b border-[#27272A]">
              <h3 className="text-lg font-bold text-white font-display">
                {editingProduct ? "Editar Produto Padrão" : "Cadastrar Novo Produto"}
              </h3>
              <button
                type="button"
                onClick={() => setIsProductModalOpen(false)}
                className="p-1 text-zinc-400 hover:text-white"
              >
                <X size={20} />
              </button>
            </div>

            <div className="space-y-4 mt-4">
              {/* Nome */}
              <div>
                <label className="block text-xs font-semibold text-zinc-300 mb-1">
                  Nome do Produto *
                </label>
                <input
                  type="text"
                  value={prodNome}
                  onChange={(e) => setProdNome(e.target.value)}
                  placeholder="Ex: Picolé Magnum Clássico"
                  className="w-full bg-[#09090B] border border-[#27272A] rounded-xl px-3.5 py-2 text-sm text-white focus:outline-none focus:border-[#0DB87E]"
                />
              </div>

              {/* Fornecedor & Categoria */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-zinc-300 mb-1">
                    Marca / Fornecedor *
                  </label>
                  <select
                    value={prodFornecedorId}
                    onChange={(e) => setProdFornecedorId(e.target.value)}
                    className="w-full bg-[#09090B] border border-[#27272A] rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-[#0DB87E]"
                  >
                    {fornecedores.map((f) => (
                      <option key={f.id} value={f.id}>
                        {f.nome_marca}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-zinc-300 mb-1">
                    Categoria *
                  </label>
                  <input
                    type="text"
                    value={prodCategoria}
                    onChange={(e) => setProdCategoria(e.target.value)}
                    placeholder="Ex: Picolés de Fruta, Açaí, Paletas"
                    className="w-full bg-[#09090B] border border-[#27272A] rounded-xl px-3.5 py-2 text-sm text-white focus:outline-none focus:border-[#0DB87E]"
                  />
                </div>
              </div>

              {/* Preço Sugerido */}
              <div>
                <label className="block text-xs font-semibold text-zinc-300 mb-1">
                  Preço Sugerido (R$) *
                </label>
                <div className="relative">
                  <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-sm font-bold text-[#00FF66]">
                    R$
                  </span>
                  <input
                    type="number"
                    step="0.50"
                    min="0"
                    value={prodPrecoSugerido}
                    onChange={(e) => setProdPrecoSugerido(e.target.value)}
                    placeholder="0.00"
                    className="w-full bg-[#09090B] border border-[#27272A] rounded-xl pl-10 pr-4 py-2 text-sm text-white font-bold focus:outline-none focus:border-[#0DB87E]"
                  />
                </div>
              </div>

              {/* Descrição */}
              <div>
                <label className="block text-xs font-semibold text-zinc-300 mb-1">
                  Descrição (Opcional)
                </label>
                <textarea
                  value={prodDescricao}
                  onChange={(e) => setProdDescricao(e.target.value)}
                  rows={2}
                  placeholder="Detalhes sobre sabor, ingredientes ou apresentação..."
                  className="w-full bg-[#09090B] border border-[#27272A] rounded-xl px-3.5 py-2 text-sm text-white focus:outline-none focus:border-[#0DB87E]"
                />
              </div>

              {/* Drag & Drop Image Upload (Storage Bucket 'catalogo-ambulantes') */}
              <div>
                <label className="block text-xs font-semibold text-zinc-300 mb-1">
                  Imagem do Produto (Drag-and-Drop para o Bucket)
                </label>
                <div
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={handleDrop}
                  onClick={() => fileInputRef.current?.click()}
                  className="border-2 border-dashed border-[#27272A] hover:border-[#0DB87E] rounded-xl p-4 text-center cursor-pointer transition-colors bg-[#09090B]/50"
                >
                  <input
                    type="file"
                    ref={fileInputRef}
                    onChange={(e) => {
                      if (e.target.files?.[0]) handleImageUpload(e.target.files[0]);
                    }}
                    accept="image/*"
                    className="hidden"
                  />
                  {uploadingImage ? (
                    <div className="py-3 text-sm text-[#00FF66] flex items-center justify-center gap-2">
                      <RefreshCw size={16} className="animate-spin" />
                      <span>Enviando para o bucket...</span>
                    </div>
                  ) : prodImagemUrl ? (
                    <div className="flex items-center justify-center gap-3">
                      <img
                        src={prodImagemUrl}
                        alt="Preview"
                        className="w-16 h-16 rounded-xl object-cover border border-[#27272A]"
                      />
                      <div className="text-left">
                        <p className="text-xs font-semibold text-white">Imagem vinculada</p>
                        <p className="text-[11px] text-zinc-500 truncate max-w-xs">{prodImagemUrl}</p>
                        <p className="text-[10px] text-[#00FF66] mt-1">Clique para trocar imagem</p>
                      </div>
                    </div>
                  ) : (
                    <div className="py-2">
                      <UploadCloud size={24} className="mx-auto text-[#0DB87E] mb-1" />
                      <p className="text-xs text-zinc-300 font-semibold">
                        Arraste uma foto aqui ou clique para selecionar
                      </p>
                      <p className="text-[10px] text-zinc-500 mt-0.5">
                        Armazenada diretamente no bucket <code>catalogo-ambulantes</code>
                      </p>
                    </div>
                  )}
                </div>
              </div>

              {/* Status Toggle */}
              <div className="flex items-center justify-between p-3 rounded-xl bg-[#09090B] border border-[#27272A]">
                <div>
                  <p className="text-xs font-semibold text-white">Ativo no Catálogo Global</p>
                  <p className="text-[11px] text-zinc-500">
                    Ambulantes poderão visualizar e vincular este item ao estoque.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setProdAtivo(!prodAtivo)}
                  className={`px-3 py-1 rounded-full text-xs font-bold transition-all ${
                    prodAtivo
                      ? "bg-[#0DB87E] text-[#09090B]"
                      : "bg-zinc-800 text-zinc-400"
                  }`}
                >
                  {prodAtivo ? "Sim, Ativo" : "Inativo"}
                </button>
              </div>
            </div>

            {/* Modal Actions */}
            <div className="flex items-center justify-end gap-3 mt-6 pt-4 border-t border-[#27272A]">
              <button
                type="button"
                onClick={() => setIsProductModalOpen(false)}
                className="px-4 py-2 rounded-xl text-sm font-semibold text-zinc-400 hover:text-white"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleSaveProduct}
                disabled={saving}
                className="px-5 py-2 rounded-xl bg-[#0DB87E] hover:bg-[#00FF66] text-[#09090B] text-sm font-bold shadow-lg shadow-[#0DB87E]/20 active:scale-95 transition-all"
              >
                {saving ? "Salvando..." : "Salvar Produto"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL: REAJUSTE EM MASSA DE PREÇOS */}
      {/* ========================================================================= */}
      {isBulkPriceModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div
            className="w-full max-w-lg bg-[#18181B] border border-[#27272A] rounded-2xl p-6 shadow-2xl relative"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between pb-4 border-b border-[#27272A]">
              <div className="flex items-center gap-2">
                <span className="p-1.5 rounded-lg bg-[#0DB87E]/20 text-[#00FF66]">
                  <Percent size={18} />
                </span>
                <h3 className="text-lg font-bold text-white font-display">
                  Reajuste de Preços em Massa
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setIsBulkPriceModalOpen(false)}
                className="p-1 text-zinc-400 hover:text-white"
              >
                <X size={20} />
              </button>
            </div>

            <div className="space-y-4 mt-4">
              {/* Escopo do Reajuste */}
              <div>
                <label className="block text-xs font-semibold text-zinc-300 mb-2">
                  Aplicar reajuste para:
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setBulkTargetScope("selected")}
                    disabled={selectedProductIds.length === 0}
                    className={`p-3 rounded-xl border text-left transition-all ${
                      bulkTargetScope === "selected"
                        ? "bg-[#0DB87E]/10 border-[#0DB87E] text-white"
                        : "bg-[#09090B] border-[#27272A] text-zinc-400"
                    } ${selectedProductIds.length === 0 ? "opacity-50 cursor-not-allowed" : ""}`}
                  >
                    <p className="text-xs font-bold">Itens Selecionados</p>
                    <p className="text-[11px] text-zinc-500">
                      {selectedProductIds.length} produtos marcados
                    </p>
                  </button>

                  <button
                    type="button"
                    onClick={() => setBulkTargetScope("brand")}
                    className={`p-3 rounded-xl border text-left transition-all ${
                      bulkTargetScope === "brand"
                        ? "bg-[#0DB87E]/10 border-[#0DB87E] text-white"
                        : "bg-[#09090B] border-[#27272A] text-zinc-400"
                    }`}
                  >
                    <p className="text-xs font-bold">Marca Inteira</p>
                    <p className="text-[11px] text-zinc-500">Todos os itens de uma marca</p>
                  </button>
                </div>
              </div>

              {/* Seletor de Marca se escopo for Brand */}
              {bulkTargetScope === "brand" && (
                <div>
                  <label className="block text-xs font-semibold text-zinc-300 mb-1">
                    Selecione a Marca
                  </label>
                  <select
                    value={bulkTargetBrandId}
                    onChange={(e) => setBulkTargetBrandId(e.target.value)}
                    className="w-full bg-[#09090B] border border-[#27272A] rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-[#0DB87E]"
                  >
                    {fornecedores.map((f) => (
                      <option key={f.id} value={f.id}>
                        {f.nome_marca} ({f.total_produtos} itens)
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {/* Tipo de Reajuste */}
              <div>
                <label className="block text-xs font-semibold text-zinc-300 mb-1">
                  Tipo de Reajuste
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setBulkAdjustmentType("percentual")}
                    className={`p-2.5 rounded-xl border text-xs font-bold transition-all ${
                      bulkAdjustmentType === "percentual"
                        ? "bg-[#0DB87E] text-[#09090B] border-[#0DB87E]"
                        : "bg-[#09090B] border-[#27272A] text-zinc-400"
                    }`}
                  >
                    Percentual (%)
                  </button>
                  <button
                    type="button"
                    onClick={() => setBulkAdjustmentType("nominal")}
                    className={`p-2.5 rounded-xl border text-xs font-bold transition-all ${
                      bulkAdjustmentType === "nominal"
                        ? "bg-[#0DB87E] text-[#09090B] border-[#0DB87E]"
                        : "bg-[#09090B] border-[#27272A] text-zinc-400"
                    }`}
                  >
                    Nominal em R$
                  </button>
                </div>
              </div>

              {/* Valor do Reajuste */}
              <div>
                <label className="block text-xs font-semibold text-zinc-300 mb-1">
                  Valor do Reajuste (Ex: 10 para +10% ou 1.50 para +R$ 1,50)
                </label>
                <input
                  type="number"
                  step="any"
                  value={bulkAdjustmentValue}
                  onChange={(e) => setBulkAdjustmentValue(e.target.value)}
                  placeholder="10"
                  className="w-full bg-[#09090B] border border-[#27272A] rounded-xl px-3.5 py-2 text-sm text-white font-bold focus:outline-none focus:border-[#0DB87E]"
                />
              </div>

              {/* Quick Presets */}
              <div className="flex flex-wrap gap-2 pt-1">
                {[
                  { label: "+5%", type: "percentual" as const, val: "5" },
                  { label: "+10%", type: "percentual" as const, val: "10" },
                  { label: "+15%", type: "percentual" as const, val: "15" },
                  { label: "-5%", type: "percentual" as const, val: "-5" },
                  { label: "+R$ 1,00", type: "nominal" as const, val: "1.00" },
                  { label: "+R$ 2,00", type: "nominal" as const, val: "2.00" },
                ].map((preset, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => {
                      setBulkAdjustmentType(preset.type);
                      setBulkAdjustmentValue(preset.val);
                    }}
                    className="px-2.5 py-1 rounded-lg bg-[#09090B] border border-[#27272A] text-xs font-semibold text-zinc-300 hover:border-[#0DB87E] hover:text-white"
                  >
                    {preset.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Modal Actions */}
            <div className="flex items-center justify-end gap-3 mt-6 pt-4 border-t border-[#27272A]">
              <button
                type="button"
                onClick={() => setIsBulkPriceModalOpen(false)}
                className="px-4 py-2 rounded-xl text-sm font-semibold text-zinc-400 hover:text-white"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleApplyBulkAdjustment}
                disabled={saving}
                className="px-5 py-2 rounded-xl bg-gradient-to-r from-[#0DB87E] to-[#00FF66] text-[#09090B] text-sm font-bold shadow-lg shadow-[#0DB87E]/20 active:scale-95 transition-all"
              >
                {saving ? "Processando..." : "Confirmar Reajuste"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL: GERENCIAR FORNECEDORES / MARCAS */}
      {/* ========================================================================= */}
      {isSupplierModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div
            className="w-full max-w-lg bg-[#18181B] border border-[#27272A] rounded-2xl p-6 shadow-2xl relative max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between pb-4 border-b border-[#27272A]">
              <h3 className="text-lg font-bold text-white font-display">
                Marcas Parceiras Cadastradas
              </h3>
              <button
                type="button"
                onClick={() => setIsSupplierModalOpen(false)}
                className="p-1 text-zinc-400 hover:text-white"
              >
                <X size={20} />
              </button>
            </div>

            {/* Form simples para nova marca */}
            <div className="p-4 rounded-xl bg-[#09090B] border border-[#27272A] mt-4 space-y-3">
              <h4 className="text-xs font-bold uppercase tracking-wider text-zinc-300">
                {editingSupplier ? "Editar Marca" : "Adicionar Nova Marca"}
              </h4>

              <div>
                <label className="block text-xs text-zinc-400 mb-1">Nome da Marca *</label>
                <input
                  type="text"
                  value={suppNome}
                  onChange={(e) => setSuppNome(e.target.value)}
                  placeholder="Ex: Frutverão, Nestlé, Kibon..."
                  className="w-full bg-[#18181B] border border-[#27272A] rounded-xl px-3 py-1.5 text-sm text-white focus:outline-none focus:border-[#0DB87E]"
                />
              </div>

              <div>
                <label className="block text-xs text-zinc-400 mb-1">Logotipo da Marca (Upload para Bucket / URL)</label>
                <div
                  onClick={() => supplierLogoInputRef.current?.click()}
                  className="border-2 border-dashed border-[#27272A] hover:border-[#0DB87E] rounded-xl p-3 text-center cursor-pointer transition-colors bg-[#18181B] mb-2"
                >
                  <input
                    type="file"
                    ref={supplierLogoInputRef}
                    onChange={(e) => {
                      if (e.target.files?.[0]) handleSupplierLogoUpload(e.target.files[0]);
                    }}
                    accept="image/*"
                    className="hidden"
                  />
                  {uploadingLogo ? (
                    <div className="py-2 text-xs text-[#00FF66] flex items-center justify-center gap-2">
                      <RefreshCw size={14} className="animate-spin" />
                      <span>Enviando logo para o bucket...</span>
                    </div>
                  ) : suppLogoUrl ? (
                    <div className="flex items-center justify-center gap-3">
                      <img
                        src={suppLogoUrl}
                        alt="Logo Preview"
                        className="w-10 h-10 rounded-lg object-contain bg-white/5 border border-[#27272A] p-1"
                      />
                      <div className="text-left">
                        <p className="text-xs font-semibold text-white">Logotipo vinculado</p>
                        <p className="text-[10px] text-[#00FF66]">Clique para alterar</p>
                      </div>
                    </div>
                  ) : (
                    <div className="py-1">
                      <UploadCloud size={20} className="mx-auto text-[#0DB87E] mb-1" />
                      <p className="text-xs text-zinc-300 font-semibold">
                        Clique para selecionar o logotipo
                      </p>
                      <p className="text-[10px] text-zinc-500">
                        Bucket <code>catalogo-ambulantes/logos</code>
                      </p>
                    </div>
                  )}
                </div>
                <input
                  type="text"
                  value={suppLogoUrl}
                  onChange={(e) => setSuppLogoUrl(e.target.value)}
                  placeholder="https://... ou preenchimento automático via upload"
                  className="w-full bg-[#18181B] border border-[#27272A] rounded-xl px-3 py-1.5 text-xs text-zinc-300 focus:outline-none focus:border-[#0DB87E]"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                {editingSupplier && (
                  <button
                    type="button"
                    onClick={() => {
                      setEditingSupplier(null);
                      setSuppNome("");
                      setSuppLogoUrl("");
                    }}
                    className="px-3 py-1 rounded-lg text-xs font-semibold text-zinc-400"
                  >
                    Cancelar Edição
                  </button>
                )}
                <button
                  type="button"
                  onClick={handleSaveSupplier}
                  disabled={saving}
                  className="px-4 py-1.5 rounded-lg bg-[#0DB87E] hover:bg-[#00FF66] text-[#09090B] text-xs font-bold"
                >
                  {editingSupplier ? "Atualizar Marca" : "Cadastrar Marca"}
                </button>
              </div>
            </div>

            {/* Lista de Marcas */}
            <div className="mt-4 space-y-2">
              <h4 className="text-xs font-bold uppercase tracking-wider text-zinc-400 mb-2">
                Marcas Ativas ({fornecedores.length})
              </h4>
              {fornecedores.map((f) => (
                <div
                  key={f.id}
                  className="p-3 rounded-xl bg-[#09090B] border border-[#27272A] flex items-center justify-between"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-[#18181B] border border-[#27272A] flex items-center justify-center overflow-hidden">
                      {f.logo_url ? (
                        <img src={f.logo_url} alt="" className="w-full h-full object-cover" />
                      ) : (
                        <Building2 size={14} className="text-[#0DB87E]" />
                      )}
                    </div>
                    <div>
                      <p className="text-sm font-bold text-white">{f.nome_marca}</p>
                      <p className="text-[11px] text-zinc-500">{f.total_produtos || 0} produtos</p>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => {
                      setEditingSupplier(f);
                      setSuppNome(f.nome_marca);
                      setSuppLogoUrl(f.logo_url || "");
                      setSuppAtivo(f.ativo);
                    }}
                    className="p-1.5 rounded-lg bg-[#18181B] border border-[#27272A] text-zinc-300 hover:text-white"
                  >
                    <Pencil size={13} />
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
