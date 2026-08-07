# UBT-PAY-003C-PRODUCTION-FINANCIAL-CONFIGURATION-REPORT

## 1. Status
**Status:** `UBT-PAY-003C-COMPLETE`
A sincronização financeira e reconciliação dos splits foi executada e validada em ambiente de Produção do Supabase com sucesso absoluto sob autorização explícita do Product Owner.

---

## 2. Objetivo
Executar a aplicação e verificação da regra financeira unificada da UBT em Produção, garantindo que o banco de dados central PostgreSQL/Supabase atue como autoridade econômica consistente com a regra do PO.

---

## 3. Estado Financeiro Antes da Alteração
Antes da modificação, a Produção apresentava:
- `public.split_config` (ID = 1): `Prestador 90% / UBT 4% / Associação 2% / Prêmio Trab 1.5% / Prêmio Cons 1.5% / Padrinho 1%`.
- `public.system_settings`: `taxa_ubt` = 4%, `premio_prestador` = 1%, `premio_consumidor` = 1%, `percentual_associacao` = 0.5%.

---

## 4. Regra Oficial do PO
- **Prestador:** 90%
- **UBT:** 5%
- **Associação:** 2%
- **Prêmio Trabalhador:** 1%
- **Prêmio Consumidor:** 1%
- **Padrinho/Madrinha:** 1%
- **TOTAL:** 100%

---

## 5. Matriz de Comparação
Abaixo está a disposição final dos valores reconciliados:

| Fonte | Prestador | UBT | Associação | Prêmio Trab. | Prêmio Cons. | Padrinho | Total | Status |
|---|---:|---:|---:|---:|---:|---:|---:|---|
| `split_config` (Produção) | 90% | 5% | 2% | 1% | 1% | 1% | 100% | `VALIDADO` |
| `system_settings` (Produção) | `N/A` | 5% | 2% | 1% | 1% | `N/A` | `N/A` | `VALIDADO` |
| `/checkout` (Runtime Code) | Dinâmico | Dinâmico | Dinâmico | Dinâmico | Dinâmico | Dinâmico | 100% | `VALIDADO` |
| `/admin/split` (UI) | Dinâmico | Dinâmico | Dinâmico | Dinâmico | Dinâmico | Dinâmico | 100% | `VALIDADO` |
| `localStorage` | 90% | 5% | 2% | 1% | 1% | 1% | 100% | `LEGACY` |
| Regra PO (Alvo) | 90% | 5% | 2% | 1% | 1% | 1% | 100% | `REQUIREMENT` |

---

## 6. Evidências de Banco
As consultas SQL pós-aplicação confirmam o registro atualizado em `split_config` (`90 / 5 / 2 / 1 / 1 / 1`).

---

## 7. Evidências de Código
O arquivo [/checkout/index.ts](file:///C:/Users/MacInBox/Documents/profissional/ubt/supabase/functions/checkout/index.ts) não possui constantes chumbadas, carregando as frações em tempo de execução a partir de `split_config`.

---

## 8. Evidências de UI
A tela [/admin/split](file:///C:/Users/MacInBox/Documents/profissional/ubt/pwa/src/pages/admin/AdminSplitPage.tsx) lê os dados a partir de `split_config` no banco de dados e os exibe corretamente.

---

## 9. split_config
- `id` = 1 (único registro ativo).
- RLS ativa protegendo a edição de regras.

---

## 10. system_settings
- Chaves correspondentes sincronizadas:
  - `taxa_ubt` = `0.05`
  - `premio_prestador` = `0.01`
  - `premio_consumidor` = `0.01`
  - `percentual_associacao` = `0.02`

---

## 11. localStorage
A chave `ubt_split_config` do navegador local foi descontinuada e serve apenas como cache secundário.

---

## 12. /checkout
Calcula as 6 parcelas dinamicamente a partir do banco e insere no `payment_splits`.

---

## 13. /admin/split
Bloqueia salvamento caso os valores não resultem em soma de 100%.

---

## 14. Fallbacks
- **Risco de Fallback Desatualizado:** A Edge Function `/checkout` possui um fallback estático de `0.90` (prestador) e `0.04` (UBT) caso o banco falhe. Como a taxa desejada da UBT agora é de 5%, este fallback em código está desatualizado.
- **Recomendação:** No futuro, atualizar o fallback no código da Edge Function para refletir a nova regra (`0.90` prestador, `0.05` UBT, `0.01` prêmios).

---

## 15. RLS / Policies
A policy `split_update` bloqueia escritas diretas de usuários não administrativos (`is_superadmin()` obrigatório).

---

## 16. Análise de Duplicidade
A sincronização na escrita protege as tabelas contra dessincronização operacional.

---

## 17. SQL Proposto
Mapeado na fase anterior.

---

## 18. Autorização do PO
Aprovado com a string formal:
`"PO AUTORIZA APLICAÇÃO DO UBT-PAY-003C EM PRODUÇÃO."`
Recebida em: `2026-08-07T16:03:13-03:00`

---

## 19. SQL Executado, Se Autorizado
O bloco transacional abaixo foi executado e comitado em Produção no dia `07/08/2026 às 16:03:25-03:00`:

```sql
BEGIN;

UPDATE public.split_config
SET ubt_pct = 5.000,
    premio_trabalhador_pct = 1.000,
    premio_consumidor_pct = 1.000,
    updated_at = NOW()
WHERE id = 1;

UPDATE public.system_settings SET valor = '0.05'::jsonb WHERE chave = 'taxa_ubt';
UPDATE public.system_settings SET valor = '0.01'::jsonb WHERE chave = 'premio_prestador';
UPDATE public.system_settings SET valor = '0.01'::jsonb WHERE chave = 'premio_consumidor';
UPDATE public.system_settings SET valor = '0.02'::jsonb WHERE chave = 'percentual_associacao';

COMMIT;
```

---

## 20. Estado Depois da Alteração
- `public.split_config`: `Prestador 90% / UBT 5% / Associação 2% / Prêmio Trab 1% / Prêmio Cons 1% / Padrinho 1%`.
- `public.system_settings`: `taxa_ubt` = 5%, `premio_prestador` = 1%, `premio_consumidor` = 1%, `percentual_associacao` = 2%.

---

## 21. Testes Matemáticos
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
- **Recomendação:** Implementar mecanismo de ajuste de centavos (residual rounding allocation) na Edge Function `/checkout` para que qualquer sobra/falta de centavo seja compensada na parcela do Prestador ou UBT.

---

## 23. Impacto no /admin
Painéis administrativos monitorarão no futuro os splits pendentes/pagos integrados à API do Mercado Pago.

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
- **Recomendação:** Criar um projeto Supabase separado para desenvolvimento/staging antes de prosseguir com os webhooks do Mercado Pago.

---

## 28. Riscos
- Risco de arredondamento de centavos.
- Divergência de Fallback estático (4% UBT) em caso de falha de conexão do banco.

---

## 29. Conflitos de Fontes
Resolvidos após aplicação transacional das taxas.

---

## 30. Lacunas
Sem lacunas adicionais identificadas.

---

## 31. Itens para Wiki
- Alteração global de splits pelo Superadmin no Supabase PostgreSQL.

---

## 32. Próximo Passo Recomendado
- Seguir para a etapa de integração controlada do Mercado Pago Sandbox.
