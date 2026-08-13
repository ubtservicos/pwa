# Épico 04: Redesign do Módulo Mototáxi (Dark UI)
**Módulo:** Mototáxi / Maps
**Status:** Execução

## 1. Objetivo
Aplicar o Design System "Dark/Bet" mapeado no Épico 03 nas rotas de solicitação de corrida (`/app/mototaxi`) e no painel do prestador. O foco principal é unificar o contraste da tela e substituir o mapa claro por um provedor de tiles escuros, mantendo a integridade da máquina de estados (`RideState`).

## 2. Especificação Técnica (Mapas)
- O componente `<TileLayer>` dentro de `MototaxiMap.tsx` e `PrestadorMapLight.tsx` deve ser atualizado para usar um mapa escuro.
- **URL sugerida:** `https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png`
- A camada de atribuição (attribution) deve ser mantida conforme exigência do provedor.

## 3. Especificação Técnica (UI/UX)
- **Tomador (`MototaxiTomador.tsx`):** O modal inferior de cálculo de preço e o botão de "Confirmar Pedido" devem utilizar as classes do novo design system (`bg-bet-card`, botões neon). O countdown de 60 segundos (`searching`) deve ter tipografia em destaque (ex: `font-mono text-bet-neon`).
- **Prestador (`PrestadorMototaxiOnline.tsx`):** O modal de recebimento de corrida ("Nova Viagem Disponível") deve ter altíssimo contraste para rápida leitura no trânsito, utilizando bordas chamativas e botão neon para o CTA de aceite.