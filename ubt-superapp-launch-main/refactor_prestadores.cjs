const fs = require('fs');

function replaceFileContent(filepath, replacer) {
  let content = fs.readFileSync(filepath, 'utf8');
  content = replacer(content);
  fs.writeFileSync(filepath, content, 'utf8');
}

function rewriteDiarista() {
  const filepath = "src/pages/DiaristaOnboardingPage.tsx";
  replaceFileContent(filepath, (content) => {
    content = content.replace(/import Stepper from "@\/components\/prestador\/Stepper";/g, '');
    
    content = content.replace(
      'const [step, setStep] = useState(1);',
      'const [activeTab, setActiveTab] = useState("Dados");\n  const [horarioInicio, setHorarioInicio] = useState("08:00");\n  const [horarioFim, setHorarioFim] = useState("17:00");\n'
    );
    
    const tabs_ui = `
      <div style={{ display: "flex", gap: 8, overflowX: "auto", paddingBottom: 16, marginBottom: 16, scrollbarWidth: "none" }}>
        {["Dados", "Preços", "Agenda"].map(t => (
          <button
            key={t}
            onClick={() => setActiveTab(t)}
            style={{
              padding: "10px 20px",
              borderRadius: 999,
              background: activeTab === t ? "#0B1B3E" : "#EFF0F3",
              color: activeTab === t ? "white" : "#5B6178",
              fontFamily: "DM Sans",
              fontWeight: 600,
              fontSize: 14,
              border: "none",
              cursor: "pointer",
              flexShrink: 0
            }}
          >
            {t}
          </button>
        ))}
      </div>
`;
    content = content.replace(
      /<Stepper steps=\{\["Dados", "Preços", "Agenda", "Revisão"\]\} current=\{step\} onStepClick=\{setStep\} \/>/g,
      tabs_ui
    );

    content = content.replace(/\{step === 1 && \(/g, '{activeTab === "Dados" && (');
    content = content.replace(/\{step === 2 && \(/g, '{activeTab === "Preços" && (');
    content = content.replace(/\{step === 3 && \(/g, '{activeTab === "Agenda" && (');
    
    content = content.replace(/\{step === 4 && \([\s\S]*?\}\)/g, '');
    
    content = content.replace(/<PrimaryButtonLight disabled=\{!cpf \|\| !sexo \|\| !endereco\} onClick=\{\(\) => setStep\(2\)\}>Continuar<\/PrimaryButtonLight>/g, '');
    content = content.replace(/<div style=\{\{ display: "flex", gap: 8 \}\}>\s*<button onClick=\{\(\) => setStep\(1\)\}[\s\S]*?<\/PrimaryButtonLight>\s*<\/div>/g, '');
    content = content.replace(/<div style=\{\{ display: "flex", gap: 8, marginTop: 16 \}\}>\s*<button onClick=\{\(\) => setStep\(2\)\}[\s\S]*?<\/PrimaryButtonLight>\s*<\/div>/g, '');

    const batch_schedule_ui = `
          <div style={{ background: "#EFF0F3", borderRadius: 16, padding: 16, marginTop: 16 }}>
            <p style={{ fontFamily: "DM Sans", fontSize: 13, fontWeight: 600, color: "#0B1B3E", marginBottom: 12 }}>
              Configuração em Lote (Geral)
            </p>
            <div style={{ display: "flex", gap: 8, alignItems: "flex-end" }}>
              <div style={{ flex: 1 }}>
                <span style={{ fontSize: 11, color: "#5B6178", marginBottom: 4, display: "block" }}>Início</span>
                <select value={horarioInicio} onChange={e => setHorarioInicio(e.target.value)} style={{ width: "100%", padding: 10, borderRadius: 8, border: "1px solid #D8DBE5", outline: "none", fontFamily: "DM Sans" }}>
                  {HORARIOS_PADRAO.map(h => <option key={\`in_\${h}\`} value={h}>{h}</option>)}
                </select>
              </div>
              <div style={{ flex: 1 }}>
                <span style={{ fontSize: 11, color: "#5B6178", marginBottom: 4, display: "block" }}>Fim</span>
                <select value={horarioFim} onChange={e => setHorarioFim(e.target.value)} style={{ width: "100%", padding: 10, borderRadius: 8, border: "1px solid #D8DBE5", outline: "none", fontFamily: "DM Sans" }}>
                  {HORARIOS_PADRAO.map(h => <option key={\`out_\${h}\`} value={h}>{h}</option>)}
                </select>
              </div>
              <button 
                onClick={() => {
                  const sIdx = HORARIOS_PADRAO.indexOf(horarioInicio);
                  const eIdx = HORARIOS_PADRAO.indexOf(horarioFim);
                  if (sIdx <= eIdx) {
                    const range = HORARIOS_PADRAO.slice(sIdx, eIdx + 1);
                    const newHorarios = { ...horariosPorDia };
                    DIAS.forEach(d => {
                      if (disponibilidade[d]) newHorarios[d] = range;
                    });
                    setHorariosPorDia(newHorarios);
                    alert("Horários aplicados aos dias selecionados!");
                  }
                }}
                style={{ background: "#0DB87E", color: "white", border: "none", borderRadius: 8, padding: "10px 16px", cursor: "pointer", fontFamily: "DM Sans", fontWeight: 600, height: 39 }}
              >
                Aplicar
              </button>
            </div>
            <p style={{ fontSize: 11, color: "#9399AD", marginTop: 8 }}>Aplica este intervalo a todos os dias selecionados acima.</p>
          </div>
`;
    content = content.replace('<div style={{ marginTop: 16 }}>', batch_schedule_ui + '\n          <div style={{ marginTop: 16 }}>');

    const save_btn = `
      <div style={{ position: "fixed", bottom: 0, left: 0, right: 0, padding: 24, background: "white", borderTop: "1px solid #E2E8F0", zIndex: 10 }}>
        <PrimaryButtonLight onClick={finalize} loading={submitting}>Salvar Configurações</PrimaryButtonLight>
      </div>
`;
    content = content.replace('    </div>\n  );\n};\n\nconst Row', save_btn + '    </div>\n  );\n};\n\nconst Row');
    
    return content;
  });
}

function rewriteAmbulante() {
  const filepath = "src/pages/AmbulantesOnboardingPage.tsx";
  replaceFileContent(filepath, (content) => {
    content = content.replace(/import Stepper from "@\/components\/prestador\/Stepper";/g, '');
    content = content.replace('const [step, setStep] = useState(1);', 'const [activeTab, setActiveTab] = useState("Dados");\n');
    
    const tabs_ui = `
      <div style={{ display: "flex", gap: 8, overflowX: "auto", paddingBottom: 16, marginBottom: 16, scrollbarWidth: "none" }}>
        {["Dados", "Cardápio"].map(t => (
          <button
            key={t}
            onClick={() => setActiveTab(t)}
            style={{
              padding: "10px 20px",
              borderRadius: 999,
              background: activeTab === t ? "#0B1B3E" : "#EFF0F3",
              color: activeTab === t ? "white" : "#5B6178",
              fontFamily: "DM Sans",
              fontWeight: 600,
              fontSize: 14,
              border: "none",
              cursor: "pointer",
              flexShrink: 0
            }}
          >
            {t}
          </button>
        ))}
      </div>
`;
    content = content.replace(
      /<Stepper steps=\{\["Dados", "Cardápio", "Revisão"\]\} current=\{step\} onStepClick=\{setStep\} \/>/g,
      tabs_ui
    );

    content = content.replace(/\{step === 1 && \(/g, '{activeTab === "Dados" && (');
    content = content.replace(/\{step === 2 && \(/g, '{activeTab === "Cardápio" && (');
    
    content = content.replace(/\{step === 3 && \([\s\S]*?\}\)/g, '');
    
    content = content.replace(/<div style=\{\{ marginTop: 32 \}\}>\s*<PrimaryButtonLight disabled=\{!canContinueStep1\} onClick=\{\(\) => setStep\(2\)\}>\s*Continuar\s*<\/PrimaryButtonLight>\s*<\/div>/g, '');
    content = content.replace(/<div style=\{\{ marginTop: 24 \}\}>\s*<PrimaryButtonLight disabled=\{!canContinueStep2\} onClick=\{\(\) => setStep\(3\)\}>[\s\S]*?<\/PrimaryButtonLight>\s*<\/div>/g, '');

    const save_btn = `
      <div style={{ position: "fixed", bottom: 0, left: 0, right: 0, padding: 24, background: "white", borderTop: "1px solid #E2E8F0", zIndex: 10 }}>
        <PrimaryButtonLight onClick={finalizar} loading={submitting} disabled={!canContinueStep1 || !canContinueStep2}>Salvar Configurações</PrimaryButtonLight>
      </div>
`;
    content = content.replace('      {/* Custom modal */}', save_btn + '\n      {/* Custom modal */}');
    return content;
  });
}

function rewriteMototaxi() {
  const filepath = "src/pages/PrestadorMototaxiOnboarding.tsx";
  replaceFileContent(filepath, (content) => {
    content = content.replace(/import Stepper from "@\/components\/prestador\/Stepper";/g, '');
    content = content.replace('const [step, setStep] = useState(1);', 'const [activeTab, setActiveTab] = useState("Pessoal");\n');
    
    const tabs_ui = `
      <div style={{ display: "flex", gap: 8, overflowX: "auto", paddingBottom: 16, marginBottom: 16, scrollbarWidth: "none" }}>
        {["Pessoal", "Veículo"].map(t => (
          <button
            key={t}
            onClick={() => setActiveTab(t)}
            style={{
              padding: "10px 20px",
              borderRadius: 999,
              background: activeTab === t ? "#0B1B3E" : "#EFF0F3",
              color: activeTab === t ? "white" : "#5B6178",
              fontFamily: "DM Sans",
              fontWeight: 600,
              fontSize: 14,
              border: "none",
              cursor: "pointer",
              flexShrink: 0
            }}
          >
            {t}
          </button>
        ))}
      </div>
`;
    content = content.replace(
      /<Stepper steps=\{\["Pessoal", "Veículo", "Revisão"\]\} current=\{step\} onStepClick=\{setStep\} \/>/g,
      tabs_ui
    );

    content = content.replace(/\{step === 1 && \(/g, '{activeTab === "Pessoal" && (');
    content = content.replace(/\{step === 2 && \(/g, '{activeTab === "Veículo" && (');
    
    content = content.replace(/\{step === 3 && \([\s\S]*?\}\)/g, '');
    
    content = content.replace(/<PrimaryButtonLight\s*disabled=\{!canContinue1\}\s*onClick=\{\(\) => setStep\(2\)\}\s*>\s*Continuar\s*<\/PrimaryButtonLight>/g, '');
    content = content.replace(/<div style=\{\{ display: "flex", gap: 8, marginTop: 16 \}\}>\s*<button onClick=\{\(\) => setStep\(1\)\}[\s\S]*?<\/PrimaryButtonLight>\s*<\/div>/g, '');

    const save_btn = `
      <div style={{ position: "fixed", bottom: 0, left: 0, right: 0, padding: 24, background: "white", borderTop: "1px solid #E2E8F0", zIndex: 10 }}>
        <PrimaryButtonLight onClick={finalize} loading={submitting} disabled={!canContinue1 || !canContinue2}>Salvar Configurações</PrimaryButtonLight>
      </div>
`;
    content = content.replace('    </div>\n  );\n};\n\nconst Row', save_btn + '    </div>\n  );\n};\n\nconst Row');
    return content;
  });
}

function rewriteCoco() {
  const filepath = "src/pages/CocoOnboardingPage.tsx";
  replaceFileContent(filepath, (content) => {
    content = content.replace(/import Stepper from "@\/components\/prestador\/Stepper";/g, '');
    content = content.replace('const [step, setStep] = useState(1);', 'const [activeTab, setActiveTab] = useState("Caminhão");\n');
    
    const tabs_ui = `
      <div style={{ display: "flex", gap: 8, overflowX: "auto", paddingBottom: 16, marginBottom: 16, scrollbarWidth: "none" }}>
        {["Caminhão"].map(t => (
          <button
            key={t}
            onClick={() => setActiveTab(t)}
            style={{
              padding: "10px 20px",
              borderRadius: 999,
              background: activeTab === t ? "#0B1B3E" : "#EFF0F3",
              color: activeTab === t ? "white" : "#5B6178",
              fontFamily: "DM Sans",
              fontWeight: 600,
              fontSize: 14,
              border: "none",
              cursor: "pointer",
              flexShrink: 0
            }}
          >
            {t}
          </button>
        ))}
      </div>
`;
    content = content.replace(
      /<Stepper steps=\{\["Caminhão", "Revisão"\]\} current=\{step\} onStepClick=\{setStep\} \/>/g,
      tabs_ui
    );

    content = content.replace(/\{step === 1 && \(/g, '{activeTab === "Caminhão" && (');
    content = content.replace(/\{step === 2 && \([\s\S]*?\}\)/g, '');
    content = content.replace(/<PrimaryButtonLight disabled=\{!canContinue\} onClick=\{\(\) => setStep\(2\)\}>\s*Continuar\s*<\/PrimaryButtonLight>/g, '');

    const save_btn = `
      <div style={{ position: "fixed", bottom: 0, left: 0, right: 0, padding: 24, background: "white", borderTop: "1px solid #E2E8F0", zIndex: 10 }}>
        <PrimaryButtonLight onClick={finalizar} loading={submitting} disabled={!canContinue}>Salvar Configurações</PrimaryButtonLight>
      </div>
`;
    content = content.replace('    </div>\n  );\n};\n\nconst Row', save_btn + '    </div>\n  );\n};\n\nconst Row');
    return content;
  });
}

try {
  rewriteDiarista();
  rewriteAmbulante();
  rewriteMototaxi();
  rewriteCoco();
  console.log("Done rewriting pages to use Tabs and Batch configuration.");
} catch (e) {
  console.error(e);
}
