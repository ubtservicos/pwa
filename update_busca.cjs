const fs = require('fs');

let content = fs.readFileSync('src/pages/DiaristasBuscaPage.tsx', 'utf8');

// Imports
if (!content.includes('supabase')) {
  content = content.replace(
    'import { MOCK_DIARISTAS } from "@/mocks/diaristasMock";',
    'import { MOCK_DIARISTAS } from "@/mocks/diaristasMock";\nimport { supabase } from "@/lib/supabase";\nimport { useEffect } from "react";\nimport { useCurrentUser } from "@/hooks/useCurrentUser";\nimport { Switch } from "@/components/ui/switch"; // Assuming a switch component exists or we can just use a custom toggle'
  );
}

// Filters
content = content.replace(
  '{ key: "feminino", label: "👩 Só mulheres" },\n',
  ''
);

// Component
const componentRegex = /const DiaristasBuscaPage = \(\) => \{([\s\S]*?)const filtered = useMemo/;
const newComponent = `const DiaristasBuscaPage = () => {
  const navigate = useNavigate();
  const user = useCurrentUser();
  const [filtro, setFiltro] = useState<Filtro>("todas");
  const [busca, setBusca] = useState("");
  const [diaristas, setDiaristas] = useState<any[]>([]);
  const [soMulheres, setSoMulheres] = useState(false);
  const [mockSexoFeminino, setMockSexoFeminino] = useState(false); // Para testes

  useEffect(() => {
    async function load() {
      const { data } = await supabase.from('diarista_perfis').select('*');
      if (data) {
        // Map data to match mock format roughly
        const formatted = data.map(d => ({
          uid: d.user_id,
          nome: d.nome || "Diarista",
          sexo: d.sexo,
          valorPorM2: Number(d.valor_por_m2),
          minimoM2: Number(d.minimo_m2),
          rating: Number(d.rating) || 5,
          totalServicos: Number(d.total_servicos) || 0,
          bairro: d.endereco || "Centro",
          location: { lat: -23.432, lng: -45.083 }, // Mock location for dist
          materiais: d.materiais || [],
          disponibilidade: d.disponibilidade || {},
          horarios: d.horarios_por_dia ? Object.values(d.horarios_por_dia)[0] : []
        }));
        setDiaristas(formatted);
      }
    }
    load();
  }, []);

  const isMulher = user?.sexo === "feminino" || mockSexoFeminino;

  const filtered = useMemo`;

content = content.replace(componentRegex, newComponent);

// Filter logic
content = content.replace(
  'return MOCK_DIARISTAS.filter((d) => {',
  'return diaristas.filter((d) => {\n      if (soMulheres && d.sexo !== "feminino") return false;'
);
content = content.replace(
  'if (filtro === "feminino" && d.sexo !== "feminino") return false;\n',
  ''
);

// Toggle UI
const toggleUI = `
      {isMulher && (
        <div style={{ padding: "14px 24px 0", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ fontSize: 20 }}>👩</span>
            <span style={{ fontFamily: "DM Sans", fontSize: 15, fontWeight: 600, color: "white" }}>Mostrar só mulheres</span>
          </div>
          <div 
            onClick={() => setSoMulheres(!soMulheres)}
            style={{ width: 44, height: 24, borderRadius: 12, background: soMulheres ? "#0DB87E" : "rgba(255,255,255,0.2)", position: "relative", cursor: "pointer", transition: "0.2s" }}
          >
            <div style={{ width: 20, height: 20, borderRadius: 10, background: "white", position: "absolute", top: 2, left: soMulheres ? 22 : 2, transition: "0.2s" }} />
          </div>
        </div>
      )}

      {/* Botão de DEBUG para simular o sexo do Tomador */}
      <div style={{ padding: "0 24px", marginTop: 12 }}>
        <button onClick={() => setMockSexoFeminino(!mockSexoFeminino)} style={{ background: "rgba(255,255,255,0.1)", border: "none", color: "white", padding: "4px 8px", borderRadius: 4, fontSize: 10 }}>
          [DEBUG] Simular Tomador: {isMulher ? "Mulher" : "Homem"}
        </button>
      </div>
`;
content = content.replace(
  '<div style={{ margin: "10px 24px 0"',
  toggleUI + '\n      <div style={{ margin: "10px 24px 0"'
);

fs.writeFileSync('src/pages/DiaristasBuscaPage.tsx', content, 'utf8');
console.log("Updated DiaristasBuscaPage");
