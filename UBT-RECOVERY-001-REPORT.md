# UBT-RECOVERY-001
## Recovery & Workspace Diagnostic Report

**Data/hora da execução:** 2026-08-02T08:05:00-03:00 (Local Time)

### 1. Workspace
- **Workspace utilizado:** `C:\Users\MacInBox\Documents\profissional\ubt\pwa`
- **Workspace inválido identificado:** `C:\Users\MacInBox\Documents\profissional\ubt-ag\site` (Pasta ausente/inexistente no disco)
- **Confirmação do workspace oficial:** `C:\Users\MacInBox\Documents\profissional\ubt\pwa` (Diretório operacional, contendo todos os arquivos de build, assets de vídeo e código fonte da aplicação React + Vite)

### 2. Git
- **Branch:** `main`
- **Remote:** `origin  https://github.com/ubtservicos/pwa.git`
- **Commit atual:** `be05045 release: UBT Public Launch Candidate v1.0`
- **Working tree:** Modificações locais não commitadas e não staged nos arquivos de configuração:
  - `package.json` (modificado)
  - `package-lock.json` (modificado)
  - `vite.config.ts` (modificado)
  - Pasta `scratch/` não rastreada (untracked)
- **Relação com origin/main:** A branch local `main` está em sincronia com `origin/main` no commit base `be05045`. As únicas diferenças são as modificações locais de configuração não rastreadas/unstaged (para suporte a sourcemaps e manualChunks otimizados).

### 3. Estrutura
- **Arquivos/diretórios encontrados:**
  - `package.json` (OK)
  - `vite.config.ts` (OK)
  - `index.html` (OK)
  - `src/` (OK)
  - `src/main.tsx` (OK)
  - `src/App.tsx` (OK)
  - `src/pages/` (OK)
  - `src/services/` (OK)
  - `public/` (OK)
  - `.git/` (OK)
- **Localização do Supabase:** `C:\Users\MacInBox\Documents\profissional\ubt\supabase`
- **Relação entre PWA e Supabase:**
  - **A)** A pasta `supabase` localiza-se no nível pai (`C:\Users\MacInBox\Documents\profissional\ubt\supabase`) e **não faz parte** do mesmo repositório Git do PWA (`C:\Users\MacInBox\Documents\profissional\ubt\pwa`).
  - **B)** É um diretório separado fisicamente.
  - **C)** É referenciada conceitualmente pelo PWA por mapear o banco de dados (tabelas como `waitlist`, triggers, políticas de RLS e edge functions), mas o código PWA não realiza imports locais diretos dessa pasta.
  - **D)** Não precisa estar presente para o build/deploy do front-end do PWA (o build front-end é independente e utiliza variáveis de ambiente).
  - **E)** É uma pasta de gerenciamento auxiliar do backend/banco de dados que reside lado a lado com o front-end.

### 4. Landing Page
- **Arquivo principal:** `src/pages/Index.tsx`
- **Componentes:** `Index` (componente principal da Landing Page), `FaqItem` (recolhível de perguntas e respostas), canvas-based particles animações (Golden Dust, Constelações, Sea Waves, Embers Sparks, Night Stars), modal player de cinema interativo multicapítulos.
- **Assets:** Vídeos mp4 localizados em `public/videos/` (Cena02.mp4 a Cena13.mp4), personagens em `public/characters/`, imagens de localizações em `public/locations/` (como fotos de praias, pontos turísticos de Ubatuba, ambulantes, etc.), logotipos do UBT em `public/logo-02.png`, etc.
- **Dependências:** Lucide React, Tailwind CSS, Supabase JS client, Canvas API para renderização de partículas.
- **Possíveis problemas encontrados:** Nenhum erro de referência quebrada ou import problemático detectado. Todas as rotas estão corretas. Os vídeos estão todos fisicamente no diretório de assets (`public/videos/`).

### 5. Build
- **Resultado npm run build:** PASS (sucesso na compilação e otimização de chunks)
- **Duração:** 12.34 segundos
- **Warnings:** Warnings comuns de CSS do Tailwind para classes de animação ambíguas (`duration-[1000ms]` e `duration-[1200ms]`).
- **Bundles gerados:**
  - `dist/index.html` (2.39 kB)
  - `dist/assets/vendor-maps-bMQ7q4Nm.css` (18.81 kB)
  - `dist/assets/index-DANZs3Wh.css` (94.84 kB)
  - `dist/assets/firebase-BkgmRoN4.js` (0.63 kB)
  - `dist/assets/vendor-ui-D549iJnB.js` (97.17 kB)
  - `dist/assets/vendor-maps-ChYPl2MO.js` (161.06 kB)
  - `dist/assets/vendor-core-DPJBbekJ.js` (194.49 kB)
  - `dist/assets/vendor-supabase-dNE_VlD0.js` (212.40 kB)
  - `dist/assets/vendor-libs-CYaYthHn.js` (614.08 kB)
  - `dist/assets/index-C38VECWW.js` (1.02 MB)

### 6. TypeScript
- **Resultado npx tsc --noEmit:** PASS (zero erros de tipagem)

### 7. Runtime
- **Resultado npm run dev:** PASS
- **URL:** `http://localhost:8080/`
- **Porta:** `8080`
- **Erros:** Zero erros de inicialização, servidor pronto para receber conexões locais.

### 8. Diagnóstico do estado do Antigravity
- O workspace local do PWA está completamente operacional e consistente.
- A causa mais provável para o estado "(resting)ws" na iteração anterior foi o comando `git push` executado em background, que ficou aguardando credenciais/autorização interativas (por ex., autenticação do GitHub via SSH/HTTPS no terminal do Windows) ou demorou para responder, fazendo com que a ferramenta entrasse em modo de descanso aguardando a finalização da tarefa. O processo foi cancelado com sucesso.

### 9. Riscos encontrados
- **Credenciais locais do Vercel CLI:** O comando `npx vercel whoami` retorna "Error: Not authorized", o que indica que qualquer tentativa de deploy direto por CLI falhará a menos que um token de acesso Vercel válido seja configurado ou logado.
- **Modificações locais de configuração:** Arquivos como `vite.config.ts`, `package.json` e `package-lock.json` possuem alterações locais que ainda não estão integradas na branch remota `origin/main`. Caso o deploy de produção da Vercel seja acionado automaticamente via integração com o GitHub ao fazer push na branch `main`, essas melhorias de chunking e sourcemaps não serão aplicadas até que sejam devidamente commitadas e enviadas.

### 10. Próximo passo recomendado
- Aguardar aprovação do usuário sobre este relatório.
- Se autorizado, realizar o commit e push das melhorias de configuração (`vite.config.ts`, `package.json`, `package-lock.json`) para a branch `main`, permitindo que o pipeline de deploy automático da Vercel (se configurado via GitHub Integration) gere a versão de produção correta com as divisões de chunks otimizadas.
- Alternativamente, obter um `VERCEL_TOKEN` ou login ativo para permitir deploy direto via CLI caso a integração automática do GitHub não esteja ativa.
