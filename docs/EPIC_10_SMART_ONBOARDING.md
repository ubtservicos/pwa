# Épico 10: Smart Onboarding & Aprovação Pendente
**Módulo:** Onboarding / Cadastro  
**Status:** Documentado & Estruturado

## 1. Visão Geral do Smart Onboarding

Para melhorar a conversão, usabilidade e coleta de dados específicos do Superapp UBT, reestruturamos o fluxo de Cadastro para um modelo dinâmico ("Smart Onboarding") que se adapta de acordo com o perfil/role do usuário.

---

## 2. Regras Condicionais de Formulário

A interface de cadastro permite selecionar um perfil e responde exibindo ou ocultando campos de forma inteligente:

### A. Associação (Entidade B2B)
* **Regras de Exibição:** Desabilita as opções de múltiplas escolhas de categoria, oculta campos de endereço residencial/profissional e praias.
* **Campos Exigidos:** Razão Social (Nome), CNPJ, E-mail, Telefone, Senha.

### B. Mototaxista (Prestador Operacional)
* **Regras de Exibição:** Oculta o campo "Bairro / Endereço de Trabalho" (pois o local de trabalho é itinerante).
* **Campos Exigidos:** Nome Completo, CPF, Telefone, Chave Pix, Senha, Bairro de Moradia.

### C. Ambulante (Prestador Comercial)
* **Regras de Exibição:** Exibe o checklist multiselect "Praias que costuma atender" para mapeamento de pontos de vendas na orla de Ubatuba.
* **Campos Exigidos:** Nome Completo, CPF, Telefone, Chave Pix, Senha, Praias que atende.

### D. Morador / Turista (Tomador de Serviços)
* **Regras de Exibição:** Exibe campos específicos para entender hábitos de consumo local: "Bairro que mora", "Bairro que trabalha" e "Praias que frequenta" (multiselect).
* **Campos Exigidos:** Nome Completo, CPF, Telefone, Senha, Bairro que mora, Bairro que trabalha, Praias que frequenta.

---

## 3. Estado de Cadastro Pendente e Fluxo de Redirecionamento

### Status Padrão: `pending`
Novos cadastros são inseridos na tabela `usuarios` com a propriedade `status: "pending"` (em vez de `active`).

### Redirecionamento à Tela de Análise (`PendingApprovalPage.tsx`)
Quando um usuário com `status === 'pending'` realiza login, o sistema o intercepta compulsoriamente (via `LgpdGuard.tsx`) e o redireciona para a tela `/app/pendente`.
* **Design da Tela:** Visual Dark característico do design system, mensagem motivadora explicando que a conta está em análise de segurança pela equipe administrativa da UBT Serviços.
* **PWA Cache Persistence:** O estado de autenticação (JWT e perfil básico) é persistido no localStorage/sessionStorage para manter a sessão ativa em instalações PWA, impedindo que o usuário precise refazer login a cada abertura do app.
