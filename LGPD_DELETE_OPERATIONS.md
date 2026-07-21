# Manual de Operações — Exclusão LGPD & Conformidade Fiscal UBT

Este manual detalha o funcionamento operacional da exclusão lógica e anonimização de contas de usuários no UBT SuperApp, balanceando os direitos do titular (Art. 16, LGPD) com os deveres tributários de guarda de registros comerciais (Lei 10.406/02 Art. 1.194 / Receita Federal).

---

## 1. Fundamento Legal de Retenção Contábil

De acordo com o **Artigo 16, Inciso I da LGPD**, a eliminação dos dados pessoais pode ser dispensada para o cumprimento de obrigação legal ou regulatória pelo controlador. 

No Brasil:
*   **Prazo Fiscal (5 anos):** Registros contábeis, notas fiscais e dados de transações financeiras (como pagamentos de corridas/splits e transferências Pix efetuadas) devem ser retidos por no mínimo 5 anos para auditoria tributária da Receita Federal.
*   **Mitigação LGPD (Anonimização):** Em vez de excluir a linha física da tabela `public.usuarios` (o que causaria quebra de integridade referencial nas tabelas de faturamento e relatórios financeiros), a plataforma realiza a **anonimização irreversível** dos dados sensíveis identificáveis do titular.

---

## 2. Fluxo Técnico de Desativação e Limpeza

Quando o usuário ou o administrador solicita a exclusão da conta, a Edge Function `/delete-account` executa as seguintes operações atômicas:

### 2.1 Atualização de Dados Cadastrais (`usuarios` e `profiles`)
1.  **Nome:** Substituído por `'ANONYMIZED_USER'`.
2.  **E-mail:** Gerado um hash de e-mail aleatório (ex: `deleted_abc123@ubtsuperapp.com.br`) para desvincular o e-mail real do usuário (permitindo que ele se cadastre novamente no futuro caso queira).
3.  **Telefone / Celular:** Substituído pelo hash correspondente para anonimização total.
4.  **Marcadores de Auditoria:** As colunas `deleted_at` e `anonymized_at` recebem a data e hora do processamento.
5.  **Papel (Role):** A role do usuário é rebaixada para `'tomador'`, bloqueando acessos a módulos de prestador.

### 2.2 Purga Física do Storage (`kyc-documents`)
Todos os documentos carregados no Supabase Storage sob o caminho do usuário (ex: fotos de CNH, comprovantes de residência e licenças) são **física e definitivamente deletados** do bucket, garantindo que nenhum documento identificável permaneça hospedado.

### 2.3 Exclusão de Credenciais (Auth.Users)
O cadastro do usuário na tabela de autenticação nativa do Supabase (`auth.users`) é excluído fisicamente via `admin.deleteUser(target_user_id)`. Se houver restrição, o e-mail cadastrado na autenticação é sobrescrito pelo hash anonymized correspondente, bloqueando acessos de login.

---

## 3. Diretrizes para Operadores Administrativos

Para gerenciar solicitações de exclusão de dados na interface administrativa `/admin/lgpd`:
1.  Pesquise o usuário por E-mail ou Nome.
2.  Valide a identidade do titular do direito.
3.  Utilize o botão **"Excluir Conta Definitivamente"**. A tela emitirá um aviso lembrando que a ação de anonimização e exclusão de documentos é **irreversível**.
4.  Confirme a ação. O painel disparará a chamada da Edge Function, e a conta será desativada com sucesso.
