# UBT-PAY-005-WALKTHROUGH

Este guia descreve como validar os fluxos da Sandbox e a interface Mercado Pago no PWA da UBT.

---

## 1. Verificando a Interface de Conexão no PWA
1. Faça login no aplicativo local com um perfil de prestador ou acesse a página de configurações financeiras: `/app/config/financeiro`.
2. Observe o novo card **"Conta Mercado Pago"** localizado no topo da página.
3. Clique em **"Conectar Mercado Pago"** para simular o redirecionamento e a obtenção de tokens Sandbox do OAuth.
4. Verifique que o status muda para `Conectado` (verde) e exibe os detalhes da conta Sandbox simulada.
5. Utilize a barra inferior de depuração ("SIMULAR AMBIENTE DE HOMOLOGAÇÃO / SANDBOX") para testar os estados de:
   - `NOT_CONNECTED` (Não conectado)
   - `CONNECTED` (Conectado)
   - `TOKEN_EXPIRING` (Reautorização necessária)
   - `ERROR` (Erro de Conexão)
6. Confirme que os botões de ação contextuais ("Reconectar Mercado Pago", "Desconectar Mercado Pago", "Limpar Erro") funcionam e atualizam o estado local no `localStorage`.
7. Clique em **"Ainda não tenho Mercado Pago"** e verifique se o guia de criação é renderizado como BottomSheet.

---

## 2. Executando os Testes Unitários de Sandbox
Para certificar que as regras de integridade do OAuth, assinaturas de webhooks e limites de ambiente Sandbox permanecem seguras:
1. Abra o terminal na pasta `pwa`.
2. Execute o comando:
   ```bash
   npx vitest run src/test/MercadoPagoSandbox.test.ts
   ```
3. Confirme que todos os 12 testes unitários são aprovados com sucesso em menos de 2 segundos.
