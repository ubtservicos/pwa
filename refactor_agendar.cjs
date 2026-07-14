const fs = require('fs');

let content = fs.readFileSync('src/pages/DiaristaAgendarPage.tsx', 'utf8');

// 1. Add step state
if (!content.includes('const [step, setStep] = useState(1);')) {
  content = content.replace(
    'const [submitting, setSubmitting] = useState(false);',
    'const [submitting, setSubmitting] = useState(false);\n  const [step, setStep] = useState(1);'
  );
}

// 2. Refactor the return block to include the Stepper and split steps
const returnRegex = /return \([\s\S]*?\n  \);\n\};/g;

const newReturn = `return (
    <div style={{ background: "#0B1B3E", minHeight: "100svh", padding: "24px 24px 100px", width: "100%" }}>
      <header style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <button onClick={() => { if (step > 1) setStep(step - 1); else navigate(-1); }} style={{ background: "none", border: "none", cursor: "pointer", padding: 0 }}>
          <ArrowLeft size={22} color="white" />
        </button>
        <h1 style={{ fontFamily: "Syne", fontSize: 20, fontWeight: 700, color: "white", margin: 0 }}>
          {step === 1 ? "Local e Kit" : step === 2 ? "Data e Hora" : "Resumo"}
        </h1>
      </header>

      {/* Stepper Wizard */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 24, position: "relative" }}>
        <div style={{ position: "absolute", top: 14, left: 20, right: 20, height: 2, background: "rgba(255,255,255,0.1)", zIndex: 0 }} />
        <div style={{ position: "absolute", top: 14, left: 20, width: step === 1 ? "0%" : step === 2 ? "50%" : "100%", height: 2, background: "#0DB87E", transition: "0.3s", zIndex: 1 }} />
        
        {[1, 2, 3].map((s) => (
          <div key={s} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 8, zIndex: 2 }}>
            <div style={{ width: 28, height: 28, borderRadius: 14, background: step >= s ? "#0DB87E" : "#1C3261", border: \`2px solid \${step >= s ? "#0DB87E" : "rgba(255,255,255,0.2)"}\`, display: "flex", alignItems: "center", justifyContent: "center", color: "white", fontFamily: "Syne", fontSize: 13, fontWeight: 700, transition: "0.3s" }}>
              {step > s ? <Check size={14} /> : s}
            </div>
          </div>
        ))}
      </div>

      <div style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 12, padding: 14, display: "flex", gap: 12, alignItems: "center", marginTop: 24 }}>
        <div style={{ width: 40, height: 40, borderRadius: 999, background: "rgba(13,184,126,0.15)", display: "flex", alignItems: "center", justifyContent: "center" }}>
          <span style={{ fontFamily: "Syne", fontSize: 14, fontWeight: 700, color: "#0DB87E" }}>{initials}</span>
        </div>
        <span style={{ flex: 1, fontFamily: "DM Sans", fontSize: 14, fontWeight: 600, color: "white" }}>{diarista.nome}</span>
        <span style={{ fontFamily: "DM Sans", fontSize: 13, color: "#0DB87E" }}>R$ {diarista.valorPorM2.toFixed(2)}/m²</span>
      </div>

      {step === 1 && (
        <div style={{ marginTop: 24 }}>
          <SectionHeader title="O LOCAL" />
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <div style={{ position: "relative" }}>
              <MapPin size={18} color="rgba(255,255,255,0.4)" style={{ position: "absolute", left: 14, top: 15 }} />
              <DarkInput placeholder="Endereço completo" value={endereco} onChange={e => setEndereco(e.target.value)} style={{ paddingLeft: 42 }} />
            </div>
            <DarkInput placeholder="Complemento (apto, bloco...)" value={complemento} onChange={e => setComplemento(e.target.value)} />
            <div style={{ position: "relative" }}>
              <Ruler size={18} color="rgba(255,255,255,0.4)" style={{ position: "absolute", left: 14, top: 15 }} />
              <DarkInput type="number" placeholder={\`Tamanho da casa em m² (Mínimo \${diarista.minimoM2}m²)\`} value={m2} onChange={e => setM2(e.target.value)} style={{ paddingLeft: 42 }} />
            </div>
            {m2 && +m2 < diarista.minimoM2 && (
              <p style={{ color: "#E74C3C", fontSize: 12, fontFamily: "DM Sans", marginTop: -4 }}>O mínimo exigido por {diarista.nome} é de {diarista.minimoM2}m².</p>
            )}
          </div>

          <SectionHeader title="KIT DE LIMPEZA" />
          <p style={{ fontFamily: "DM Sans", fontSize: 13, color: "rgba(255,255,255,0.5)", marginBottom: 12 }}>Selecione apenas o que você precisa que a profissional traga. (Subentende-se que você já possui o básico).</p>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {diarista.materiais.map((mId: string) => {
              const m = MATERIAIS_PADRAO.find(x => x.id === mId);
              if (!m) return null;
              const sel = materiaisSel.includes(mId);
              return (
                <div key={mId} onClick={() => {
                  setMateriaisSel(prev => sel ? prev.filter(x => x !== mId) : [...prev, mId])
                }} style={{ display: "flex", alignItems: "center", gap: 12, background: "rgba(255,255,255,0.04)", padding: "12px 16px", borderRadius: 12, cursor: "pointer", border: \`1px solid \${sel ? "#0DB87E" : "transparent"}\` }}>
                  <div style={{ width: 22, height: 22, borderRadius: 6, border: \`2px solid \${sel ? "#0DB87E" : "rgba(255,255,255,0.2)"}\`, background: sel ? "#0DB87E" : "transparent", display: "flex", alignItems: "center", justifyContent: "center" }}>
                    {sel && <Check size={14} color="white" />}
                  </div>
                  <span style={{ fontSize: 18 }}>{m.emoji}</span>
                  <div style={{ flex: 1 }}>
                    <p style={{ fontFamily: "DM Sans", fontSize: 14, fontWeight: 600, color: "white", margin: 0 }}>{m.nome}</p>
                    <p style={{ fontFamily: "DM Sans", fontSize: 12, color: "rgba(255,255,255,0.45)", margin: 0 }}>+{m.custoAdicional ? \`R$ \${m.custoAdicional.toFixed(2)}\` : "Grátis"}</p>
                  </div>
                </div>
              );
            })}
          </div>

          <button
            disabled={!endereco || !m2 || +m2 < diarista.minimoM2}
            onClick={() => setStep(2)}
            style={{ width: "100%", height: 52, background: (!endereco || !m2 || +m2 < diarista.minimoM2) ? "rgba(255,255,255,0.1)" : "#0DB87E", color: (!endereco || !m2 || +m2 < diarista.minimoM2) ? "rgba(255,255,255,0.4)" : "white", border: "none", borderRadius: 12, fontFamily: "Syne", fontSize: 15, fontWeight: 600, marginTop: 32, cursor: "pointer" }}
          >
            Avançar para Data
          </button>
        </div>
      )}

      {step === 2 && (
        <div style={{ marginTop: 24 }}>
          <SectionHeader title="DATA DO SERVIÇO" />
          <div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", paddingBottom: 12 }}>
              <button onClick={() => { if (calMes === 0) { setCalMes(11); setCalAno(calAno - 1); } else setCalMes(calMes - 1); }} style={{ background: "none", border: "none", cursor: "pointer" }}>
                <ChevronLeft size={20} color="white" />
              </button>
              <span style={{ fontFamily: "Syne", fontSize: 15, fontWeight: 700, color: "white" }}>
                {MESES[calMes]} {calAno}
              </span>
              <button onClick={() => { if (calMes === 11) { setCalMes(0); setCalAno(calAno + 1); } else setCalMes(calMes + 1); }} style={{ background: "none", border: "none", cursor: "pointer" }}>
                <ChevronRight size={20} color="white" />
              </button>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(7,1fr)", gap: 4 }}>
              {DIAS_SEMANA_LBL.map((l) => (
                <span key={l} style={{ fontFamily: "DM Sans", fontSize: 11, color: "rgba(255,255,255,0.35)", textAlign: "center" }}>{l}</span>
              ))}
              {Array.from({ length: primeiroDia }).map((_, i) => <div key={\`e\${i}\`} />)}
              {Array.from({ length: diasNoMes }).map((_, i) => {
                const dia = i + 1;
                const iso = isoDate(dia);
                const dt = new Date(calAno, calMes, dia); dt.setHours(0, 0, 0, 0);
                const passado = dt < hoje;
                
                // Extract availability for the specific day name
                const nomeDia = DIAS_SEMANA_KEY[dt.getDay()];
                const disp = diarista.disponibilidade[nomeDia] === true;
                
                const isHoje = dt.getTime() === hoje.getTime();
                const sel = selectedDate === iso;
                const disabled = passado || !disp;
                return (
                  <button
                    key={dia}
                    disabled={disabled}
                    onClick={() => { setSelectedDate(iso); setSelectedHora(null); }}
                    style={{
                      width: "100%", aspectRatio: "1", borderRadius: 999, border: isHoje && !sel ? "1px solid rgba(13,184,126,0.40)" : "none",
                      background: sel ? "#0DB87E" : "transparent",
                      color: sel ? "white" : disabled ? "rgba(255,255,255,0.20)" : "white",
                      fontFamily: "DM Sans", fontSize: 14, fontWeight: sel ? 700 : 400,
                      cursor: disabled ? "not-allowed" : "pointer",
                    }}
                  >
                    {dia}
                  </button>
                );
              })}
            </div>
          </div>

          {selectedDate && (
            <>
              <SectionHeader title="HORÁRIO DE CHEGADA" />
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                {(() => {
                  const dataObj = new Date(selectedDate + "T00:00:00");
                  const nomeDia = DIAS_SEMANA_KEY[dataObj.getDay()];
                  const horasParaODia = diarista.horarios_por_dia?.[nomeDia] || diarista.horarios || [];
                  
                  if (horasParaODia.length === 0) {
                     return <p style={{ color: "rgba(255,255,255,0.5)", fontSize: 13 }}>Nenhum horário cadastrado para este dia.</p>;
                  }

                  return horasParaODia.map((h: string) => {
                    const sel = selectedHora === h;
                    return (
                      <button
                        key={h}
                        onClick={() => setSelectedHora(h)}
                        style={{
                          padding: "10px 16px", borderRadius: 999, cursor: "pointer", minWidth: 72,
                          fontFamily: "DM Sans", fontSize: 14, fontWeight: 600,
                          background: sel ? "#0DB87E" : "rgba(255,255,255,0.06)",
                          border: \`1.5px solid \${sel ? "#0DB87E" : "rgba(255,255,255,0.10)"}\`,
                          color: sel ? "white" : "rgba(255,255,255,0.70)",
                        }}
                      >
                        {h}
                      </button>
                    );
                  });
                })()}
              </div>
            </>
          )}

          <button
            disabled={!selectedDate || !selectedHora}
            onClick={() => setStep(3)}
            style={{ width: "100%", height: 52, background: (!selectedDate || !selectedHora) ? "rgba(255,255,255,0.1)" : "#0DB87E", color: (!selectedDate || !selectedHora) ? "rgba(255,255,255,0.4)" : "white", border: "none", borderRadius: 12, fontFamily: "Syne", fontSize: 15, fontWeight: 600, marginTop: 32, cursor: "pointer" }}
          >
            Avançar para Resumo
          </button>
        </div>
      )}

      {step === 3 && (
        <div style={{ marginTop: 24 }}>
          <SectionHeader title="RESUMO DO PEDIDO" />
          
          <div style={{ background: "rgba(255,255,255,0.03)", borderRadius: 12, padding: 16, border: "1px solid rgba(255,255,255,0.06)" }}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 12 }}>
              <span style={{ color: "rgba(255,255,255,0.6)", fontSize: 13, fontFamily: "DM Sans" }}>Data e Hora</span>
              <span style={{ color: "white", fontSize: 13, fontWeight: 600, fontFamily: "DM Sans" }}>{selectedDate?.split("-").reverse().join("/")} às {selectedHora}</span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 12 }}>
              <span style={{ color: "rgba(255,255,255,0.6)", fontSize: 13, fontFamily: "DM Sans" }}>Local</span>
              <span style={{ color: "white", fontSize: 13, fontWeight: 600, fontFamily: "DM Sans", textAlign: "right", maxWidth: "60%" }}>{endereco} - {m2}m²</span>
            </div>
            
            <div style={{ borderTop: "1px dashed rgba(255,255,255,0.1)", margin: "16px 0" }} />
            
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
              <span style={{ color: "rgba(255,255,255,0.6)", fontSize: 13, fontFamily: "DM Sans" }}>Diária Base ({m2}m² x R$ {diarista.valorPorM2})</span>
              <span style={{ color: "white", fontSize: 14, fontFamily: "DM Sans" }}>R$ {valorBase.toFixed(2)}</span>
            </div>
            
            {materiaisSel.length > 0 && (
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
                <span style={{ color: "rgba(255,255,255,0.6)", fontSize: 13, fontFamily: "DM Sans" }}>Kit de Limpeza ({materiaisSel.length} itens)</span>
                <span style={{ color: "white", fontSize: 14, fontFamily: "DM Sans" }}>R$ {valorMateriais.toFixed(2)}</span>
              </div>
            )}
            
            <div style={{ borderTop: "1px dashed rgba(255,255,255,0.1)", margin: "16px 0" }} />
            
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span style={{ color: "white", fontSize: 16, fontWeight: 700, fontFamily: "Syne" }}>Total</span>
              <span style={{ color: "#0DB87E", fontSize: 20, fontWeight: 700, fontFamily: "Syne" }}>R$ {valorTotal.toFixed(2)}</span>
            </div>
          </div>
          
          <SectionHeader title="OBSERVAÇÕES (OPCIONAL)" />
          <textarea
            placeholder="Alguma recomendação especial para a diarista? (Animais em casa, produtos alérgicos...)"
            value={notas}
            onChange={e => setNotas(e.target.value)}
            style={{ width: "100%", background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.10)", borderRadius: 12, minHeight: 80, padding: 14, color: "white", fontFamily: "DM Sans", fontSize: 14, outline: "none", resize: "none" }}
          />

          <button
            disabled={submitting}
            onClick={handleSubmit}
            style={{ width: "100%", height: 52, background: submitting ? "rgba(255,255,255,0.1)" : "#0DB87E", color: submitting ? "rgba(255,255,255,0.4)" : "white", border: "none", borderRadius: 12, fontFamily: "Syne", fontSize: 15, fontWeight: 600, marginTop: 32, cursor: submitting ? "not-allowed" : "pointer" }}
          >
            {submitting ? "Confirmando..." : "Confirmar Agendamento"}
          </button>
        </div>
      )}
    </div>
  );
};`;

content = content.replace(returnRegex, newReturn);

fs.writeFileSync('src/pages/DiaristaAgendarPage.tsx', content, 'utf8');
console.log("Refactored DiaristaAgendarPage with Stepper");
