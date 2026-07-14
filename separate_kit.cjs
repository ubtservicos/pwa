const fs = require('fs');

let content = fs.readFileSync('src/pages/DiaristaOnboardingPage.tsx', 'utf8');

// 1. Add "Kit Produtos" to tabs array
content = content.replace('["Dados", "Preços", "Agenda"]', '["Dados", "Preços", "Kit Produtos", "Agenda"]');

// 2. Extract the Kit de Produtos block
const startStr = '          {materiaisSel.includes("produtos") && (';
const startIdx = content.indexOf(startStr);

if (startIdx === -1) {
  console.log("Could not find start");
  process.exit(1);
}

// Find the matching end for this block.
// It ends with `            </div>\n          )}\n` right before `{showAddMaterial && (`
const endStr = '          {showAddMaterial && (';
const endIdx = content.indexOf(endStr, startIdx);

if (endIdx === -1) {
  console.log("Could not find end");
  process.exit(1);
}

const kitBlockWithOuterCondition = content.substring(startIdx, endIdx);

// Remove from old location
content = content.slice(0, startIdx) + content.slice(endIdx);

// We want to remove the `{materiaisSel.includes("produtos") && (` and the trailing `)}\n`
let innerDiv = kitBlockWithOuterCondition.replace('          {materiaisSel.includes("produtos") && (\n', '');
// trim the last `          )}\n`
innerDiv = innerDiv.replace(/\s*\)\}\s*$/, '');

const newTab = `
      {activeTab === "Kit Produtos" && (
        <div style={{ marginTop: 28, display: "flex", flexDirection: "column", gap: 16 }}>
          <h2 style={{ fontFamily: "Syne", fontSize: 18, fontWeight: 700, color: "#0B1B3E", margin: 0 }}>Kit de Produtos</h2>
          {!materiaisSel.includes("produtos") ? (
             <div style={{ textAlign: "center", padding: "40px 20px", background: "white", borderRadius: 12, border: "1px dashed #D8DBE5" }}>
               <p style={{ fontFamily: "DM Sans", fontSize: 14, color: "#5B6178", marginBottom: 16 }}>Você não marcou "Produtos de limpeza" na aba de Preços.</p>
               <button onClick={() => setActiveTab("Preços")} style={{ background: "#EFF0F3", color: "#0B1B3E", padding: "10px 16px", borderRadius: 999, border: "none", fontWeight: 600, fontFamily: "DM Sans", cursor: "pointer" }}>Voltar para Preços</button>
             </div>
          ) : (
${innerDiv}
          )}
        </div>
      )}
`;

content = content.replace('{activeTab === "Agenda" && (', newTab + '\n      {activeTab === "Agenda" && (');

fs.writeFileSync('src/pages/DiaristaOnboardingPage.tsx', content, 'utf8');
console.log("Separated Kit Produtos successfully!");
