# UBT-PAY-004B-WALKTHROUGH

Este guia descreve como um operador ou PO da UBT pode verificar se o isolamento de ambientes e o bootstrap da produção estão operando corretamente.

---

## 1. Verificando o Isolamento do Ambiente de Produção
1. Acesse o painel da Vercel e abra as configurações do projeto de Produção (`app`).
2. Vá em **Environment Variables**.
3. Confirme que no ambiente **Production** a variável:
   - `VITE_SUPABASE_URL` é igual a:
     `https://bfqidoduceusbqlnrsol.supabase.co`
4. Vá para o ambiente **Preview / Development** nas configurações e confirme que:
   - `VITE_SUPABASE_URL` é igual a:
     `https://xqujubbqcfqxkfczbidq.supabase.co`
5. Isso comprova o isolamento de ambientes no pipeline de Deploy.

---

## 2. Verificando as Tabelas em Produção (UBT - Prod)
1. Conecte ao painel/console da Supabase utilizando a conta administrativa da UBT no projeto **"UBT - Prod"** (`bfqidoduceusbqlnrsol`).
2. Acesse o **Table Editor**.
3. Verifique que:
   - A tabela `public.usuarios` existe e está vazia.
   - A tabela `public.waitlist` existe e está vazia.
   - A tabela `public.user_onboarding` existe e está vazia.
   - A tabela `public.admin_audit_logs` existe e está vazia.
4. Isso comprova que Produção nasceu limpa (sem vazamento de dados de teste/desenvolvimento).

---

## 3. Verificando a Configuração Econômica de Produção
1. No console da Supabase do projeto **"UBT - Prod"**, acesse o SQL Editor.
2. Execute a seguinte query:
   ```sql
   SELECT * FROM public.split_config;
   ```
3. Confirme que o resultado é o split de faturamento oficial:
   - `prestador_pct = 90.000`
   - `ubt_pct = 5.000`
   - `comunidade_pct = 2.000`
   - `premio_trabalhador_pct = 1.000`
   - `premio_consumidor_pct = 1.000`
   - `padrinho_pct = 1.000`
4. Execute também a query:
   ```sql
   SELECT chave, valor FROM public.system_settings WHERE chave IN ('taxa_ubt', 'percentual_associacao');
   ```
5. Confirme que as chaves retornam os valores:
   - `taxa_ubt = 0.05`
   - `percentual_associacao = 0.02`
6. Isso comprova que a governança econômica de faturamento está locked e sincronizada com as definições do PO.
