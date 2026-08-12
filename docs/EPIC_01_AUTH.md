# Epic 01 — Supabase Authentication & Profile Management

Este documento descreve as especificações e regras de negócio para o Épico de Autenticação utilizando o Supabase no PWA da UBT.

---

## 1. Regras de Negócio e Funcionalidades

### 1.1. Autenticação Baseada em E-mail & Senha
- **Cadastro (SignUp):** Os usuários cadastram-se preenchendo Nome, CPF, Telefone, E-mail, Chave Pix e Senha. O cadastro invoca `supabase.auth.signUp`. Os metadados do perfil do usuário são enviados no objeto `options.data`.
- **Entrada (Login/SignIn):** O login é validado via e-mail e senha usando `supabase.auth.signInWithPassword`.
- **Validação de Credenciais:** Caso as credenciais sejam inválidas, a interface deve exibir um feedback visual e um Toast de erro ("Credenciais inválidas. Por favor, verifique seu e-mail e senha. ❌").

### 1.2. Gerenciamento de Sessão Reativa
- **Hook useCurrentUser:** O hook centraliza a sessão do usuário de forma reativa:
  - Recupera a sessão atual via `supabase.auth.getSession()` ou `supabase.auth.getUser()` no carregamento.
  - Ouve atualizações de autenticação em tempo real com `supabase.auth.onAuthStateChange`.
  - Resolve dados do perfil buscando na tabela `public.usuarios` (dados como `nome` e `role`).
  - Fallback automático para o estado `Visitante` (role `tomador`, uid vazio `""`) quando o usuário desloga.

---

## 2. Tabelas e Integrações
- **Usuarios / Profiles:** As informações adicionais de perfil do usuário são vinculadas ao seu `auth.uid` correspondente.
- **Padrinho/Madrinha:** Se o link contiver indicação (`?ref=`), o ID do padrinho/madrinha é atribuído no cadastro e gravado na base de dados.
