import { create } from "zustand";
import { persist } from "zustand/middleware";
import type {
  Payable,
  PayableMutationResult,
  PayablePaymentInput,
} from "../features/payables/types";
import {
  addMonthsKeepingDay,
  buildMonthlyDueDates,
  makePayableId,
  RECURRENCE_HORIZON_MONTHS,
  todayISO,
} from "../features/payables/utils";
import { isFirebaseConfigured } from "../lib/firebase/firebaseConfig";
import {
  deletePayablesBulk,
  deletePayable as fbDeletePayable,
  fetchPayables,
  savePayable,
  savePayablesBulk,
} from "../lib/firebase/payablesService";
import type { Transaction } from "../types";
import { useFinancialStore } from "./financialStore";

/** Dados do formulário: o id e os campos de controle são gerados aqui. */
export type PayableDraft = Omit<Payable, "id" | "status" | "seriesId" | "createdAt">;

interface PayablesStore {
  payables: Payable[];
  loading: boolean;
  error: string | null;

  loadPayables: () => Promise<void>;
  createPayable: (draft: PayableDraft) => Promise<PayableMutationResult>;
  updatePayable: (payable: Payable) => Promise<PayableMutationResult>;
  removePayable: (id: string) => Promise<void>;
  removeSeries: (seriesId: string) => Promise<void>;
  markAsPaid: (id: string, payment: PayablePaymentInput) => Promise<PayableMutationResult>;
  /** Baixa vinculando um lançamento que JÁ existe (conciliação da importação) */
  linkToTransaction: (
    id: string,
    link: { transactionId: string; paidAt: string; paidAmount: number; account: string }
  ) => Promise<PayableMutationResult>;
  undoPayment: (id: string) => Promise<PayableMutationResult>;
  /** Mantém séries recorrentes sempre com 12 meses à frente materializados */
  extendRecurringSeries: () => Promise<void>;
  reset: () => void;
}

const sortByDueDate = (payables: Payable[]): Payable[] =>
  [...payables].sort((a, b) => a.dueDate.localeCompare(b.dueDate));

export const usePayablesStore = create<PayablesStore>()(
  persist(
    (set, get) => ({
      payables: [],
      loading: false,
      error: null,

      loadPayables: async () => {
        if (!isFirebaseConfigured()) return;
        set({ loading: true });
        try {
          const remote = await fetchPayables();
          set({ payables: sortByDueDate(remote), loading: false });
          await get().extendRecurringSeries();
        } catch (err) {
          console.error("Erro ao carregar contas a pagar/receber:", err);
          set({ error: (err as Error).message, loading: false });
        }
      },

      createPayable: async (draft) => {
        if (!draft.description.trim()) {
          return { ok: false, error: "Informe a descrição da conta." };
        }
        if (!(draft.amount > 0)) {
          return { ok: false, error: "Informe um valor maior que zero." };
        }
        if (!draft.dueDate) {
          return { ok: false, error: "Informe a data de vencimento." };
        }

        const createdAt = new Date().toISOString();
        let novos: Payable[];

        if (draft.recurrence) {
          // Conta recorrente: materializa 12 ocorrências de uma vez e as
          // mantém ligadas por seriesId. Materializar (em vez de calcular na
          // hora) deixa cada mês editável e pagável de forma independente.
          const seriesId = makePayableId();
          novos = buildMonthlyDueDates(
            draft.dueDate,
            draft.recurrence,
            RECURRENCE_HORIZON_MONTHS
          ).map((dueDate) => ({
            ...draft,
            id: makePayableId(),
            dueDate,
            status: "open" as const,
            seriesId,
            createdAt,
          }));
        } else {
          novos = [{ ...draft, id: makePayableId(), status: "open" as const, createdAt }];
        }

        set((state) => ({ payables: sortByDueDate([...state.payables, ...novos]) }));

        try {
          await savePayablesBulk(novos);
          return { ok: true };
        } catch (err) {
          console.error("Erro ao salvar conta:", err);
          set({ error: (err as Error).message });
          return { ok: false, error: (err as Error).message };
        }
      },

      updatePayable: async (payable) => {
        set((state) => ({
          payables: sortByDueDate(state.payables.map((p) => (p.id === payable.id ? payable : p))),
        }));
        try {
          await savePayable(payable);
          return { ok: true };
        } catch (err) {
          console.error("Erro ao atualizar conta:", err);
          set({ error: (err as Error).message });
          return { ok: false, error: (err as Error).message };
        }
      },

      removePayable: async (id) => {
        set((state) => ({ payables: state.payables.filter((p) => p.id !== id) }));
        try {
          await fbDeletePayable(id);
        } catch (err) {
          console.error("Erro ao excluir conta:", err);
          set({ error: (err as Error).message });
        }
      },

      removeSeries: async (seriesId) => {
        // Só remove o que ainda está em aberto: apagar uma conta já paga
        // deixaria o lançamento correspondente órfão no caixa.
        const alvos = get().payables.filter((p) => p.seriesId === seriesId && p.status === "open");
        const ids = alvos.map((p) => p.id);
        set((state) => ({ payables: state.payables.filter((p) => !ids.includes(p.id)) }));
        try {
          await deletePayablesBulk(ids);
        } catch (err) {
          console.error("Erro ao excluir série:", err);
          set({ error: (err as Error).message });
        }
      },

      markAsPaid: async (id, payment) => {
        const payable = get().payables.find((p) => p.id === id);
        if (!payable) return { ok: false, error: "Conta não encontrada." };
        if (payable.status === "paid") return { ok: false, error: "Esta conta já está baixada." };
        if (!(payment.paidAmount > 0)) {
          return { ok: false, error: "Informe o valor pago." };
        }
        if (!payment.account.trim()) {
          return { ok: false, error: "Informe o banco/conta da liquidação." };
        }

        // A baixa gera o lançamento no caixa: é ele que alimenta KPIs e
        // gráficos. A conta a pagar sozinha é previsão e não entra em nada.
        const transaction: Transaction = {
          id: `payable-${payable.id}`,
          date: new Date(`${payment.paidAt}T12:00:00`),
          amount: payment.paidAmount,
          type: payable.direction === "pay" ? "Expense" : "Income",
          category: payable.category,
          subcategory: payable.subcategory ?? "",
          account: payment.account.trim(),
          ...(payment.note?.trim() ? { note: payment.note.trim() } : {}),
        };

        try {
          await useFinancialStore.getState().addTransaction(transaction);
        } catch (err) {
          console.error("Erro ao gerar o lançamento da baixa:", err);
          return { ok: false, error: (err as Error).message };
        }

        const atualizado: Payable = {
          ...payable,
          status: "paid",
          paidAt: payment.paidAt,
          paidAmount: payment.paidAmount,
          paidAccount: payment.account.trim(),
          transactionId: transaction.id,
        };
        return get().updatePayable(atualizado);
      },

      linkToTransaction: async (id, link) => {
        const payable = get().payables.find((p) => p.id === id);
        if (!payable) return { ok: false, error: "Conta não encontrada." };
        if (payable.status === "paid") return { ok: false, error: "Esta conta já está baixada." };

        // Nenhum lançamento é criado aqui: ele já veio da importação. Criar
        // outro dobraria o valor no caixa.
        return get().updatePayable({
          ...payable,
          status: "paid",
          paidAt: link.paidAt,
          paidAmount: link.paidAmount,
          paidAccount: link.account,
          transactionId: link.transactionId,
        });
      },

      undoPayment: async (id) => {
        const payable = get().payables.find((p) => p.id === id);
        if (!payable) return { ok: false, error: "Conta não encontrada." };
        if (payable.status !== "paid") return { ok: false, error: "Esta conta não está baixada." };

        // Só apaga o lançamento que a própria baixa criou. Se a conta foi
        // conciliada com um lançamento importado, ele é do extrato e deve
        // permanecer no caixa — o estorno apenas desfaz o vínculo.
        if (payable.transactionId?.startsWith("payable-")) {
          try {
            await useFinancialStore.getState().removeTransaction(payable.transactionId);
          } catch (err) {
            console.error("Erro ao estornar o lançamento:", err);
            return { ok: false, error: (err as Error).message };
          }
        }

        const atualizado: Payable = {
          ...payable,
          status: "open",
          paidAt: undefined,
          paidAmount: undefined,
          paidAccount: undefined,
          transactionId: undefined,
        };
        return get().updatePayable(atualizado);
      },

      extendRecurringSeries: async () => {
        const { payables } = get();
        const limite = addMonthsKeepingDay(todayISO(), RECURRENCE_HORIZON_MONTHS, 28);
        const novos: Payable[] = [];

        // Agrupa por série e completa até o horizonte, para que a cliente
        // nunca precise recadastrar o aluguel quando os 12 meses acabarem.
        const series = new Map<string, Payable[]>();
        payables.forEach((p) => {
          if (p.seriesId && p.recurrence) {
            series.set(p.seriesId, [...(series.get(p.seriesId) ?? []), p]);
          }
        });

        series.forEach((ocorrencias) => {
          const modelo = ocorrencias[ocorrencias.length - 1];
          if (!modelo?.recurrence) return;
          let ultima = ocorrencias.reduce(
            (max, p) => (p.dueDate > max ? p.dueDate : max),
            ocorrencias[0].dueDate
          );
          let guard = 0;
          while (ultima < limite && guard < RECURRENCE_HORIZON_MONTHS * 2) {
            ultima = addMonthsKeepingDay(ultima, 1, modelo.recurrence.dayOfMonth);
            novos.push({
              ...modelo,
              id: makePayableId(),
              dueDate: ultima,
              status: "open",
              paidAt: undefined,
              paidAmount: undefined,
              paidAccount: undefined,
              transactionId: undefined,
              notifiedAt: undefined,
              createdAt: new Date().toISOString(),
            });
            guard += 1;
          }
        });

        if (novos.length === 0) return;
        set((state) => ({ payables: sortByDueDate([...state.payables, ...novos]) }));
        try {
          await savePayablesBulk(novos);
        } catch (err) {
          console.error("Erro ao estender séries recorrentes:", err);
          set({ error: (err as Error).message });
        }
      },

      reset: () => set({ payables: [], loading: false, error: null }),
    }),
    {
      name: "payables-storage",
      partialize: (state) => ({
        // Com Firebase ligado ele é a fonte da verdade; o localStorage só
        // guarda dados no modo 100% local.
        payables: isFirebaseConfigured() ? [] : state.payables,
      }),
    }
  )
);

export const usePayables = () => usePayablesStore((state) => state.payables);
export const useLoadPayables = () => usePayablesStore((state) => state.loadPayables);
export const useCreatePayable = () => usePayablesStore((state) => state.createPayable);
export const useUpdatePayable = () => usePayablesStore((state) => state.updatePayable);
export const useRemovePayable = () => usePayablesStore((state) => state.removePayable);
export const useRemoveSeries = () => usePayablesStore((state) => state.removeSeries);
export const useMarkPayableAsPaid = () => usePayablesStore((state) => state.markAsPaid);
export const useLinkPayableToTransaction = () =>
  usePayablesStore((state) => state.linkToTransaction);
export const useUndoPayablePayment = () => usePayablesStore((state) => state.undoPayment);
