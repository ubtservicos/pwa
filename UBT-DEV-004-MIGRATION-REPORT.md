# UBT-DEV-004-MIGRATION-REPORT

## 1. Identificação
- **Data/Hora:** 2026-08-02T09:28:00-03:00
- **Workspace:** `C:\Users\MacInBox\Documents\profissional\ubt\pwa`
- **Migration Aplicada:** [33_waitlist_multi_profile.sql](file:///C:/Users/MacInBox/Documents/profissional/ubt/pwa/33_waitlist_multi_profile.sql)
- **Banco/Projeto Alvo:** Supabase UBT (`xqujubbqcfqxkfczbidq` no pooler da AWS)

## 2. Auditoria do Schema (Antes da Migration)
* **Status da Tabela:** A tabela `public.waitlist` existe e está vazia (0 registros).
* **Coluna Perfil:** Tipo `text NOT NULL` (nullable: NO).
* **RLS Status:** Ativado (`RowSecurityEnabled: true`).
* **Policies Relacionadas:**
  * `"Enable insert for anyone on waitlist"` (INSERT)
  * `"Enable read access for admins on waitlist"` (SELECT)
  * `"Enable write access for admins on waitlist"` (UPDATE)
* **Índices/Triggers:** Nenhum índice ou trigger depende ou faz referência à coluna `perfil`.

## 3. Aplicação da Migration
* A migration foi aplicada com sucesso via conexão PostgreSQL direta:
```sql
ALTER TABLE public.waitlist 
  ALTER COLUMN perfil TYPE text[] USING ARRAY[perfil]::text[];
```

## 4. Validação do Schema (Após a Migration)
* **Coluna Perfil:** Tipo `ARRAY` (mapeado para `text[]` no PostgreSQL).
* **RLS Status:** Permanece ativado (`RowSecurityEnabled: true`).
* **Policies Relacionadas:** Inalteradas e totalmente válidas (não foram afetadas pela mudança de tipo da coluna).
* **Registros:** A tabela continua com 0 registros (nenhum dado perdido).

## 5. Teste de Compatibilidade e Integridade
O script de teste inseriu temporariamente dois registros e validou a leitura e filtragem:
1. **Lead com Perfil Único (ex: Migrado):**
   * Inserido lead com `perfil = ARRAY['morador']`.
   * Retornado como objeto array: `["morador"]` (PASS).
2. **Lead com Múltiplos Perfis:**
   * Inserido lead com `perfil = ARRAY['morador', 'prestador', 'associacao']`.
   * Retornado como objeto array: `["morador", "prestador", "associacao"]` (PASS).
3. **Filtro por Perfil:**
   * Query de filtro usando operador de array `@> ARRAY['prestador']::text[]` (equivalente ao `.cs()` do cliente Supabase) retornou corretamente apenas o lead com múltiplos perfis (PASS).
4. **Limpeza:** Os registros de teste foram removidos após a validação.

## 6. Riscos Encontrados
Nenhum risco detectado. A migração foi executada em transação SQL isolada. O uso de `text[]` é compatível com os leads legados (lidos como arrays de um elemento) e com a estrutura do frontend atualizada no passo UBT-DEV-003.

## 7. Decisão e Necessidade de Deploy
* **Migration no Supabase:** Executada e concluída (YES).
* **Deploy necessário:** YES (O código atualizado do frontend em React/TypeScript precisa ser compilado e publicado na Vercel para suportar a seleção múltipla e o filtro por array no painel administrativo).
* **Resultado Geral:** PASS
