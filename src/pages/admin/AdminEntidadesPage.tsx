import { useState } from "react";
import { X } from "lucide-react";
import { MOCK_ENTIDADES, AdminEntidade } from "@/mocks/adminData";
import { Card, PrimaryButton, GhostButton } from "@/components/admin/ui";
import { useAdminToast } from "@/components/admin/AdminToast";

const CATEGORIAS = ["mototaxi", "geral", "surf", "aulas", "diaristas", "beleza"];

const Toggle = ({ on, onChange }: { on: boolean; onChange: () => void }) => (
  <button
    onClick={onChange}
    aria-pressed={on}
    style={{
      width: 44,
      height: 24,
      borderRadius: 999,
      background: on ? "#0DB87E" : "#CBD5E1",
      border: "none",
      position: "relative",
      cursor: "pointer",
      transition: "background 200ms",
    }}
  >
    <span
      style={{
        position: "absolute",
        top: 2,
        left: on ? 22 : 2,
        width: 20,
        height: 20,
        borderRadius: 999,
        background: "#fff",
        boxShadow: "0 1px 3px rgba(0,0,0,0.2)",
        transition: "left 200ms",
      }}
    />
  </button>
);

type Form = Omit<AdminEntidade, "id">;
const emptyForm: Form = { name: "", sigla: "", categoria: "mototaxi", membros: 0, pixKey: "", ativa: true };

export default function AdminEntidadesPage() {
  const toast = useAdminToast();
  const [entidades, setEntidades] = useState<AdminEntidade[]>(MOCK_ENTIDADES);
  const [show, setShow] = useState(false);
  const [editing, setEditing] = useState<AdminEntidade | null>(null);
  const [form, setForm] = useState<Form>(emptyForm);

  const open = (e?: AdminEntidade) => {
    if (e) {
      setEditing(e);
      const { id, ...rest } = e;
      setForm(rest);
    } else {
      setEditing(null);
      setForm(emptyForm);
    }
    setShow(true);
  };

  const save = () => {
    if (!form.name || !form.sigla) {
      toast.show("Preencha nome e sigla.");
      return;
    }
    if (editing) {
      setEntidades((arr) => arr.map((x) => (x.id === editing.id ? { ...editing, ...form } : x)));
      toast.show("Entidade atualizada!");
    } else {
      setEntidades((arr) => [...arr, { ...form, id: "en" + Date.now().toString(36) }]);
      toast.show("Entidade criada!");
    }
    setShow(false);
  };

  return (
    <div style={{ padding: 32 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
        <h1 style={{ fontFamily: "Syne", fontSize: 22, fontWeight: 700, color: "#0F172A", margin: 0 }}>Entidades de Classe</h1>
        <PrimaryButton onClick={() => open()}>+ Nova entidade</PrimaryButton>
      </div>

      <Card style={{ padding: 0, overflow: "hidden" }}>
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead style={{ background: "#F8FAFC" }}>
              <tr>
                {["Sigla", "Nome", "Categoria", "Membros", "Chave Pix", "Status", "Ações"].map((h) => (
                  <th key={h} style={{ textAlign: "left", padding: "12px 20px", fontFamily: "DM Sans", fontSize: 11, fontWeight: 600, color: "#94A3B8", textTransform: "uppercase", letterSpacing: 1 }}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {entidades.map((e) => (
                <tr key={e.id} style={{ borderBottom: "1px solid #E2E8F0" }}>
                  <td style={{ padding: "14px 20px" }}>
                    <span style={{ background: "#F1F5F9", fontFamily: "monospace", fontSize: 12, color: "#0F172A", borderRadius: 6, padding: "3px 8px" }}>
                      {e.sigla}
                    </span>
                  </td>
                  <td style={{ padding: "14px 20px", fontFamily: "DM Sans", fontSize: 14, color: "#0F172A" }}>{e.name}</td>
                  <td style={{ padding: "14px 20px", fontFamily: "DM Sans", fontSize: 13, color: "#475569", textTransform: "capitalize" }}>{e.categoria}</td>
                  <td style={{ padding: "14px 20px", fontFamily: "DM Sans", fontSize: 14, color: "#0F172A" }}>{e.membros}</td>
                  <td style={{ padding: "14px 20px", fontFamily: "DM Sans", fontSize: 13, color: "#475569" }}>{e.pixKey}</td>
                  <td style={{ padding: "14px 20px" }}>
                    <Toggle
                      on={e.ativa}
                      onChange={() => setEntidades((arr) => arr.map((x) => (x.id === e.id ? { ...x, ativa: !x.ativa } : x)))}
                    />
                  </td>
                  <td style={{ padding: "14px 20px" }}>
                    <button
                      onClick={() => open(e)}
                      style={{
                        background: "transparent",
                        border: "1px solid #E2E8F0",
                        color: "#2B6EE8",
                        fontFamily: "DM Sans",
                        fontSize: 12,
                        fontWeight: 600,
                        borderRadius: 6,
                        padding: "5px 12px",
                        cursor: "pointer",
                      }}
                    >
                      Editar
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      {show && (
        <>
          <div onClick={() => setShow(false)} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", zIndex: 60 }} />
          <div
            style={{
              position: "fixed",
              top: "50%",
              left: "50%",
              transform: "translate(-50%, -50%)",
              background: "#fff",
              borderRadius: 16,
              padding: 32,
              width: 480,
              maxWidth: "92vw",
              zIndex: 70,
              boxShadow: "0 30px 60px rgba(0,0,0,0.25)",
            }}
          >
            <button
              onClick={() => setShow(false)}
              aria-label="Fechar"
              style={{ position: "absolute", top: 16, right: 16, background: "none", border: "none", cursor: "pointer" }}
            >
              <X size={18} color="#475569" />
            </button>
            <div style={{ fontFamily: "Syne", fontSize: 18, fontWeight: 700, color: "#0F172A" }}>
              {editing ? "Editar Entidade" : "Nova Entidade"}
            </div>
            <div style={{ marginTop: 20, display: "flex", flexDirection: "column", gap: 14 }}>
              {[
                { key: "name", label: "Nome completo", type: "text" },
                { key: "sigla", label: "Sigla (até 5)", type: "text", maxLength: 5, upper: true },
                { key: "pixKey", label: "Chave Pix", type: "text" },
                { key: "membros", label: "Nº de membros", type: "number" },
              ].map((f: any) => (
                <label key={f.key} style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                  <span style={{ fontFamily: "DM Sans", fontSize: 12, fontWeight: 600, color: "#475569" }}>{f.label}</span>
                  <input
                    type={f.type}
                    maxLength={f.maxLength}
                    value={(form as any)[f.key]}
                    onChange={(e) => {
                      let v: any = f.type === "number" ? Number(e.target.value) : e.target.value;
                      if (f.upper && typeof v === "string") v = v.toUpperCase();
                      setForm((s) => ({ ...s, [f.key]: v }));
                    }}
                    style={{
                      background: "#F1F5F9",
                      border: "1px solid #E2E8F0",
                      borderRadius: 10,
                      padding: "10px 14px",
                      fontFamily: "DM Sans",
                      fontSize: 14,
                      color: "#0F172A",
                      outline: "none",
                    }}
                  />
                </label>
              ))}
              <label style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                <span style={{ fontFamily: "DM Sans", fontSize: 12, fontWeight: 600, color: "#475569" }}>Categoria</span>
                <select
                  value={form.categoria}
                  onChange={(e) => setForm((s) => ({ ...s, categoria: e.target.value }))}
                  style={{
                    background: "#F1F5F9",
                    border: "1px solid #E2E8F0",
                    borderRadius: 10,
                    padding: "10px 14px",
                    fontFamily: "DM Sans",
                    fontSize: 14,
                    color: "#0F172A",
                    outline: "none",
                  }}
                >
                  {CATEGORIAS.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <div style={{ display: "flex", gap: 10, marginTop: 24 }}>
              <PrimaryButton onClick={save} style={{ flex: 1 }}>
                Salvar
              </PrimaryButton>
              <GhostButton onClick={() => setShow(false)} style={{ flex: 1 }}>
                Cancelar
              </GhostButton>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
