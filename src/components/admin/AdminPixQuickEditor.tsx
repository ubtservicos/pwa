import React, { useState, useEffect } from "react";
import { AlertTriangle, CheckCircle2, KeyRound, Loader2 } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { applyPixMask, getPixMaxLength, getPixPlaceholder } from "@/utils/masks";
import { PixKeyType, validatePixKeyValue } from "@/components/finance/PixContingencyBanner";

interface AdminPixQuickEditorProps {
  userId: string;
  chavePix?: string | null;
  tipoChavePix?: string | null;
  saldoContingenciado?: number;
  onSaved?: (novaChave: string, novoTipo: string, repassesLiberados: number) => void;
  onToast?: (msg: string) => void;
}

export default function AdminPixQuickEditor({
  userId,
  chavePix,
  tipoChavePix,
  saldoContingenciado = 0,
  onSaved,
  onToast,
}: AdminPixQuickEditorProps) {
  const normalizedInitType = (): PixKeyType => {
    const t = String(tipoChavePix || "telefone").toLowerCase().trim();
    if (t === "cpf" || t === "cnpj" || t === "telefone" || t === "email" || t === "aleatoria") {
      return t;
    }
    return "telefone";
  };

  const [editing, setEditing] = useState(false);
  const [tipo, setTipo] = useState<PixKeyType>(normalizedInitType);
  const [valor, setValor] = useState(chavePix || "");
  const [saving, setSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    setTipo(normalizedInitType());
    setValor(chavePix || "");
    setErrorMsg(null);
  }, [userId, chavePix, tipoChavePix]);

  const hasPix = Boolean(chavePix && chavePix.trim());

  const handleSave = async () => {
    setErrorMsg(null);
    const err = validatePixKeyValue(tipo, valor);
    if (err) {
      setErrorMsg(err);
      return;
    }

    setSaving(true);
    try {
      const { data, error } = await supabase.rpc("salvar_chave_pix_usuario", {
        p_user_id: userId,
        p_chave_pix: valor.trim(),
        p_tipo_chave_pix: tipo,
      });
      if (error) throw error;

      const liberados = Number(data?.repasses_liberados || 0);
      setEditing(false);
      onSaved?.(valor.trim(), tipo, liberados);
      onToast?.(
        liberados > 0
          ? `Chave PIX atualizada! ${liberados} repasse(s) liberado(s) do contingenciamento. ✓`
          : "Chave PIX salva com sucesso! ✓"
      );
    } catch (e: any) {
      const msg = e?.message || "Erro ao salvar chave PIX.";
      setErrorMsg(msg);
      onToast?.(msg);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      style={{
        background: hasPix ? "rgba(13, 184, 126, 0.06)" : "rgba(245, 166, 35, 0.08)",
        border: hasPix ? "1px solid rgba(13, 184, 126, 0.28)" : "1px solid rgba(245, 166, 35, 0.45)",
        borderRadius: 10,
        padding: 12,
        display: "flex",
        flexDirection: "column",
        gap: 8,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, flexWrap: "wrap" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          {hasPix ? (
            <CheckCircle2 size={16} color="#0DB87E" />
          ) : (
            <AlertTriangle size={16} color="#F5A623" />
          )}
          <div>
            <div style={{ fontSize: 12, fontWeight: 700, color: hasPix ? "#0DB87E" : "#F5A623" }}>
              {hasPix
                ? `Chave PIX Ativa (${(tipoChavePix || tipo).toUpperCase()})`
                : "⚠️ Sem chave PIX"}
            </div>
            {hasPix ? (
              <div style={{ fontSize: 12, fontFamily: "monospace", color: "var(--admin-text)", marginTop: 2 }}>
                {chavePix}
              </div>
            ) : (
              <div style={{ fontSize: 11, color: "var(--admin-subtle)", marginTop: 2 }}>
                {saldoContingenciado > 0
                  ? `Saldo retido: R$ ${saldoContingenciado.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`
                  : "Repasses de 0,5% por apadrinhamento ficarão retidos até o cadastro da chave."}
              </div>
            )}
          </div>
        </div>

        <button
          type="button"
          onClick={() => {
            setEditing((v) => !v);
            setErrorMsg(null);
          }}
          style={{
            padding: "5px 10px",
            borderRadius: 6,
            border: "1px solid var(--admin-border)",
            background: "var(--admin-bg)",
            color: hasPix ? "var(--admin-text)" : "#F5A623",
            fontSize: 11,
            fontWeight: 700,
            cursor: "pointer",
            display: "inline-flex",
            alignItems: "center",
            gap: 4,
          }}
        >
          <KeyRound size={12} />
          <span>{editing ? "Fechar" : hasPix ? "Editar PIX" : "Cadastrar PIX"}</span>
        </button>
      </div>

      {editing && (
        <div style={{ display: "flex", flexDirection: "column", gap: 8, paddingTop: 8, borderTop: "1px solid var(--admin-border)" }}>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
            <select
              value={tipo}
              onChange={(e) => {
                setTipo(e.target.value as PixKeyType);
                setValor("");
                setErrorMsg(null);
              }}
              style={{
                background: "var(--admin-bg)",
                border: "1px solid var(--admin-border)",
                borderRadius: 6,
                padding: "6px 8px",
                fontSize: 12,
                color: "var(--admin-text)",
              }}
            >
              <option value="telefone">Telefone</option>
              <option value="cpf">CPF</option>
              <option value="cnpj">CNPJ</option>
              <option value="email">E-mail</option>
              <option value="aleatoria">Aleatória (EVP)</option>
            </select>

            <input
              type="text"
              value={valor}
              maxLength={getPixMaxLength(tipo)}
              placeholder={getPixPlaceholder(tipo)}
              onChange={(e) => {
                setValor(applyPixMask(e.target.value, tipo));
                setErrorMsg(null);
              }}
              style={{
                flex: 1,
                minWidth: 160,
                background: "var(--admin-bg)",
                border: "1px solid var(--admin-border)",
                borderRadius: 6,
                padding: "6px 10px",
                fontSize: 12,
                fontFamily: "monospace",
                color: "var(--admin-text)",
              }}
            />

            <button
              type="button"
              onClick={handleSave}
              disabled={saving}
              style={{
                padding: "6px 12px",
                borderRadius: 6,
                border: "none",
                background: "#0DB87E",
                color: "#FFFFFF",
                fontSize: 12,
                fontWeight: 700,
                cursor: saving ? "wait" : "pointer",
                display: "inline-flex",
                alignItems: "center",
                gap: 4,
              }}
            >
              {saving && <Loader2 size={12} className="animate-spin" />}
              <span>{saving ? "Salvando..." : "Salvar PIX"}</span>
            </button>
          </div>
          {errorMsg && <span style={{ fontSize: 11, color: "#E84040", fontWeight: 600 }}>{errorMsg}</span>}
        </div>
      )}
    </div>
  );
}
