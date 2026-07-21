# Matriz de Permissões — RBAC Backoffice UBT

Este documento define a governança de acesso baseado em papéis (RBAC - Role-Based Access Control) no painel administrativo do UBT SuperApp, determinando as rotas acessíveis e menus visíveis para cada perfil operacional.

---

## 1. Perfis de Acesso (Roles)

*   `operator` (Operações): Foco no monitoramento de cadastros, aprovações operacionais de KYC e monitoramento em tempo real do piloto.
*   `financeiro` (Financeiro): Acesso irrestrito a relatórios fiscais, splits, saques e conciliações de pagamento.
*   `moderador` (Mediação): Responsável pela moderação de conflitos e suporte ao cliente em disputas.
*   `admin` (Administrador): Gerenciador operacional pleno (sem privilégios de auditoria ou privacidade profunda).
*   `super_admin` (Super Administrador): Acesso total, incluindo segurança, LGPD, exclusões de contas e logs de auditoria imutáveis.

---

## 2. Matriz de Rotas & Mapeamento de Permissões

A tabela abaixo cruza cada rota do painel administrativo com os papéis que possuem autorização de acesso e visualização no menu de navegação lateral:

| Rota / Recurso | Descrição | Operator | Financeiro | Moderador | Admin | Super Admin |
| :--- | :--- | :---: | :---: | :---: | :---: | :---: |
| `/admin` | Dashboard administrativo unificado | 🟢 | 🟢 | 🟢 | 🟢 | 🟢 |
| `/admin/clientes` | Gestão de perfis e alteração de status | 🟢 | ❌ | 🟢 | 🟢 | 🟢 |
| `/admin/kyc-pendentes` | Análise de documentos e onboarding | 🟢 | ❌ | ❌ | 🟢 | 🟢 |
| `/admin/financeiro` | Balanços e faturamento das verticais | ❌ | 🟢 | ❌ | 🟢 | 🟢 |
| `/admin/payments` | Detalhamento de transações individuais | ❌ | 🟢 | ❌ | 🟢 | 🟢 |
| `/admin/payouts` | Liberação e controle de saques Pix | ❌ | 🟢 | ❌ | 🟢 | 🟢 |
| `/admin/disputes` | Mediações e contestações abertas | ❌ | ❌ | 🟢 | 🟢 | 🟢 |
| `/admin/refunds` | Processamento de reembolsos de pagamentos | ❌ | 🟢 | ❌ | 🟢 | 🟢 |
| `/admin/cancellations` | Visualização de logs de cancelamento | 🟢 | 🟢 | ❌ | 🟢 | 🟢 |
| `/admin/operacoes` | Painel realtime de acompanhamento | 🟢 | ❌ | ❌ | 🟢 | 🟢 |
| `/admin/split` | Taxas de comissão e parametrização | ❌ | 🟢 | ❌ | 🟢 | 🟢 |
| `/admin/preco` | Configurações de preço dinâmico e metas | 🟢 | ❌ | ❌ | 🟢 | 🟢 |
| `/admin/arbitragem` | Painel de controle de disputas | ❌ | ❌ | 🟢 | 🟢 | 🟢 |
| `/admin/entidades` | Gerenciamento de entidades parceiras | 🟢 | ❌ | ❌ | 🟢 | 🟢 |
| `/admin/conteudo` | Moderação de propagandas e avisos | 🟢 | ❌ | ❌ | 🟢 | 🟢 |
| `/admin/coco` | Equipes e balanço de coletas do Coco | 🟢 | ❌ | ❌ | 🟢 | 🟢 |
| `/admin/diaristas` | Kit diarista e controle de diárias | 🟢 | ❌ | ❌ | 🟢 | 🟢 |
| `/admin/lgpd` | Gestão de consentimentos e deleção de dados | ❌ | ❌ | ❌ | ❌ | 🟢 |
| `/admin/auditoria` | Visualização de trilhas de auditoria imutáveis | ❌ | ❌ | ❌ | ❌ | 🟢 |

---

## 3. Mecanismo de Segurança do Frontend

1.  **Proteção de Rota (Guard):** O componente `<AdminRoute allowedRoles={...}>` intercepta requisições de roteamento a nível de aplicação. Caso o usuário não possua um papel compatível, ele é automaticamente redirecionado à tela de login administrativo.
2.  **Ocultação de Menu (Sidebar):** O componente `<Sidebar />` lê dinamicamente a role atribuída ao usuário conectado no Supabase e filtra as opções do array `NAV_ITEMS` antes de renderizar a navegação.
3.  **Bypass do Desenvolvedor:** O e-mail `ubt.servicos@gmail.com` é tratado diretamente no frontend como papel `super_admin` por motivos de recuperação de emergência (emergency override).
