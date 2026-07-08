const fs = require('fs');

let content = fs.readFileSync('src/pages/DiaristaOnboardingPage.tsx', 'utf8');

// 1. Add Ubatuba Neighborhoods constant at the top
const bairrosConst = `
const BAIRROS_UBATUBA = [
  "Centro", "Itaguá", "Tenório", "Praia Grande", "Toninhas", "Enseada", 
  "Perequê-Mirim", "Lázaro", "Domingas Dias", "Maranduba", "Lagoinha", 
  "Praia Dura", "Estufa I", "Estufa II", "Ipiranguinha", "Perequê-Açu", 
  "Taquaral", "Sumidouro", "Itamambuca", "Félix", "Prumirim", "Ubatumirim", "Picinguaba"
].sort();
`;
content = content.replace('const DIAS = ', bairrosConst + '\nconst DIAS = ');

// 2. Change endereco state to bairros (array) and add showBairrosModal state
content = content.replace(
  'const [endereco, setEndereco] = useState("");',
  'const [bairros, setBairros] = useState<string[]>([]);\n  const [showBairrosModal, setShowBairrosModal] = useState(false);'
);

// 3. Update loadMateriais to also load the profile (fetchPerfil)
const loadPerfilCode = `
      // Carregar perfil existente
      if (user.uid) {
        const { data: perfil } = await supabase.from('diarista_perfis').select('*').eq('prestador_id', user.uid).single();
        if (perfil) {
          if (perfil.cpf) setCpf(perfil.cpf);
          if (perfil.sexo) setSexo(perfil.sexo);
          if (perfil.endereco) setBairros(perfil.endereco.split(', ').filter(Boolean));
          if (perfil.valor_por_m2) setValorPorM2(String(perfil.valor_por_m2));
          if (perfil.minimo_m2) setMinimoM2(String(perfil.minimo_m2));
          if (perfil.materiais) setMateriaisSel(perfil.materiais);
          if (perfil.materiais_custom) setMateriaisCustom(perfil.materiais_custom);
          if (perfil.disponibilidade) setDisponibilidade(perfil.disponibilidade);
          if (perfil.horarios_por_dia) setHorariosPorDia(perfil.horarios_por_dia);
          
          if (perfil.materiais_detalhes && resMateriais.data && !resMateriais.error) {
            // Merge loaded details with standard
            const savedDetails = perfil.materiais_detalhes;
            setMateriaisDetalhes(
              resMateriais.data.map((m: any) => {
                const saved = savedDetails.find((x: any) => x.id === m.id);
                return {
                  id: m.id,
                  nome: m.nome,
                  emoji: m.emoji,
                  categoria: m.categoria,
                  ativo: saved ? saved.ativo : true,
                  precoEditado: saved ? saved.precoEditado : Number(m.preco_medio),
                  precoMedioMercado: medias[m.id] || Number(m.preco_medio)
                };
              })
            );
            setLoadingMateriais(false);
            return; // Skip the default map below
          }
        }
      }
`;
content = content.replace('const medias: Record<string, number> = {};', 'const medias: Record<string, number> = {};\n' + loadPerfilCode);

// 4. Update finalize payload to use bairros.join(', ') and add onConflict
content = content.replace('endereco,', 'endereco: bairros.join(", "),');
content = content.replace(
  'const { error } = await supabase.from(\'diarista_perfis\').upsert({',
  'const { error } = await supabase.from(\'diarista_perfis\').upsert({\n          prestador_id: user.uid,'
);
// remove duplicate prestador_id if any (I'll just replace the upsert call)
content = content.replace(/const \{ error \} = await supabase\.from\('diarista_perfis'\)\.upsert\(\{[\s\S]*?horarios_por_dia: horariosPorDia\n\s*\}\);/, 
  `const { error } = await supabase.from('diarista_perfis').upsert({
          prestador_id: user.uid,
          cpf,
          sexo,
          endereco: bairros.join(", "),
          valor_por_m2: +valorPorM2,
          minimo_m2: +minimoM2,
          materiais: materiaisSel,
          materiais_custom: materiaisCustom,
          materiais_detalhes: materiaisDetalhes,
          disponibilidade,
          horarios_por_dia: horariosPorDia
        }, { onConflict: 'prestador_id' });`
);

// 5. Replace address input with Bairros selector
const bairrosUI = `
          <div>
            <p style={{ fontFamily: "DM Sans", fontSize: 13, fontWeight: 600, color: "#5B6178", marginBottom: 10 }}>Bairros de Atuação</p>
            <div 
              onClick={() => setShowBairrosModal(true)}
              style={{ width: "100%", background: "white", border: "1px solid #D8DBE5", borderRadius: 12, minHeight: 48, padding: "12px 14px", cursor: "pointer", display: "flex", alignItems: "center" }}
            >
              <MapPin size={18} color="#9399AD" style={{ marginRight: 10 }} />
              <span style={{ fontFamily: "DM Sans", fontSize: 14, color: bairros.length > 0 ? "#0B1B3E" : "#9399AD", flex: 1 }}>
                {bairros.length > 0 ? bairros.join(", ") : "Selecione os bairros..."}
              </span>
            </div>
          </div>
`;
content = content.replace('<FormFieldLight label="Endereço de base (bairro de atuação)" icon={MapPin} value={endereco} onChange={(e) => setEndereco(e.target.value)} placeholder="Centro, Ubatuba" />', bairrosUI);

// 6. Add Bairros Modal
const bairrosModal = `
      {showBairrosModal && (
        <div style={{ position: "fixed", inset: 0, zIndex: 100, display: "flex", flexDirection: "column" }}>
          <div onClick={() => setShowBairrosModal(false)} style={{ position: "absolute", inset: 0, background: "rgba(11,27,62,0.5)" }} />
          <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, background: "white", borderRadius: "20px 20px 0 0", display: "flex", flexDirection: "column", maxHeight: "80vh" }}>
            <div style={{ padding: "20px 24px", borderBottom: "1px solid #E2E8F0", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <h3 style={{ fontFamily: "Syne", fontSize: 18, fontWeight: 700, color: "#0B1B3E", margin: 0 }}>Selecione os Bairros</h3>
              <button onClick={() => setShowBairrosModal(false)} style={{ background: "none", border: "none", fontFamily: "DM Sans", fontSize: 14, fontWeight: 600, color: "#0DB87E", cursor: "pointer" }}>Pronto</button>
            </div>
            <div style={{ padding: "20px 24px", overflowY: "auto", display: "flex", flexDirection: "column", gap: 12 }}>
              {BAIRROS_UBATUBA.map(b => {
                const sel = bairros.includes(b);
                return (
                  <label key={b} style={{ display: "flex", alignItems: "center", gap: 12, cursor: "pointer" }}>
                    <div style={{ width: 22, height: 22, borderRadius: 6, border: \`2px solid \${sel ? "#0DB87E" : "#D8DBE5"}\`, background: sel ? "#0DB87E" : "white", display: "flex", alignItems: "center", justifyContent: "center" }}>
                      {sel && <Check size={14} color="white" />}
                    </div>
                    <span style={{ fontFamily: "DM Sans", fontSize: 15, color: "#0B1B3E" }}>{b}</span>
                    <input type="checkbox" checked={sel} onChange={() => setBairros(p => sel ? p.filter(x => x !== b) : [...p, b])} style={{ display: "none" }} />
                  </label>
                );
              })}
            </div>
          </div>
        </div>
      )}
`;

// Insert the modal before the closing </div> of the component
content = content.replace('    </div>\n  );\n};\n\nexport default DiaristaOnboardingPage;', bairrosModal + '    </div>\n  );\n};\n\nexport default DiaristaOnboardingPage;');

// 7. Update Footer Buttons
const TABS = ["Dados", "Preços", "Kit Produtos", "Agenda"];
const footerButtons = `
      <div style={{ position: "fixed", bottom: 64, left: 0, right: 0, padding: 24, background: "white", borderTop: "1px solid #E2E8F0", zIndex: 10, display: "flex", gap: 12 }}>
        {activeTab !== "Agenda" && (
          <button 
            onClick={() => {
              const tabs = ["Dados", "Preços", "Kit Produtos", "Agenda"];
              setActiveTab(tabs[tabs.indexOf(activeTab) + 1]);
            }} 
            style={{ flex: 1, padding: "14px", borderRadius: 12, border: "2px solid #0DB87E", background: "white", color: "#0DB87E", fontFamily: "DM Sans", fontSize: 15, fontWeight: 600, cursor: "pointer" }}
          >
            Continuar
          </button>
        )}
        <PrimaryButtonLight onClick={finalize} loading={submitting} style={{ flex: activeTab === "Agenda" ? 1 : 1.5 }}>
          Salvar e sair
        </PrimaryButtonLight>
      </div>
`;
content = content.replace(
  /<div style=\{\{\s*position: "fixed",\s*bottom: 64,[\s\S]*?<\/div>/m,
  footerButtons
);

fs.writeFileSync('src/pages/DiaristaOnboardingPage.tsx', content, 'utf8');
console.log("Refactoring complete");
