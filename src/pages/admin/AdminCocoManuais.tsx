import { useState, useEffect } from "react";
import { 
  BookOpen, 
  Plus, 
  Trash2, 
  Edit3, 
  Sparkles, 
  Check, 
  X, 
  Layers 
} from "lucide-react";
import { Card, PrimaryButton, GhostButton } from "@/components/admin/ui";
import { useAdminToast } from "@/components/admin/AdminToast";
import { supabase } from "@/lib/supabase";
import { getMaterial, MATERIAIS_COCO } from "@/mocks/cocoMateriais";

export interface DicaMaterial {
  id: string;
  material_id: string;
  titulo?: string;
  conteudo_html: string;
}

export default function AdminCocoManuais() {
  const toast = useAdminToast();
  const [dicas, setDicas] = useState<DicaMaterial[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingDica, setEditingDica] = useState<DicaMaterial | null>(null);
  const [dicaMaterialId, setDicaMaterialId] = useState("plastico");
  const [dicaTitulo, setDicaTitulo] = useState("");
  const [dicaHtml, setDicaHtml] = useState("");
  const [isDicaModalOpen, setIsDicaModalOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  const fetchDicas = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("coco_dicas_materiais")
        .select("*")
        .order("material_id", { ascending: true });

      if (!error && data && data.length > 0) {
        setDicas(data);
      }
    } catch (e) {
      console.warn("Offline fallback para manuais educativos:", e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDicas();
  }, []);

  const handleOpenDicaModal = (dica?: DicaMaterial) => {
    if (dica) {
      setEditingDica(dica);
      setDicaMaterialId(dica.material_id);
      setDicaTitulo(dica.titulo || "");
      setDicaHtml(dica.conteudo_html.replace(/<[^>]*>?/gm, ""));
    } else {
      setEditingDica(null);
      setDicaMaterialId("plastico");
      setDicaTitulo("");
      setDicaHtml("");
    }
    setIsDicaModalOpen(true);
  };

  const handleSaveDica = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanText = dicaHtml.replace(/<[^>]*>?/gm, "").trim();
    if (!cleanText) {
      toast.show("Preencha o conteúdo orientativo do manual.");
      return;
    }

    setSaving(true);
    try {
      if (editingDica) {
        // Atualizar
        const { error } = await supabase
          .from("coco_dicas_materiais")
          .update({
            material_id: dicaMaterialId,
            titulo: dicaTitulo || `Como descartar ${getMaterial(dicaMaterialId).nome}`,
            conteudo_html: cleanText
          })
          .eq("id", editingDica.id);

        if (error) throw error;
        toast.show("Manual educativo atualizado com sucesso!");
      } else {
        // Inserir
        const { error } = await supabase
          .from("coco_dicas_materiais")
          .insert([{
            material_id: dicaMaterialId,
            titulo: dicaTitulo || `Como descartar ${getMaterial(dicaMaterialId).nome}`,
            conteudo_html: cleanText
          }]);

        if (error) throw error;
        toast.show("Novo manual educativo criado!");
      }

      setIsDicaModalOpen(false);
      fetchDicas();
    } catch (err: any) {
      if (editingDica) {
        setDicas(prev => prev.map(d => d.id === editingDica.id ? {
          ...d,
          material_id: dicaMaterialId,
          titulo: dicaTitulo || `Como descartar ${getMaterial(dicaMaterialId).nome}`,
          conteudo_html: cleanText
        } : d));
      } else {
        setDicas(prev => [...prev, {
          id: `local-${Date.now()}`,
          material_id: dicaMaterialId,
          titulo: dicaTitulo || `Como descartar ${getMaterial(dicaMaterialId).nome}`,
          conteudo_html: cleanText
        }]);
      }
      toast.show("Manual salvo localmente.");
      setIsDicaModalOpen(false);
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteDica = async (id: string, materialId: string) => {
    if (!window.confirm(`Tem certeza que deseja remover o manual de "${materialId}"?`)) return;

    try {
      const { error } = await supabase
        .from("coco_dicas_materiais")
        .delete()
        .eq("id", id);
      if (error) throw error;
      toast.show("Manual removido.");
      fetchDicas();
    } catch {
      setDicas(prev => prev.filter(d => d.id !== id));
      toast.show("Manual removido localmente.");
    }
  };

  return (
    <div style={{ maxWidth: 1200, margin: "0 auto", padding: "24px 20px" }}>
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 24, flexWrap: "wrap", gap: 16 }}>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 4 }}>
            <div style={{ width: 36, height: 36, borderRadius: 10, background: "rgba(13,184,126,0.15)", display: "flex", alignItems: "center", justifyContent: "center", color: "#0DB87E" }}>
              <BookOpen size={20} />
            </div>
            <h1 style={{ fontFamily: "Syne", fontSize: 24, fontWeight: 700, margin: 0, color: "var(--admin-text)" }}>
              Manuais Educativos de Descarte
            </h1>
          </div>
          <p style={{ fontFamily: "DM Sans", fontSize: 14, color: "var(--admin-subtle)", margin: 0 }}>
            Orientações exibidas no aplicativo dos cidadãos para separação e higienização correta dos recicláveis.
          </p>
        </div>

        <button
          onClick={() => handleOpenDicaModal()}
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            background: "#0DB87E",
            color: "white",
            border: "none",
            borderRadius: 10,
            padding: "10px 18px",
            fontFamily: "Syne",
            fontWeight: 700,
            fontSize: 14,
            cursor: "pointer",
            boxShadow: "0 4px 12px rgba(13,184,126,0.3)"
          }}
        >
          <Plus size={16} /> Novo Manual
        </button>
      </div>

      {/* Grid de Manuais */}
      {dicas.length === 0 ? (
        <Card style={{ padding: "48px 20px", textAlign: "center", color: "var(--admin-muted)", fontFamily: "DM Sans" }}>
          Nenhum manual de descarte cadastrado ainda. Clique em "Novo Manual" para cadastrar orientações para a população.
        </Card>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(340px, 1fr))", gap: 20 }}>
          {dicas.map((dica) => {
            const mat = getMaterial(dica.material_id);
            const plainContent = (dica.conteudo_html || "").replace(/<[^>]*>?/gm, "").trim();

            return (
              <Card key={dica.id} style={{ padding: 20, display: "flex", flexDirection: "column", justifyContent: "space-between" }}>
                <div>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 12 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                      <span style={{ fontSize: 28, background: `${mat.cor}15`, width: 44, height: 44, borderRadius: 12, display: "flex", alignItems: "center", justifyContent: "center" }}>
                        {mat.emoji}
                      </span>
                      <div>
                        <span style={{ fontSize: 11, fontFamily: "monospace", textTransform: "uppercase", color: mat.cor, fontWeight: 700 }}>
                          {dica.material_id}
                        </span>
                        <h4 style={{ margin: "2px 0 0", fontFamily: "Syne", fontSize: 16, fontWeight: 700, color: "var(--admin-text)" }}>
                          {dica.titulo || mat.nome}
                        </h4>
                      </div>
                    </div>

                    <div style={{ display: "flex", gap: 4 }}>
                      <button
                        onClick={() => handleOpenDicaModal(dica)}
                        style={{ background: "transparent", border: "none", color: "var(--admin-subtle)", cursor: "pointer", padding: 4 }}
                        title="Editar Manual"
                      >
                        <Edit3 size={15} />
                      </button>
                      <button
                        onClick={() => handleDeleteDica(dica.id, mat.nome)}
                        style={{ background: "transparent", border: "none", color: "#E84040", cursor: "pointer", padding: 4 }}
                        title="Remover Manual"
                      >
                        <Trash2 size={15} />
                      </button>
                    </div>
                  </div>

                  <div
                    style={{
                      fontFamily: "DM Sans",
                      fontSize: 13,
                      lineHeight: 1.6,
                      color: "var(--admin-subtle)",
                      background: "var(--admin-bg)",
                      padding: "12px 14px",
                      borderRadius: 10,
                      border: "1px solid var(--admin-border)"
                    }}
                  >
                    {plainContent}
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {/* Modal de Manual / Dica */}
      {isDicaModalOpen && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)", backdropFilter: "blur(4px)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1100, padding: 16 }}>
          <div style={{ background: "var(--admin-surface)", border: "1px solid var(--admin-border)", borderRadius: 16, width: "100%", maxWidth: 520, padding: 24 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
              <h3 style={{ fontFamily: "Syne", fontSize: 18, fontWeight: 700, margin: 0, color: "var(--admin-text)" }}>
                {editingDica ? "Editar Manual Educativo" : "Novo Manual de Descarte"}
              </h3>
              <button onClick={() => setIsDicaModalOpen(false)} style={{ background: "transparent", border: "none", color: "var(--admin-subtle)", cursor: "pointer" }}>
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleSaveDica} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              <div>
                <label style={{ display: "block", fontFamily: "DM Sans", fontSize: 12, fontWeight: 600, color: "var(--admin-subtle)", marginBottom: 6 }}>
                  Tipo de Material Reciclável *
                </label>
                <select
                  value={dicaMaterialId}
                  onChange={(e) => setDicaMaterialId(e.target.value)}
                  style={{ width: "100%", background: "var(--admin-bg)", border: "1px solid var(--admin-border)", borderRadius: 8, padding: "10px 12px", color: "var(--admin-text)", fontFamily: "DM Sans", fontSize: 14 }}
                >
                  {MATERIAIS_COCO.map((m) => (
                    <option key={m.id} value={m.id}>{m.emoji} {m.nome}</option>
                  ))}
                </select>
              </div>

              <div>
                <label style={{ display: "block", fontFamily: "DM Sans", fontSize: 12, fontWeight: 600, color: "var(--admin-subtle)", marginBottom: 6 }}>
                  Título do Guia (Opcional)
                </label>
                <input
                  type="text"
                  placeholder="Ex: Como descartar garrafas PET e frascos"
                  value={dicaTitulo}
                  onChange={(e) => setDicaTitulo(e.target.value)}
                  style={{ width: "100%", background: "var(--admin-bg)", border: "1px solid var(--admin-border)", borderRadius: 8, padding: "10px 12px", color: "var(--admin-text)", fontFamily: "DM Sans", fontSize: 14 }}
                />
              </div>

              <div>
                <label style={{ display: "block", fontFamily: "DM Sans", fontSize: 12, fontWeight: 600, color: "var(--admin-subtle)", marginBottom: 6 }}>
                  Conteúdo Orientativo (HTML ou Texto) *
                </label>
                <textarea
                  required
                  rows={5}
                  placeholder="Instruções para o cidadão: ex: Enxaguar antes do descarte, retirar tampas..."
                  value={dicaHtml}
                  onChange={(e) => setDicaHtml(e.target.value)}
                  style={{ width: "100%", background: "var(--admin-bg)", border: "1px solid var(--admin-border)", borderRadius: 8, padding: "10px 12px", color: "var(--admin-text)", fontFamily: "DM Sans", fontSize: 14, resize: "vertical" }}
                />
              </div>

              <div style={{ display: "flex", justifyContent: "flex-end", gap: 12, marginTop: 16 }}>
                <GhostButton type="button" onClick={() => setIsDicaModalOpen(false)}>
                  Cancelar
                </GhostButton>
                <PrimaryButton type="submit" disabled={saving}>
                  {saving ? "Salvando..." : (editingDica ? "Salvar Alterações" : "Criar Manual")}
                </PrimaryButton>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
