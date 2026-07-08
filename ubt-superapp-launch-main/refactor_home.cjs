const fs = require('fs');

// 1. Fix white bar at the bottom in index.css
let css = fs.readFileSync('src/index.css', 'utf8');
if (!css.includes('body {\n  background-color: #0B1B3E;')) {
  css += '\nbody {\n  background-color: #0B1B3E;\n}\n';
  fs.writeFileSync('src/index.css', css, 'utf8');
}

// 2. Add "Pedidos Ativos" section in AppHome.tsx
let home = fs.readFileSync('src/pages/AppHome.tsx', 'utf8');

if (!home.includes('PEDIDOS EM ANDAMENTO')) {
  // Add clock icon import
  home = home.replace(
    'Recycle,\n  type LucideIcon,',
    'Recycle,\n  Clock,\n  ChevronRight,\n  type LucideIcon,'
  );

  // Add the section before the closing div
  const sectionStr = `
      {/* Pedidos em Andamento */}
      <section className="mt-8">
        <div className="flex items-center justify-between">
          <p
            className="font-sans text-[11px] font-semibold uppercase"
            style={{
              color: "rgba(255,255,255,0.40)",
              letterSpacing: "1.5px",
            }}
          >
            Pedidos em Andamento
          </p>
          <button style={{ background: "none", border: "none", color: "#0DB87E", fontSize: 12, fontFamily: "DM Sans", cursor: "pointer" }}>
            Ver todos
          </button>
        </div>
        
        <div className="mt-4 flex flex-col gap-3">
          {/* Mockup de Pedido - Isso valeria para qualquer categoria */}
          <div style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 16, padding: 16 }}>
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <div style={{ width: 28, height: 28, borderRadius: 8, background: "rgba(13,184,126,0.15)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <Sparkles size={14} color="#0DB87E" />
                </div>
                <span style={{ fontFamily: "Syne", fontSize: 14, fontWeight: 700, color: "white" }}>Diarista</span>
              </div>
              <span style={{ padding: "4px 8px", borderRadius: 999, background: "rgba(243,156,18,0.15)", color: "#F39C12", fontSize: 10, fontFamily: "DM Sans", fontWeight: 600 }}>Aguardando Confirmação</span>
            </div>
            
            <p style={{ fontFamily: "DM Sans", fontSize: 13, color: "rgba(255,255,255,0.6)", margin: "0 0 4px 0" }}>Maria Silva</p>
            <div className="flex items-center gap-2 mb-4">
              <Clock size={12} color="rgba(255,255,255,0.4)" />
              <span style={{ fontFamily: "DM Sans", fontSize: 12, color: "rgba(255,255,255,0.4)" }}>Qua, 20/05 às 08:00</span>
            </div>

            <button style={{ width: "100%", height: 36, borderRadius: 8, background: "rgba(255,255,255,0.05)", border: "none", color: "white", fontFamily: "DM Sans", fontSize: 13, fontWeight: 600, display: "flex", alignItems: "center", justifyContent: "center", gap: 6, cursor: "pointer" }}>
              Acompanhar Pedido <ChevronRight size={14} color="rgba(255,255,255,0.4)" />
            </button>
          </div>
        </div>
      </section>
`;

  home = home.replace('    </div>\n  );\n};', sectionStr + '    </div>\n  );\n};');
  fs.writeFileSync('src/pages/AppHome.tsx', home, 'utf8');
}

console.log("Updated AppHome and index.css");
