import { useState, useEffect } from "react";
import { Sparkles, Trash2, Plus } from "lucide-react";
import { Card, PrimaryButton, GhostButton, Pill } from "@/components/admin/ui";
import { useAdminToast } from "@/components/admin/AdminToast";
import { supabase } from "@/lib/supabase";

export default function AdminDiaristasPage() {
  const toast = useAdminToast();
  const [materiais, setMateriais] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const [novoId, setNovoId] = useState("");
  const [novoNome, setNovoNome] = useState("");
  const [novoEmoji, setNovoEmoji] = useState("✨");
  const [novoCategoria, setNovoCategoria] = useState("quimicos");
  const [novoPreco, setNovoPreco] = useState("5.00");

  useEffect(() => {
    loadMateriais();
  }, []);

  async function loadMateriais() {
    setLoading(true);
    const { data, error } = await supabase.from("diarista_materiais_padrao").select("*").order("categoria", { ascending: true });
    if (data) setMateriais(data);
    else if (error) console.error("Erro ao carregar materiais:", error);
    setLoading(false);
  }

  async function addMaterial() {
    if (!novoId || !novoNome) {
      toast.show("Preencha ID e Nome");
      return;
    }
    const { error } = await supabase.from("diarista_materiais_padrao").insert({
      id: novoId,
      nome: novoNome,
      emoji: novoEmoji,
      categoria: novoCategoria,
      preco_medio: Number(novoPreco)
    });
    
    if (error) {
      toast.show("Erro ao adicionar: " + error.message);
    } else {
      toast.show("Material adicionado!");
      setNovoId("");
      setNovoNome("");
      loadMateriais();
    }
  }

  async function removeMaterial(id: string) {
    const { error } = await supabase.from("diarista_materiais_padrao").delete().eq("id", id);
    if (error) {
      toast.show("Erro ao remover: " + error.message);
    } else {
      toast.show("Material removido!");
      loadMateriais();
    }
  }

  async function updatePreco(id: string, preco: number) {
    const { error } = await supabase.from("diarista_materiais_padrao").update({ preco_medio: preco }).eq("id", id);
    if (error) {
      toast.show("Erro ao atualizar preço!");
    } else {
      toast.show("Preço atualizado!");
    }
  }

  return (
    <div style={{ padding: 32 }}>
      <h1 style={{ fontFamily: "Syne", fontSize: 22, fontWeight: 700, color: "#0F172A", margin: "0 0 20px" }}>
        Diaristas - Materiais
      </h1>

      <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 380px) 1fr", gap: 24 }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 16, minWidth: 0 }}>
          <Card style={{ padding: 24 }}>
            <div style={{ fontFamily: "Syne", fontSize: 15, fontWeight: 700, color: "#0F172A" }}>Adicionar Material Padrão</div>
            <div style={{ fontFamily: "DM Sans", fontSize: 13, color: "#475569", marginTop: 4 }}>
              Este item aparecerá para as diaristas no onboarding.
            </div>
            
            <div style={{ display: "flex", flexDirection: "column", gap: 12, marginTop: 16 }}>
              <input value={novoId} onChange={e => setNovoId(e.target.value)} placeholder="ID (ex: sabao_po)" style={inputStyle} />
              <input value={novoNome} onChange={e => setNovoNome(e.target.value)} placeholder="Nome (ex: Sabão em Pó)" style={inputStyle} />
              <div style={{ display: "flex", gap: 8 }}>
                <input value={novoEmoji} onChange={e => setNovoEmoji(e.target.value)} placeholder="Emoji (ex: 🫧)" style={{...inputStyle, width: 80}} />
                <select value={novoCategoria} onChange={e => setNovoCategoria(e.target.value)} style={{...inputStyle, flex: 1}}>
                  <option value="quimicos">Químicos</option>
                  <option value="utensilios">Utensílios</option>
                </select>
              </div>
              <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                <span style={{ fontFamily: "DM Sans", fontSize: 14, color: "#0F172A" }}>R$</span>
                <input type="number" step="0.01" value={novoPreco} onChange={e => setNovoPreco(e.target.value)} placeholder="Preço médio" style={{...inputStyle, flex: 1}} />
              </div>
              <PrimaryButton onClick={addMaterial}>Adicionar</PrimaryButton>
            </div>
          </Card>
        </div>

        <Card style={{ padding: 24, minHeight: 480 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div style={{ fontFamily: "Syne", fontSize: 15, fontWeight: 700, color: "#0F172A", display: "flex", alignItems: "center", gap: 8 }}>
              <Sparkles size={18} color="#0DB87E" />
              Materiais Cadastrados
            </div>
            <Pill bg="rgba(13,184,126,0.10)" color="#0DB87E" size="sm">
              {materiais.length}
            </Pill>
          </div>
          
          <div style={{ marginTop: 16 }}>
            {loading ? (
              <div style={{ fontFamily: "DM Sans", fontSize: 14, color: "#94A3B8", textAlign: "center", padding: "40px 0" }}>Carregando...</div>
            ) : materiais.length === 0 ? (
              <div style={{ fontFamily: "DM Sans", fontSize: 14, color: "#94A3B8", textAlign: "center", padding: "40px 0" }}>Nenhum material encontrado ou tabela não criada.</div>
            ) : (
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead>
                  <tr style={{ borderBottom: "1px solid #E2E8F0" }}>
                    <th style={thStyle}>Item</th>
                    <th style={thStyle}>Categoria</th>
                    <th style={{...thStyle, textAlign: "right"}}>Preço Médio</th>
                    <th style={thStyle}>Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {materiais.map(m => (
                    <tr key={m.id} style={{ borderBottom: "1px solid #F1F5F9" }}>
                      <td style={tdStyle}>
                        <span style={{ fontSize: 18, marginRight: 8 }}>{m.emoji}</span>
                        <span style={{ fontFamily: "DM Sans", fontSize: 14, color: "#0F172A", fontWeight: 500 }}>{m.nome}</span>
                      </td>
                      <td style={tdStyle}>
                        <Pill bg="#F1F5F9" color="#475569" size="sm"><span style={{ textTransform: "capitalize" }}>{m.categoria}</span></Pill>
                      </td>
                      <td style={{...tdStyle, textAlign: "right"}}>
                        <div style={{ display: "flex", alignItems: "center", justifyContent: "flex-end", gap: 4 }}>
                          <span style={{ fontFamily: "DM Sans", fontSize: 13, color: "#94A3B8" }}>R$</span>
                          <input 
                            type="number" 
                            step="0.01" 
                            defaultValue={m.preco_medio} 
                            onBlur={(e) => updatePreco(m.id, Number(e.target.value))}
                            style={{ width: 60, border: "1px solid #E2E8F0", borderRadius: 6, padding: "4px 8px", fontFamily: "DM Sans", fontSize: 13, textAlign: "right" }}
                          />
                        </div>
                      </td>
                      <td style={{...tdStyle, textAlign: "center", width: 50 }}>
                        <button onClick={() => removeMaterial(m.id)} style={{ background: "none", border: "none", cursor: "pointer", color: "#E84040", padding: 4 }}>
                          <Trash2 size={16} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </Card>
      </div>
    </div>
  );
}

const inputStyle = {
  background: "#F1F5F9",
  border: "1px solid #E2E8F0",
  borderRadius: 10,
  height: 40,
  padding: "0 14px",
  fontFamily: "DM Sans",
  fontSize: 14,
  color: "#0F172A",
  outline: "none",
};

const thStyle = {
  fontFamily: "DM Sans",
  fontSize: 12,
  fontWeight: 600,
  color: "#94A3B8",
  textAlign: "left" as const,
  padding: "12px 8px",
};

const tdStyle = {
  padding: "12px 8px",
};
