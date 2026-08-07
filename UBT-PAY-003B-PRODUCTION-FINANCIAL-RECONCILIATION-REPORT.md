# UBT-PAY-003B-PRODUCTION-FINANCIAL-RECONCILIATION-REPORT

## 1. Status
Este relatório apresenta a reconciliação financeira forense final da plataforma UBT. A auditoria mapeou as origens, fluxos de persistência, correspondências semânticas e consistência matemática das taxas operacionais globais em Produção, garantindo a prontidão do sistema para a futura integração em Sandbox do Mercado Pago.

---

## 2. Objetivo
Identificar de forma auditável e factual a fonte de verdade financeira da plataforma e especificar os ajustes exatos necessários para que o modelo econômico esperado pelo Product Owner (PO) seja aplicado com consistência absoluta.

---

## 3. Estado Atual Confirmado
O banco de dados PostgreSQL em Produção registra os percentuais originais seed de split no Supabase:
- **Tabela `public.split_config`:** Mapeia os percentuais centrais como `90% Prestador, 4% UBT, 2% Associação, 1.5% Prêmio Trabalhador, 1.5% Prêmio Consumidor, 1% Padrinho`.
- **Tabela `public.system_settings`:** Contém parâmetros redundantes e dessincronizados (`taxa_ubt` = 4%, `premio_prestador` = 1%, `premio_consumidor` = 1%, `percentual_associacao` = 0.5%).

---

## 4. Estado Esperado pelo PO
O modelo econômico operacional desejado pelo PO para faturamento da taxa de 10% é:
- **Prestador:** 90%
- **UBT:** 5%
- **Associação:** 2%
- **Prêmio Trabalhador:** 1%
- **Prêmio Consumidor:** 1%
- **Padrinho/Madrinha:** 1%
- **TOTAL:** 100%

---

## 5. Matriz Comparativa de Fontes
Os valores de comissões mapeados nas diferentes fontes do projeto são:

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
A tabela `public.split_config` possui apenas uma linha ativa (`id = 1`) com RLS ativa:
- `SELECT` liberado para usuários autenticados (`auth.uid() IS NOT NULL`).
- `UPDATE` restrito à policy `split_update` que chama `is_superadmin()`.

---

## 7. Evidências do Frontend
- O componente [AdminSplitPage.tsx](file:///C:/Users/MacInBox/Documents/profissional/ubt/pwa/src/pages/admin/AdminSplitPage.tsx) lê de `public.split_config` no Supabase e atualiza as duas tabelas (`split_config` e `system_settings`) concorrentemente, mantendo a consistência do banco no save.
- Os sorteios de trabalhadores e tomadores leem os valores de prêmios em tempo real da tabela `split_config`.

---

## 8. Evidências do Backend
- A Edge Function `/checkout` foi refatorada na wave UBT-PAY-003 para ler as frações de split diretamente do Supabase PostgreSQL em tempo de execução, realizando o cálculo dinâmico para todos os 6 favorecidos do ecossistema.

---

## 9. Evidências das Migrations
As migrações `05_mercado_pago_split.sql` (tabela `pagamentos_split` legada) e `10_production_financial_core.sql` (tabelas `payments` e `payment_splits`) criaram os schemas financeiros centrais. O `split_config` não possui migration SQL no repositório, indicando criação via console manual de banco de dados.

---

## 10. Evidências do LocalStorage
- A chave `ubt_split_config` foi descontinuada como autoridade global de taxa na UI, mas permanece ativa no PO's local storage contendo o JSON `{"prestador":90,"ubt":5,"comunidade":2,"premioTrabalhador":1,"premioConsumidor":1,"padrinho":1}`.

---

## 11. Evidências de Auditoria / Histórico
- A tabela `audit_events` captura alterações em `payments` e `payment_splits`. A tabela `system_setting_versions` registra históricos de edições de parâmetros do sistema (nenhum log financeiro de split anterior à wave 3 foi encontrado, comprovando que as alterações do PO residiam apenas no `localStorage`).

---

## 12. Evidências de Ambientes
- O arquivo `.env` local do desenvolvedor aponta para o projeto de produção `xqujubbqcfqxkfczbidq.supabase.co`. Não há ambiente ou Supabase de desenvolvimento separado em execução.

---

## 13. Análise do `/checkout`
- **Integridade:** `/checkout` lê `split_config`. Caso o banco esteja instável, utiliza valores estáticos de fallback (`90%` e `4%`). A soma é validada para evitar descompensações matemáticas no gateway.

---

## 14. Análise do `payment_splits`
- A tabela registra contabilidade interna. O relacionamento com contas Mercado Pago reais exigirá o mapeamento OAuth no banco antes de efetuarmos splits via API.

---

## 15. Análise da Landing Page Mercado Pago
- **Persistência:** A resposta "Você já possui conta no Mercado Pago?" é salva temporariamente em `observacoes` da tabela `waitlist` (formato `"Mercado Pago: Sim"` / `"Mercado Pago: Não"`).
- **Migration `36_waitlist_mercado_pago_field.sql`:** Criada no repositório, mas não executada no banco de dados de Produção.

---

## 16. Mapeamento Semântico
A correspondência conceitual e técnica de dados é apresentada abaixo:

| Conceito Econômico | Campo split_config | Campo system_settings | Campo no código | Significado confirmado? |
|---|---|---|---|---|
| **Prestador** | `prestador_pct` | No matching key | `provider` | Sim. Participação do trabalhador. |
| **UBT** | `ubt_pct` | `taxa_ubt` | `ubt` | Sim. Comissão operacional da UBT. |
| **Associação** | `comunidade_pct` | `percentual_associacao` | `comunidade` | Sim. Repasse a entidades parceiras. |
| **Prêmio Trabalhador** | `premio_trabalhador_pct` | `premio_prestador` | `prize_worker` | Sim. Sorteios mensais de prestadores. |
| **Prêmio Consumidor** | `premio_consumidor_pct` | `premio_consumidor` | `prize_consumer` | Sim. Sorteios mensais de tomadores. |
| **Padrinho/Madrinha** | `padrinho_pct` | No matching key | `godparent` | Sim. Comissão por indicação. |

---

## 17. Conflitos de Fontes

### CONFLITO DE FONTES 1 (Expectativa vs Banco de Produção)
- **Fonte A:** Navegador do Product Owner (localStorage local exibindo UBT 5%, Prêmios 1%).
- **Fonte B:** Supabase PostgreSQL Produção (`split_config` retornando UBT 4%, Prêmios 1.5%).
- **Diferença:** Percentuais econômicos não sincronizados.
- **Impacto:** Edge Functions continuariam dividindo os pagamentos com base em (4% / 1.5%).
- **Recomendação:** Executar o script de alinhamento abaixo para consolidar as metas econômicas do PO.

---

## 18. Lacunas
- `UNKNOWN`: A data em que o PO clicou em salvar na UI legada (ausência de dados de log, visto que a alteração ficou retida na memória local do navegador).

---

## 19. Riscos
- **Inconsistência Operacional:** Divergência entre splits se as duas tabelas (`split_config` e `system_settings`) fossem operadas de forma independente. O acoplamento transacional introduzido na Wave 3 mitiga este risco.

---

## 20. Correção Recomendada — NÃO EXECUTADA

> [!WARNING]
> **AÇÃO BLOQUEADA — AGUARDANDO AUTORIZAÇÃO DO PO**
> Nenhuma query de escrita foi executada em ambiente de Produção. As tabelas permanecem com os valores antigos até aprovação formal.

### Scripts de Sincronização Preparados:

1. **Atualização da Tabela `split_config`:**
   ```sql
   UPDATE public.split_config
   SET ubt_pct = 5.000,
       premio_trabalhador_pct = 1.000,
       premio_consumidor_pct = 1.000,
       updated_at = NOW()
   WHERE id = 1;
   ```

2. **Sincronização com `system_settings`:**
   ```sql
   UPDATE public.system_settings SET valor = '0.05'::jsonb WHERE chave = 'taxa_ubt';
   UPDATE public.system_settings SET valor = '0.01'::jsonb WHERE chave = 'premio_prestador';
   UPDATE public.system_settings SET valor = '0.01'::jsonb WHERE chave = 'premio_consumidor';
   ```

---

## 21. Impacto Futuro no Mercado Pago
A estabilização da base única em Produção garante que o futuro fluxo de Sandbox execute repasses corretos e proporcionais às chaves indicadas na API do gateway.

---

## 22. Impacto Futuro no `/admin`
Quaisquer ajustes financeiros subsequentes na interface administrativa serão refletidos instantaneamente no PostgreSQL de Produção, atualizando o comportamento global de splits em tempo real.

---

## 23. Itens para Wiki
- Como as comissões são estruturadas em `split_config` no Supabase e a importância de validar a soma das frações em 100%.

---

## 24. Próximo Passo Recomendado
- Obter a aprovação do PO para rodar os scripts de correção financeira e, na sequência, iniciar os testes reais do Mercado Pago Sandbox.
