const fs = require('fs');

// 1. CSS Global margin-bottom
let css = fs.readFileSync('src/index.css', 'utf8');
if (!css.includes('margin-bottom: 80px !important;')) {
  css = css.replace(/body\s*\{[^}]+\}/, match => {
    return match.replace('}', '  margin-bottom: 80px !important;\n}');
  });
  fs.writeFileSync('src/index.css', css, 'utf8');
}

// 2. AdminDiaristasPage.tsx
let admin = fs.readFileSync('src/pages/admin/AdminDiaristasPage.tsx', 'utf8');
admin = admin.replace(
  '<Pill bg="#F1F5F9" color="#475569" size="sm" style={{ textTransform: "capitalize" }}>{m.categoria}</Pill>',
  '<Pill bg="#F1F5F9" color="#475569" size="sm"><span style={{ textTransform: "capitalize" }}>{m.categoria}</span></Pill>'
);
fs.writeFileSync('src/pages/admin/AdminDiaristasPage.tsx', admin, 'utf8');

// 3. AmbulantesOnboardingPage.tsx
let amb = fs.readFileSync('src/pages/AmbulantesOnboardingPage.tsx', 'utf8');
amb = amb.replace(
  'onClick={() => (step > 1 ? setStep((s) => s - 1) : navigate(-1))}',
  'onClick={() => navigate(-1)}'
);
fs.writeFileSync('src/pages/AmbulantesOnboardingPage.tsx', amb, 'utf8');

// 4. PrestadorMototaxiOnboarding.tsx
let moto = fs.readFileSync('src/pages/PrestadorMototaxiOnboarding.tsx', 'utf8');
moto = moto.replace(/<Stepper steps=\{STEPS\} current=\{step\} onStepClick=\{setStep\} \/>/, `
      <div style={{ display: "flex", gap: 8, overflowX: "auto", paddingBottom: 16, marginBottom: 16, scrollbarWidth: "none" }}>
        {["Pessoal", "Veículo", "Modo"].map(t => (
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
`);
moto = moto.replace(/<PrimaryButtonLight disabled=\{!canStep1\} onClick=\{\(\) => setStep\(2\)\} className="mt-2">\s*Continuar\s*<\/PrimaryButtonLight>/g, '');
moto = moto.replace(/<PrimaryButtonLight disabled=\{!canStep2\} onClick=\{\(\) => setStep\(3\)\} className="mt-3">\s*Continuar\s*<\/PrimaryButtonLight>/g, '');
fs.writeFileSync('src/pages/PrestadorMototaxiOnboarding.tsx', moto, 'utf8');

// 5. CocoOnboardingPage.tsx (proactive fix)
let coco = fs.readFileSync('src/pages/CocoOnboardingPage.tsx', 'utf8');
coco = coco.replace(
  'onClick={() => (step > 1 ? setStep((s) => s - 1) : navigate(-1))}',
  'onClick={() => navigate(-1)}'
);
fs.writeFileSync('src/pages/CocoOnboardingPage.tsx', coco, 'utf8');

console.log('Fixes applied successfully!');
