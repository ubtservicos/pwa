# Ajuda Contextual — Central de Configurações (/admin/configuracoes)

Este documento detalha o controle e parametrização dos parâmetros de negócios e limites do SuperApp.

---

### Central de Configurações (`admin.configuracoes.centro_configuracoes`)

- **Descrição curta:** Parâmetros globais de taxas, limites e comportamentos de regras.
- **O que significa:** O painel de controle que abriga os parâmetros de negócios ativos (ex: taxas de comissão da UBT, limites de saques diários de motoristas, carência de cancelamento de corridas).
- **Para que serve:** Permitir a calibração de regras e limites da plataforma em tempo real sem a necessidade de novos deploys de código ou atualizações de banco de dados.
- **Como interpretar:** O administrador altera os valores aqui e o reflexo é instantâneo para todos os aplicativos de clientes e prestadores de serviços de Ubatuba.
- **Origem dos dados:** Tabela `public.system_settings`, onde cada linha contém uma chave parametrizável, seu valor atual, categoria e valor padrão de fábrica.
- **Quem normalmente utiliza:** Gerentes de Operações, Diretores Executivos e Administradores de TI.
- **Observações / limitações:** Modificações neste painel geram novos registros na tabela de histórico de versões (`public.system_setting_versions`) e disparam notificações de auditoria devido à criticidade do impacto nas regras de split financeiro.
