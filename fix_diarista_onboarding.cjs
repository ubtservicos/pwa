const fs = require('fs');

let content = fs.readFileSync('src/pages/DiaristaOnboardingPage.tsx', 'utf8');

// 1. Fix loadMateriais: move the `resMedias` block above the `if (user.uid)` block
const badMediasBlock = `
      if (resMedias.data) {
        resMedias.data.forEach((m: any) => {
          medias[m.material_id] = Number(m.preco_medio);
        });
        setMediasMercado(medias);
      }
`;
// remove it from its current position
content = content.replace(badMediasBlock, '');

// insert it right after `const medias: Record<string, number> = {};`
const mediasInit = `const medias: Record<string, number> = {};`;
content = content.replace(mediasInit, mediasInit + '\n' + badMediasBlock);


// 2. Remove "Materiais que você traz" UI and update Calculator
const targetUIRegex = /<div>\s*<p style=\{\{\s*fontFamily: "DM Sans", fontSize: 13, fontWeight: 600, color: "#5B6178", marginBottom: 10, marginTop: 8\s*\}\}>Materiais que você traz<\/p>[\s\S]*?\{\s*showAddMaterial && \([\s\S]*?\}\s*\)\s*\}/;

const newCalc = `
          <div style={{ background: "#EFF0F3", borderRadius: 12, padding: 18, marginTop: 8 }}>
            <p style={{ fontFamily: "DM Sans", fontSize: 14, fontWeight: 600, color: "#0B1B3E", margin: "0 0 4px 0" }}>Teste seus preços!</p>
            <p style={{ fontFamily: "DM Sans", fontSize: 12, color: "#5B6178", margin: "0 0 12px 0" }}>Use nossa calculadora rápida para ver quanto você receberia por uma faxina. Digite o tamanho de uma casa (ex: 80) e veja o valor final.</p>
            
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <input 
                type="number" 
                value={calcM2} 
                onChange={(e) => setCalcM2(e.target.value)} 
                placeholder="m²" 
                style={{ width: 80, textAlign: "center", padding: "10px", borderRadius: 8, border: "1px solid #D8DBE5", background: "white", fontFamily: "DM Sans", fontSize: 15, outline: "none" }} 
              />
              <span style={{ fontFamily: "DM Sans", fontSize: 14, color: "#5B6178" }}>x R$ {valorPorM2} =</span>
              {calcM2 && (
                <span style={{ fontFamily: "Syne", fontSize: 18, fontWeight: 700, color: "#0DB87E" }}>
                  R$ {(+calcM2 * +valorPorM2).toFixed(2)}
                </span>
              )}
            </div>
          </div>
`;

content = content.replace(targetUIRegex, newCalc);

// we have two calculators now since I replaced the target area with newCalc but the old calculator might still be there!
// Let's remove the old calculator too.
const oldCalcRegex = /<div style=\{\{\s*background: "#EFF0F3", borderRadius: 12, padding: 14, marginTop: 8\s*\}\}>[\s\S]*?<\/div>\s*<\/div>\s*<\/div>\s*\)\}/;
// the original calculator has `</div` for the calc, then `</div` for the prices tab container, then `)}` for the activeTab check.
// Wait, safer to just replace the whole "Como você cobra?" section inside `activeTab === "Preços"`
const fullPrecosRegex = /\{activeTab === "Preços" && \([\s\S]*?\}\s*\)\s*\}/;

const fullPrecosReplacement = `{activeTab === "Preços" && (
        <div style={{ marginTop: 28, display: "flex", flexDirection: "column", gap: 16 }}>
          <h2 style={{ fontFamily: "Syne", fontSize: 18, fontWeight: 700, color: "#0B1B3E", margin: 0 }}>Como você cobra?</h2>
          <FormFieldLight label="R$ por m²" icon={DollarSign} type="number" step="0.01" value={valorPorM2} onChange={(e) => setValorPorM2(e.target.value)} placeholder="0.35" />
          <p style={{ fontFamily: "DM Sans", fontSize: 11, color: "#9399AD", marginTop: -8 }}>Ex: 0,35 = R$ 35,00 para 100m²</p>
          <FormFieldLight label="Área mínima (m²)" icon={Ruler} type="number" value={minimoM2} onChange={(e) => setMinimoM2(e.target.value)} placeholder="40" />

          <div style={{ background: "#EFF0F3", borderRadius: 12, padding: 18, marginTop: 12 }}>
            <p style={{ fontFamily: "DM Sans", fontSize: 14, fontWeight: 600, color: "#0B1B3E", margin: "0 0 4px 0" }}>Teste seus preços!</p>
            <p style={{ fontFamily: "DM Sans", fontSize: 12, color: "#5B6178", margin: "0 0 12px 0" }}>Use nossa calculadora rápida para ver quanto você receberia por uma faxina. Digite o tamanho de uma casa (ex: 80) e veja o valor.</p>
            
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <input 
                type="number" 
                value={calcM2} 
                onChange={(e) => setCalcM2(e.target.value)} 
                placeholder="m²" 
                style={{ width: 80, textAlign: "center", padding: "10px", borderRadius: 8, border: "1px solid #D8DBE5", background: "white", fontFamily: "DM Sans", fontSize: 15, outline: "none" }} 
              />
              <span style={{ fontFamily: "DM Sans", fontSize: 14, color: "#5B6178" }}>x R$ {valorPorM2} =</span>
              {calcM2 ? (
                <span style={{ fontFamily: "Syne", fontSize: 18, fontWeight: 700, color: "#0DB87E" }}>
                  R$ {(+calcM2 * +valorPorM2).toFixed(2)}
                </span>
              ) : (
                <span style={{ fontFamily: "Syne", fontSize: 18, fontWeight: 700, color: "#9399AD" }}>
                  R$ 0,00
                </span>
              )}
            </div>
          </div>
        </div>
      )}`;

content = content.replace(fullPrecosRegex, fullPrecosReplacement);

fs.writeFileSync('src/pages/DiaristaOnboardingPage.tsx', content, 'utf8');
console.log("Fix complete");
