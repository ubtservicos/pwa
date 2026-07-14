const fs = require('fs');
const path = require('path');

function replaceFileContent(filePath, replacer) {
  const fullPath = path.resolve(__dirname, filePath);
  let content = fs.readFileSync(fullPath, 'utf8');
  content = replacer(content);
  fs.writeFileSync(fullPath, content);
  console.log(`Updated ${filePath}`);
}

// 1. AmbulantesDiscoveryPage.tsx
replaceFileContent('src/pages/AmbulantesDiscoveryPage.tsx', (content) => {
  content = content.replace(/import \{ db \} from "@\/lib\/firebase";\nimport \{ onValue, ref \} from "firebase\/database";/g, 'import { supabase } from "@/lib/supabase";');
  
  content = content.replace(/const sessionsToUse = realSessions\.length > 0 \? realSessions\.filter\(s => s\.isOnline\) : MOCK_FALLBACK_SESSIONS;/g, 'const sessionsToUse = realSessions;');
  
  content = content.replace(/useEffect\(\(\) => \{\n    if \(!db\) return;\n    const r = ref\(db, "ambulante_sessions"\);\n    const off = onValue\(r, \(snap\) => \{[\s\S]*?\}\);\n    return \(\) => off\(\);\n  \}, \[\]\);/g, `useEffect(() => {
    async function loadSessions() {
      const { data, error } = await supabase
        .from('ambulante_sessions')
        .select(\`
          id, modalidade, lat, lng, is_online, rating, total_pedidos,
          usuarios ( nome ),
          ambulante_session_produtos (
            preco, disponivel,
            produtos ( id, nome, emoji, descricao, categoria )
          )
        \`)
        .eq('is_online', true);

      if (error || !data) {
        setRealSessions([]);
        return;
      }

      const arr = data.map((s: any) => {
        const produtosData: Record<string, any> = {};
        if (s.ambulante_session_produtos) {
          s.ambulante_session_produtos.forEach((sp: any) => {
            if (sp.disponivel && sp.produtos) {
              produtosData[sp.produtos.id] = {
                nome: sp.produtos.nome,
                emoji: sp.produtos.emoji,
                preco: sp.preco || sp.produtos.preco,
                descricao: sp.produtos.descricao,
                disponivel: true,
                categoria: sp.produtos.categoria
              };
            }
          });
        }
        return {
          sessionId: s.id,
          prestadorId: s.id,
          nome: s.usuarios?.nome || "Ambulante",
          modalidade: s.modalidade || "local_fixo",
          location: { lat: s.lat, lng: s.lng },
          isOnline: s.is_online,
          produtos: produtosData,
          rating: s.rating,
          totalPedidos: s.total_pedidos
        };
      });
      setRealSessions(arr);
    }
    loadSessions();

    const channel = supabase
      .channel('public:ambulante_sessions')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'ambulante_sessions' }, () => {
        loadSessions();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);`);

  return content;
});

// 2. AmbulanteCatalogPage.tsx
replaceFileContent('src/pages/AmbulanteCatalogPage.tsx', (content) => {
  content = content.replace(/import \{ db \} from "@\/lib\/firebase";\nimport \{ ref, onValue \} from "firebase\/database";/g, 'import { supabase } from "@/lib/supabase";');
  
  content = content.replace(/useEffect\(\(\) => \{\n    if \(!sessionId\) return;\n    const mock = \[\.\.\.MOCK_SESSIONS, \.\.\.MOCK_FALLBACK_SESSIONS\]\.find\(\(s\) => s\.sessionId === sessionId\);\n    if \(mock\) \{\n      setSessionData\(mock\);\n      setLoading\(false\);\n      return;\n    \}\n\n    if \(!db\) return;\n    const r = ref\(db, `ambulante_sessions\/\$\{sessionId\}`\);\n    const off = onValue\(r, \(snap\) => \{[\s\S]*?\}\);\n    return \(\) => off\(\);\n  \}, \[sessionId\]\);/g, `useEffect(() => {
    if (!sessionId) return;
    async function load() {
      const { data, error } = await supabase
        .from('ambulante_sessions')
        .select(\`
          id, modalidade, lat, lng, is_online, rating, total_pedidos,
          usuarios ( nome ),
          ambulante_session_produtos (
            preco, disponivel,
            produtos ( id, nome, emoji, descricao, categoria )
          )
        \`)
        .eq('id', sessionId)
        .single();
        
      if (error || !data) {
        setSessionData(null);
        setLoading(false);
        return;
      }
      
      const produtosData: Record<string, any> = {};
      if (data.ambulante_session_produtos) {
        data.ambulante_session_produtos.forEach((sp: any) => {
          if (sp.disponivel && sp.produtos) {
            produtosData[sp.produtos.id] = {
              nome: sp.produtos.nome,
              emoji: sp.produtos.emoji,
              preco: sp.preco || sp.produtos.preco,
              descricao: sp.produtos.descricao,
              disponivel: true,
              categoria: sp.produtos.categoria
            };
          }
        });
      }
      
      setSessionData({
        sessionId: data.id,
        nome: data.usuarios?.nome || "Ambulante",
        modalidade: data.modalidade || "local_fixo",
        location: { lat: data.lat, lng: data.lng },
        produtos: produtosData,
        rating: data.rating,
        totalPedidos: data.total_pedidos
      });
      setLoading(false);
    }
    load();
    
    const channel = supabase
      .channel('public:ambulante_sessions:'+sessionId)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'ambulante_sessions', filter: \`id=eq.\${sessionId}\` }, () => {
        load();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [sessionId]);`);
  
  return content;
});

// 3. AmbulanteCarrinhoPage.tsx
replaceFileContent('src/pages/AmbulanteCarrinhoPage.tsx', (content) => {
  content = content.replace(/import \{ db \} from "@\/lib\/firebase";\nimport \{ push, ref, set, onValue \} from "firebase\/database";/g, 'import { supabase } from "@/lib/supabase";');

  content = content.replace(/useEffect\(\(\) => \{\n    if \(!state\.sessionId\) return;\n    \n    const mock = \[\.\.\.MOCK_SESSIONS, \.\.\.MOCK_FALLBACK_SESSIONS\]\.find\(\(s\) => s\.sessionId === state\.sessionId\);\n    if \(mock\) \{\n      setSessionData\(mock\);\n      return;\n    \}\n\n    if \(!db\) return;\n    const off = onValue\(ref\(db, `ambulante_sessions\/\$\{state\.sessionId\}`\), \(snap\) => \{[\s\S]*?\}\);\n    return \(\) => off\(\);\n  \}, \[state\.sessionId\]\);/g, `useEffect(() => {
    if (!state.sessionId) return;
    async function load() {
      const { data, error } = await supabase
        .from('ambulante_sessions')
        .select('id, modalidade, lat, lng, usuarios(nome)')
        .eq('id', state.sessionId)
        .single();
      if (data) {
        setSessionData({
          sessionId: data.id,
          prestadorId: data.id,
          nome: data.usuarios?.nome || "Ambulante",
          modalidade: data.modalidade || "local_fixo",
          location: { lat: data.lat, lng: data.lng },
        });
      }
    }
    load();
  }, [state.sessionId]);`);

  content = content.replace(/const payload = \{[\s\S]*?messages: \[\],\n    \};/g, `const { data: dbData, error } = await supabase.from('pedidos').insert({
      tomador_id: user.uid === 'guest' ? null : user.uid,
      prestador_id: null, // we will need to fetch prestador_id, for now session_id is more important
      session_id: session.sessionId,
      status: "pending",
      modalidade,
      total,
      delivery_lat: coords?.lat,
      delivery_lng: coords?.lng,
      delivery_address: endereco,
      delivery_referencia: referencia,
    }).select().single();
    
    if (dbData) {
      const itensPayload = state.itens.map(i => ({
        pedido_id: dbData.id,
        produto_id: i.prodId.length === 36 ? i.prodId : null, // only valid UUIDs
        nome: i.nome,
        emoji: i.emoji,
        qty: i.qty,
        preco_unit: i.precoUnit,
        subtotal: i.subtotal
      }));
      await supabase.from('pedido_itens').insert(itensPayload);
    }`);

  content = content.replace(/let pedidoId = `local-\$\{Date\.now\(\)\}`;[\s\S]*?setState\(\{ pedidoId, modalidade, status: "pending" \}\);\n    navigate\(`\/app\/ambulantes\/pedido\/\$\{pedidoId\}`\);/g, `if (dbData) {
      setState({ pedidoId: dbData.id, modalidade, status: "pending" });
      navigate(\`/app/ambulantes/pedido/\${dbData.id}\`);
    } else {
      setSubmitting(false);
      alert("Erro ao criar pedido!");
    }`);

  return content;
});

// 4. AmbulantePedidoPage.tsx
replaceFileContent('src/pages/AmbulantePedidoPage.tsx', (content) => {
  content = content.replace(/import \{ db \} from "@\/lib\/firebase";\nimport \{ onValue, ref, update \} from "firebase\/database";/g, 'import { supabase } from "@/lib/supabase";');

  content = content.replace(/useEffect\(\(\) => \{\n    if \(!id\) return;\n    let unsub: \(\(\) => void\) \| null = null;\n    if \(db\) \{\n      try \{\n        const r = ref\(db, `ambulante_pedidos\/\$\{id\}`\);\n        unsub = onValue\(r, \(snap\) => \{\n          const v = snap\.val\(\);\n          if \(v\?\.status\) setStatus\(v\.status as RemoteStatus\);\n        \}\);\n      \} catch \{ \/\* ignore \*\/ \}\n    \}\n    return \(\) => \{ if \(unsub\) unsub\(\); \};\n  \}, \[id\]\);/g, `useEffect(() => {
    if (!id || id.startsWith('local-')) return;
    async function fetchStatus() {
      const { data } = await supabase.from('pedidos').select('status').eq('id', id).single();
      if (data?.status) setStatus(data.status as RemoteStatus);
    }
    fetchStatus();

    const channel = supabase
      .channel('public:pedidos:'+id)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'pedidos', filter: \`id=eq.\${id}\` }, (payload) => {
        if (payload.new.status) setStatus(payload.new.status as RemoteStatus);
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [id]);`);

  content = content.replace(/const updateRemote = \(patch: Record<string, unknown>\) => \{\n    if \(!db \|\| !id\) return;\n    try \{ update\(ref\(db, `ambulante_pedidos\/\$\{id\}`\), patch\); \} catch \{ \/\* noop \*\/ \}\n  \};/g, `const updateRemote = async (patch: Record<string, unknown>) => {
    if (!id || id.startsWith('local-')) return;
    await supabase.from('pedidos').update(patch).eq('id', id);
  };`);

  return content;
});

// 5. AmbulantesGerenciarPedidoPage.tsx
replaceFileContent('src/pages/AmbulantesGerenciarPedidoPage.tsx', (content) => {
  content = content.replace(/import \{ db \} from "@\/lib\/firebase";\nimport \{ onValue, ref, update \} from "firebase\/database";/g, 'import { supabase } from "@/lib/supabase";');

  content = content.replace(/useEffect\(\(\) => \{\n    if \(!id \|\| !db \|\| id\.startsWith\("demo-"\)\) return;\n    let off: \(\(\) => void\) \| null = null;\n    try \{\n      const r = ref\(db, `ambulante_pedidos\/\$\{id\}`\);\n      off = onValue\(r, \(snap\) => \{[\s\S]*?\}\);\n    \} catch \{ \/\* noop \*\/ \}\n    return \(\) => \{ if \(off\) off\(\); \};\n  \}, \[id\]\);/g, `useEffect(() => {
    if (!id || id.startsWith("demo-")) return;
    
    async function load() {
      const { data, error } = await supabase
        .from('pedidos')
        .select(\`
          status, modalidade, total, delivery_lat, delivery_lng, delivery_address, delivery_referencia,
          pedido_itens ( produto_id, nome, emoji, qty, preco_unit, subtotal )
        \`)
        .eq('id', id)
        .single();
        
      if (data) {
        if (["confirmed", "preparing", "ready", "completed"].includes(data.status)) {
          setStatus(data.status as Status);
        }
        setPedido({
          itens: data.pedido_itens.map((i: any) => ({
            prodId: i.produto_id || 'unknown',
            nome: i.nome,
            emoji: i.emoji,
            qty: i.qty,
            precoUnit: i.preco_unit,
            subtotal: i.subtotal
          })),
          total: data.total,
          modalidade: data.modalidade as any,
          tomadorLocation: data.modalidade === 'delivery' ? {
            lat: data.delivery_lat,
            lng: data.delivery_lng,
            address: data.delivery_address,
            referencia: data.delivery_referencia
          } : undefined
        });
      }
    }
    load();

    const channel = supabase
      .channel('public:pedidos:'+id)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'pedidos', filter: \`id=eq.\${id}\` }, (payload) => {
        if (payload.new.status && ["confirmed", "preparing", "ready", "completed"].includes(payload.new.status)) {
          setStatus(payload.new.status as Status);
        }
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [id]);`);

  content = content.replace(/const advance = \(next: Status\) => \{\n    setStatus\(next\);\n    if \(db && id && !id\.startsWith\("demo-"\)\) \{\n      try \{\n        update\(ref\(db, `ambulante_pedidos\/\$\{id\}`\), \{\n          status: next,\n          \.\.\.\(next === "completed" \? \{ completedAt: Date\.now\(\) \} : \{\}\),\n        \}\);\n      \} catch \{ \/\* noop \*\/ \}\n    \}\n  \};/g, `const advance = async (next: Status) => {
    setStatus(next);
    if (id && !id.startsWith("demo-")) {
      await supabase.from('pedidos').update({
        status: next,
        ...(next === "completed" ? { completed_at: new Date().toISOString() } : {}),
      }).eq('id', id);
    }
  };`);
  
  content = content.replace(/update\(ref\(db, `ambulante_pedidos\/\$\{id\}\/ratings`\), \{ prestador: rating \}\);/g, `/* ignored ratings for now */`);

  return content;
});

console.log("Refactoring complete");
