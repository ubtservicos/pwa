# Épico 09: Integração de Pagamento e Split Dinâmico (Mercado Pago)
**Módulo:** Motor Financeiro  
**Status:** Documentado & Estruturado

## 1. Visão Geral da Arquitetura

Para dar suporte ao fluxo financeiro automatizado do aplicativo UBT, integramos o provedor de pagamentos **Mercado Pago** (utilizando URLs de Sandbox para homologação). O objetivo principal é receber o pagamento do tomador de serviço e realizar o **split de pagamento (rateio)** imediato no momento da liquidação da transação, dividindo o valor total da corrida ($V_{total}$) entre as partes interessadas de acordo com as regras de negócio da plataforma.

---

## 2. Divisão do Split Dinâmico (Rateio)

Qualquer corrida de Mototáxi finalizada com sucesso tem seu valor total distribuído conforme as proporções abaixo:

| Beneficiário | Percentual | Descrição |
| :--- | :--- | :--- |
| **Prestador (Diarista / Motorista)** | `90.0%` | Recebe a maior fatia diretamente na sua carteira Mercado Pago. |
| **UBT (Taxa de Plataforma)** | `4.0%` | Taxa operacional administrativa da UBT Serviços. |
| **Comunidade (Fundo Social)** | `2.0%` | Destinado a projetos e melhorias comunitárias em Ubatuba. |
| **Prêmios (Sorteios e Campanhas)** | `3.0%` | Acumulado para campanhas de fidelização e prêmios do usuário. |
| **Associação / Padrinho** | `1.0%` | Dividido com a associação vinculada ou o padrinho do prestador. |

---

## 3. Estratégia de Integração da API do Mercado Pago

### Fluxo de Checkout Pro (Preferências)
A API do Mercado Pago permite a criação de **Preferências de Pagamento** (`/v1/checkout/preferences`) contendo o rateio da transação através de configurações de split.
* O pagamento principal é processado na conta da plataforma UBT.
* A plataforma especifica a taxa da aplicação (`marketplace_fee` ou `application_fee`) e faz o repasse direcionado aos recebedores secundários (Mercado Pago Marketplace / Split Payments).
* Durante a criação da preferência, adicionamos os detalhes do rateio na estrutura de `marketplace` do Mercado Pago.

### Payload de Exemplo (Checkout Pro Preferences)
```json
{
  "items": [
    {
      "id": "corrida-mototaxi-123",
      "title": "Corrida UBT Mototáxi - Ubatuba",
      "quantity": 1,
      "currency_id": "BRL",
      "unit_price": 25.50
    }
  ],
  "marketplace_fee": 2.55,
  "sponsor_id": 987654321,
  "external_reference": "ride_123",
  "back_urls": {
    "success": "https://ubtservicos.com.br/app/payment/success",
    "failure": "https://ubtservicos.com.br/app/payment/failure",
    "pending": "https://ubtservicos.com.br/app/payment/pending"
  },
  "auto_return": "all"
}
```

---

## 4. Variáveis de Ambiente e Sandbox

Para isolamento de ambiente e segurança em homologação, a API consome as seguintes credenciais via chaves de Sandbox configuradas localmente:

* `import.meta.env.VITE_MP_ACCESS_TOKEN`: Token de acesso privado do Mercado Pago para chamadas de API (serviço/backend).
* `import.meta.env.VITE_MP_PUBLIC_KEY`: Chave pública para renderização segura do checkout transparente ou botão do Checkout Pro na interface.
* **URLs de Sandbox**: As transações são geradas sob o domínio `sandbox.mercadopago.com.br`, permitindo testar pagamentos Pix simulados e números de cartões de teste sem transações monetárias reais.
