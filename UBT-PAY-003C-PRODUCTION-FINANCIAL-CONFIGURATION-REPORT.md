# UBT-PAY-003C-PRODUCTION-FINANCIAL-CONFIGURATION-REPORT

## 1. Status
**Status:** `UBT-PAY-003C-READY-FOR-PO-AUTHORIZATION`
Nenhuma alteração foi realizada nas tabelas de Produção do Supabase (`split_config` e `system_settings`) nem na migration `36_waitlist_mercado_pago_field.sql`. O diagnóstico foi concluído, as divergências foram mapeadas, as fórmulas matemáticas foram validadas e os scripts SQL de migração e alinhamento de dados estão preparados para aplicação assim que autorizados pelo Product Owner.

---

## 2. Objetivo
Executar o diagnóstico pré-alteração da configuração financeira da UBT em Produção, comparar os dados com o modelo econômico oficial, projetar a migração em lote de forma transacional e obter a autorização formal do PO.

---

## 3. Estado Financeiro Antes da Alteração
Após consulta direta no banco de dados remoto da Produção, o estado atual das tabelas é:

### Tabela `public.split_config`
- **Registro:** `id = 1` (único registro na tabela).
- **Dados:**
  - `prestador_pct` = `90.000` (90%)
  - `ubt_pct` = `4.000` (4%)
  - `comunidade_pct` = `2.000` (2%)
  - `premio_trabalhador_pct` = `1.500` (1.5%)
  - `premio_consumidor_pct` = `1.500` (1.5%)
  - `padrinho_pct` = `1.000` (1%)
  - `updated_at` = `2026-05-07 19:45:38.545-03`
  - `active` / `status` = Não existem colunas ou flags desse tipo na tabela (apenas a chave primária `id`).

### Tabela `public.system_settings`
- `taxa_ubt` = `0.04` (4%)
- `premio_consumidor` = `0.01` (1%)
- `premio_prestador` = `0.01` (1%)
- `percentual_associacao` = `0.005` (0.5%)

---

## 4. Regra Oficial do PO
O modelo econômico final desejado pelo Product Owner é:
- **Prestador:** 90%
- **UBT:** 5%
- **Associação:** 2%
- **Prêmio Trabalhador:** 1%
- **Prêmio Consumidor:** 1%
- **Padrinho/Madrinha:** 1%
- **TOTAL:** 100%

---

## 5. Matriz de Comparação
Abaixo está disposta a tabela de percentuais coletados:

| Fonte | Prestador | UBT | Associação | Prêmio Trab. | Prêmio Cons. | Padrinho | Total | Status |
|---|---:|---:|---:|---:|---:|---:|---:|---|
| `split_config` (Produção) | 90% | 4% | 2% | 1.5% | 1.5% | 1% | 100% | `VALIDADO` |
| `system_settings` (Produção) | `N/A` | 4% | 0.5% | 1% | 1% | `N/A` | `N/A` | `CONFLITO` |
| `/checkout` (Runtime Code) | Dinâmico | Dinâmico | Dinâmico | Dinâmico | Dinâmico | Dinâmico | 100% | `VALIDADO` |
| `/admin/split` (UI) | Dinâmico | Dinâmico | Dinâmico | Dinâmico | Dinâmico | Dinâmico | 100% | `VALIDADO` |
| `localStorage` | 90% | 5% | 2% | 1% | 1% | 1% | 100% | `LEGACY` |
| Regra PO (Alvo) | 90% | 5% | 2% | 1% | 1% | 1% | 100% | `REQUIREMENT` |

---

## 6. Evidências de Banco
As queries SELECT comprovaram que a tabela `split_config` possui apenas o registro `id = 1` e que a coluna `possui_conta_mercado_pago` na tabela `waitlist` ainda não existe.

---

## 7. Evidências de Código
O arquivo [/checkout/index.ts](file:///C:/Users/MacInBox/Documents/profissional/ubt/supabase/functions/checkout/index.ts) não possui constantes chumbadas, carregando os coeficientes via `supabase.from("split_config")`. O mesmo ocorre nas páginas administrativas de sorteio de bilhetes.

---

## 8. Evidências de UI
A tela [/admin/split](file:///C:/Users/MacInBox/Documents/profissional/ubt/pwa/src/pages/admin/AdminSplitPage.tsx) lê os dados a partir de `split_config` no banco de dados e os exibe corretamente.

---

## 9. split_config
- `id` (Primary Key, integer, Default: 1).
- RLS ativa. `split_select` permite consulta para autenticados; `split_update` exige `is_superadmin()`.

---

## 10. system_settings
- Chaves mapeadas correspondentes:
  - `taxa_ubt` <-> `ubt_pct`
  - `premio_prestador` <-> `premio_trabalhador_pct`
  - `premio_consumidor` <-> `premio_consumidor_pct`
  - `percentual_associacao` <-> `comunidade_pct`

---

## 11. localStorage
A chave `ubt_split_config` do navegador local foi descontinuada e agora serve apenas como fallback em caso de falha de rede.

---

## 12. /checkout
Calcula as 6 parcelas dinamicamente a partir do banco e insere no `payment_splits`.

---

## 13. /admin/split
Valida client-side que a soma deve ser exatamente igual a 100% antes de habilitar a sincronização na nuvem.

---

## 14. Fallbacks
- **Risco de Fallback Desatualizado:** A Edge Function `/checkout` possui um fallback estático de `0.90` (prestador) e `0.04` (UBT) caso o banco falhe. Como a taxa desejada da UBT é de 5%, este fallback está desalinhado da regra oficial.
- **Recomendação:** No futuro, atualizar o fallback no código da Edge Function para refletir a nova regra (`0.90` prestador, `0.05` UBT, `0.01` prêmios).

---

## 15. RLS / Policies
A policy `split_update` bloqueia escritas diretas de usuários não administrativos (`is_superadmin()` obrigatório).

---

## 16. Análise de Duplicidade
A tabela `system_settings` é **redundante** para a execução do checkout de splits, mas é atualizada concorrentemente para compatibilidade e histórico de versão de configurações.

---

## 17. SQL Proposto

Para aplicar a regra econômica do PO de forma transacional e consistente em Produção:

```sql
BEGIN;

-- 1. Atualizar split_config central
UPDATE public.split_config
SET ubt_pct = 5.000,
    premio_trabalhador_pct = 1.000,
    premio_consumidor_pct = 1.000,
    updated_at = NOW()
WHERE id = 1;

-- 2. Atualizar system_settings espelhadas
UPDATE public.system_settings SET valor = '0.05'::jsonb WHERE chave = 'taxa_ubt';
UPDATE public.system_settings SET valor = '0.01'::jsonb WHERE chave = 'premio_prestador';
UPDATE public.system_settings SET valor = '0.01'::jsonb WHERE chave = 'premio_consumidor';

COMMIT;
```

---

## 18. Autorização do PO
> [!IMPORTANT]
> **Aguardando autorização com a string exata:**
> `"PO AUTORIZA APLICAÇÃO DO UBT-PAY-003C EM PRODUÇÃO."`

---

## 19. SQL Executado, Se Autorizado
`[NÃO EXECUTADO — AGUARDANDO AUTORIZAÇÃO]`

---

## 20. Estado Depois da Alteração
`[NÃO APLICADO]`

---

## 21. Testes Matemáticos
Cálculo simulado para diferentes volumes de transação com a regra oficial `90 / 5 / 2 / 1 / 1 / 1`:

- **Transação R$ 100,00:**
  - Prestador: R$ 90,00
  - UBT: R$ 5,00
  - Associação: R$ 2,00
  - Prêmio Trabalhador: R$ 1,00
  - Prêmio Consumidor: R$ 1,00
  - Padrinho: R$ 1,00
  - **Soma:** R$ 100,00 (Exato)

- **Transação R$ 50,00:**
  - Prestador: R$ 45,00
  - UBT: R$ 2,50
  - Associação: R$ 1,00
  - Prêmio Trabalhador: R$ 0,50
  - Prêmio Consumidor: R$ 0,50
  - Padrinho: R$ 0,50
  - **Soma:** R$ 50,00 (Exato)

- **Transação R$ 10,00:**
  - Prestador: R$ 9,00
  - UBT: R$ 0,50
  - Associação: R$ 0,20
  - Prêmio Trabalhador: R$ 0,10
  - Prêmio Consumidor: R$ 0,10
  - Padrinho: R$ 0,10
  - **Soma:** R$ 10,00 (Exato)

---

## 22. Testes de Arredondamento
- **Risco de Diferença Monetária:** Em dízimas ou valores ímpares (ex: R$ 13,37), a soma das parcelas arredondadas com duas casas decimais (`.toFixed(2)`) pode diferir do valor total da transação por 1 ou 2 centavos.
- **Exemplo com R$ 13,37:**
  - Prestador: `13.37 * 0.9 = 12.033` -> R$ 12,03
  - UBT: `13.37 * 0.05 = 0.6685` -> R$ 0,67
  - Associação: `13.37 * 0.02 = 0.2674` -> R$ 0,27
  - Prêmio Trab.: `13.37 * 0.01 = 0.1337` -> R$ 0,13
  - Prêmio Cons.: `13.37 * 0.01 = 0.1337` -> R$ 0,13
  - Padrinho: `13.37 * 0.01 = 0.1337` -> R$ 0,13
  - **Soma das parcelas:** R$ 13,36 (Diferença de -R$ 0,01).
- **Recomendação:** Implementar mecanismo de ajuste de centavos (residual rounding allocation) na Edge Function `/checkout` para que qualquer sobra/falta de centavo seja compensada na parcela da UBT ou do Prestador, mantendo o total em conformidade matemática.

---

## 23. Impacto no /admin
No painel `/admin`, a reconciliação futura do Mercado Pago precisará cruzar os valores esperados calculados no banco UBT contra os splits reais liquidados pelo gateway Mercado Pago, disparando alertas em caso de divergência.

---

## 24. Impacto Futuro no Mercado Pago
As contas Mercado Pago (`recipient_id`) precisarão ser autenticadas via OAuth no banco UBT para que o gateway consiga efetuar a divisão física dos valores em Sandbox.

---

## 25. Estado da Landing Page
O campo `possuiContaMercadoPago` (Sim/Não) é capturado obrigatoriamente no frontend de cadastro de waitlist e gravado com segurança na coluna `observacoes` da tabela `waitlist` remoto.

---

## 26. Estado da migration 36_waitlist_mercado_pago_field.sql
A migration está comitada e pronta no repositório, mas **não** foi executada no Supabase de Produção, mantendo o fallback de `observacoes` ativo.

---

## 27. Estado dos Ambientes
- **Risco de Compartilhamento:** Localhost e Produção conectam-se ao mesmo banco de dados PostgreSQL.
- **Impacto:** Testes locais alteram configurações do aplicativo em produção instantaneamente.
- **Recomendação:** Criar um projeto Supabase separado para desenvolvimento/staging antes de prosseguir com os webhooks do Mercado Pago.

---

## 28. Riscos
- **Diferença de centavos:** Risco de discrepância de somas parciais por arredondamento no Pix Mercado Pago.
- **Divergência de Fallback:** Fallback de `/checkout` (4% UBT) discrepante da regra de produção (5% UBT).

---

## 29. Conflitos de Fontes
- **Conflito 1:** Tabela `split_config` em Produção (4% UBT, 1.5% prêmios) contra modelo econômico esperado pelo PO (5% UBT, 1% prêmios).

---

## 30. Lacunas
- `UNKNOWN`: Histórico temporal das edições locais no navegador do PO.

---

## 31. Itens para Wiki
- **Ação:** Sincronizar e reajustar comissões financeiras no Supabase.

---

## 32. Próximo Passo Recomendado
- Obter a autorização explícita do PO para executar a transação SQL de saneamento financeiro em Produção.
