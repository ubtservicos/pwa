# UBT-PAY-004C-WALKTHROUGH

Este guia apresenta as instruções para auditar e atestar a blindagem do isolamento dos três ambientes oficiais da UBT.

---

## 1. Auditoria de Conectividade do Desenvolvedor (Localhost)
1. Abra o arquivo local `.env` no repositório de desenvolvimento.
2. Certifique-se de que a variável `VITE_SUPABASE_URL` aponta estritamente para a instância de Homologação:
   `https://xqujubbqcfqxkfczbidq.supabase.co`
3. Execute comandos de testes locais ou dev server:
   - Se tentar rodar queries locais, confirme que elas alteram apenas a base `UBT - Dev/Homol`.
4. Isso garante que o localhost está isolado do banco de Produção.

---

## 2. Auditoria do Pipeline de Homologação (Vercel HOMOLOG)
1. Acesse o deploy da branch `main` na Vercel:
   `https://app-git-main-ubtservicos-projects.vercel.app`
2. Efetue o cadastro de um lead de teste na Landing Page.
3. Abra a interface administrativa em `/admin/waitlist` conectada ao projeto DEV/HOMOLOG.
4. Verifique que o lead recém-cadastrado aparece na listagem de homologação.
5. Isso comprova que o fluxo de Homologação opera de forma isolada na nuvem.

---

## 3. Auditoria do Pipeline de Produção (Vercel PROD)
1. Abra as configurações de ambiente do deploy Production da Vercel.
2. Certifique-se de que a variável `VITE_SUPABASE_URL` está definida estritamente com o Project Ref de Produção:
   `https://bfqidoduceusbqlnrsol.supabase.co`
3. Abra o console do projeto Supabase **"UBT - Prod"** (`bfqidoduceusbqlnrsol`) no Table Editor.
4. Confirme que nenhuma ação feita no Passo 2 (Homologação) gerou registros nas tabelas `public.usuarios` ou `public.waitlist` de Produção.
5. Isso comprova documentalmente a separação absoluta dos três ambientes oficiais.
