# UBT SuperApp — Relatório de Auditoria: Módulo KYC

**Data do Relatório:** 2026-07-17  
**Versão:** KYC Audit v2.0  
**Classificação:** Técnico / Segurança Interna  
**Autor:** Antigravity AI  

---

## Posicionamento Institucional UBT sobre Credenciamento e Inclusão

> [!NOTE]
> A UBT busca ampliar oportunidades de trabalho e geração de renda para a comunidade local, respeitando princípios de inclusão e responsabilidade social.
> 
> O processo de credenciamento considera a documentação exigida para cada atividade, a regularidade operacional e o comportamento dentro da plataforma.
> 
> A segurança dos usuários é reforçada por mecanismos de verificação documental, avaliações da comunidade, monitoramento operacional, auditoria antifraude e moderação contínua.
> 
> A UBT mantém política de tolerância zero para fraude, violência, assédio ou qualquer atividade ilegal.

---

## 1. Tabelas Utilizadas (Supabase)

O credenciamento e verificação de prestadores de serviço (KYC) utiliza as seguintes tabelas do banco de dados PostgreSQL remoto:

*   `public.usuarios` (Leitura/Escrita) ➔ Controla a role (`'tomador'` ➔ `'prestador'`) e armazena o status cadastral e metadados de quarentena.
*   `public.diarista_perfis` (Leitura/Escrita) ➔ Dados profissionais complementares das diaristas.
*   `public.coco_caminhoes` (Leitura/Escrita) ➔ Cadastro de veículos coletores e prestadores vinculados à associação.
*   `storage.objects` (Leitura/Escrita) ➔ Tabela nativa de metadados do Supabase Storage para arquivos PDF/PNG de comprovação.

---

## 2. Documentação Exigida por Vertical

| Vertical | Documentos Exigidos | Finalidade Regulatória |
| :--- | :--- | :--- |
| **Geral / Comum** | 1. Documento de Identidade (RG/CNH)<br>2. Comprovante de Residência | Validação civil do cidadão e prova de domicílio. |
| **Mototáxi** | *Documentos Comuns +*<br>3. CRLV da Motocicleta<br>4. Prontuário de Pontos CNH (DETRAN) | Verificação de licenciamento do veículo cadastrado e limite máximo de infrações de trânsito. |
| **Diaristas** | *Documentos Comuns apenas* | Acesso básico a serviços residenciais. |
| **Ambulantes** | *Documentos Comuns +*<br>3. Licença de Funcionamento da Prefeitura | Comprovação de alvará municipal para comercialização em praias/vias públicas. |
| **Côco & Cia** | *Documentos Comuns +*<br>3. CRLV do Caminhão<br>4. Vínculo / Carta Credencial da Associação | Validação do caminhão de coleta e comprovação de filiação de triagem oficial. |

---

## 3. Armazenamento e Segurança dos Arquivos

Os arquivos de credenciamento são gravados no Supabase Storage sob o bucket **`kyc-documents`**.

*   **Estrutura de Caminhos (Paths):**  
    `kyc-documents/{user_id}/{document_type}_{timestamp}.{ext}`  
    *Exemplo: `kyc-documents/34ba98c1-f2.../cnh_frente_178413536.png`*
*   **Políticas RLS aplicadas no Storage:**
    ```sql
    -- Permissão de escrita para o próprio titular
    CREATE POLICY "Titulares enviam seus documentos de KYC"
      ON storage.objects FOR INSERT
      WITH CHECK (bucket_id = 'kyc-documents' AND (storage.foldername(name))[1] = auth.uid()::text);

    -- Permissão de leitura restrita
    CREATE POLICY "Acesso de leitura restrito ao titular e admins"
      ON storage.objects FOR SELECT
      USING (bucket_id = 'kyc-documents' AND ((storage.foldername(name))[1] = auth.uid()::text OR public.is_admin()));
    ```

---

## 4. Fluxo de Aprovação, Expiração e Bloqueios Automáticos

### 4.1 Fluxo de Aprovação
1.  **Submissão:** O prestador envia os arquivos via aplicativo móvel.
2.  **Triagem:** O cadastro entra na fila de KYCs Pendentes (`/admin/kyc-pendentes`).
3.  **Análise:** O operador administrativo analisa e compara dados e fotos.
4.  **Conclusão:** O operador aprova (promove o usuário para `role = 'prestador'`) ou reprova (registra motivo e emite notificação).

### 4.2 Expiração Documental
*   **CRLV do Veículo / Licença Ambulante:** Expira de forma programada conforme o calendário de licenciamento anual do DETRAN/Prefeitura.
*   **Processo:** Uma tarefa cron programada (Supabase Edge Function) varre a tabela cadastral a cada 24 horas, sinalizando documentos vencidos.

### 4.3 Bloqueios Automáticos
> [!CAUTION]
> Se um documento obrigatório (ex: CNH ou CRLV) expirar, a conta do prestador entra automaticamente em **Quarentena**. O sistema rebaixa a role temporariamente para `'tomador'` e bloqueia chamadas ou agendamentos, emitindo um alerta push para recadastramento urgente.

---

## 5. Matriz de Riscos (Regulatórios e Operacionais)

| Risco | Impacto | Probabilidade | Mitigação Proposta |
| :--- | :--- | :--- | :--- |
| **Documentos Falsificados / Editados** | 🔴 Alto (Jurídico) | 🟡 Média | Validação automática OCR integrada a bureaus governamentais (Serpro/Datavalid). |
| **Vazamento de Dados Sensíveis** | 🔴 Alto (LGPD) | 🟡 Média | Criptografia em repouso dos arquivos no bucket e auditoria rígida de acesso dos admins. |
| **Falta de Licenciamento (Ambulante/Mototáxi)**| 🟡 Médio (Fiscal) | 🔴 Alta | Bloqueio imediato na data de expiração da licença anual no banco. |

---

## 6. Nível de Prontidão (Classificação)

*   **Classificação:** 🟡 **Pilot Ready**
*   **Justificativa:** O backoffice possui telas de auditoria integradas (`AdminKycListPage` / `AdminKycDetailPage`) alterando o banco diretamente. Contudo, a validação automática de autenticidade (bureau OCR) e a checagem programada de expiração de documentos ainda dependem de integrações externas para estarem prontas para escala em produção.
