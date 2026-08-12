# Épico 03: Redesign Global (Estética Dark/Bet)
**Módulo:** UI/UX Core
**Status:** Execução

## 1. Objetivo
Pivotar a identidade visual da plataforma para focar no público de 18-30 anos, adotando uma estética "Dark Mode" inspirada em plataformas de apostas esportivas (Bets). O design deve transmitir velocidade, gamificação e alto contraste.

## 2. Paleta de Cores (Tailwind Variables)
- **Background Principal:** Grafite profundo escuro (`#09090B`).
- **Superfícies (Cards/Modais):** Cinza chumbo (`#18181B`) com bordas sutis (`#27272A`).
- **Primary (Ação):** Cor neon vibrante (verde limão ou azul ciano de alto contraste) para botões de "Pedir" e "Aceitar".
- **Texto:** Branco puro para títulos, cinza claro (`#A1A1AA`) para descrições.

## 3. Especificação Técnica
- O arquivo `tailwind.config.ts` deve ser atualizado para incorporar essa paleta customizada.
- O arquivo `index.css` (ou `App.css`) deve ter a classe `.dark` forçada no elemento `:root` ou `body`, tornando o Dark Mode o padrão absoluto da aplicação.
- Componentes base do `radix-ui` (se houver variáveis CSS globais) devem ser mapeados para essas novas cores.