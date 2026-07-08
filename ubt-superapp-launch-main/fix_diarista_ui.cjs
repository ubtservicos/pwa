const fs = require('fs');

let content = fs.readFileSync('src/pages/DiaristaOnboardingPage.tsx', 'utf8');

// 1. Add horariosEmLote state
content = content.replace(
  'const [horariosPorDia, setHorariosPorDia] = useState<Record<string, string[]>>({});',
  'const [horariosPorDia, setHorariosPorDia] = useState<Record<string, string[]>>({});\n  const [horariosEmLote, setHorariosEmLote] = useState<string[]>(["08:00", "09:00", "10:00", "11:00", "12:00", "13:00", "14:00", "15:00", "16:00", "17:00"]);'
);

// 2. Initialize horariosEmLote on load
content = content.replace(
  'if (perfil.horarios_por_dia) setHorariosPorDia(perfil.horarios_por_dia);',
  `if (perfil.horarios_por_dia) {
            setHorariosPorDia(perfil.horarios_por_dia);
            const days = Object.keys(perfil.horarios_por_dia);
            if (days.length > 0 && perfil.horarios_por_dia[days[0]]) {
              setHorariosEmLote(perfil.horarios_por_dia[days[0]]);
            }
          }`
);

// 3. Update finalize payload for horarios_por_dia
content = content.replace(
  'horarios_por_dia: horariosPorDia',
  'horarios_por_dia: DIAS.reduce((acc, d) => ({ ...acc, [d]: disponibilidade[d] ? horariosEmLote : [] }), {})'
);
content = content.replace(
  'horariosPorDia,\n      isOnline:',
  'horariosPorDia: DIAS.reduce((acc, d) => ({ ...acc, [d]: disponibilidade[d] ? horariosEmLote : [] }), {}),\n      isOnline:'
);

// 4. Update the Agenda tab UI
const oldAgendaTabRegex = /\{activeTab === "Agenda" && \([\s\S]*?\}\s*\)\s*\}/;
const newAgendaTab = `{activeTab === "Agenda" && (
        <div style={{ marginTop: 28, display: "flex", flexDirection: "column", gap: 16 }}>
          <h2 style={{ fontFamily: "Syne", fontSize: 18, fontWeight: 700, color: "#0B1B3E", margin: 0 }}>Sua Agenda</h2>
          <p style={{ fontFamily: "DM Sans", fontSize: 13, color: "#5B6178", marginTop: -8 }}>Quais dias da semana você atende?</p>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 8 }}>
            {DIAS.map(d => (
              <button
                key={d}
                onClick={() => setDisponibilidade(p => ({ ...p, [d]: !p[d] }))}
                style={{
                  padding: "10px 0",
                  borderRadius: 12,
                  border: \`2px solid \${disponibilidade[d] ? "#0DB87E" : "#E2E8F0"}\`,
                  background: disponibilidade[d] ? "#E6FAF4" : "white",
                  color: disponibilidade[d] ? "#0DB87E" : "#5B6178",
                  fontFamily: "DM Sans",
                  fontSize: 14,
                  fontWeight: 600,
                  cursor: "pointer",
                }}
              >
                {DIA_LBL[d]}
              </button>
            ))}
          </div>

          <div style={{ background: "white", borderRadius: 16, border: "1px solid #E2E8F0", padding: 16, marginTop: 8 }}>
            <p style={{ fontFamily: "DM Sans", fontSize: 15, fontWeight: 600, color: "#0B1B3E", marginBottom: 12 }}>
              Selecione os horários de atendimento:
            </p>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8 }}>
              {HORARIOS_PADRAO.map(h => {
                const ativo = horariosEmLote.includes(h);
                return (
                  <button
                    key={h}
                    onClick={() => {
                      setHorariosEmLote(p => 
                        ativo ? p.filter(x => x !== h) : [...p, h].sort()
                      );
                    }}
                    style={{
                      padding: "8px 0",
                      borderRadius: 8,
                      border: \`1px solid \${ativo ? "#0DB87E" : "#E2E8F0"}\`,
                      background: ativo ? "#E6FAF4" : "white",
                      color: ativo ? "#0DB87E" : "#5B6178",
                      fontFamily: "DM Sans",
                      fontSize: 13,
                      fontWeight: 500,
                      cursor: "pointer"
                    }}
                  >
                    {h}
                  </button>
                );
              })}
            </div>
            <p style={{ fontFamily: "DM Sans", fontSize: 12, color: "#9399AD", marginTop: 16, textAlign: "center" }}>
              Os horários selecionados serão aplicados a todos os dias marcados acima.
            </p>
          </div>
        </div>
      )}`;
content = content.replace(oldAgendaTabRegex, newAgendaTab);

// 5. Update Tabs and Scroll logic
// we add useEffect to scroll to top and scroll tab into view
const scrollLogic = `
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "smooth" });
    const tabEl = document.getElementById(\`tab-\${activeTab}\`);
    if (tabEl) {
      tabEl.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "center" });
    }
  }, [activeTab]);
`;
content = content.replace('const [mediasMercado, setMediasMercado] = useState<Record<string, number>>({});', 'const [mediasMercado, setMediasMercado] = useState<Record<string, number>>({});\n' + scrollLogic);

// update tabs render to add id
content = content.replace(
  'key={t}\n            onClick={() => setActiveTab(t)}',
  'key={t}\n            id={`tab-${t}`}\n            onClick={() => setActiveTab(t)}'
);

fs.writeFileSync('src/pages/DiaristaOnboardingPage.tsx', content, 'utf8');
console.log("Diarista UI fixed.");
