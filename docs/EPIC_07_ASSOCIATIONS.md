# Épico 07: Portal B2B - Associações de Classe
**Módulo:** Gestão B2B / Associações
**Status:** Execução

## 1. Objetivo
Criar um portal dedicado para presidentes e gestores de Associações (Mototaxistas, Ambulantes, Diaristas). O portal servirá como vitrine para captação de entidades parceiras, demonstrando controle de filiados, transparência financeira (split) e ferramentas de comunicação (WhatsApp).

## 2. Nova Role e Estrutura de Dados
- **Role:** Adicionar `'associacao'` à tipagem `RealUserRole` no arquivo `database.types.ts`.
- **Tabelas Lógicas (Para as queries do UI):**
  - `associacoes_perfil`: Detalhes institucionais (CNPJ, nome fantasia, chave PIX).
  - `associacao_membros`: Tabela pivô vinculando `associacao_id` e `prestador_id` (status: ativo, pendente, bloqueado).

## 3. Estrutura de Telas (Dark/Bet Theme)
Rotas sob o agrupamento `/app/associacao`:
1. **Dashboard (`/app/associacao/dashboard`):** Visão geral, cards em chumbo (`bg-[#18181B]`) mostrando Total de Filiados Ativos e Receita de Repasses (Cashback B2B) no mês.
2. **Membros (`/app/associacao/membros`):** Tabela ou lista de filiados. Botões para Aprovar/Bloquear filiação.
3. **Mensageria (`/app/associacao/mensageria`):** Interface para redigir um recado. Um CTA neon vibrante (`bg-[#00FF66]`) de "Disparar via WhatsApp" (que gera links `wa.me` dinâmicos ou simula um disparo de API).
4. **Configurações (`/app/associacao/config`):** Edição de perfil da entidade e taxa de repasse.

## 4. Roteamento
- Criar um componente guardião (ex: `AssociacaoRoute`) para blindar essas URLs, permitindo apenas usuários com `role === 'associacao'`.