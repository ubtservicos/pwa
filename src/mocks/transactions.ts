export type TransactionType = "entrada" | "saida" | "split" | "sorteio";
export type SplitDestino =
  | "comunidade"
  | "premioTrabalhador"
  | "premioTomador"
  | "padrinho";

export interface Transaction {
  id: string;
  type: TransactionType;
  date: string;
  description: string;
  amount: number;
  status: "confirmed" | "pending" | "cancelled";
  splitDestino?: SplitDestino;
  splitPercent?: number;
  sorteioData?: string;
  sorteioStatus?: "participando" | "ganhou" | "nao_ganhou";
  premio?: number;
}

const daysAgo = (n: number, hour = 14, min = 0) => {
  const d = new Date();
  d.setDate(d.getDate() - n);
  d.setHours(hour, min, 0, 0);
  return d.toISOString();
};

export const MOCK_TRANSACTIONS: Transaction[] = [
  // Day 0 (Today)
  {
    id: "tx-01",
    type: "entrada",
    date: daysAgo(0, 10, 30),
    description: "Venda de Pastel e Caldo de Cana",
    amount: 65.00,
    status: "confirmed"
  },
  {
    id: "tx-02",
    type: "split",
    date: daysAgo(0, 10, 30),
    description: "Split UBT - Comunidade",
    amount: 1.30,
    status: "confirmed",
    splitDestino: "comunidade"
  },
  {
    id: "tx-03",
    type: "split",
    date: daysAgo(0, 10, 30),
    description: "Split UBT - Prêmio Trabalhador",
    amount: 0.98,
    status: "confirmed",
    splitDestino: "premioTrabalhador"
  },
  {
    id: "tx-04",
    type: "split",
    date: daysAgo(0, 10, 30),
    description: "Split UBT - Prêmio Tomador",
    amount: 0.98,
    status: "confirmed",
    splitDestino: "premioTomador"
  },
  {
    id: "tx-05",
    type: "split",
    date: daysAgo(0, 10, 30),
    description: "Split UBT - Padrinho/Madrinha",
    amount: 0.65,
    status: "confirmed",
    splitDestino: "padrinho"
  },
  {
    id: "tx-06",
    type: "saida",
    date: daysAgo(0, 15, 0),
    description: "Saque PIX para Banco",
    amount: 150.00,
    status: "confirmed"
  },
  
  // Day 1 (Yesterday)
  {
    id: "tx-11",
    type: "entrada",
    date: daysAgo(1, 14, 15),
    description: "Faxina Residencial Completa",
    amount: 180.00,
    status: "confirmed"
  },
  {
    id: "tx-12",
    type: "split",
    date: daysAgo(1, 14, 15),
    description: "Split UBT - Comunidade",
    amount: 3.60,
    status: "confirmed",
    splitDestino: "comunidade"
  },
  {
    id: "tx-13",
    type: "split",
    date: daysAgo(1, 14, 15),
    description: "Split UBT - Prêmio Trabalhador",
    amount: 2.70,
    status: "confirmed",
    splitDestino: "premioTrabalhador"
  },
  {
    id: "tx-14",
    type: "split",
    date: daysAgo(1, 14, 15),
    description: "Split UBT - Prêmio Tomador",
    amount: 2.70,
    status: "confirmed",
    splitDestino: "premioTomador"
  },
  {
    id: "tx-15",
    type: "split",
    date: daysAgo(1, 14, 15),
    description: "Split UBT - Padrinho/Madrinha",
    amount: 1.80,
    status: "confirmed",
    splitDestino: "padrinho"
  },
  
  // Day 2
  {
    id: "tx-21",
    type: "entrada",
    date: daysAgo(2, 9, 0),
    description: "Corrida Mototaxi (Centro > Itaguá)",
    amount: 25.00,
    status: "confirmed"
  },
  {
    id: "tx-22",
    type: "split",
    date: daysAgo(2, 9, 0),
    description: "Split UBT - Comunidade",
    amount: 0.50,
    status: "confirmed",
    splitDestino: "comunidade"
  },
  {
    id: "tx-23",
    type: "split",
    date: daysAgo(2, 9, 0),
    description: "Split UBT - Prêmio Trabalhador",
    amount: 0.38,
    status: "confirmed",
    splitDestino: "premioTrabalhador"
  },
  {
    id: "tx-24",
    type: "split",
    date: daysAgo(2, 9, 0),
    description: "Split UBT - Prêmio Tomador",
    amount: 0.38,
    status: "confirmed",
    splitDestino: "premioTomador"
  },
  {
    id: "tx-25",
    type: "split",
    date: daysAgo(2, 9, 0),
    description: "Split UBT - Padrinho/Madrinha",
    amount: 0.25,
    status: "confirmed",
    splitDestino: "padrinho"
  },

  // Day 3
  {
    id: "tx-31",
    type: "entrada",
    date: daysAgo(3, 11, 20),
    description: "Venda de Água de Côco e Lanches",
    amount: 120.00,
    status: "confirmed"
  },
  {
    id: "tx-32",
    type: "split",
    date: daysAgo(3, 11, 20),
    description: "Split UBT - Comunidade",
    amount: 2.40,
    status: "confirmed",
    splitDestino: "comunidade"
  },
  {
    id: "tx-33",
    type: "split",
    date: daysAgo(3, 11, 20),
    description: "Split UBT - Prêmio Trabalhador",
    amount: 1.80,
    status: "confirmed",
    splitDestino: "premioTrabalhador"
  },
  {
    id: "tx-34",
    type: "split",
    date: daysAgo(3, 11, 20),
    description: "Split UBT - Prêmio Tomador",
    amount: 1.80,
    status: "confirmed",
    splitDestino: "premioTomador"
  },
  {
    id: "tx-35",
    type: "split",
    date: daysAgo(3, 11, 20),
    description: "Split UBT - Padrinho/Madrinha",
    amount: 1.20,
    status: "confirmed",
    splitDestino: "padrinho"
  },
  {
    id: "tx-36",
    type: "saida",
    date: daysAgo(3, 16, 45),
    description: "Pagamento de Taxa de Licença Mensal",
    amount: 45.00,
    status: "confirmed"
  },

  // Day 4
  {
    id: "tx-41",
    type: "entrada",
    date: daysAgo(4, 13, 0),
    description: "Faxina Residencial Expressa",
    amount: 110.00,
    status: "confirmed"
  },
  {
    id: "tx-42",
    type: "split",
    date: daysAgo(4, 13, 0),
    description: "Split UBT - Comunidade",
    amount: 2.20,
    status: "confirmed",
    splitDestino: "comunidade"
  },
  {
    id: "tx-43",
    type: "split",
    date: daysAgo(4, 13, 0),
    description: "Split UBT - Prêmio Trabalhador",
    amount: 1.65,
    status: "confirmed",
    splitDestino: "premioTrabalhador"
  },
  {
    id: "tx-44",
    type: "split",
    date: daysAgo(4, 13, 0),
    description: "Split UBT - Prêmio Tomador",
    amount: 1.65,
    status: "confirmed",
    splitDestino: "premioTomador"
  },
  {
    id: "tx-45",
    type: "split",
    date: daysAgo(4, 13, 0),
    description: "Split UBT - Padrinho/Madrinha",
    amount: 1.10,
    status: "confirmed",
    splitDestino: "padrinho"
  },

  // Day 5
  {
    id: "tx-51",
    type: "entrada",
    date: daysAgo(5, 17, 30),
    description: "Corrida Mototaxi (Itaguá > Perequê-Açu)",
    amount: 32.00,
    status: "confirmed"
  },
  {
    id: "tx-52",
    type: "split",
    date: daysAgo(5, 17, 30),
    description: "Split UBT - Comunidade",
    amount: 0.64,
    status: "confirmed",
    splitDestino: "comunidade"
  },
  {
    id: "tx-53",
    type: "split",
    date: daysAgo(5, 17, 30),
    description: "Split UBT - Prêmio Trabalhador",
    amount: 0.48,
    status: "confirmed",
    splitDestino: "premioTrabalhador"
  },
  {
    id: "tx-54",
    type: "split",
    date: daysAgo(5, 17, 30),
    description: "Split UBT - Prêmio Tomador",
    amount: 0.48,
    status: "confirmed",
    splitDestino: "premioTomador"
  },
  {
    id: "tx-55",
    type: "split",
    date: daysAgo(5, 17, 30),
    description: "Split UBT - Padrinho/Madrinha",
    amount: 0.32,
    status: "confirmed",
    splitDestino: "padrinho"
  },

  // Day 6
  {
    id: "tx-61",
    type: "entrada",
    date: daysAgo(6, 10, 0),
    description: "Faxina Comercial Escritório",
    amount: 350.00,
    status: "confirmed"
  },
  {
    id: "tx-62",
    type: "split",
    date: daysAgo(6, 10, 0),
    description: "Split UBT - Comunidade",
    amount: 7.00,
    status: "confirmed",
    splitDestino: "comunidade"
  },
  {
    id: "tx-63",
    type: "split",
    date: daysAgo(6, 10, 0),
    description: "Split UBT - Prêmio Trabalhador",
    amount: 5.25,
    status: "confirmed",
    splitDestino: "premioTrabalhador"
  },
  {
    id: "tx-64",
    type: "split",
    date: daysAgo(6, 10, 0),
    description: "Split UBT - Prêmio Tomador",
    amount: 5.25,
    status: "confirmed",
    splitDestino: "premioTomador"
  },
  {
    id: "tx-65",
    type: "split",
    date: daysAgo(6, 10, 0),
    description: "Split UBT - Padrinho/Madrinha",
    amount: 3.50,
    status: "confirmed",
    splitDestino: "padrinho"
  },
  {
    id: "tx-66",
    type: "saida",
    date: daysAgo(6, 19, 0),
    description: "Saque PIX para Banco",
    amount: 250.00,
    status: "confirmed"
  },

  // Sorteios participações
  {
    id: "tx-sorteio-1",
    type: "sorteio",
    date: daysAgo(2, 12, 0),
    description: "Ticket da Sorte - Prêmio Trabalhador (1/5)",
    amount: 0,
    status: "confirmed",
    sorteioStatus: "participando"
  },
  {
    id: "tx-sorteio-2",
    type: "sorteio",
    date: daysAgo(4, 12, 0),
    description: "Ticket da Sorte - Prêmio Tomador (1/11)",
    amount: 0,
    status: "confirmed",
    sorteioStatus: "participando"
  },
  {
    id: "tx-sorteio-3",
    type: "sorteio",
    date: daysAgo(30, 18, 0),
    description: "Edição Especial - Sorteio Consumidor 1/11",
    amount: 1500.00,
    status: "confirmed",
    sorteioStatus: "ganhou"
  }
];
