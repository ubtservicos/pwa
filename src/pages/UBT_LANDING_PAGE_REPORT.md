# Relatório Técnico da Landing Page de Lançamento UBT v1.0

Este documento descreve a implementação técnica da primeira versão pública da Landing Page da UBT, de acordo com as especificações estritas do documento **`UBT-COMM-002-LANDING-LAUNCH-V1.0.md`**.

---

## 1. Resumo Técnico das Alterações

*   **Identidade Visual Cinematográfica e Tropical:** Criada uma interface imersiva com fundo escuro e degradês nas cores da marca (nascer do sol, pôr do sol, mata atlântica), aplicando blur de fundo e glassmorphism para garantir leveza e foco.
*   **Gestão de Vídeos:** Copiamos todos os 11 arquivos `.mp4` aprovados da pasta de produção para `/public/videos/` no front-end para que fossem carregados de maneira nativa e responsiva pelo player de vídeo.
*   **Player de Cinema Multicapítulos (Modal Fullscreen):** Implementado um modal interativo de exibição cinematográfica. Ao clicar no botão de assistir nas seções da Landing Page, o modal abre um player customizado onde o visitante pode assistir à cena ativa ou navegar por um menu lateral de capítulos com resumos de cada cena.
*   **Formulário Seja um Fundador (Integração Supabase):**
    *   Formulário totalmente reativo colhendo Nome, WhatsApp, E-mail, Cidade e Perfil.
    *   Integrado em tempo real com o cliente Supabase do projeto, inserindo diretamente na tabela `waitlist`.
    *   Validação em tempo real para evitar registros duplicados de e-mail.
    *   Feedback dinâmico de sucesso e proteção à privacidade do usuário em conformidade com a LGPD.
*   **Performance, SEO e Acessibilidade:**
    *   Implementado suporte nativo para legendas descritivas em imagens.
    *   Lazy loading implícito em tags de vídeo.
    *   Zero erros no teste de compilação do TypeScript (`npx tsc --noEmit`) e bundle de produção Vite gerado com sucesso.
*   **Preservação da Experiência Anterior (Scrolljacking Storyboard):**
    *   O antigo Concept Experience interativo de 13 cenas foi preservado integralmente e movido de rota para `/experience` ([`ConceptExperience.tsx`](file:///C:/Users/MacInBox/Documents/profissional/ubt/pwa/src/pages/ConceptExperience.tsx)).

---

## 2. Componentes Criados ou Modificados

*   [`Index.tsx`](file:///C:/Users/MacInBox/Documents/profissional/ubt/pwa/src/pages/Index.tsx) **[Modificado]**: Reescrito para ser a Landing Page pública oficial com todas as seções descritas no briefing.
*   [`ConceptExperience.tsx`](file:///C:/Users/MacInBox/Documents/profissional/ubt/pwa/src/pages/ConceptExperience.tsx) **[Novo]**: Backup do reprodutor interativo de scroll anterior.
*   [`App.tsx`](file:///C:/Users/MacInBox/Documents/profissional/ubt/pwa/src/App.tsx) **[Modificado]**: Adicionada a rota `/experience` mapeada para a página de backup.

---

## 3. Arquivos Alterados no Sistema

*   `pwa/src/pages/Index.tsx`
*   `pwa/src/pages/ConceptExperience.tsx`
*   `pwa/src/App.tsx`
*   `pwa/public/videos/*` (Copiados da produção: Cena02, Cena03, Cena04, Cena05, Cena06, Cena07, Cena08, Cena09, Cena10, Cena12, Cena13)
*   `pwa/public/characters/*` (Copiados da governança de personagens)
*   `pwa/public/locations/*` (Copiados da biblioteca de fotos reais de Ubatuba)
*   `mds/diario_bordo_2026-07-22_11-36.md` (Log do item nº 57 adicionado)

---

## 4. Melhorias Futuras Recomendadas (Não Implementadas)

1.  **Vídeo HLS/DASH Streaming:** Para conexões móveis lentas, o carregamento de arquivos `.mp4` inteiros pode atrasar a experiência. Recomenda-se converter os vídeos para HLS e usar o player `video.js` ou similar para ajuste de bitrate dinâmico.
2.  **Automação de E-mail / WhatsApp Marketing:** Configurar um trigger no banco do Supabase para enviar mensagens automatizadas de boas-vindas aos Fundadores via serviços integrados (como SendGrid ou Twilio).
3.  **Compartilhamento de Link com UTM Dinâmico:** Gerar links exclusivos de indicação com query strings que preencham automaticamente o campo "Origem/Indicação" no formulário de novos fundadores convidados.

---

## 5. Checklist de Validação para Publicação

- [ ] **Testes de Integração:** Efetuar um cadastro de teste no formulário "Seja um Fundador" e verificar se a linha aparece no banco do Supabase e na tela [`/admin/waitlist`](file:///C:/Users/MacInBox/Documents/profissional/ubt/pwa/src/pages/admin/AdminWaitlistPage.tsx).
- [ ] **Responsividade:** Validar no Chrome DevTools o layout em resoluções mobile (como iPhone SE e Pixel 7) e certificar que a orientação horizontal no player é solicitada de forma legível.
- [ ] **Mídia e Imagens:** Verificar se todos os caminhos de `/public/videos/` e `/public/characters/` carregam sem erro 404 em ambiente de staging.
- [ ] **Controles de Volume:** Validar o botão de mutar no player e nos cards de vídeo de visualização.
