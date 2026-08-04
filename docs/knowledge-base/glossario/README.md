# Glossário Geral — Conceitos Centrais UBT

Este documento define os termos e métricas essenciais da infraestrutura operacional e financeira da UBT.

---

## Termos e Siglas Principais

### GMV (Gross Merchandise Value)
- **Definição:** Volume Bruto de Mercadorias transacionado na plataforma em um determinado período.
- **Contexto UBT:** Representa a soma de todas as corridas pagas, compras de coco concluídas e agendamentos de diaristas contratados antes da dedução de tarifas ou reembolsos.

### RLS (Row Level Security)
- **Definição:** Segurança ao Nível de Linha nativa do banco de dados PostgreSQL.
- **Contexto UBT:** Garante que clientes, prestadores e operadores acessem estritamente os dados que possuem autorização legal ou relacional direta para ver, blindando a API pública do Supabase contra acessos indevidos.

### Ghost Ride (Corrida Fantasma)
- **Definição:** Alerta antifraude disparado por discrepâncias de posicionamento geográfico.
- **Contexto UBT:** Ocorre quando uma corrida de mototáxi é concluída no sistema mas a velocidade média calculada é inconsistente, a rota planejada diverge expressivamente do GPS, ou não há qualquer deslocamento físico registrado para o prestador.

### Circuit Breaker
- **Definição:** Padrão de tolerância a falhas (Disjuntor) que intercepta requisições a serviços externos instáveis.
- **Contexto UBT:** Evita que falhas na API de notificações ou processadoras de pagamento causem gargalos e travem o carregamento do SuperApp para o usuário final.
