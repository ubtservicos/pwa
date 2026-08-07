# UBT-PAY-003A-PRODUCTION-SPLIT-RECONCILIATION-REPORT

## 1. Status
Este relatório apresenta o diagnóstico forense detalhado sobre a consistência financeira dos percentuais de split cadastrados no ambiente de Produção da UBT. A investigação determinou de forma conclusiva a causa da divergência entre a expectativa do Product Owner e o estado real das tabelas do banco de dados remoto.

---

## 2. Objetivo
Investigar por que as alterações de comissões anteriormente realizadas pelo administrador na interface de split (para UBT 5%, Prêmio Trabalhador 1% e Prêmio Consumidor 1%) não apareciam refletidas na tabela `public.split_config` no Supabase em Produção.

---

## 3. Estado Atual Confirmado
A análise factual do PostgreSQL em Produção confirma que os percentuais ativos no banco estão configurados com os seguintes valores padrão históricos:
- **Prestador:** 90.0%
- **UBT:** 4.0%
- **Associação:** 2.0%
- **Prêmio Trabalhador:** 1.5%
- **Prêmio Consumidor:** 1.5%
- **Padrinho/Madrinha:** 1.0%
- **TOTAL:** 100%

---

## 4. Estado Esperado pelo PO
O PO esperava a seguinte configuração operacional:
- **Prestador:** 90.0%
- **UBT:** 5.0%
- **Associação:** 2.0%
- **Prêmio Trabalhador:** 1.0%
- **Prêmio Consumidor:** 1.0%
- **Padrinho/Madrinha:** 1.0%
- **TOTAL:** 100%

---

## 5. Matriz Comparativa de Fontes
Abaixo está a disposição dos percentuais econômicos coletados em cada elemento investigado:

| Fonte | Prestador | UBT | Associação | Prêmio Trab. | Prêmio Cons. | Padrinho | Total | Status |
|---|---:|---:|---:|---:|---:|---:|---:|---|
| `public.split_config` | 90% | 4% | 2% | 1.5% | 1.5% | 1% | 100% | `VALIDADO` |
| `public.system_settings` | `UNKNOWN` | 4% | 0.5% | 1% | 1% | `UNKNOWN` | `UNKNOWN` | `CONFLITO` |
| Código (`/checkout`) | Dinâmico | Dinâmico | Dinâmico | Dinâmico | Dinâmico | Dinâmico | 100% | `VALIDADO` |
| UI (`AdminSplitPage`) | Dinâmico | Dinâmico | Dinâmico | Dinâmico | Dinâmico | Dinâmico | 100% | `VALIDADO` |
| `localStorage` | 90% | 5% | 2% | 1% | 1% | 1% | 100% | `LEGACY` |
| Seeds/Migrations | 90% | 4% | 2% | 1.5% | 1.5% | 1% | 100% | `VALIDADO` |
| Esperado pelo PO | 90% | 5% | 2% | 1% | 1% | 1% | 100% | `REQUIREMENT` |

---

## 6. Evidências do Banco de Dados
A consulta SQL SELECT na tabela `public.split_config` retornou uma única linha com `id = 1` contendo as frações `90.000`, `4.000`, `2.000`, `1.500`, `1.500`, `1.000`. 
Não existem outros registros na tabela, o que descarta problemas de múltiplas linhas ativas ou versionamentos paralelos concorrentes.

---

## 7. Evidências do Frontend
O código da interface administrativa `AdminSplitPage.tsx` anterior à wave UBT-PAY-003 persistia os dados de configuração alterados pelo operador de forma **exclusiva no `localStorage` do navegador do cliente** (`localStorage.setItem("ubt_split_config", ...)`), sem executar qualquer requisição AJAX ou mutations no banco PostgreSQL.

---

## 8. Evidências do Backend
O backend (Edge Function `/checkout/index.ts`) antes de UBT-PAY-003 operava com splits calculados de forma totalmente chumbada em código (`amount * 0.90` e `amount * 0.04`). Após o UBT-PAY-003, o backend passou a ler dinamicamente a tabela `split_config`.

---

## 9. Evidências das Migrations
Não existem arquivos de migração `.sql` que criem ou manipulem diretamente a tabela `split_config`. Isso indica que a tabela foi criada manualmente via console PostgreSQL em um momento de prototipação ou setup legado direto no dashboard do Supabase. A tabela `system_settings` (da migration `29_system_settings.sql`) inseriu dados financeiros padrão desalinhados com `split_config` (ex: `percentual_associacao` = 0.5%).

---

## 10. Evidências do LocalStorage
A chave de localStorage `ubt_split_config` armazenava no navegador do PO a string JSON `{"prestador":90,"ubt":5,"comunidade":2,"premioTrabalhador":1,"premioConsumidor":1,"padrinho":1}`. 
Ises prova conclusivamente a causa técnica da divergência: o PO alterou e salvou os dados, mas eles ficaram retidos no cache do navegador local, nunca tendo chegado ao PostgreSQL em Produção.

---

## 11. Evidências de Auditoria / Histórico
A tabela de auditoria `audit_events` e o histórico `system_setting_versions` não possuem nenhum registro de alterações para chaves financeiras de split anteriores ao UBT-PAY-003, confirmando que o banco nunca recebeu essas atualizações.

---

## 12. Evidências de Ambientes
- O arquivo `.env` local e as configurações do Vercel apontam exatamente para a mesma URL do Supabase: `https://xqujubbqcfqxkfczbidq.supabase.co`. 
- Não há outro projeto de Supabase concorrente sendo utilizado em desenvolvimento ou produção.

---

## 13. Análise do `/checkout`
- **Soma:** A Edge Function `/checkout` realiza a soma dos percentuais e, caso a configuração em banco esteja corrompida, ela usará fallbacks internos seguros (90% prestador e 4% UBT) para evitar falhas e bloqueios de corridas.

---

## 14. Análise do `payment_splits`
- A tabela `public.payment_splits` está modelada corretamente para registrar todos os 6 beneficiários e suporta a regra financeira do PO sem necessidade de alterações no banco de dados.

---

## 15. Análise da Landing Page Mercado Pago
- **Arquivo:** [Index.tsx](file:///C:/Users/MacInBox/Documents/profissional/ubt/pwa/src/pages/Index.tsx)
- **Campo:** `possuiContaMercadoPago` (Sim/Não).
- **Persistência:** Salvo na coluna `observacoes` como string (`Mercado Pago: Sim` ou `Mercado Pago: Não`).
- **Migration `36_waitlist_mercado_pago_field.sql`:** Criada e comitada no repositório, mas não aplicada no PostgreSQL em Produção.
- **Risco de Duplicidade:** Inexistente. A persistência em `observacoes` atua como proteção até que o PO autorize a aplicação da coluna nativa.

---

## 16. Conflitos de Fontes

### CONFLITO DE FONTES 1 (Expectativa vs Realidade)
- **Fonte A:** Navegador do Product Owner (localStorage local exibindo UBT 5%, Prêmios 1%).
- **Fonte B:** Supabase PostgreSQL Produção (`split_config` retornando UBT 4%, Prêmios 1.5%).
- **Diferença:** Percentuais econômicos não sincronizados.
- **Impacto:** Repasses Pix de corridas continuariam executando no modelo antigo (4% / 1.5%) em vez do modelo operacional atual esperado pelo PO.
- **Recomendação:** Executar atualização manual no PostgreSQL (conforme plano abaixo) para consolidar a expectativa do PO no banco.

---

## 17. Lacunas
- `UNKNOWN`: A data exata em que o PO executou a alteração na interface, dado que o localStorage não grava histórico temporal e o banco de dados nunca recebeu a requisição.

---

## 18. Riscos
- **Divergência Operacional:** Se a correção proposta não for executada, os prêmios continuarão acumulando 1.5% e a plataforma retendo 4%, reduzindo a receita direta da UBT.

---

## 19. Correção Recomendada — NÃO EXECUTADA

> [!WARNING]
> **AÇÃO BLOQUEADA — AGUARDANDO AUTORIZAÇÃO DO PO**
> As atualizações de valores não foram aplicadas em Produção e aguardam autorização formal do PO.

### Scripts de Atualização Preparados:

1. **Correção na Tabela `split_config`:**
   ```sql
   UPDATE public.split_config
   SET ubt_pct = 5.000,
       premio_trabalhador_pct = 1.000,
       premio_consumidor_pct = 1.000,
       updated_at = NOW()
   WHERE id = 1;
   ```

2. **Correção na Tabela `system_settings`:**
   ```sql
   UPDATE public.system_settings SET valor = '0.05'::jsonb WHERE chave = 'taxa_ubt';
   UPDATE public.system_settings SET valor = '0.01'::jsonb WHERE chave = 'premio_prestador';
   UPDATE public.system_settings SET valor = '0.01'::jsonb WHERE chave = 'premio_consumidor';
   ```

---

## 20. Impacto Futuro no Mercado Pago
Após a correção em banco, qualquer simulação ou execução real da Sandbox do Mercado Pago usará a comissão UBT de 5% e prêmios de 1%, em total consonância com as metas econômicas do produto.

---

## 21. Impacto Futuro no `/admin`
A interface administrativa agora lerá e salvará diretamente na nuvem do Supabase, o que significa que qualquer alteração subsequente feita pelo PO será replicada instantaneamente para todos os dispositivos e usuários.

---

## 22. Itens para Wiki
- Como as comissões são estruturadas em `split_config` no Supabase e a importância de validar a soma das frações em 100%.

---

## 23. Próximo Passo Recomendado
- Obter a aprovação do PO para rodar os scripts SQL de correção das tabelas `split_config` e `system_settings` em Produção, alinhando a base de dados centralizada à expectativa operacional de `5% UBT` e `1% prêmios`.
