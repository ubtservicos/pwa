import { useState, useEffect, useRef, useMemo } from "react";
import { useNavigate, useParams } from "react-router-dom";
import * as XLSX from "xlsx";
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
  UploadCloud,
  FileSpreadsheet,
  Download,
  Upload,
  Image as ImageIcon,
  Home,
  Tag,
  Sparkles
} from "lucide-react";
import { useAdminToast } from "@/components/admin/AdminToast";
import { supabase } from "@/lib/supabase";

interface Fornecedor {
  id: string;
  nome_marca: string;
  logo_url?: string | null;
  ativo: boolean;
}

interface ProdutoPadrao {
  id: string;
  id_fornecedor?: string | null;
  nome_produto: string;
  descricao?: string | null;
  preco_sugerido: number;
  imagem_url?: string | null;
  categoria: string; // Categoria Macro
  subcategoria?: string | null; // Sub-categoria
  ativo: boolean;
  fornecedores_padrao?: {
    id: string;
    nome_marca: string;
    logo_url?: string | null;
  } | null;
}

// Lista oficial em ordem alfabética estrita das Categorias Macro
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

export default function AdminAmbulantesProdutosPage() {
  const toast = useAdminToast();
  const navigate = useNavigate();
  const { categoriaSlug } = useParams<{ categoriaSlug?: string }>();

  // Dados do backend
  const [fornecedores, setFornecedores] = useState<Fornecedor[]>([]);
  const [produtos, setProdutos] = useState<ProdutoPadrao[]>([]);
  const [loading, setLoading] = useState(true);

  // Categoria Macro Ativa (null = Nível 1 Dashboard de Categorias)
  const selectedCategoria = useMemo(() => {
    if (!categoriaSlug) return null;
    return (
      CATEGORIAS_MACRO.find((c) => slugify(c.nome) === categoriaSlug.toLowerCase()) || null
    );
  }, [categoriaSlug]);

  // Filtros Nível 1
  const [macroSearch, setMacroSearch] = useState("");

  // Filtros Nível 2 (Produtos da Categoria)
  const [prodSearch, setProdSearch] = useState("");
  const [selectedSubcategoria, setSelectedSubcategoria] = useState<string>("all");
  const [selectedMarcaId, setSelectedMarcaId] = useState<string>("all");
  const [selectedStatus, setSelectedStatus] = useState<string>("all");
  const [selectedProductIds, setSelectedProductIds] = useState<string[]>([]);

  // Modais
  const [isProductModalOpen, setIsProductModalOpen] = useState(false);
  const [isSupplierModalOpen, setIsSupplierModalOpen] = useState(false);
  const [isBulkPriceModalOpen, setIsBulkPriceModalOpen] = useState(false);
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  // Form Produto
  const [editingProduct, setEditingProduct] = useState<ProdutoPadrao | null>(null);
  const [prodNome, setProdNome] = useState("");
  const [prodSubcategoria, setProdSubcategoria] = useState("");
  const [prodFornecedorId, setProdFornecedorId] = useState<string>("");
  const [prodPrecoSugerido, setProdPrecoSugerido] = useState("10.00");
  const [prodDescricao, setProdDescricao] = useState("");
  const [prodImagemUrl, setProdImagemUrl] = useState("");
  const [prodAtivo, setProdAtivo] = useState(true);
  const [uploadingImage, setUploadingImage] = useState(false);

  // Form Marca / Fornecedor
  const [editingSupplier, setEditingSupplier] = useState<Fornecedor | null>(null);
  const [suppNome, setSuppNome] = useState("");
  const [suppLogoUrl, setSuppLogoUrl] = useState("");
  const [suppAtivo, setSuppAtivo] = useState(true);
  const [uploadingLogo, setUploadingLogo] = useState(false);

  // Reajuste em Massa
  const [bulkAdjustmentType, setBulkAdjustmentType] = useState<"percentual" | "nominal">("percentual");
  const [bulkAdjustmentValue, setBulkAdjustmentValue] = useState<string>("10");

  // Estado de Importação XLSX
  const [importRows, setImportRows] = useState<any[]>([]);
  const [importing, setImporting] = useState(false);
  const [importFileName, setImportFileName] = useState("");

  const fileInputRef = useRef<HTMLInputElement>(null);
  const supplierLogoInputRef = useRef<HTMLInputElement>(null);
  const excelFileInputRef = useRef<HTMLInputElement>(null);

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

      setFornecedores(fRes.data || []);
      setProdutos(pRes.data || []);
    } catch (err: any) {
      console.error("Erro ao carregar dados de produtos:", err);
      toast.show("Erro ao carregar dados: " + (err.message || ""));
    } finally {
      setLoading(false);
    }
  }

  // Upload da Foto do Produto para o Bucket
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
      console.error("Erro no upload:", err);
      toast.show("Falha no upload: " + (err.message || ""));
    } finally {
      setUploadingImage(false);
    }
  };

  // Upload de Logotipo de Marca
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

  // Salvar Produto (Novo ou Edição)
  const handleSaveProduct = async () => {
    if (!prodNome.trim() || !prodPrecoSugerido) {
      toast.show("Preencha o Nome do Produto e o Preço Sugerido.");
      return;
    }

    const macro = selectedCategoria ? selectedCategoria.nome : "Sorvete";

    try {
      setSaving(true);
      const precoNumber = parseFloat(prodPrecoSugerido.replace(",", ".")) || 0;
      const supplierValue = prodFornecedorId ? prodFornecedorId : null;

      const payload = {
        nome_produto: prodNome.trim(),
        categoria: macro,
        subcategoria: prodSubcategoria.trim() || "Geral",
        id_fornecedor: supplierValue,
        preco_sugerido: precoNumber,
        descricao: prodDescricao.trim() || null,
        imagem_url: prodImagemUrl.trim() || null,
        ativo: prodAtivo,
      };

      if (editingProduct) {
        const { error } = await supabase
          .from("produtos_padrao")
          .update({ ...payload, updated_at: new Date().toISOString() })
          .eq("id", editingProduct.id);

        if (error) throw error;
        toast.show("Produto atualizado com sucesso!");
      } else {
        const { error } = await supabase.from("produtos_padrao").insert(payload);
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

  // Toggle ativação do produto
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
      toast.show("Erro ao atualizar status.");
      loadAllData();
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
    if (!confirm(`Deseja excluir a marca "${nome}"? Os produtos vinculados perderão a associação.`)) return;
    try {
      const { error } = await supabase.from("fornecedores_padrao").delete().eq("id", id);
      if (error) throw error;
      toast.show("Marca excluída.");
      await loadAllData();
    } catch (err: any) {
      toast.show("Erro ao excluir: " + err.message);
    }
  };

  // Modal de Adicionar Produto
  const handleOpenAddProduct = () => {
    setEditingProduct(null);
    setProdNome("");
    setProdSubcategoria("");
    setProdFornecedorId("");
    setProdPrecoSugerido("10.00");
    setProdDescricao("");
    setProdImagemUrl("");
    setProdAtivo(true);
    setIsProductModalOpen(true);
  };

  const handleOpenEditProduct = (prod: ProdutoPadrao) => {
    setEditingProduct(prod);
    setProdNome(prod.nome_produto);
    setProdSubcategoria(prod.subcategoria || "");
    setProdFornecedorId(prod.id_fornecedor || "");
    setProdPrecoSugerido(Number(prod.preco_sugerido).toFixed(2));
    setProdDescricao(prod.descricao || "");
    setProdImagemUrl(prod.imagem_url || "");
    setProdAtivo(prod.ativo);
    setIsProductModalOpen(true);
  };

  // =========================================================================
  // EXPORTAÇÃO XLSX (GOOGLE SHEETS COMPATÍVEL)
  // =========================================================================
  const handleExportXLSX = () => {
    if (!selectedCategoria) return;

    const dataToExport = categoryProducts.map((p) => ({
      Nome: p.nome_produto,
      "Sub-Categoria": p.subcategoria || "Geral",
      Marca: p.fornecedores_padrao?.nome_marca || "",
      "Preço": Number(p.preco_sugerido).toFixed(2),
      "Descrição": p.descricao || "",
      "Imagem URL": p.imagem_url || "",
      Ativo: p.ativo ? "Sim" : "Não",
    }));

    const worksheet = XLSX.utils.json_to_sheet(dataToExport);

    // Ajusta largura visual das colunas
    worksheet["!cols"] = [
      { wch: 30 }, // Nome
      { wch: 22 }, // Sub-Categoria
      { wch: 18 }, // Marca
      { wch: 12 }, // Preço
      { wch: 40 }, // Descrição
      { wch: 35 }, // Imagem URL
      { wch: 10 }, // Ativo
    ];

    const workbook = XLSX.utils.book_new();
    const sheetName = selectedCategoria.nome.slice(0, 31);
    XLSX.utils.book_append_sheet(workbook, worksheet, sheetName);

    const fileName = `produtos_${slugify(selectedCategoria.nome)}_${new Date().toISOString().slice(0, 10)}.xlsx`;
    XLSX.writeFile(workbook, fileName);
    toast.show(`Planilha exportada com sucesso: ${fileName}`);
  };

  // Download do Modelo de Planilha XLSX
  const handleDownloadTemplateXLSX = () => {
    if (!selectedCategoria) return;

    const templateRows = [
      {
        Nome: "Banana com Avelã",
        "Sub-Categoria": "Paleta Mexicana",
        Marca: "Frutverão",
        "Preço": "12.00",
        "Descrição": "Paleta recheada artesanal de alta cremosidade",
        "Imagem URL": "",
        Ativo: "Sim",
      },
      {
        Nome: "Limão Suíço",
        "Sub-Categoria": "Picolés de Fruta",
        Marca: "Kibon",
        "Preço": "6.00",
        "Descrição": "Picolé refrescante feito com suco natural",
        "Imagem URL": "",
        Ativo: "Sim",
      },
      {
        Nome: "Coco Queimado Artesanal",
        "Sub-Categoria": "Massa 2 Bolas",
        Marca: "",
        "Preço": "15.00",
        "Descrição": "Receita tradicional caiçara com pedaços de coco tostado",
        "Imagem URL": "",
        Ativo: "Sim",
      },
    ];

    const worksheet = XLSX.utils.json_to_sheet(templateRows);
    worksheet["!cols"] = [
      { wch: 30 },
      { wch: 22 },
      { wch: 18 },
      { wch: 12 },
      { wch: 45 },
      { wch: 30 },
      { wch: 10 },
    ];

    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Modelo_Importacao");
    XLSX.writeFile(workbook, `modelo_produtos_${slugify(selectedCategoria.nome)}.xlsx`);
    toast.show("Modelo XLSX baixado com sucesso!");
  };

  // Leitura e Parse de Arquivo XLSX
  const handleFileImportChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setImportFileName(file.name);
    const reader = new FileReader();

    reader.onload = (evt) => {
      try {
        const bstr = evt.target?.result;
        const workbook = XLSX.read(bstr, { type: "binary" });
        const firstSheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[firstSheetName];
        const rawJson: any[] = XLSX.utils.sheet_to_json(worksheet);

        if (!rawJson || rawJson.length === 0) {
          toast.show("A planilha selecionada está vazia.");
          return;
        }

        // Normalização das chaves
        const parsed = rawJson.map((row) => {
          const nome =
            row["Nome"] || row["nome"] || row["Nome do Produto"] || row["PRODUTO"] || "";
          const subcategoria =
            row["Sub-Categoria"] ||
            row["Subcategoria"] ||
            row["subcategoria"] ||
            row["SUB-CATEGORIA"] ||
            "Geral";
          const marca = row["Marca"] || row["marca"] || row["MARCA"] || "";
          const preco =
            row["Preço"] || row["Preco"] || row["preco"] || row["PRECO"] || "10.00";
          const descricao = row["Descrição"] || row["Descricao"] || row["descricao"] || "";
          const imagem_url = row["Imagem URL"] || row["Foto"] || row["imagem_url"] || "";
          const ativoStr = String(row["Ativo"] || row["ativo"] || "Sim").toLowerCase();
          const ativo = !["nao", "não", "false", "0", "inativo"].includes(ativoStr);

          return {
            nome: String(nome).trim(),
            subcategoria: String(subcategoria).trim(),
            marca: String(marca).trim(),
            preco: parseFloat(String(preco).replace("R$", "").replace(",", ".").trim()) || 0,
            descricao: String(descricao).trim(),
            imagem_url: String(imagem_url).trim(),
            ativo,
          };
        }).filter((r) => r.nome.length > 0);

        setImportRows(parsed);
        setIsImportModalOpen(true);
      } catch (err: any) {
        console.error("Erro ao ler arquivo XLSX:", err);
        toast.show("Falha ao processar arquivo XLSX: " + err.message);
      }
    };

    reader.readAsBinaryString(file);
    e.target.value = "";
  };

  // Confirmação de Importação no Supabase
  const handleConfirmImport = async () => {
    if (!selectedCategoria || importRows.length === 0) return;

    try {
      setImporting(true);

      // Mapa de marcas para vincular os IDs
      const brandMap = new Map<string, string>();
      fornecedores.forEach((f) => {
        brandMap.set(f.nome_marca.toLowerCase().trim(), f.id);
      });

      const payload = importRows.map((r) => {
        let matchedSupplierId: string | null = null;
        if (r.marca) {
          matchedSupplierId = brandMap.get(r.marca.toLowerCase().trim()) || null;
        }

        return {
          categoria: selectedCategoria.nome,
          subcategoria: r.subcategoria || "Geral",
          nome_produto: r.nome,
          preco_sugerido: r.preco,
          id_fornecedor: matchedSupplierId,
          descricao: r.descricao || null,
          imagem_url: r.imagem_url || null,
          ativo: r.ativo,
        };
      });

      const { error } = await supabase.from("produtos_padrao").insert(payload);
      if (error) throw error;

      toast.show(`${importRows.length} produtos importados com sucesso para ${selectedCategoria.nome}!`);
      setIsImportModalOpen(false);
      setImportRows([]);
      setImportFileName("");
      await loadAllData();
    } catch (err: any) {
      console.error("Erro na importação em lote:", err);
      toast.show("Erro ao importar: " + err.message);
    } finally {
      setImporting(false);
    }
  };

  // Produtos pertencentes à Categoria Macro selecionada
  const categoryProducts = useMemo(() => {
    if (!selectedCategoria) return [];
    return produtos.filter(
      (p) =>
        p.categoria?.toLowerCase().trim() === selectedCategoria.nome.toLowerCase().trim()
    );
  }, [produtos, selectedCategoria]);

  // Lista de Subcategorias da Categoria Ativa
  const categorySubcategories = useMemo(() => {
    return [
      "all",
      ...Array.from(
        new Set(categoryProducts.map((p) => p.subcategoria).filter(Boolean))
      ),
    ];
  }, [categoryProducts]);

  // Produtos filtrados no Nível 2
  const filteredCategoryProducts = useMemo(() => {
    return categoryProducts.filter((p) => {
      const matchesSearch =
        prodSearch === "" ||
        p.nome_produto.toLowerCase().includes(prodSearch.toLowerCase()) ||
        (p.descricao && p.descricao.toLowerCase().includes(prodSearch.toLowerCase())) ||
        (p.subcategoria && p.subcategoria.toLowerCase().includes(prodSearch.toLowerCase())) ||
        (p.fornecedores_padrao?.nome_marca &&
          p.fornecedores_padrao.nome_marca.toLowerCase().includes(prodSearch.toLowerCase()));

      const matchesSub =
        selectedSubcategoria === "all" || p.subcategoria === selectedSubcategoria;

      const matchesMarca =
        selectedMarcaId === "all" ||
        (selectedMarcaId === "none" && !p.id_fornecedor) ||
        p.id_fornecedor === selectedMarcaId;

      const matchesStatus =
        selectedStatus === "all" ||
        (selectedStatus === "active" && p.ativo) ||
        (selectedStatus === "inactive" && !p.ativo);

      return matchesSearch && matchesSub && matchesMarca && matchesStatus;
    });
  }, [categoryProducts, prodSearch, selectedSubcategoria, selectedMarcaId, selectedStatus]);

  const handleSelectAll = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.checked) {
      setSelectedProductIds(filteredCategoryProducts.map((p) => p.id));
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
      {/* BREADCRUMB HIERÁRQUICO (INVERTIDO: CATEGORIAS NO TOPO)                   */}
      {/* ========================================================================= */}
      <nav aria-label="Breadcrumb" className="flex items-center gap-2 text-xs text-zinc-400">
        <button
          type="button"
          onClick={() => navigate("/admin/ambulantes/produtos")}
          className="flex items-center gap-1.5 hover:text-white transition-colors cursor-pointer"
        >
          <Home size={14} className="text-zinc-500" />
          <span>Inicial</span>
        </button>

        <span className="text-zinc-600">/</span>

        <button
          type="button"
          onClick={() => navigate("/admin/ambulantes/produtos")}
          className={`hover:text-white transition-colors cursor-pointer ${
            !selectedCategoria ? "text-[#00FF66] font-semibold" : ""
          }`}
        >
          Produtos (Categorias)
        </button>

        {selectedCategoria && (
          <>
            <span className="text-zinc-600">/</span>
            <span className="text-white font-bold bg-[#18181B] border border-[#27272A] px-2.5 py-0.5 rounded-lg flex items-center gap-1.5">
              <span>{selectedCategoria.emoji}</span>
              <span>{selectedCategoria.nome}</span>
            </span>
          </>
        )}
      </nav>

      {/* ========================================================================= */}
      {/* NÍVEL 1: DASHBOARD DE CATEGORIAS MACRO (ORDEM ALFABÉTICA)                 */}
      {/* ========================================================================= */}
      {!selectedCategoria ? (
        <div className="space-y-6 animate-in fade-in duration-200">
          {/* Header Nível 1 */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2.5">
                <span className="p-2 rounded-xl bg-[#0DB87E]/20 text-[#00FF66] border border-[#0DB87E]/30">
                  <Utensils size={22} />
                </span>
                <h1 className="text-2xl font-bold font-display text-white">
                  Gestão de Produtos (Tipos de Produtos)
                </h1>
              </div>
              <p className="text-xs text-zinc-400 mt-1 max-w-2xl">
                Selecione uma categoria macro para gerenciar os itens padrão, sub-categorias, marcas e regras de preços dos ambulantes de praia.
              </p>
            </div>

            {/* Ações Globais */}
            <div className="flex flex-wrap items-center gap-2.5">
              <button
                type="button"
                onClick={() => setIsSupplierModalOpen(true)}
                className="px-4 py-2 rounded-xl bg-[#18181B] border border-[#27272A] hover:border-[#0DB87E]/50 text-zinc-200 text-xs font-semibold flex items-center gap-2 transition-all hover:bg-[#27272A] cursor-pointer"
              >
                <Building2 size={15} className="text-[#00FF66]" />
                <span>Gerenciar Marcas ({fornecedores.length})</span>
              </button>
            </div>
          </div>

          {/* Cards de Métricas Gerais */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="p-4 rounded-2xl bg-[#18181B] border border-[#27272A] flex items-center justify-between">
              <div>
                <p className="text-xs text-zinc-400 font-semibold uppercase tracking-wider">Categorias Macro</p>
                <h3 className="text-2xl font-bold text-white mt-1">{CATEGORIAS_MACRO.length}</h3>
              </div>
              <div className="w-10 h-10 rounded-xl bg-[#09090B] border border-[#27272A] flex items-center justify-center text-[#00FF66]">
                <Layers size={20} />
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
                <p className="text-xs text-zinc-400 font-semibold uppercase tracking-wider">Marcas Parceiras</p>
                <h3 className="text-2xl font-bold text-white mt-1">{fornecedores.length}</h3>
              </div>
              <div className="w-10 h-10 rounded-xl bg-[#09090B] border border-[#27272A] flex items-center justify-center text-amber-400">
                <Building2 size={20} />
              </div>
            </div>
          </div>

          {/* Grid de Cards das Categorias Macro (Ordem Alfabética Estrita) */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {CATEGORIAS_MACRO.map((cat) => {
              const catProds = produtos.filter(
                (p) => p.categoria?.toLowerCase().trim() === cat.nome.toLowerCase().trim()
              );
              const activeCount = catProds.filter((p) => p.ativo).length;
              const subcats = Array.from(
                new Set(catProds.map((p) => p.subcategoria).filter(Boolean))
              );
              const brandIds = Array.from(
                new Set(catProds.map((p) => p.id_fornecedor).filter(Boolean))
              );

              return (
                <div
                  key={cat.nome}
                  className="rounded-2xl bg-[#18181B] border border-[#27272A] hover:border-[#0DB87E]/60 transition-all p-5 flex flex-col justify-between group shadow-lg shadow-black/40 hover:shadow-[#0DB87E]/5"
                >
                  <div>
                    <div className="flex items-start justify-between gap-3">
                      <div className="w-14 h-14 rounded-2xl bg-[#09090B] border border-[#27272A] flex items-center justify-center text-3xl shrink-0 group-hover:scale-105 transition-transform">
                        {cat.emoji}
                      </div>

                      <span className="text-[11px] font-extrabold px-2.5 py-1 rounded-full bg-[#0DB87E]/10 text-[#00FF66] border border-[#0DB87E]/25">
                        {catProds.length} {catProds.length === 1 ? "item" : "itens"}
                      </span>
                    </div>

                    <div className="mt-4">
                      <h3 className="text-base font-bold text-white group-hover:text-[#00FF66] transition-colors">
                        {cat.nome}
                      </h3>
                      <p className="text-xs text-zinc-400 mt-1 line-clamp-2">
                        {cat.desc}
                      </p>
                    </div>

                    <div className="mt-4 pt-3 border-t border-[#27272A] grid grid-cols-3 gap-2 text-xs">
                      <div>
                        <span className="text-zinc-500 block text-[10px] uppercase font-bold">Ativos</span>
                        <span className="text-[#00FF66] font-extrabold text-xs">{activeCount}</span>
                      </div>
                      <div>
                        <span className="text-zinc-500 block text-[10px] uppercase font-bold">Sub-cat.</span>
                        <span className="text-white font-extrabold text-xs">{subcats.length}</span>
                      </div>
                      <div>
                        <span className="text-zinc-500 block text-[10px] uppercase font-bold">Marcas</span>
                        <span className="text-zinc-300 font-extrabold text-xs">{brandIds.length}</span>
                      </div>
                    </div>
                  </div>

                  <div className="mt-5 pt-3">
                    <button
                      type="button"
                      onClick={() => navigate(`/admin/ambulantes/produtos/${slugify(cat.nome)}`)}
                      className="w-full py-2.5 px-3 rounded-xl bg-[#09090B] hover:bg-[#0DB87E] text-zinc-300 hover:text-[#09090B] text-xs font-bold border border-[#27272A] hover:border-[#0DB87E] flex items-center justify-center gap-2 transition-all cursor-pointer group/btn"
                    >
                      <span>Gerenciar Produtos de {cat.nome}</span>
                      <ChevronRight size={15} className="group-hover/btn:translate-x-0.5 transition-transform" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ) : (
        /* ========================================================================= */
        /* NÍVEL 2: TABELA DE PRODUTOS DA CATEGORIA MACRO SELECIONADA                */
        /* ========================================================================= */
        <div className="space-y-6 animate-in fade-in duration-200">
          {/* Header da Categoria Macro */}
          <div className="p-5 rounded-2xl bg-[#18181B] border border-[#27272A] flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <button
                type="button"
                onClick={() => navigate("/admin/ambulantes/produtos")}
                className="w-10 h-10 rounded-xl bg-[#09090B] border border-[#27272A] hover:border-[#0DB87E] flex items-center justify-center text-zinc-300 hover:text-white transition-all cursor-pointer"
                title="Voltar para Todas as Categorias"
              >
                <ArrowLeft size={18} />
              </button>

              <div className="w-14 h-14 rounded-2xl bg-[#09090B] border border-[#27272A] flex items-center justify-center text-3xl shrink-0">
                {selectedCategoria.emoji}
              </div>

              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-xl font-bold font-display text-white">
                    {selectedCategoria.nome}
                  </h2>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-[#0DB87E]/15 text-[#00FF66] border border-[#0DB87E]/30 uppercase tracking-wider">
                    Categoria Oficial
                  </span>
                </div>
                <p className="text-xs text-zinc-400 mt-1">
                  {selectedCategoria.desc} • {categoryProducts.length} produtos cadastrados
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setIsSupplierModalOpen(true)}
                className="px-3 py-2 rounded-xl bg-[#09090B] border border-[#27272A] text-zinc-300 hover:text-white text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
              >
                <Building2 size={14} className="text-[#00FF66]" />
                <span>Marcas Parceiras</span>
              </button>
            </div>
          </div>

          {/* ========================================================================= */}
          {/* BARRA DE FERRAMENTAS & AÇÃO PRINCIPAL "+ NOVO PRODUTO" (POSICIONAMENTO)   */}
          {/* ========================================================================= */}
          <div className="p-4 rounded-2xl bg-[#18181B] border border-[#27272A] flex flex-col lg:flex-row items-center justify-between gap-3 shadow-md">
            {/* Lado Esquerdo: Busca e Filtros */}
            <div className="flex flex-1 flex-col sm:flex-row items-center gap-2.5 w-full">
              <div className="relative flex-1 w-full">
                <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-500" />
                <input
                  type="text"
                  value={prodSearch}
                  onChange={(e) => setProdSearch(e.target.value)}
                  placeholder={`Buscar em ${selectedCategoria.nome} (nome, sub-categoria, marca)...`}
                  className="w-full bg-[#09090B] border border-[#27272A] rounded-xl pl-9 pr-3.5 py-2 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-[#0DB87E]"
                />
              </div>

              <div className="flex items-center gap-2 w-full sm:w-auto">
                {/* Filtro Sub-categoria */}
                <select
                  value={selectedSubcategoria}
                  onChange={(e) => setSelectedSubcategoria(e.target.value)}
                  className="bg-[#09090B] border border-[#27272A] rounded-xl px-3 py-2 text-xs text-zinc-300 focus:outline-none focus:border-[#0DB87E] w-full sm:w-auto"
                >
                  <option value="all">Todas as Sub-categorias</option>
                  {categorySubcategories.filter((c) => c !== "all").map((sub) => (
                    <option key={sub} value={sub}>
                      {sub}
                    </option>
                  ))}
                </select>

                {/* Filtro Marca */}
                <select
                  value={selectedMarcaId}
                  onChange={(e) => setSelectedMarcaId(e.target.value)}
                  className="bg-[#09090B] border border-[#27272A] rounded-xl px-3 py-2 text-xs text-zinc-300 focus:outline-none focus:border-[#0DB87E] w-full sm:w-auto"
                >
                  <option value="all">Todas as Marcas</option>
                  <option value="none">Sem Marca / Artesanal</option>
                  {fornecedores.map((f) => (
                    <option key={f.id} value={f.id}>
                      {f.nome_marca}
                    </option>
                  ))}
                </select>

                {/* Filtro Status */}
                <select
                  value={selectedStatus}
                  onChange={(e) => setSelectedStatus(e.target.value)}
                  className="bg-[#09090B] border border-[#27272A] rounded-xl px-3 py-2 text-xs text-zinc-300 focus:outline-none focus:border-[#0DB87E] w-full sm:w-auto"
                >
                  <option value="all">Todos os Status</option>
                  <option value="active">Somente Ativos</option>
                  <option value="inactive">Somente Inativos</option>
                </select>
              </div>
            </div>

            {/* Lado Direito: IMPORTAÇÃO / EXPORTAÇÃO XLSX & BOTÃO PRINCIPAL */}
            <div className="w-full lg:w-auto flex flex-wrap items-center justify-end gap-2">
              <button
                type="button"
                onClick={handleExportXLSX}
                className="px-3 py-2 rounded-xl bg-[#09090B] border border-[#27272A] hover:border-[#0DB87E] text-zinc-300 hover:text-white text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
                title="Exportar produtos desta categoria para planilha XLSX"
              >
                <Download size={14} className="text-[#00FF66]" />
                <span>Exportar XLSX</span>
              </button>

              <label className="px-3 py-2 rounded-xl bg-[#09090B] border border-[#27272A] hover:border-[#0DB87E] text-zinc-300 hover:text-white text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer">
                <Upload size={14} className="text-[#0DB87E]" />
                <span>Importar XLSX</span>
                <input
                  type="file"
                  ref={excelFileInputRef}
                  accept=".xlsx,.xls,.csv"
                  onChange={handleFileImportChange}
                  className="hidden"
                />
              </label>

              <button
                type="button"
                onClick={handleOpenAddProduct}
                className="px-4 py-2 rounded-xl bg-[#0DB87E] hover:bg-[#00FF66] text-[#09090B] text-xs font-bold flex items-center justify-center gap-1.5 shadow-lg shadow-[#0DB87E]/20 transition-all active:scale-95 cursor-pointer shrink-0"
              >
                <Plus size={16} />
                <span>Novo Produto em {selectedCategoria.nome}</span>
              </button>
            </div>
          </div>

          {/* Tabela de Produtos da Categoria Macro */}
          <div className="rounded-2xl bg-[#18181B] border border-[#27272A] overflow-hidden shadow-xl">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-[#27272A] bg-[#09090B]/60 text-zinc-400 font-semibold uppercase tracking-wider">
                    <th className="p-3.5 w-10 text-center">
                      <input
                        type="checkbox"
                        checked={
                          filteredCategoryProducts.length > 0 &&
                          selectedProductIds.length === filteredCategoryProducts.length
                        }
                        onChange={handleSelectAll}
                        className="rounded border-[#27272A] text-[#0DB87E] focus:ring-0 cursor-pointer"
                      />
                    </th>
                    <th className="p-3.5">Produto</th>
                    <th className="p-3.5">Sub-categoria</th>
                    <th className="p-3.5">Marca</th>
                    <th className="p-3.5">Preço Sugerido</th>
                    <th className="p-3.5 text-center">Status</th>
                    <th className="p-3.5 text-right">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#27272A]">
                  {filteredCategoryProducts.map((p) => {
                    const isSelected = selectedProductIds.includes(p.id);
                    const prodImg = resolveImageUrl(p.imagem_url);

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
                              {prodImg ? (
                                <img
                                  src={prodImg}
                                  alt={p.nome_produto}
                                  className="w-full h-full object-cover"
                                />
                              ) : (
                                <span className="text-xl">{selectedCategoria.emoji}</span>
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
                            {p.subcategoria || "Geral"}
                          </span>
                        </td>
                        <td className="p-3.5">
                          {p.fornecedores_padrao?.nome_marca ? (
                            <span className="font-semibold text-[#00FF66] bg-[#0DB87E]/10 px-2 py-0.5 rounded border border-[#0DB87E]/20 text-[11px]">
                              {p.fornecedores_padrao.nome_marca}
                            </span>
                          ) : (
                            <span className="text-zinc-500 text-[11px] italic">Sem Marca</span>
                          )}
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

                  {filteredCategoryProducts.length === 0 && (
                    <tr>
                      <td colSpan={7} className="p-10 text-center text-zinc-400 space-y-3">
                        <ShoppingBag size={32} className="text-zinc-600 mx-auto" />
                        <p className="text-xs font-semibold text-white">
                          Nenhum produto cadastrado para a categoria {selectedCategoria.nome}.
                        </p>
                        <p className="text-xs text-zinc-500 max-w-sm mx-auto">
                          Adicione produtos manualmente ou importe uma planilha XLSX do Google Sheets.
                        </p>
                        <div className="pt-2 flex items-center justify-center gap-2">
                          <button
                            type="button"
                            onClick={handleOpenAddProduct}
                            className="px-3.5 py-2 rounded-xl bg-[#0DB87E] text-[#09090B] text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer"
                          >
                            <Plus size={14} />
                            <span>Adicionar Manualmente</span>
                          </button>
                          <button
                            type="button"
                            onClick={handleDownloadTemplateXLSX}
                            className="px-3.5 py-2 rounded-xl bg-[#18181B] border border-[#27272A] text-zinc-300 text-xs font-semibold inline-flex items-center gap-1.5 cursor-pointer hover:border-[#0DB87E]"
                          >
                            <Download size={14} />
                            <span>Baixar Modelo XLSX</span>
                          </button>
                        </div>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
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
                {editingProduct ? "Editar Produto" : `Novo Produto em ${selectedCategoria?.nome || "Catálogo"}`}
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
                  Categoria Macro
                </label>
                <input
                  type="text"
                  disabled
                  value={selectedCategoria?.nome || "Sorvete"}
                  className="w-full bg-[#09090B]/60 border border-[#27272A] rounded-xl px-3.5 py-2.5 text-xs text-[#00FF66] font-bold cursor-not-allowed"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-zinc-300 mb-1">
                    Marca / Fornecedor (Opcional)
                  </label>
                  <select
                    value={prodFornecedorId}
                    onChange={(e) => setProdFornecedorId(e.target.value)}
                    className="w-full bg-[#09090B] border border-[#27272A] rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none focus:border-[#0DB87E]"
                  >
                    <option value="">Sem Marca / Artesanal</option>
                    {fornecedores.map((f) => (
                      <option key={f.id} value={f.id}>
                        {f.nome_marca}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-medium text-zinc-300 mb-1">
                    Sub-categoria *
                  </label>
                  <input
                    type="text"
                    value={prodSubcategoria}
                    onChange={(e) => setProdSubcategoria(e.target.value)}
                    placeholder="Ex: Paleta Mexicana, Picolé..."
                    className="w-full bg-[#09090B] border border-[#27272A] rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-[#0DB87E]"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-zinc-300 mb-1">
                    Nome do Produto / Sabor *
                  </label>
                  <input
                    type="text"
                    value={prodNome}
                    onChange={(e) => setProdNome(e.target.value)}
                    placeholder="Ex: Banana com Avelã"
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
                    placeholder="12.00"
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
                  placeholder="Detalhes dos ingredientes, alérgenos ou diferenciais..."
                  rows={2}
                  className="w-full bg-[#09090B] border border-[#27272A] rounded-xl px-3.5 py-2 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-[#0DB87E]"
                />
              </div>

              {/* Upload da Foto */}
              <div>
                <label className="block text-xs font-medium text-zinc-300 mb-1">
                  Foto do Produto
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
                      {uploadingImage ? "Enviando para o bucket..." : "Selecionar Foto"}
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
      {/* MODAL: IMPORTAÇÃO XLSX                                                    */}
      {/* ========================================================================= */}
      {isImportModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-2xl bg-[#18181B] border border-[#27272A] rounded-2xl p-6 space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-[#27272A] pb-3">
              <h3 className="text-base font-bold text-white flex items-center gap-2 font-display">
                <FileSpreadsheet size={18} className="text-[#00FF66]" />
                Importar Produtos via Planilha ({selectedCategoria?.nome})
              </h3>
              <button
                type="button"
                onClick={() => {
                  setIsImportModalOpen(false);
                  setImportRows([]);
                }}
                className="w-8 h-8 rounded-lg bg-[#09090B] border border-[#27272A] flex items-center justify-center text-zinc-400 hover:text-white cursor-pointer"
              >
                <X size={16} />
              </button>
            </div>

            <div className="space-y-4">
              <div className="p-3 bg-[#0DB87E]/10 border border-[#0DB87E]/30 rounded-xl text-xs text-[#00FF66]">
                Planilha lida: <strong>{importFileName}</strong> • {importRows.length} linhas válidas identificadas.
              </div>

              {/* Tabela de Preview */}
              <div className="max-h-60 overflow-y-auto border border-[#27272A] rounded-xl">
                <table className="w-full text-left text-xs">
                  <thead className="bg-[#09090B] text-zinc-400 sticky top-0">
                    <tr className="border-b border-[#27272A]">
                      <th className="p-2">Nome</th>
                      <th className="p-2">Sub-categoria</th>
                      <th className="p-2">Marca</th>
                      <th className="p-2">Preço</th>
                      <th className="p-2">Ativo</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#27272A]">
                    {importRows.slice(0, 50).map((r, idx) => (
                      <tr key={idx} className="hover:bg-[#27272A]/30">
                        <td className="p-2 text-white font-medium">{r.nome}</td>
                        <td className="p-2 text-zinc-400">{r.subcategoria}</td>
                        <td className="p-2 text-zinc-300">{r.marca || "-"}</td>
                        <td className="p-2 text-[#00FF66] font-bold">R$ {r.preco.toFixed(2)}</td>
                        <td className="p-2 text-zinc-400">{r.ativo ? "Sim" : "Não"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="pt-2 flex gap-3">
                <button
                  type="button"
                  onClick={() => {
                    setIsImportModalOpen(false);
                    setImportRows([]);
                  }}
                  className="flex-1 py-2.5 rounded-xl border border-[#27272A] bg-[#09090B] text-zinc-300 text-xs font-bold hover:bg-zinc-800 transition-all cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  disabled={importing || importRows.length === 0}
                  onClick={handleConfirmImport}
                  className="flex-1 py-2.5 rounded-xl bg-[#0DB87E] hover:bg-[#00FF66] text-[#09090B] text-xs font-bold transition-all cursor-pointer disabled:opacity-50"
                >
                  {importing ? "Importando dados..." : `Confirmar Importação (${importRows.length} itens)`}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL: MARCAS / FORNECEDORES (CRUD COMPLETO)                              */}
      {/* ========================================================================= */}
      {isSupplierModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-lg bg-[#18181B] border border-[#27272A] rounded-2xl p-6 space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-[#27272A] pb-3">
              <h3 className="text-base font-bold text-white flex items-center gap-2 font-display">
                <Building2 size={18} className="text-[#00FF66]" />
                Gerenciar Marcas Parceiras
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
              <div className="p-3 bg-[#09090B] border border-[#27272A] rounded-xl space-y-3">
                <h4 className="text-xs font-bold text-white uppercase tracking-wider">
                  {editingSupplier ? "Editar Marca" : "Nova Marca"}
                </h4>

                <div>
                  <label className="block text-xs font-medium text-zinc-300 mb-1">
                    Nome da Marca / Indústria *
                  </label>
                  <input
                    type="text"
                    value={suppNome}
                    onChange={(e) => setSuppNome(e.target.value)}
                    placeholder="Ex: Frutverão, Kibon, Nestlé, Oggi"
                    className="w-full bg-[#18181B] border border-[#27272A] rounded-xl px-3 py-2 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-[#0DB87E]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-zinc-300 mb-1">
                    Logotipo da Marca
                  </label>
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-xl bg-[#18181B] border border-[#27272A] overflow-hidden flex items-center justify-center shrink-0">
                      {suppLogoUrl ? (
                        <img src={suppLogoUrl} alt="Logo" className="w-full h-full object-contain p-1" />
                      ) : (
                        <Building2 size={18} className="text-zinc-600" />
                      )}
                    </div>
                    <label className="flex-1 flex flex-col items-center justify-center border border-dashed border-[#27272A] rounded-xl p-2.5 bg-[#18181B] hover:border-[#0DB87E] cursor-pointer transition-all">
                      <UploadCloud size={16} className="text-zinc-400 mb-0.5" />
                      <span className="text-[11px] text-zinc-300 font-medium">
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

                <div className="flex gap-2 pt-1">
                  {editingSupplier && (
                    <button
                      type="button"
                      onClick={() => {
                        setEditingSupplier(null);
                        setSuppNome("");
                        setSuppLogoUrl("");
                      }}
                      className="px-3 py-1.5 rounded-lg border border-[#27272A] text-zinc-300 text-xs font-semibold cursor-pointer"
                    >
                      Cancelar Edição
                    </button>
                  )}
                  <button
                    type="button"
                    disabled={saving || uploadingLogo}
                    onClick={handleSaveSupplier}
                    className="px-4 py-1.5 rounded-lg bg-[#0DB87E] text-[#09090B] text-xs font-bold hover:bg-[#00FF66] transition-all cursor-pointer disabled:opacity-50"
                  >
                    {saving ? "Salvando..." : editingSupplier ? "Atualizar Marca" : "Adicionar Marca"}
                  </button>
                </div>
              </div>

              {/* Lista de Marcas Cadastradas */}
              <div>
                <h4 className="text-xs font-bold text-white uppercase tracking-wider mb-2">
                  Marcas Cadastradas ({fornecedores.length})
                </h4>
                <div className="max-h-52 overflow-y-auto space-y-2">
                  {fornecedores.map((f) => (
                    <div
                      key={f.id}
                      className="p-2.5 rounded-xl bg-[#09090B] border border-[#27272A] flex items-center justify-between"
                    >
                      <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-lg bg-[#18181B] border border-[#27272A] flex items-center justify-center overflow-hidden">
                          {f.logo_url ? (
                            <img src={resolveImageUrl(f.logo_url)} alt={f.nome_marca} className="w-full h-full object-contain p-0.5" />
                          ) : (
                            <span className="text-[10px] font-bold text-zinc-400">
                              {f.nome_marca.slice(0, 2).toUpperCase()}
                            </span>
                          )}
                        </div>
                        <span className="text-xs font-bold text-white">{f.nome_marca}</span>
                      </div>

                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => {
                            setEditingSupplier(f);
                            setSuppNome(f.nome_marca);
                            setSuppLogoUrl(f.logo_url || "");
                            setSuppAtivo(f.ativo);
                          }}
                          className="w-7 h-7 rounded-lg bg-[#18181B] border border-[#27272A] flex items-center justify-center text-zinc-400 hover:text-white cursor-pointer"
                        >
                          <Pencil size={12} />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeleteSupplier(f.id, f.nome_marca)}
                          className="w-7 h-7 rounded-lg bg-red-950/30 border border-red-900/40 flex items-center justify-center text-red-400 hover:text-red-300 cursor-pointer"
                        >
                          <Trash2 size={12} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
