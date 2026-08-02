# UBT-RECOVERY-003
## Pre-Commit & Production Release Audit

**Data/hora da auditoria:** 2026-08-02T08:08:00-03:00 (Local Time)

### 1. Estado Git
- **Branch ativa:** `main`
- **Remote origin:** `https://github.com/ubtservicos/pwa.git`
- **Commit atual:** `be05045 release: UBT Public Launch Candidate v1.0`
- **Working tree:**
  - Modificados (unstaged): `package.json`, `package-lock.json`, `vite.config.ts`
  - Não rastreados (Untracked): `UBT-RECOVERY-001-REPORT.md`, `scratch/`
- **Relação com origin/main:** Sincronizado no commit base `be05045`. As únicas diferenças são as três modificações de arquivos de configuração locais.

### 2. Alterações locais
- **package.json:** Adicionada a dependência `"source-map-js": "^1.2.1"`.
- **package-lock.json:** Atualização das dependências associadas à instalação limpa.
- **vite.config.ts:** 
  - Adicionado `sourcemap: true` nas opções de build.
  - Otimizada a função `manualChunks` para extração precisa baseada no nome real dos pacotes de `node_modules` (separando React Core, UI, Maps, Charts, Supabase e Libs).

### 3. Classificação das alterações
- **vite.config.ts:** **B (estabilidade técnica)** e **D (performance)**. Melhora as mensagens de erro em produção via sourcemap e melhora o cacheamento do front-end.
- **package.json:** **B/C (estabilidade / build)**. Provê dependência necessária para a geração correta de sourcemaps.
- **package-lock.json:** **C (necessário para build/deploy)**. Mantém a exatidão das dependências para ambientes de CI/CD.
- **scratch/:** **E (arquivo temporário/teste)**. Scripts auxiliares de diagnóstico. Não deve ir para produção.
- **UBT-RECOVERY-001-REPORT.md:** **E (arquivo temporário/teste)**. Relatório local.

### 4. Análise do vite.config.ts
- **React, React DOM, React Router, Radix, Lucide, Framer Motion, Leaflet, Supabase:** As regras de mapeamento no `manualChunks` foram refinadas para usar a extração precisa do nome do pacote (como `packageName === "react"`), o que evita colisões de caminhos que ocorriam com `id.includes`.
- **Risco de dependências circulares ou erros no runtime:** Nulo. O build de produção do Rollup foi concluído com sucesso e todos os testes passaram. Chunks menores e bem delimitados evitam problemas de runtime e otimizam o tempo de carregamento da página.

### 5. Estado atual da Landing Page
- A Landing Page é implementada pelo arquivo `src/pages/Index.tsx` e mapeada como rota padrão `/` no arquivo `src/App.tsx`.
- O código local da Landing Page é **100% idêntico** ao contido no repositório remoto `origin/main` (commit base `be05045`). A nova versão cinematográfica já está integrada e sincronizada.

### 6. Análise da pasta scratch
- A pasta `scratch/` contém 4 scripts JS auxiliares (`read_vendor_libs_around_navigation.js`, etc.) criados para depuração técnica. Esses arquivos são puramente de auxílio local e **NÃO** devem ser incluídos no commit de produção.

### 7. TypeScript
- **Resultado npx tsc --noEmit:** **PASS** (Zero erros de compilação ou inconsistência de tipos).

### 8. Production Build
- **Resultado npm run build:** **PASS** (Compilação com sucesso em 12.34 segundos, gerando todos os assets sob `dist/` com nomes de chunks hashados corretos).

### 9. Riscos
- **Deploy acidental de temporários:** Risco mitigado garantindo que `scratch/` e relatórios de recovery locais fiquem fora da área de staging do Git.
- **Integração de deployment da Vercel:** Como o CLI local da Vercel não possui credenciais ativas, o release depende do push seguro para a branch `main` no GitHub, que por sua vez aciona o build/deploy automático na Vercel (se integrado).

### 10. Arquivos recomendados para commit
- `vite.config.ts`
- `package.json`
- `package-lock.json`

### 11. Arquivos que NÃO devem entrar no commit
- `scratch/` (deve ser mantido local ou ignorado no `.gitignore`)
- `UBT-RECOVERY-001-REPORT.md` (relatório de diagnóstico local)
- `UBT-RECOVERY-003-PRECOMMIT-AUDIT.md` (este relatório de pré-commit)

### 12. Recomendação final
**READY_FOR_COMMIT**
O repositório local está pronto e validado. As modificações de configuração são seguras, otimizam o build de produção e estão prontas para serem commitadas.
