/**
 * Tesouraria: contas bancárias cadastradas e ajustes de saldo.
 *
 * O saldo NÃO é um campo editável. Ele é sempre calculado:
 *   saldo = saldo de abertura + ajustes + lançamentos a partir da abertura
 *
 * Deixar a cliente sobrescrever o saldo direto destruiria a rastreabilidade —
 * ninguém saberia depois por que o número mudou. Cada correção vira um
 * registro de ajuste com data, valor e motivo.
 */

export type BankAccountType = "checking" | "savings" | "cash" | "credit" | "investment";

export const BANK_ACCOUNT_TYPE_LABEL: Record<BankAccountType, string> = {
  checking: "Conta corrente",
  savings: "Poupança",
  cash: "Caixa / Dinheiro",
  credit: "Cartão de crédito",
  investment: "Investimento",
};

export interface BankAccount {
  id: string;
  userId?: string;
  /** Nome exibido e usado para casar com o campo "Conta/Carteira" dos lançamentos */
  name: string;
  bank?: string;
  type: BankAccountType;
  /** Agência e conta, só informativos */
  branch?: string;
  number?: string;
  /** Saldo na data de abertura; os lançamentos anteriores a ela são ignorados */
  openingBalance: number;
  /** "YYYY-MM-DD" */
  openingDate: string;
  active: boolean;
  note?: string;
  createdAt?: string;
}

export interface BalanceAdjustment {
  id: string;
  userId?: string;
  accountId: string;
  /** "YYYY-MM-DD" */
  date: string;
  /** Diferença aplicada: positiva aumenta o saldo, negativa reduz */
  amount: number;
  /** Saldo calculado antes e depois, congelados para auditoria */
  previousBalance: number;
  newBalance: number;
  reason: string;
  /** "conciliation" quando veio da tela de conciliação; "manual" quando digitado */
  origin: "conciliation" | "manual";
  createdAt?: string;
}

export interface AccountBalance {
  account: BankAccount;
  openingBalance: number;
  /** Soma dos lançamentos a partir da data de abertura */
  transactionsTotal: number;
  adjustmentsTotal: number;
  currentBalance: number;
  transactionsCount: number;
}

export interface TreasuryMutationResult {
  ok: boolean;
  error?: string;
}
