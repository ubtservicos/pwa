import re

file_path = r'c:\Users\MacInBox\Documents\profissional\ubt-ag\site\ubt-superapp-launch-main\src\pages\AmbulantesOnboardingPage.tsx'
with open(file_path, 'r', encoding='utf-8') as f:
    content = f.read()

# Make a backup
with open(file_path + '.bak', 'w', encoding='utf-8') as f:
    f.write(content)

# 1. Update interfaces
content = re.sub(
    r'interface CustomItem \{.*?\}',
    'interface CustomItem { id: string; nome: string; emoji: string; foto?: string; preco: number; variosValores?: boolean; }',
    content,
    flags=re.DOTALL
)

# 2. Add EMOJIS list
if 'const EMOJIS = [' not in content:
    content = content.replace(
        'const AmbulantesOnboardingPage = () => {',
        'const EMOJIS = ["🍽️", "🥤", "🍺", "🍫", "🍰", "🍔", "🍕", "🌭", "🍟", "🍿", "🍩", "🧁", "🍉", "🍇", "🍓", "🥥", "🥖", "🥐", "🧀", "🍦", "🧊"];\n\nconst AmbulantesOnboardingPage = () => {'
    )

# 3. Update states
content = re.sub(
    r'const \[selectedProds, setSelectedProds\] = useState<Record<string, number>>\(\{\}\);',
    'const [selectedProds, setSelectedProds] = useState<Record<string, { preco: number, variosValores: boolean }>>({});',
    content
)
content = re.sub(
    r'const \[customDraft, setCustomDraft\] = useState<CustomItem>\(\{ nome: "", emoji: "🍽️", preco: 10 \}\);',
    'const [customDraft, setCustomDraft] = useState<Omit<CustomItem, "id">>({ nome: "", emoji: "🍽️", preco: 10, variosValores: false });\n  const [showEmojiPicker, setShowEmojiPicker] = useState(false);',
    content
)

# 4. Update handlers
toggle_old = r'''  const toggleProd = (id: string, preco: number) => {
    setSelectedProds((p) => {
      const n = { ...p };
      if (n[id] !== undefined) delete n[id];
      else n[id] = preco;
      return n;
    });
  };'''

toggle_new = '''  const toggleProd = (id: string, preco: number) => {
    setSelectedProds((p) => {
      const n = { ...p };
      if (n[id] !== undefined) delete n[id];
      else n[id] = { preco, variosValores: false };
      return n;
    });
  };

  const updateProdPreco = (id: string, preco: number) => {
    setSelectedProds((p) => ({ ...p, [id]: { ...p[id], preco } }));
  };

  const toggleProdVariosValores = (id: string) => {
    setSelectedProds((p) => ({ ...p, [id]: { ...p[id], variosValores: !p[id].variosValores } }));
  };'''
content = content.replace(toggle_old, toggle_new)

add_custom_old = r'''  const addCustom = () => {
    if (!customDraft.nome.trim()) return;
    const id = `custom-${Date.now()}`;
    setCustomItems((c) => [...c, { ...customDraft }]);
    setSelectedProds((p) => ({ ...p, [id]: customDraft.preco }));
    setCustomDraft({ nome: "", emoji: "🍽️", preco: 10 });
    setShowCustomModal(false);
  };'''

add_custom_new = '''  const addCustom = () => {
    if (!customDraft.nome.trim()) return;
    const id = `custom-${Date.now()}`;
    setCustomItems((c) => [...c, { ...customDraft, id }]);
    setSelectedProds((p) => ({ ...p, [id]: { preco: customDraft.preco, variosValores: !!customDraft.variosValores } }));
    setCustomDraft({ nome: "", emoji: "🍽️", preco: 10, variosValores: false, foto: undefined });
    setShowCustomModal(false);
  };

  const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (ev) => {
        setCustomDraft((c) => ({ ...c, foto: ev.target?.result as string, emoji: "" }));
      };
      reader.readAsDataURL(file);
    }
  };'''
content = content.replace(add_custom_old, add_custom_new)

# 5. Finalizar fix
finalizar_old = r'''    const produtosMap = Object.fromEntries(
      Object.entries(selectedProds).map(([id, preco]) => {
        const p = CATALOGO_PADRAO.find((x) => x.id === id);
        if (p) {
          return [id, { nome: p.nome, emoji: p.emoji, descricao: p.descricao, preco, disponivel: true }];
        }
        // custom
        const idx = parseInt(id.replace("custom-", "0")) || 0;
        const c = customItems[customItems.length - 1] ?? { nome: "Item", emoji: "🍽️", preco };
        return [id, { nome: c.nome, emoji: c.emoji, descricao: c.descricao ?? "", preco, disponivel: true }];
      })
    );'''

finalizar_new = '''    const produtosMap = Object.fromEntries(
      Object.entries(selectedProds).map(([id, config]) => {
        const p = allList.find((x) => x.id === id);
        if (p) {
          return [id, { 
            nome: p.nome, 
            emoji: p.emoji, 
            foto: (p as CustomItem).foto,
            descricao: ('descricao' in p ? p.descricao : ""), 
            preco: config.preco, 
            variosValores: config.variosValores,
            disponivel: true 
          }];
        }
        return [id, { nome: "Item", emoji: "🍽️", preco: config.preco, variosValores: config.variosValores, disponivel: true }];
      })
    );'''
content = content.replace(finalizar_old, finalizar_new)

# 6. Step 2 inputs replace
step2_input_old = r'''                  {selected && (
                    <div
                      onClick={(e) => e.stopPropagation()}
                      className="flex items-center justify-center gap-1"
                      style={{ marginTop: 8 }}
                    >
                      <span className="font-sans" style={{ fontSize: 11, color: "#5B6178" }}>R$</span>
                      <input
                        type="number" min={0} step={0.5}
                        value={selectedProds[prod.id]}
                        onChange={(e) => setSelectedProds((p) => ({ ...p, [prod.id]: +e.target.value }))}
                        style={{
                          width: 60, textAlign: "center",
                          fontFamily: "DM Sans", fontSize: 13, fontWeight: 600,
                          color: "#0B1B3E", background: "#fff",
                          border: "1px solid #D8DBE5", borderRadius: 8, padding: "4px 6px",
                        }}
                      />
                    </div>
                  )}'''

step2_input_new = '''                  {selected && (
                    <div onClick={(e) => e.stopPropagation()} style={{ marginTop: 8 }}>
                      <div className="flex items-center justify-center gap-1 mb-2">
                        <input type="checkbox" checked={selectedProds[prod.id].variosValores} onChange={() => toggleProdVariosValores(prod.id)} />
                        <span className="font-sans" style={{ fontSize: 11, color: "#5B6178" }}>Diversos valores</span>
                      </div>
                      {!selectedProds[prod.id].variosValores && (
                        <div className="flex items-center justify-center gap-1">
                          <span className="font-sans" style={{ fontSize: 11, color: "#5B6178" }}>R$</span>
                          <input
                            type="number" min={0} step={0.5}
                            value={selectedProds[prod.id].preco}
                            onChange={(e) => updateProdPreco(prod.id, +e.target.value)}
                            style={{
                              width: 60, textAlign: "center",
                              fontFamily: "DM Sans", fontSize: 13, fontWeight: 600,
                              color: "#0B1B3E", background: "#fff",
                              border: "1px solid #D8DBE5", borderRadius: 8, padding: "4px 6px",
                            }}
                          />
                        </div>
                      )}
                    </div>
                  )}'''
content = content.replace(step2_input_old, step2_input_new)

# 7. Step 3 replace
step3_old = r'''              {Object.entries(selectedProds).map(([id, preco]) => {
                const p = CATALOGO_PADRAO.find((x) => x.id === id);
                const display = p ?? { emoji: "🍽️", nome: id };
                return (
                  <div key={id} className="flex items-center justify-between">
                    <span className="font-sans" style={{ fontSize: 14, color: "#0B1B3E" }}>
                      {display.emoji} {display.nome}
                    </span>
                    <div className="flex items-center gap-3">
                      <span className="font-sans" style={{ fontSize: 13, color: "#0DB87E", fontWeight: 600 }}>
                        R$ {preco.toFixed(2)}
                      </span>'''

step3_new = '''              {Object.entries(selectedProds).map(([id, config]) => {
                const p = allList.find((x) => x.id === id);
                const display = p ?? { emoji: "🍽️", nome: id, foto: undefined };
                return (
                  <div key={id} className="flex items-center justify-between" style={{ padding: "8px 0", borderBottom: "1px solid #F1F5F9" }}>
                    <div className="flex items-center gap-2">
                      {(display as CustomItem).foto ? (
                        <img src={(display as CustomItem).foto} alt={display.nome} style={{ width: 32, height: 32, borderRadius: 8, objectFit: "cover" }} />
                      ) : (
                        <span style={{ fontSize: 20 }}>{display.emoji}</span>
                      )}
                      <span className="font-sans" style={{ fontSize: 14, color: "#0B1B3E", fontWeight: 500 }}>
                        {display.nome}
                      </span>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="font-sans" style={{ fontSize: 13, color: "#0DB87E", fontWeight: 600 }}>
                        {config.variosValores ? "Diversos valores" : `R$ ${config.preco.toFixed(2)}`}
                      </span>'''
content = content.replace(step3_old, step3_new)

# 8. Custom Modal replace
modal_old = r'''            <div className="mt-3">
              <FormFieldLight
                label="Emoji"
                placeholder="🍫"
                value={customDraft.emoji}
                onChange={(e) => setCustomDraft((c) => ({ ...c, emoji: e.target.value.slice(0, 2) }))}
              />
            </div>
            <div className="mt-3">
              <FormFieldLight
                label="Preço (R$)"
                type="number"
                value={String(customDraft.preco)}
                onChange={(e) => setCustomDraft((c) => ({ ...c, preco: +e.target.value }))}
              />
            </div>
            <div style={{ marginTop: 16 }}>
              <PrimaryButtonLight onClick={addCustom} disabled={!customDraft.nome.trim()}>
                Adicionar
              </PrimaryButtonLight>
            </div>'''

modal_new = '''            <div className="mt-3">
              <span style={{ fontFamily: "DM Sans", fontSize: 12, fontWeight: 600, color: "#5B6178", display: "block", marginBottom: 6 }}>
                Ícone ou Foto
              </span>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setShowEmojiPicker(true)}
                  style={{ flex: 1, padding: 10, borderRadius: 10, border: "1px solid #D8DBE5", background: "#F8FAFC", fontSize: 20, cursor: "pointer" }}
                >
                  {customDraft.emoji || "😊"}
                </button>
                <label
                  style={{ flex: 1, padding: 10, borderRadius: 10, border: "1px solid #D8DBE5", background: "#F8FAFC", fontSize: 14, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", color: "#5B6178", fontFamily: "DM Sans", fontWeight: 500 }}
                >
                  {customDraft.foto ? "📷 Foto OK" : "📷 Tirar foto"}
                  <input type="file" accept="image/*" capture="environment" style={{ display: "none" }} onChange={handlePhotoUpload} />
                </label>
              </div>
            </div>
            <div className="mt-4 flex items-center gap-2">
              <input type="checkbox" id="varios-valores-custom" checked={customDraft.variosValores} onChange={(e) => setCustomDraft(c => ({...c, variosValores: e.target.checked}))} />
              <label htmlFor="varios-valores-custom" style={{ fontFamily: "DM Sans", fontSize: 13, color: "#0B1B3E", cursor: "pointer" }}>
                Diversos valores
              </label>
            </div>
            {!customDraft.variosValores && (
              <div className="mt-3">
                <FormFieldLight
                  label="Preço (R$)"
                  type="number"
                  value={String(customDraft.preco)}
                  onChange={(e) => setCustomDraft((c) => ({ ...c, preco: +e.target.value }))}
                />
              </div>
            )}
            <div style={{ marginTop: 24 }}>
              <PrimaryButtonLight onClick={addCustom} disabled={!customDraft.nome.trim()}>
                Adicionar Item
              </PrimaryButtonLight>
            </div>'''
content = content.replace(modal_old, modal_new)

# 9. Emoji Picker Modal Add
emoji_picker = '''      {showEmojiPicker && (
        <div style={{ position: "fixed", inset: 0, zIndex: 60, background: "rgba(11,27,62,0.40)", display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }} onClick={() => setShowEmojiPicker(false)}>
          <div onClick={(e) => e.stopPropagation()} style={{ background: "#fff", borderRadius: 16, padding: 24, width: 320, maxWidth: "100%" }}>
            <h3 className="font-display" style={{ fontSize: 16, fontWeight: 700, color: "#0B1B3E", marginBottom: 16 }}>Escolha um ícone</h3>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 12 }}>
              {EMOJIS.map(em => (
                <button
                  key={em}
                  type="button"
                  onClick={() => { setCustomDraft(c => ({...c, emoji: em, foto: undefined})); setShowEmojiPicker(false); }}
                  style={{ fontSize: 24, padding: 8, background: "#F8FAFC", border: "1px solid #D8DBE5", borderRadius: 8, cursor: "pointer" }}
                >
                  {em}
                </button>
              ))}
            </div>
            <button onClick={() => setShowEmojiPicker(false)} style={{ width: "100%", padding: 12, marginTop: 16, border: "none", background: "transparent", color: "#5B6178", fontFamily: "DM Sans", fontWeight: 600, cursor: "pointer" }}>Cancelar</button>
          </div>
        </div>
      )}'''
if 'showEmojiPicker && (' not in content:
    content = content.replace('    </div>\n  );\n};\n\nexport default AmbulantesOnboardingPage;', emoji_picker + '\n    </div>\n  );\n};\n\nexport default AmbulantesOnboardingPage;')

with open(file_path, 'w', encoding='utf-8') as f:
    f.write(content)

print("Refactor complete!")
