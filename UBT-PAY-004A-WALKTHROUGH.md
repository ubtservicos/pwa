# UBT-PAY-004A-WALKTHROUGH

Este guia apresenta o passo a passo para que qualquer colaborador da equipe consiga testar o fluxo de waitlist e onboarding no ambiente de Homologação.

---

## Passo 1: Acessar o Ambiente de Homologação
1. Abra o navegador e acesse a URL de Homologação:
   `https://app-git-main-ubtservicos-projects.vercel.app`
2. Certifique-se de que a página inicial carrega normalmente.

---

## Passo 2: Criar Lead de Teste na Landing Page
1. No formulário de cadastro de Fundadores ("Seja um Fundador"):
   - Preencha Nome Completo (ex: `QA Tester Homolog`).
   - Insira E-mail (ex: `tester@ubtsuperapp.com.br`).
   - Insira Telefone (ex: `(12) 99999-9999`).
   - Insira Cidade: `Ubatuba`.
2. Responda à pergunta: *"Você já possui conta no Mercado Pago?"*:
   - Clique em **Sim** ou **Não**.
3. Envie o formulário e confirme a mensagem visual de sucesso.

---

## Passo 3: Acessar a Tela de Waitlist Administrativa
1. Efetue login com uma conta administrativa do sistema.
2. Navegue até o menu lateral ou acesse diretamente a URL:
   `/admin/waitlist`
3. Confirme que o lead criado no Passo 2 aparece na tabela com a resposta correspondente do Mercado Pago na coluna *"Mercado Pago?"*.

---

## Passo 4: Aprovação Individual de Leads
1. Localize o lead criado no Passo 2 e clique no botão **"Detalhes"**.
2. No modal que se abre, verifique os dados de aquisição e o consentimento LGPD.
3. Clique em **"Aprovar Lead"**.
4. Confirme que:
   - O status do lead muda para **Aprovado**.
   - O toast administrativo mostra sucesso na aprovação.
   - O log de auditoria foi gravado e a comunicação mock com o `whatsapp-agent` foi disparada (atualizando `communication_status` para `sent` na tabela `user_onboarding`).

---

## Passo 5: Aprovação em Lote de Leads
1. Crie 3 leads adicionais de teste na Landing Page.
2. Acesse a tela `/admin/waitlist`.
3. Selecione os checkboxes dos 3 novos leads.
4. No painel de lote superior, clique em **"Aprovar Lote"** e depois em **Confirmar**.
5. Verifique se os status de todos os 3 mudam para **Aprovado** e os logs de auditoria correspondentes são criados na nuvem Supabase.

---

## Passo 6: Validar URL de Onboarding
1. Através do console do Supabase ou banco de dados, verifique o registro criado na tabela `user_onboarding` para um dos leads aprovados.
2. Confirme que a URL gerada segue o padrão:
   `https://ubtsuperapp.com.br/onboarding?token={waitlist_id}`
3. Acesse a rota `/onboarding` para confirmar que a máquina de estados está no status `WAITLIST_APPROVED` e pronta para iniciar a fase de cadastro.

---

## Passo 7: Teste Matemático de Splits
1. A Edge Function `/checkout` pode ser testada localmente ou em Homologação passando o payload de simulação.
2. Confirmar que a divisão do valor da transação distribui centavos de forma exata para os 6 favorecidos sem perdas ou sobras.
- Exemplo com R$ 13,37:
  - Prestador recebe R$ 12,04 (ajustado pelo residual rounding).
  - UBT recebe R$ 0,67.
  - Associação recebe R$ 0,27.
  - Prêmios recebem R$ 0,13 cada.
  - Padrinho recebe R$ 0,13.
  - **Soma:** R$ 13,37 (100% correto).
