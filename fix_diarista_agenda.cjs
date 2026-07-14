const fs = require('fs');

let content = fs.readFileSync('src/pages/DiaristaOnboardingPage.tsx', 'utf8');

// 1. Fix the payload for finalize()
// Previous: horarios_por_dia: DIAS.reduce((acc, d) => ({ ...acc, [d]: disponibilidade[d] ? horariosEmLote : [] }), {})
content = content.replace(
  /horarios_por_dia: DIAS\.reduce\(\(acc, d\) => \(\{ \.\.\.acc, \[d\]: disponibilidade\[d\] \? horariosEmLote : \[\] \}\), \{\}\)/g,
  'horarios_por_dia: horariosPorDia'
);

// 2. Change the Agenda tab UI
const oldAgendaTabRegex = /\{activeTab === "Agenda" && \([\s\S]*?\}\s*\)\s*\}/;
const newAgendaTab = `{activeTab === "Agenda" && (
        <div style={{ marginTop: 28, display: "flex", flexDirection: "column", gap: 16 }}>
          <h2 style={{ fontFamily: "Syne", fontSize: 18, fontWeight: 700, color: "#0B1B3E", margin: 0 }}>Sua Agenda</h2>
          <p style={{ fontFamily: "DM Sans", fontSize: 13, color: "#5B6178", marginTop: -8 }}>Quais dias da semana você atende?</p>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 8 }}>
            {DIAS.map(d => (
              <button
                key={d}
                onClick={() => {
                  setDisponibilidade(p => ({ ...p, [d]: !p[d] }));
                  if (!disponibilidade[d]) setDiaEditando(d);
                }}
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

          {Object.keys(disponibilidade).some(d => disponibilidade[d]) && (
            <div style={{ background: "white", borderRadius: 16, border: "1px solid #E2E8F0", padding: 16, marginTop: 8 }}>
              <p style={{ fontFamily: "DM Sans", fontSize: 15, fontWeight: 600, color: "#0B1B3E", marginBottom: 12 }}>
                Ajuste os horários por dia:
              </p>
              
              <div style={{ display: "flex", gap: 8, overflowX: "auto", paddingBottom: 10, scrollbarWidth: "none" }}>
                {DIAS.filter(d => disponibilidade[d]).map(d => (
                  <button
                    key={d}
                    onClick={() => setDiaEditando(d)}
                    style={{
                      minWidth: 56,
                      padding: "8px 12px",
                      borderRadius: 999,
                      border: \`2px solid \${diaEditando === d ? "#0DB87E" : "#E2E8F0"}\`,
                      background: diaEditando === d ? "#0DB87E" : "white",
                      color: diaEditando === d ? "white" : "#5B6178",
                      fontFamily: "DM Sans",
                      fontSize: 13,
                      fontWeight: 600,
                      cursor: "pointer",
                    }}
                  >
                    {DIA_LBL[d]}
                  </button>
                ))}
              </div>

              {diaEditando && disponibilidade[diaEditando] && (
                <div style={{ marginTop: 12 }}>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8 }}>
                    {HORARIOS_PADRAO.map(h => {
                      const ativo = (horariosPorDia[diaEditando] || []).includes(h);
                      return (
                        <button
                          key={h}
                          onClick={() => {
                            setHorariosPorDia(p => {
                              const prev = p[diaEditando] || [];
                              return { ...p, [diaEditando]: ativo ? prev.filter(x => x !== h) : [...prev, h].sort() };
                            });
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
                  
                  <button
                    onClick={() => {
                      const horasAtuais = horariosPorDia[diaEditando] || [];
                      setHorariosPorDia(p => {
                        const novo = { ...p };
                        DIAS.forEach(d => {
                          if (disponibilidade[d]) novo[d] = [...horasAtuais];
                        });
                        return novo;
                      });
                      alert("Horários copiados para todos os outros dias de trabalho!");
                    }}
                    style={{
                      width: "100%",
                      marginTop: 16,
                      padding: "10px",
                      borderRadius: 8,
                      background: "rgba(13,184,126,0.1)",
                      color: "#0DB87E",
                      border: "1px solid rgba(13,184,126,0.3)",
                      fontFamily: "DM Sans",
                      fontSize: 13,
                      fontWeight: 600,
                      cursor: "pointer",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      gap: 6
                    }}
                  >
                    <Check size={16} /> Aplicar estes horários para todos os dias
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      )}`;

content = content.replace(oldAgendaTabRegex, newAgendaTab);
fs.writeFileSync('src/pages/DiaristaOnboardingPage.tsx', content, 'utf8');
console.log("Agenda UI fixed.");
