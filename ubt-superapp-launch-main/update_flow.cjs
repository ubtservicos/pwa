const fs = require('fs');

function updatePage(filename) {
  let content = fs.readFileSync(filename, 'utf8');

  // Inject Supabase and hooks if missing
  if (!content.includes('import { supabase }')) {
    content = content.replace(
      'import { useNavigate, useParams } from "react-router-dom";',
      'import { useNavigate, useParams } from "react-router-dom";\nimport { supabase } from "@/lib/supabase";\nimport { useEffect } from "react";'
    );
  }

  // Find where diarista is initialized from mock
  const initRegex = /const diarista = MOCK_DIARISTAS\.find\(\(d\) => d\.uid === prestadorId\);/;
  
  if (content.match(initRegex)) {
    const newInit = `const [diarista, setDiarista] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      if (!prestadorId) return;
      const { data } = await supabase.from('diarista_perfis').select('*').eq('user_id', prestadorId).maybeSingle();
      if (data) {
        setDiarista({
          uid: data.user_id,
          nome: data.nome || "Diarista",
          sexo: data.sexo,
          valorPorM2: Number(data.valor_por_m2),
          minimoM2: Number(data.minimo_m2),
          rating: Number(data.rating) || 5,
          totalServicos: Number(data.total_servicos) || 0,
          bairro: data.endereco || "Centro",
          location: { lat: -23.432, lng: -45.083 },
          materiais: data.materiais || [],
          disponibilidade: data.disponibilidade || {},
          horarios_por_dia: data.horarios_por_dia || {},
          horarios: data.horarios_por_dia ? Object.values(data.horarios_por_dia)[0] : []
        });
      }
      setLoading(false);
    }
    load();
  }, [prestadorId]);

  if (loading) return <div style={{ padding: 24, color: "white", background: "#0B1B3E", minHeight: "100svh" }}>Carregando...</div>;`;
    
    content = content.replace(initRegex, newInit);
  }

  fs.writeFileSync(filename, content, 'utf8');
}

updatePage('src/pages/DiaristaPerfilPage.tsx');
updatePage('src/pages/DiaristaAgendarPage.tsx');

console.log("Updated flow pages to use Supabase");
