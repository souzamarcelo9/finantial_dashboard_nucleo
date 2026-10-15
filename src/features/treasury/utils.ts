import type { Transaction } from "../../types";
import type { AccountBalance, BalanceAdjustment, BankAccount } from "./types";

/**
 * O campo "Conta/Carteira" do lançamento é texto livre e histórico.
 * Para casar com a conta cadastrada, comparamos sem caixa, sem acento e sem
 * espaços extras — "Banco Domínio" e "BANCO DOMINIO" são a mesma conta.
 */
export const normalizeAccountName = (value: string): string =>
  (value ?? "")
    .trim()
    .toLocaleLowerCase("pt-BR")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ");

/** "YYYY-MM-DD" de um Date ou de uma data já em string */
export const transactionISODate = (date: string | Date): string => {
  if (date instanceof Date) {
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(
      date.getDate()
    ).padStart(2, "0")}`;
  }
  return String(date).slice(0, 10);
};

/**
 * Efeito de um lançamento sobre o saldo da conta.
 *
 * Segue exatamente a mesma convenção já usada em
 * `calculateNetBalanceBreakdownFromAccounts`: entradas somam, saídas
 * subtraem, e Reimbursement/Investment ficam de fora. Divergir aqui faria a
 * Tesouraria mostrar um saldo diferente do card de saldos da Visão Geral.
 */
export const transactionBalanceEffect = (transaction: Transaction): number => {
  const amount = Math.abs(Number(transaction.amount) || 0);
  if (transaction.type === "Income" || transaction.type === "Transfer-In") return amount;
  if (transaction.type === "Expense" || transaction.type === "Transfer-Out") return -amount;
  return 0;
};

/**
 * Saldo atual de uma conta.
 *
 * Lançamentos ANTERIORES à data de abertura são ignorados de propósito: o
 * saldo de abertura já os representa, e somá-los contaria duas vezes.
 */
export const calculateAccountBalance = (
  account: BankAccount,
  transactions: Transaction[],
  adjustments: BalanceAdjustment[]
): AccountBalance => {
  const alvo = normalizeAccountName(account.name);

  let transactionsTotal = 0;
  let transactionsCount = 0;
  transactions.forEach((transaction) => {
    if (normalizeAccountName(transaction.account) !== alvo) return;
    if (transactionISODate(transaction.date) < account.openingDate) return;
    transactionsTotal += transactionBalanceEffect(transaction);
    transactionsCount += 1;
  });

  const adjustmentsTotal = adjustments
    .filter((adjustment) => adjustment.accountId === account.id)
    .reduce((total, adjustment) => total + (Number(adjustment.amount) || 0), 0);

  return {
    account,
    openingBalance: account.openingBalance,
    transactionsTotal,
    adjustmentsTotal,
    currentBalance: account.openingBalance + transactionsTotal + adjustmentsTotal,
    transactionsCount,
  };
};

export const calculateAllBalances = (
  accounts: BankAccount[],
  transactions: Transaction[],
  adjustments: BalanceAdjustment[]
): AccountBalance[] =>
  accounts.map((account) => calculateAccountBalance(account, transactions, adjustments));

export const makeTreasuryId = (prefix: string): string =>
  `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

/**
 * Lançamentos cuja conta não corresponde a nenhuma conta cadastrada.
 * Serve para avisar a cliente de que existe dinheiro fora da tesouraria —
 * normalmente erro de digitação no nome da conta.
 */
export const findUnlinkedAccountNames = (
  accounts: BankAccount[],
  transactions: Transaction[]
): Array<{ name: string; count: number }> => {
  const conhecidas = new Set(accounts.map((a) => normalizeAccountName(a.name)));
  const avulsas = new Map<string, { name: string; count: number }>();
  transactions.forEach((transaction) => {
    const bruto = (transaction.account ?? "").trim();
    if (!bruto) return;
    const chave = normalizeAccountName(bruto);
    if (conhecidas.has(chave)) return;
    const atual = avulsas.get(chave);
    avulsas.set(chave, { name: atual?.name ?? bruto, count: (atual?.count ?? 0) + 1 });
  });
  return [...avulsas.values()].sort((a, b) => b.count - a.count);
};
