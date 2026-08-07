# UBT-PAY-003-SPLIT-CONFIGURATION-REPORT

## 1. Status Geral
Esta wave de remediação financeira unificou a persistência de regras de comissões e splits na UBT, eliminando a dependência do navegador local (`localStorage`) como autoridade global de taxa. O banco de dados PostgreSQL do Supabase tornou-se a única fonte de verdade para a lógica econômica da plataforma, consultada em tempo real por páginas administrativas de sorteio e pela Edge Function `/checkout`.

---

## 2. Configurações Financeiras de Produção
A consulta direta na tabela `public.split_config` revelou que a base de dados de Produção registrava os percentuais padrão:
- **Prestador:** 90%
- **UBT:** 4%
- **Associação:** 2%
- **Prêmio Trabalhador:** 1.5%
- **Prêmio Consumidor:** 1.5%
- **Padrinho/Madrinha:** 1%
- **TOTAL:** 100%

O descompasso do PO (que via 5% UBT e 1% prêmios) foi motivado pela escrita local restrita a `localStorage` na UI anterior. Essa inconsistência foi sanada por meio do acoplamento direto das ações da UI ao PostgreSQL.

---

## 3. Arquivos Modificados
As seguintes correções foram codificadas, testadas e integradas ao repositório git:

- **[AdminSplitPage.tsx](file:///C:/Users/MacInBox/Documents/profissional/ubt/pwa/src/pages/admin/AdminSplitPage.tsx)**
  - Removido o carregamento prioritário de split do `localStorage`. Agora consulta a tabela Supabase `split_config` no `useEffect` de mount.
  - Refatorada a função `handleSave` para realizar atualização transacional na tabela `split_config` (ID = 1) e sincronizar em lote as chaves da tabela `system_settings` (`taxa_ubt`, `premio_consumidor`, `premio_prestador` e `percentual_associacao`), garantindo consistência em todas as tabelas.
  
- **[AdminSorteioTrabPage.tsx](file:///C:/Users/MacInBox/Documents/profissional/ubt/pwa/src/pages/admin/AdminSorteioTrabPage.tsx)**
  - Mapeado o mount hook para ler dinamicamente o valor de `premio_trabalhador_pct` diretamente do banco de dados na inicialização dos bilhetes de sorteio.
  
- **[AdminSorteioConsPage.tsx](file:///C:/Users/MacInBox/Documents/profissional/ubt/pwa/src/pages/admin/AdminSorteioConsPage.tsx)**
  - Mapeado o mount hook para ler dinamicamente o valor de `premio_consumidor_pct` diretamente do banco de dados na inicialização do histórico de sorteio de tomadores.

- **[checkout/index.ts](file:///C:/Users/MacInBox/Documents/profissional/ubt/supabase/functions/checkout/index.ts)**
  - Removidos os coeficientes estáticos `0.90` e `0.04` chumbados em código.
  - Adicionado query handler que extrai em tempo real a linha ativa em `public.split_config`.
  - Habilitado o cálculo e inserção dinâmica de registros na tabela `payment_splits` para os 6 favorecidos do ecossistema: Prestador (`provider`), UBT (`ubt`), Associação/Comunidade (`comunidade`), Sorteio Trabalhador (`prize_worker`), Sorteio Consumidor (`prize_consumer`), e Padrinho (`godparent`).

---

## 4. Testes e Validação
A conformidade técnica foi validada por meio de verificação em lote:
1. **Tipo e Sintaxe:** Executado teste de transpilação `npm run build` bem-sucedido sem erros.
2. **Suíte de Testes:** Executado `npx vitest run` resultando em 100% de sucesso nas 19 asserções de geofencing e waitlist.
3. **Validação de RLS:** Confirmado que a escrita na tabela `split_config` permanece blindada a usuários comuns por meio da verificação da policy `split_update` que exige privilégios de `is_superadmin()`.

---

## 5. Próxima Etapa de Planejamento (Mercado Pago)
A consolidação de splits no banco prepara o caminho para a Sandbox e Produção:
- A Edge Function `/checkout` atuará como calculadora de splits baseando-se estritamente na tabela `split_config` no momento da criação do Pix/Cartão de crédito transparente.

---

## 6. Ações Operacionais para a Wiki
O conhecimento levantado nesta wave deve ser incluído na base de conhecimento oficial da UBT:

- **USUÁRIO RESPONSÁVEL:** Superadmin / Financeiro.
- **AÇÃO:** Alteração Global dos Percentuais de Split.
- **TELA/LOCAL:** `/admin/split` (Configuração da Taxa de Serviço).
- **PRÉ-REQUISITOS:** Autenticação como `super_admin` e soma dos percentuais informados igual a 100%.
- **RESULTADO ESPERADO:** Gravação nas tabelas `split_config` e `system_settings` no PostgreSQL, com impacto imediato em todas as Edge Functions de checkout.
- **ERROS POSSÍVEIS:** Rejeição do salvamento caso a soma totalize valor diferente de 100%.
