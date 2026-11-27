export type LegalDocumentKey = "terms" | "privacy";

export interface LegalDocumentSection {
  heading: string;
  paragraphs: string[];
  bullets?: string[];
  postParagraphs?: string[];
}

export interface LegalDocument {
  key: LegalDocumentKey;
  title: string;
  updatedAt: string;
  sections: LegalDocumentSection[];
}

export const TERMS_OF_USE_DOC: LegalDocument = {
  key: "terms",
  title: "TERMOS DE USO DA PLATAFORMA UBT",
  updatedAt: "Última atualização: Julho de 2026",
  sections: [
    {
      heading: "1. Apresentação",
      paragraphs: [
        "A plataforma UBT é um ambiente digital destinado à intermediação tecnológica entre tomadores e prestadores de serviços autônomos, bem como ao gerenciamento de iniciativas sociais e ambientais vinculadas ao ecossistema da plataforma.",
        "A UBT atua exclusivamente como intermediadora tecnológica, não sendo empregadora, contratante, sócia ou representante dos prestadores cadastrados.",
      ],
    },
    {
      heading: "2. Área de Operação",
      paragraphs: [
        "A operação inicial da plataforma está limitada ao município de Ubatuba, Estado de São Paulo, podendo ser expandida para outras localidades mediante decisão da administração da plataforma.",
      ],
    },
    {
      heading: "3. Elegibilidade",
      paragraphs: [
        "3.1 Prestadores: Somente poderão atuar como prestadores usuários maiores de 18 anos, regularmente capazes e aprovados nos procedimentos de verificação de identidade e elegibilidade da plataforma.",
        "3.2 Tomadores: O cadastro na plataforma é permitido a usuários com idade mínima de 13 anos. A contratação de serviços presenciais, financeiros, de mobilidade ou que envolvam deslocamento de terceiros é permitida exclusivamente para usuários maiores de 18 anos ou devidamente assistidos por seus responsáveis legais.",
      ],
    },
    {
      heading: "4. Serviços Disponíveis",
      paragraphs: ["A plataforma poderá disponibilizar, entre outros:"],
      bullets: [
        "Mototáxi e entregas;",
        "Serviços de diaristas;",
        "Comércio e entregas por ambulantes;",
        "Gestão ambiental e logística social da iniciativa Côco & Cia;",
        "Outros serviços que venham a ser incorporados futuramente.",
      ],
    },
    {
      heading: "5. Natureza da Relação Jurídica",
      paragraphs: [
        "A UBT não possui vínculo empregatício, societário, associativo ou de representação com os prestadores cadastrados.",
        "Cada prestador atua por sua conta e risco, sendo integralmente responsável:",
      ],
      bullets: [
        "pela regularidade de sua atividade profissional;",
        "por licenças e autorizações exigidas por lei;",
        "pelo recolhimento de tributos;",
        "pela contratação de seguros eventualmente necessários;",
        "pela manutenção de documentos obrigatórios.",
      ],
    },
    {
      heading: "6. Verificação de Identidade (KYC)",
      paragraphs: [
        "Todos os prestadores deverão submeter-se aos procedimentos de identificação, verificação documental e validação cadastral exigidos pela plataforma.",
        "A UBT poderá utilizar sistemas automatizados, inteligência artificial e análise humana para validação dos cadastros.",
        "A aprovação cadastral é discricionária e poderá ser revogada a qualquer momento em caso de fraude, inconsistência ou risco operacional.",
      ],
    },
    {
      heading: "7. Geolocalização",
      paragraphs: [
        "A utilização dos serviços poderá envolver coleta, processamento e armazenamento de dados de localização em tempo real para:",
      ],
      bullets: [
        "execução dos serviços;",
        "segurança dos usuários;",
        "prevenção de fraudes;",
        "resolução de disputas;",
        "melhoria operacional da plataforma.",
      ],
      postParagraphs: [
        "Os dados serão armazenados apenas pelo período necessário às finalidades operacionais e legais aplicáveis.",
      ],
    },
    {
      heading: "8. Pagamentos",
      paragraphs: [
        "Os pagamentos serão processados por instituições financeiras ou fintechs parceiras mediante sistema de split de pagamentos.",
        "A UBT poderá reter automaticamente:",
      ],
      bullets: [
        "taxas operacionais;",
        "comissões de intermediação;",
        "valores relacionados aos programas de prêmio-consumidor e prêmio-trabalhador.",
      ],
    },
    {
      heading: "9. Responsabilidade pelos Serviços",
      paragraphs: [
        "Os serviços são executados exclusivamente pelos prestadores independentes.",
        "A UBT não garante:",
      ],
      bullets: [
        "disponibilidade contínua dos prestadores;",
        "qualidade específica dos serviços;",
        "resultado econômico esperado;",
        "entrega de resultados profissionais específicos.",
      ],
    },
    {
      heading: "10. Mototáxi e Mobilidade",
      paragraphs: [
        "Os prestadores responsáveis por transporte e mobilidade declaram possuir:",
      ],
      bullets: [
        "habilitação válida;",
        "documentação regular;",
        "licenças eventualmente exigidas;",
        "observância das normas de trânsito aplicáveis.",
      ],
      postParagraphs: [
        "Acidentes, danos materiais e danos corporais decorrentes da prestação dos serviços são de responsabilidade do prestador responsável pela execução do serviço, ressalvadas as hipóteses previstas em lei.",
      ],
    },
    {
      heading: "11. Diaristas e Serviços Residenciais",
      paragraphs: [
        "Questões relacionadas à execução do serviço, danos materiais, objetos pessoais, materiais utilizados ou condições do imóvel deverão ser resolvidas prioritariamente entre as partes envolvidas.",
        "A UBT poderá atuar como mediadora administrativa das disputas.",
      ],
    },
    {
      heading: "12. Mediação e Resolução de Conflitos",
      paragraphs: [
        "A plataforma poderá atuar como mediadora em conflitos entre usuários.",
        "Nos casos envolvendo fraude, risco à segurança, violação dos Termos ou abuso da plataforma, a UBT poderá adotar medidas administrativas unilaterais, incluindo:",
      ],
      bullets: [
        "bloqueios temporários;",
        "suspensão de contas;",
        "cancelamento de transações;",
        "retenção preventiva de valores;",
        "encerramento definitivo do cadastro.",
      ],
    },
    {
      heading: "13. Chat e Comunicações",
      paragraphs: [
        "A plataforma poderá disponibilizar ferramentas internas de comunicação entre usuários.",
        "É proibida a utilização dessas ferramentas para:",
      ],
      bullets: [
        "assédio;",
        "discriminação;",
        "ameaças;",
        "práticas ilícitas;",
        "envio de spam.",
      ],
    },
    {
      heading: "14. Côco & Cia",
      paragraphs: [
        "O módulo Côco & Cia constitui iniciativa socioambiental de apoio à coleta seletiva e reciclagem no município de Ubatuba.",
        "O cadastro de caminhões, gestores e colaboradores será restrito aos administradores autorizados da iniciativa e à administração da UBT.",
      ],
    },
    {
      heading: "15. Suspensão e Encerramento de Contas",
      paragraphs: ["A UBT poderá suspender ou encerrar contas que:"],
      bullets: [
        "violem estes Termos;",
        "apresentem comportamento fraudulento;",
        "gerem riscos operacionais;",
        "descumpram obrigações legais ou regulatórias.",
      ],
    },
    {
      heading: "16. Alterações dos Termos",
      paragraphs: [
        "A UBT poderá alterar estes Termos a qualquer momento, mediante disponibilização da nova versão na plataforma.",
      ],
    },
    {
      heading: "17. Foro",
      paragraphs: [
        "Fica eleito o foro da Comarca de Ubatuba/SP para resolução das controvérsias decorrentes destes Termos, observada a legislação aplicável ao consumidor.",
      ],
    },
    {
      heading: "18. Contato",
      paragraphs: [
        "UBT Plataforma Digital de Serviços",
        "Razão Social: UBT Plataforma Digital Ltda",
        "CNPJ: 68.394.558/0001-32",
        "E-mail: ubt.servicos@gmail.com",
        "Endereço: Ubatuba/SP",
      ],
    },
  ],
};

export const PRIVACY_POLICY_DOC: LegalDocument = {
  key: "privacy",
  title: "POLÍTICA DE PRIVACIDADE E PROTEÇÃO DE DADOS (LGPD) – UBT",
  updatedAt: "Última atualização: Julho de 2026",
  sections: [
    {
      heading: "1. Objetivo",
      paragraphs: [
        "Esta Política descreve como a UBT coleta, utiliza, armazena, compartilha e protege os dados pessoais tratados na plataforma.",
      ],
    },
    {
      heading: "2. Dados coletados",
      paragraphs: ["A UBT poderá coletar:"],
      bullets: [
        "nome completo;",
        "CPF;",
        "RG ou CNH;",
        "fotografia;",
        "selfie para validação de identidade;",
        "endereço;",
        "telefone;",
        "e-mail;",
        "dados bancários e chave PIX;",
        "geolocalização em tempo real;",
        "histórico de serviços e transações;",
        "mensagens trocadas pelo chat interno;",
        "informações de dispositivos e navegação.",
      ],
    },
    {
      heading: "3. Finalidades do tratamento",
      paragraphs: ["Os dados poderão ser utilizados para:"],
      bullets: [
        "criação e manutenção das contas;",
        "execução dos serviços contratados;",
        "prevenção de fraudes;",
        "verificação de identidade (KYC);",
        "processamento de pagamentos;",
        "atendimento ao cliente;",
        "resolução de disputas;",
        "cumprimento de obrigações legais;",
        "melhoria dos serviços e segurança da plataforma.",
      ],
    },
    {
      heading: "4. Geolocalização",
      paragraphs: [
        "A plataforma utiliza geolocalização em tempo real para execução de corridas, entregas, rastreamento operacional e segurança dos usuários.",
      ],
    },
    {
      heading: "5. Compartilhamento",
      paragraphs: ["Os dados poderão ser compartilhados com:"],
      bullets: [
        "instituições financeiras e processadores de pagamento;",
        "autoridades públicas quando exigido por lei;",
        "fornecedores tecnológicos necessários para a operação da plataforma.",
      ],
      postParagraphs: ["A UBT não comercializa dados pessoais."],
    },
    {
      heading: "6. Direitos do titular",
      paragraphs: ["Os usuários poderão solicitar:"],
      bullets: [
        "confirmação do tratamento;",
        "acesso aos dados;",
        "correção de dados incorretos;",
        "anonimização;",
        "exclusão quando aplicável;",
        "portabilidade;",
        "revogação do consentimento.",
      ],
    },
    {
      heading: "7. Retenção",
      paragraphs: [
        "Os dados serão mantidos pelo período necessário às finalidades operacionais, legais, regulatórias e de prevenção a fraudes.",
      ],
    },
    {
      heading: "8. Segurança",
      paragraphs: [
        "A UBT adota medidas técnicas e organizacionais compatíveis com os padrões atuais de segurança da informação.",
      ],
    },
    {
      heading: "9. Encarregado de Dados (DPO)",
      paragraphs: [
        "Nome: Encarregado de Proteção de Dados — UBT Plataforma Digital Ltda (CNPJ: 68.394.558/0001-32)",
        "E-mail: ubt.servicos@gmail.com",
      ],
    },
  ],
};

export function getLegalDocument(key: LegalDocumentKey): LegalDocument {
  return key === "terms" ? TERMS_OF_USE_DOC : PRIVACY_POLICY_DOC;
}
