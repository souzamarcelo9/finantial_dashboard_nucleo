import type { Payable, PayableDerivedStatus, PayableRecurrence } from "./types";

/** Quantos dias antes do vencimento a conta entra em alerta (amarelo / e-mail) */
export const DUE_SOON_DAYS = 5;

/** Quantos meses à frente uma série recorrente é mantida materializada */
export const RECURRENCE_HORIZON_MONTHS = 12;

export const todayISO = (): string => {
  const now = new Date();
  return toISODate(now.getFullYear(), now.getMonth(), now.getDate());
};

export const toISODate = (year: number, monthIndex: number, day: number): string =>
  `${year}-${String(monthIndex + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;

/**
 * Converte "YYYY-MM-DD" em Date à meia-noite LOCAL.
 * `new Date("2026-10-14")` seria interpretado como UTC e, no Brasil, voltaria
 * para o dia 13 — por isso a construção manual.
 */
export const parseISODate = (iso: string): Date => {
  const [year, month, day] = iso.split("-").map(Number);
  return new Date(year, (month ?? 1) - 1, day ?? 1);
};

export const formatISODateBR = (iso: string): string => {
  if (!iso) return "-";
  const [year, month, day] = iso.split("-");
  return `${day}/${month}/${year}`;
};

/** Dias até o vencimento: negativo = vencido, 0 = vence hoje */
export const daysUntilDue = (dueDate: string, reference = todayISO()): number => {
  const diff = parseISODate(dueDate).getTime() - parseISODate(reference).getTime();
  return Math.round(diff / 86_400_000);
};

export const getDerivedStatus = (
  payable: Payable,
  reference = todayISO()
): PayableDerivedStatus => {
  if (payable.status === "paid") return "paid";
  const days = daysUntilDue(payable.dueDate, reference);
  if (days < 0) return "overdue";
  if (days <= DUE_SOON_DAYS) return "due-soon";
  return "open";
};

export const DERIVED_STATUS_LABEL: Record<PayableDerivedStatus, string> = {
  paid: "Pago",
  overdue: "Vencido",
  "due-soon": "A vencer",
  open: "Em aberto",
};

/** Classes Tailwind do badge de status (vermelho vencido, verde pago) */
export const DERIVED_STATUS_CLASS: Record<PayableDerivedStatus, string> = {
  paid: "bg-emerald-500/15 text-emerald-300 border-emerald-500/40",
  overdue: "bg-red-500/15 text-red-300 border-red-500/40",
  "due-soon": "bg-amber-500/15 text-amber-300 border-amber-500/40",
  open: "bg-gray-600/30 text-gray-300 border-gray-500/40",
};

/** Último dia do mês (1-12 em monthIndex 0-11) */
const lastDayOfMonth = (year: number, monthIndex: number): number =>
  new Date(year, monthIndex + 1, 0).getDate();

/**
 * Próximo vencimento mensal a partir de uma data.
 * Dia 31 em fevereiro cai para o último dia do mês, e volta para 31 no mês
 * seguinte — por isso o dia desejado vem da recorrência, não da data anterior.
 */
export const addMonthsKeepingDay = (iso: string, months: number, dayOfMonth: number): string => {
  const base = parseISODate(iso);
  const year = base.getFullYear();
  const monthIndex = base.getMonth() + months;
  const target = new Date(year, monthIndex, 1);
  const day = Math.min(dayOfMonth, lastDayOfMonth(target.getFullYear(), target.getMonth()));
  return toISODate(target.getFullYear(), target.getMonth(), day);
};

/**
 * Gera as datas de vencimento de uma série mensal, a partir da primeira
 * (inclusive) até `months` ocorrências.
 */
export const buildMonthlyDueDates = (
  firstDueDate: string,
  recurrence: PayableRecurrence,
  months: number
): string[] => {
  const dates: string[] = [];
  for (let i = 0; i < months; i++) {
    dates.push(addMonthsKeepingDay(firstDueDate, i, recurrence.dayOfMonth));
  }
  return dates;
};

export const makePayableId = (): string =>
  `pay-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

export const sumAmounts = (payables: Payable[]): number =>
  payables.reduce((total, p) => total + (Number(p.amount) || 0), 0);
