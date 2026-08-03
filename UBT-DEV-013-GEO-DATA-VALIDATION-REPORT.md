# UBT-DEV-013-GEO-DATA-VALIDATION-REPORT

## 1. Identificação
- **Data/Hora:** 2026-08-03T14:20:00-03:00
- **Workspace:** `C:\Users\MacInBox\Documents\profissional\ubt\pwa`
- **Status da Validação:** **GEO_DATA_VALIDATION = PASS**

## 2. Tabelas Inspecionadas

### A) `public.ceps_ubatuba`
- **Existência:** Sim, existe no banco Supabase.
- **Estrutura/Schema Encontrado:**
  * `cep` (`text NOT NULL` - PRIMARY KEY)
  * `logradouro` (`text NOT NULL`)
  * `bairro` (`text NOT NULL`)
  * `lat` (`numeric NULL`)
  * `lng` (`numeric NULL`)
  * `created_at` (`timestamp with time zone`)
- **Métricas e Registros:**
  * Total de Registros: **1823**
  * Registros com CEP válido: **1823**
  * Registros com Bairro preenchido: **1823** (100% de cobertura)
  * Registros com Lat/Lng preenchidos: **7** (apenas 0.4% de cobertura)
- **Índices:** `ceps_ubatuba_pkey` (B-Tree no campo `cep`).
- **Segurança (RLS):** Habilitado, com política pública permissiva de leitura/escrita aberta (`Allow All ceps_ubatuba`).

### B) `public.endereco_cache`
- **Existência:** **Não existe** no banco de dados de produção. O script `09_hybrid_geocoding_cache.sql` está presente localmente no repositório, mas a tabela correspondente não foi criada na base Supabase.
- **Cobertura de Fallback:** Inexistente no momento.

## 3. Exemplos de CEPs Testados e Consulta real
Foram consultados registros aleatórios de CEPs na base:
* **CEP 11695-710:** Bairro `Taquaral` (Logradouro: `Acampamento A`, Lat/Lng: `null`, `null`)
* **CEP 11684-434:** Bairro `Folha Seca` (Logradouro: `Avenida A`, Lat/Lng: `null`, `null`)
* **CEP 11694-048:** Bairro `Horto Florestal` (Logradouro: `Rua A`, Lat/Lng: `null`, `null`)
* **CEP 11687-112:** Bairro `Toninhas` (Logradouro: `Rua A`, Lat/Lng: `-24.286389`, `-53.833381`)

### Conclusão Técnica do Schema
1. A relação **CEP → Bairro** funciona perfeitamente com cobertura total de Ubatuba.
2. A relação **CEP → Latitude/Longitude** não é operacional hoje, pois 99.6% dos registros têm coordenadas nulas e as poucas coordenadas registradas são placeholders incorretos que apontam fora da cidade.

## 4. Viabilidade do Futuro Mapa de Fundadores
* **Viabilidade de Fluxo:** Sim, o modelo de dados proposto (`waitlist.cep_moradia`) é totalmente viável para relacionar com `ceps_ubatuba.cep`.
* **Solução para Lat/Lng:** Devido à ausência de coordenadas válidas na tabela `ceps_ubatuba`, para a construção futura do mapa de concentração, a UBT possui duas alternativas:
  * **Opção Recomendada (Leve):** Mapear os bairros cadastrados para um dicionário de coordenadas centrais pré-definidas (estático ou em tabela de bairros) no frontend. Isso evita o custo de geocodificar CEPs individuais ou usar APIs pagas de mapas.
  * **Opção Nominal:** Executar um script em lote para geocodificar as coordenadas dos bairros/logradouros na tabela `ceps_ubatuba` via API externa.
* **Separação Visual:** Totalmente viável. O mapa poderá utilizar cores ou ícones de pins distintos baseando-se nas tags do array `perfil` do fundador (tomadores/moradores, diaristas, mototaxistas, ambulantes, associações).

## 5. Avaliação de Privacidade (LGPD)
Armazenar exclusivamente o `cep_moradia`, `bairro_moradia` e `bairro_trabalho` é **altamente recomendado e seguro**. Esses dados de localização em nível de macrozona impedem a reidentificação direta da residência física exata do indivíduo (não contêm número, rua exata ou complemento), garantindo o respeito ao princípio de minimização de dados da LGPD enquanto atende plenamente ao objetivo estatístico e territorial de liberação do piloto.

## 6. Recomendação sobre a UX do CEP
Recomenda-se a **Opção C**: *CEP digitado pelo usuário + bairro automaticamente encontrado, mas permitindo correção manual*.
* **Justificativa:** O preenchimento automático garante velocidade de cadastro e padronização ortográfica das nomenclaturas dos bairros para futuras agregações. Contudo, permitir a edição do bairro protege a conversão do formulário caso o usuário possua um CEP novo ou localizado em áreas de divisa que não existam na base local de 1823 registros, impedindo que o fundador fique travado ao preencher o formulário.

## 7. Riscos Encontrados
- **Coordenadas Placeholders:** A presença de latitudes e longitudades placeholders incorretas na base de dados de CEPs pode distorcer a plotagem inicial se as coordenadas forem lidas sem filtragem ou tratamento futuro.
- **Ausência do `endereco_cache`:** Sem a tabela `endereco_cache`, a busca de endereços ficará restrita a CEPs exatos da tabela `ceps_ubatuba`.

## 8. Recomendação Final
A estrutura geral de geolocalização por macrozona é viável e está validada. Podemos prosseguir com segurança para a criação da migração `34_waitlist_geo_fields.sql` contendo os novos campos nullable, uma vez aprovado o planejamento.
