# UBT-PAY-002A-PRODUCTION-SPLIT-AND-MP-READINESS-REPORT

## 1. Status Geral
Este relatório apresenta a verificação real da configuração de split em ambiente de Produção e a prontidão da plataforma UBT para integração com o Mercado Pago. Foi confirmada a divergência de percentuais informada pelo Product Owner e identificada a sua causa mecânica exata. Adicionalmente, o formulário de waitlist foi atualizado e a estrutura de persistência para contas Mercado Pago foi mapeada.

---

## 2. Evidência Real da Configuração de Split em Produção
A consulta factual realizada na tabela `public.split_config` do banco de dados PostgreSQL do Supabase em Produção (Host: `aws-1-sa-east-1.pooler.supabase.com`) retornou o seguinte registro real:

```json
{
  "id": 1,
  "prestador_pct": "90.000",
  "ubt_pct": "4.000",
  "comunidade_pct": "2.000",
  "premio_trabalhador_pct": "1.500",
  "premio_consumidor_pct": "1.500",
  "padrinho_pct": "1.000",
  "updated_at": "2026-05-07T19:45:38.545Z"
}
```

Adicionalmente, na tabela `public.system_settings`, a comissão operacional está persistida sob a chave `taxa_ubt` com o valor de `0.04` (4%).

---

## 3. Comparação UI vs Banco vs Código
Abaixo está a matriz de comparação real dos percentuais mapeados em cada camada do projeto:

| Destino | Valor em Produção (Banco) | Valor no Código (Deno / Frontend) | Valor esperado pelo PO | Status de Alinhamento |
|---|---:|---:|---:|---|
| **Prestador** | 90.0% | 90% (Diarista fallback & checkout Edge) | 90% | **VALIDADO** |
| **UBT** | 4.0% | 4% (checkout Edge, `taxa_ubt` no settings) | 5% | <span style="color:red">**DIVERGENTE**</span> |
| **Associação** | 2.0% | 2% (Diarista fallback) | 2% | **VALIDADO** |
| **Padrinho/Madrinha** | 1.0% | 1% (Diarista fallback) | 1% | **VALIDADO** |
| **Prêmio Trabalhador** | 1.5% | 1.5% (Diarista fallback) | 1% | <span style="color:red">**DIVERGENTE**</span> |
| **Prêmio Consumidor** | 1.5% | 1.5% (Diarista fallback) | 1% | <span style="color:red">**DIVERGENTE**</span> |

---

## 4. Conflitos Encontrados
- **Banco de Dados vs PO:** O banco de dados em Produção registra 4% para a UBT e 1.5% para os prêmios, enquanto o PO espera 5% para a UBT e 1% para cada um dos prêmios.
- **Edge Function vs Configuração:** A Edge Function `/checkout` calcula repasses fixos em código (90% e 4%), omitindo totalmente as distribuições de Associação, Padrinho e Prêmios no banco de dados operacional.
- **Interface vs Banco:** A tela `/admin/split` permite editar valores e simular cálculos locais, mas nunca escreve no banco.

---

## 5. Causa Provável da Divergência (1.5% vs 1%)
1. **Mecanismo de Escrita da UI:** A interface administrativa `AdminSplitPage.tsx` salva as alterações realizadas pelo operador **estritamente no localStorage** do navegador (`localStorage.setItem("ubt_split_config", ...)`). Ela não realiza chamadas de API (UPDATE) para sincronizar com as tabelas `public.split_config` ou `public.system_settings`.
2. **Percepção do PO:** Como o PO acessou o painel em seu próprio computador, alterou os valores para os percentuais desejados (`90% / 5% / 2% / 1% / 1% / 1%`) e clicou em "Salvar", seu navegador local persistiu essas informações. O PO visualizou a tela configurada corretamente e deduziu que a alteração havia sido aplicada em Produção para todos os usuários.
3. **Persistência Centralizada Inalterada:** Como nenhuma query de banco foi executada, o banco de dados centralizado permaneceu intocado com os registros da seed padrão inicial de `1.5%` e `4%`.

---

## 6. Nova Informação da Landing Page
O formulário de waitlist de pioneiros foi atualizado no arquivo `src/pages/Index.tsx`:
- **Campo de Coleta:** Pergunta tipo Select/Radio: *"Você já possui uma conta no Mercado Pago?"*.
- **Opções:** "Sim" e "Não".
- **Obrigatoriedade:** Campo obrigatório para novos cadastros (bloqueia o envio do formulário caso não seja preenchido).
- **Persistência Segura:** A resposta selecionada é estruturada e inserida na coluna `observacoes` sob a tag `Mercado Pago: Sim` ou `Mercado Pago: Não` para garantir compatibilidade com registros históricos de leads e evitar travamento na base de dados antes da aplicação da migration.

---

## 7. Schema Atual da Tabela `waitlist`
A estrutura física atual da tabela `public.waitlist` é a seguinte:
- `id`: uuid (Primary Key)
- `nome`, `email`, `telefone`, `cidade`: text
- `perfil`: text[]
- `origem`, `utm_source`, `utm_medium`, `utm_campaign`, `utm_content`, `utm_term`: text
- `device_type`, `browser`, `os`, `ip_hash`: text
- `consentimento_lgpd`: boolean
- `status`: text (default 'novo')
- `observacoes`: text (utilizado temporariamente para armazenar a resposta de conta Mercado Pago)
- `cep_moradia`, `bairro_moradia`, `bairro_trabalho`: text

---

## 8. Necessidade de Migration
Para acomodar a coluna de forma totalmente nativa e estruturada, é necessária a aplicação de uma migration futura.
- **Arquivo de Migration Preparado:** `36_waitlist_mercado_pago_field.sql` criado sob o diretório do projeto.
- **Comando SQL de Prontidão:**
  ```sql
  ALTER TABLE public.waitlist ADD COLUMN IF NOT EXISTS possui_conta_mercado_pago boolean DEFAULT NULL;
  ```
- **Status:** **PREPARADO / NÃO APLICADO** (Aguardando homologação e comando explícito para execução).

---

## 9. Impactos Previstos no Admin
O BackOffice Administrativo em `/admin/waitlist` passará a exibir o indicador de conta Mercado Pago na listagem de leads e na visualização detalhada do formulário. Isso permitirá que a equipe de onboarding verifique quais candidatos a prestadores de serviços já possuem contas válidas antes de convocá-los para a etapa de liberação da fila de espera.

---

## 10. Métricas Futuras (BackOffice Financeiro)
A serem monitoradas no módulo `/admin/financeiro` após a integração real:
- **Taxa de Penetração MP:** Porcentagem de prestadores cadastrados com conta vinculada e aptos a transacionar.
- **Índice de Conversão de Onboarding:** Razão de prestadores que iniciam o fluxo OAuth e concluem a autorização com sucesso.
- **Status de Splits:** Volume financeiro processado por split versus retido por contas irregulares ou desconectadas.

---

## 11. Eventos Futuros de Monitoramento
- `payout_failed`: Falha de repasse Pix ou transferência para prestador.
- `oauth_revoked`: O prestador removeu a permissão do aplicativo UBT dentro de sua conta Mercado Pago.
- `payment_divergence`: Divergência entre valores líquidos simulados no banco de dados e os creditados pela API Mercado Pago.

---

## 12. Estados Futuros do Onboarding Mercado Pago
Os estados que controlam o ciclo de vida financeiro de um prestador na UBT são:
- **`Possui Conta MP` (Booleano):** Resposta de simulação cadastral inicial na waitlist.
- **`Iniciou OAuth` (Estado):** Prestador clicou no redirecionamento e foi enviado à URL do Mercado Pago.
- **`Autorizado` (Token Exchange):** UBT possui o `access_token` e `refresh_token` do prestador.
- **`Apto para Split` (Validado):** O status da conta Mercado Pago retornou ativa na API e o prestador cadastrou chave Pix válida.

---

## 13. Separação DEV/Sandbox vs PROD
- **DEV/Localhost:** A aplicação consome chaves e segredos em Sandbox. Webhooks locais são roteados através de túnel Ngrok.
- **PROD:** O frontend apenas consome credenciais com prefixo `APP_USR-` fornecidas dinamicamente por Edge Functions, impossibilitando que chaves Sandbox e de Produção se misturem em repositórios Git ou ambientes de execução.

---

## 14. Itens que NÃO Devem Ser Implementados Agora
- Atualização real do banco de dados Supabase com a nova coluna.
- Chamadas HTTP para a API real ou Sandbox do Mercado Pago.
- Fluxo de redirect OAuth ou geração de link de vendedor do Mercado Pago.

---

## 15. Ações Humanas para a Wiki
- **Configuração de Chave Webhook:** Como o administrador de Engenharia copia o webhook token do painel do Mercado Pago e o injeta nas Edge Functions da UBT.
- **Onboarding do Prestador:** Como o prestador é instruído a conectar e reautorizar sua conta via interface do aplicativo.

---

## 16. Riscos
- **Inconsistência de Dados no Backfill:** Se a nova coluna de waitlist for criada futuramente como `NOT NULL`, os leads históricos falharão. Por isso, a coluna foi desenhada como `NULL` (opcional).
- **Perda de Registro Local:** Operadores perderem a configuração de split local se limparem o cache/localStorage do navegador de forma manual.

---

## 17. Unknowns
- `UNKNOWN`: Se o e-mail do Mercado Pago do prestador deve coincidir obrigatoriamente com o e-mail cadastrado na UBT para vinculação OAuth.

---

## 18. Recomendações
1. **Ajustar UI de Admin:** Atualizar a tela `/admin/split` para que escreva os valores de comissão e prêmios na tabela `public.split_config` no PostgreSQL em vez de usar `localStorage`.
2. **Atualização do Banco:** Aplicar a alteração do banco para a comissão UBT (5%) e prêmios (1%) assim que a migration preparatória for aprovada pelo PO.

---

## 19. Próximo Passo Sugerido
- Submeter o relatório ao PO e solicitar autorização para:
  1. Aplicar a migration `36_waitlist_mercado_pago_field.sql` para criar a coluna nativa na waitlist.
  2. Ajustar os percentuais na tabela central de Produção para 5% UBT e 1% prêmios.
