# Épico 08: Dark Theme Secundário para Área do Prestador
**Módulo:** UX / UI Design System
**Status:** Execução

## 1. Diretrizes de UX e Identidade Visual
Diferenciar de forma clara o ambiente de consumo (Tomador de serviço) do ambiente de trabalho (Prestador de serviço - Motoristas, Ambulantes, Diaristas) é crucial para evitar confusões de contexto operacional durante o uso diário do aplicativo.

Ao invés de utilizar um tema claro clássico, o Arquiteto determinou a adoção de um **Dark Theme Secundário** para a área dos Prestadores. Isso mantém a identidade visual moderna e de alto contraste "Dark/Bet" do UBT, mas introduz tons chumbo ligeiramente mais suaves para sinalizar ao trabalhador que ele está no modo de serviço ativo.

## 2. Paleta de Cores do Prestador (Dark Secundário)
Definimos no arquivo `index.css` e mapeamos no `tailwind.config.ts` as seguintes classes utilitárias e variáveis semânticas:
- **Fundo Principal (Grafite Chumbo):** `--prestador-bg: #18181B` (Usar `bg-prestador-bg`).
- **Superfícies (Cards, Modais, Gavetas):** `--prestador-card: #27272A` (Usar `bg-prestador-card`).
- **Bordas e Linhas:** `--prestador-border: #3F3F46` (Usar `border-prestador-border`).

As ações críticas de conversão e transações continuam utilizando o verde neon vibrante (`#00FF66` / `text-navy` ou `text-[#09090B]`) para preservar o apelo visual e legibilidade.
