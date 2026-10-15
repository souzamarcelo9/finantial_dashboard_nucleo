/**
 * Contas a pagar e a receber.
 *
 * É uma entidade SEPARADA de Transaction de propósito: um lançamento é fato
 * consumado (regime de caixa) e entra nos KPIs; uma conta é previsão e não
 * pode contaminar os gráficos enquanto não for paga. Quando a conta é baixada,
 * o sistema cria o lançamento e guarda o vínculo em `transactionId`.
 *
 * Datas são strings "YYYY-MM-DD", não Date: vencimento é dia de calendário,
 * e objetos Date trariam fuso horário para um problema que não tem hora.
 */

export type PayableDirection = "pay" | "receive";

/** Estado persistido. "vencido" NÃO é salvo: depende da data de hoje. */
export type PayableStatus = "open" | "paid";

/** Estado exibido, calculado na hora a partir de status + dueDate. */
export type PayableDerivedStatus = "paid" | "overdue" | "due-soon" | "open";

export interface PayableRecurrence {
  frequency: "monthly";
  /** Dia do vencimento; 31 cai para o último dia em meses curtos. */
  dayOfMonth: number;
}

export interface Payable {
  id: string;
  userId?: string;
  direction: PayableDirection;
  description: string;
  /** Fornecedor (a pagar) ou cliente (a receber) */
  counterparty?: string;
  category: string;
  subcategory?: string;
  /** Banco/conta prevista para a liquidação */
  account?: string;
  amount: number;
  /** "YYYY-MM-DD" */
  dueDate: string;
  status: PayableStatus;
  /** "YYYY-MM-DD" — preenchido na baixa */
  paidAt?: string;
  paidAmount?: number;
  paidAccount?: string;
  /** Lançamento gerado pela baixa, usado para estornar */
  transactionId?: string;
  /** Agrupa as ocorrências de uma conta recorrente */
  seriesId?: string;
  recurrence?: PayableRecurrence;
  note?: string;
  /** Último aviso enviado por e-mail (usado pelo cron para não repetir) */
  notifiedAt?: string;
  createdAt?: string;
}

export interface PayablePaymentInput {
  paidAt: string;
  paidAmount: number;
  account: string;
  note?: string;
}

export interface PayableMutationResult {
  ok: boolean;
  error?: string;
}
