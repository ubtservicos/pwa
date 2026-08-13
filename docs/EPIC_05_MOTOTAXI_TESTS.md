# Épico 05: Testes de Integração do Módulo Mototáxi
**Módulo:** QA / Testing
**Status:** Execução

## 1. Objetivo
Garantir a integridade da máquina de estados `RideState` e das transições de corrida na vertical de Mototáxi utilizando o Vitest, prevenindo regressões futuras.

## 2. Especificação Técnica
- Criar o arquivo `src/test/MototaxiJourney.test.ts`.
- A suíte deve mockar as interações com o Supabase e simular as transições exatas mapeadas na auditoria anterior: `idle` -> `searching` -> `accepted` -> `arriving` -> `in_progress` -> `completed`.
- O cálculo matemático de preço (`calcPrice`) deve receber cobertura de teste unitário estrita, garantindo que as taxas base e a quilometragem sejam multiplicadas corretamente (risco financeiro).