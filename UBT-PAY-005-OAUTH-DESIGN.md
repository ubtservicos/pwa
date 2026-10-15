# UBT-PAY-005-OAUTH-DESIGN

## 1. Fluxo de Autorização OAuth (Sandbox)
O fluxo foi desenhado para assegurar o isolamento das credenciais e a prevenção de ataques CSRF:

```text
 PRESTADOR (PWA)         UBT BACKEND (EDGE FUNCTION)           MERCADO PAGO API
    |                                 |                               |
    |--- 1. Clique Conectar --------->|                               |
    |    (Gera state criptográfico)   |                               |
    |<-- 2. Redireciona para OAuth ---|                               |
    |                                 |                               |
    |==================== 3. Consentimento do Seller =================|
    |                                                                 |
    |--- 4. Redirect Callback ------->|                               |
    |    (Garante state match)        |--- 5. Troca code por Token -->|
    |                                 |<-- 6. Retorna Tokens ---------|
    |                                 |                               |
    |                                 |--- 7. Criptografa e Persiste -|
    |<-- 8. Status CONNECTED ---------|                               |
```

---

## 2. Proteção contra Vulnerabilidades
- **CSRF:** Geração de um token randômico persistido temporariamente e enviado no parâmetro `state`. O callback valida a igualdade do state antes de processar o code.
- **Replay / Reutilização de Code:** O backend rejeita imediatamente requisições com códigos vazios, expirados ou previamente trocados.
- **Isolamento de Secrets:** O Client Secret e os Access Tokens resultantes permanecem restritos à memória do backend/Edge Functions. O frontend PWA só recebe confirmações booleanas/badges.

---

## 3. Máquina de Estados da Conexão
Os estados suportados pela máquina de integração do Prestador com o Marketplace:
- `NOT_CONNECTED`: Estado inicial de não vinculado.
- `AUTHORIZATION_STARTED`: Redirecionado para o consentimento.
- `CONNECTED`: Token obtido e salvo com sucesso.
- `TOKEN_EXPIRING`: Access Token próximo da expiração.
- `REFRESH_REQUIRED`: Falha temporária no uso do access token (necessita refresh).
- `REVOKED`: Acesso revogado pelo Prestador.
- `ERROR`: Falha catastrófica no fluxo.
