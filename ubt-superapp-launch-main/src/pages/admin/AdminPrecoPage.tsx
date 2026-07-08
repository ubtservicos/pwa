import { useState } from "react";
import { Check } from "lucide-react";
import { Card, PrimaryButton } from "@/components/admin/ui";
import { useAdminToast } from "@/components/admin/AdminToast";

type Opt = { value: number; label: string; desc: string; color: string };

const DEMANDA_OPTIONS: Opt[] = [
  { value: 1.0, label: "Normal", desc: "Fluxo regular de pedidos", color: "#0DB87E" },
  { value: 1.3, label: "Alta demanda", desc: "Muitos pedidos simultâneos", color: "#F5A623" },
  { value: 1.6, label: "Demanda crítica", desc: "Capacidade máxima do sistema", color: "#E84040" },
];
const HORARIO_OPTIONS: Opt[] = [
  { value: 1.0, label: "Dia normal", desc: "06h–17h dias úteis", color: "#0DB87E" },
  { value: 1.2, label: "Horário de pico", desc: "07h–09h e 17h–19h", color: "#F5A623" },
  { value: 1.4, label: "Madrugada", desc: "00h–05h todos os dias", color: "#E84040" },
];
const CLIMA_OPTIONS: Opt[] = [
  { value: 1.0, label: "Tempo bom", desc: "Sem precipitação", color: "#0DB87E" },
  { value: 1.2, label: "Chuva", desc: "Chuva leve a moderada", color: "#2B6EE8" },
  { value: 1.5, label: "Tempestade", desc: "Chuva forte ou vendaval", color: "#E84040" },
];

const RadioCard = ({ opt, selected, onSelect }: { opt: Opt; selected: boolean; onSelect: () => void }) => (
  <div
    onClick={onSelect}
    style={{
      border: `2px solid ${selected ? opt.color : "#E2E8F0"}`,
      background: selected ? opt.color + "14" : "#fff",
      borderRadius: 12,
      padding: 14,
      cursor: "pointer",
      marginBottom: 8,
      display: "flex",
      alignItems: "center",
      gap: 12,
      position: "relative",
      transition: "border-color 150ms, background 150ms",
    }}
  >
    <div style={{ fontFamily: "Syne", fontSize: 20, fontWeight: 700, color: opt.color, minWidth: 50 }}>
      {opt.value.toFixed(1)}×
    </div>
    <div style={{ flex: 1 }}>
      <div style={{ fontFamily: "DM Sans", fontSize: 14, fontWeight: 600, color: "#0F172A" }}>{opt.label}</div>
      <div style={{ fontFamily: "DM Sans", fontSize: 12, color: "#475569" }}>{opt.desc}</div>
    </div>
    {selected && <Check size={16} color={opt.color} />}
  </div>
);

export default function AdminPrecoPage() {
  const toast = useAdminToast();
  const [demanda, setDemanda] = useState(1.0);
  const [horario, setHorario] = useState(1.0);
  const [clima, setClima] = useState(1.0);

  const preco = (4 + 2.5 * 5) * demanda * horario * clima;

  return (
    <div style={{ padding: 32, maxWidth: 960, margin: "0 auto" }}>
      <h1 style={{ fontFamily: "Syne", fontSize: 22, fontWeight: 700, color: "#0F172A", margin: 0 }}>Preço Dinâmico</h1>

      <div
        style={{
          background: "#0F172A",
          borderRadius: 16,
          padding: 24,
          marginTop: 16,
          marginBottom: 24,
          textAlign: "center",
          color: "#fff",
        }}
      >
        <span style={{ fontFamily: "Syne", fontSize: 16 }}>Preço = (R$ 4,00 + R$ 2,50 × km) × </span>
        {[demanda, horario, clima].map((v, i) => (
          <span
            key={i}
            style={{
              display: "inline-block",
              background: "rgba(13,184,126,0.20)",
              color: "#0DB87E",
              fontFamily: "DM Sans",
              fontSize: 14,
              fontWeight: 700,
              borderRadius: 999,
              padding: "4px 12px",
              margin: "0 4px",
            }}
          >
            {v.toFixed(1)}×
          </span>
        ))}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: 24 }}>
        {[
          { title: "Demanda", opts: DEMANDA_OPTIONS, val: demanda, set: setDemanda },
          { title: "Horário", opts: HORARIO_OPTIONS, val: horario, set: setHorario },
          { title: "Clima", opts: CLIMA_OPTIONS, val: clima, set: setClima },
        ].map((sec) => (
          <Card key={sec.title} style={{ padding: 24 }}>
            <div style={{ fontFamily: "Syne", fontSize: 15, fontWeight: 700, color: "#0F172A", marginBottom: 16 }}>
              {sec.title}
            </div>
            {sec.opts.map((o) => (
              <RadioCard key={o.value} opt={o} selected={sec.val === o.value} onSelect={() => sec.set(o.value)} />
            ))}
          </Card>
        ))}
      </div>

      <div
        style={{
          background: "#0F172A",
          borderRadius: 16,
          padding: 24,
          marginTop: 24,
          textAlign: "center",
          color: "#fff",
        }}
      >
        <div style={{ fontFamily: "DM Sans", fontSize: 14, color: "rgba(255,255,255,0.55)" }}>Preço para 5 km:</div>
        <div style={{ fontFamily: "Syne", fontSize: 40, fontWeight: 800, color: "#0DB87E", marginTop: 8 }}>
          R$ {preco.toFixed(2)}
        </div>
        <div style={{ fontFamily: "DM Sans", fontSize: 14, color: "rgba(255,255,255,0.55)", marginTop: 8 }}>
          Prestador recebe: R$ {(preco * 0.9).toFixed(2)}
        </div>
      </div>

      <PrimaryButton
        onClick={() => toast.show("Configuração de preço atualizada!")}
        style={{ width: "100%", marginTop: 24, padding: "14px 18px", fontSize: 14 }}
      >
        Salvar configuração
      </PrimaryButton>
    </div>
  );
}
