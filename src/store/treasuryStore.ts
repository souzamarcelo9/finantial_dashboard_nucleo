import { create } from "zustand";
import { persist } from "zustand/middleware";
import type {
  BalanceAdjustment,
  BankAccount,
  TreasuryMutationResult,
} from "../features/treasury/types";
import { makeTreasuryId, normalizeAccountName } from "../features/treasury/utils";
import { isFirebaseConfigured } from "../lib/firebase/firebaseConfig";
import {
  deleteBalanceAdjustment,
  deleteBankAccount,
  fetchBalanceAdjustments,
  fetchBankAccounts,
  saveBalanceAdjustment,
  saveBankAccount,
} from "../lib/firebase/treasuryService";

export type BankAccountDraft = Omit<BankAccount, "id" | "createdAt">;

export interface AdjustmentInput {
  accountId: string;
  date: string;
  /** Diferença a aplicar (pode ser negativa) */
  amount: number;
  previousBalance: number;
  reason: string;
  origin: "conciliation" | "manual";
}

interface TreasuryStore {
  accounts: BankAccount[];
  adjustments: BalanceAdjustment[];
  loading: boolean;
  error: string | null;

  loadTreasury: () => Promise<void>;
  createAccount: (draft: BankAccountDraft) => Promise<TreasuryMutationResult>;
  updateAccount: (account: BankAccount) => Promise<TreasuryMutationResult>;
  removeAccount: (id: string) => Promise<TreasuryMutationResult>;
  addAdjustment: (input: AdjustmentInput) => Promise<TreasuryMutationResult>;
  removeAdjustment: (id: string) => Promise<void>;
  reset: () => void;
}

export const useTreasuryStore = create<TreasuryStore>()(
  persist(
    (set, get) => ({
      accounts: [],
      adjustments: [],
      loading: false,
      error: null,

      loadTreasury: async () => {
        if (!isFirebaseConfigured()) return;
        set({ loading: true });
        try {
          const [accounts, adjustments] = await Promise.all([
            fetchBankAccounts(),
            fetchBalanceAdjustments(),
          ]);
          set({
            accounts: accounts.sort((a, b) => a.name.localeCompare(b.name, "pt-BR")),
            adjustments,
            loading: false,
          });
        } catch (err) {
          console.error("Erro ao carregar a tesouraria:", err);
          set({ error: (err as Error).message, loading: false });
        }
      },

      createAccount: async (draft) => {
        const name = draft.name.trim().replace(/\s+/g, " ");
        if (!name) return { ok: false, error: "Informe o nome da conta." };
        if (!draft.openingDate) return { ok: false, error: "Informe a data do saldo inicial." };

        const duplicada = get().accounts.find(
          (a) => normalizeAccountName(a.name) === normalizeAccountName(name)
        );
        if (duplicada) {
          return { ok: false, error: `Já existe uma conta chamada "${duplicada.name}".` };
        }

        const account: BankAccount = {
          ...draft,
          name,
          id: makeTreasuryId("acc"),
          createdAt: new Date().toISOString(),
        };
        set((state) => ({
          accounts: [...state.accounts, account].sort((a, b) =>
            a.name.localeCompare(b.name, "pt-BR")
          ),
        }));
        try {
          await saveBankAccount(account);
          return { ok: true };
        } catch (err) {
          set({ error: (err as Error).message });
          return { ok: false, error: (err as Error).message };
        }
      },

      updateAccount: async (account) => {
        const name = account.name.trim().replace(/\s+/g, " ");
        if (!name) return { ok: false, error: "Informe o nome da conta." };
        const duplicada = get().accounts.find(
          (a) => a.id !== account.id && normalizeAccountName(a.name) === normalizeAccountName(name)
        );
        if (duplicada) {
          return { ok: false, error: `Já existe uma conta chamada "${duplicada.name}".` };
        }

        const atualizada = { ...account, name };
        set((state) => ({
          accounts: state.accounts
            .map((a) => (a.id === account.id ? atualizada : a))
            .sort((a, b) => a.name.localeCompare(b.name, "pt-BR")),
        }));
        try {
          await saveBankAccount(atualizada);
          return { ok: true };
        } catch (err) {
          set({ error: (err as Error).message });
          return { ok: false, error: (err as Error).message };
        }
      },

      removeAccount: async (id) => {
        // Excluir uma conta com ajustes apagaria o histórico de auditoria.
        const ajustes = get().adjustments.filter((a) => a.accountId === id).length;
        if (ajustes > 0) {
          return {
            ok: false,
            error: `Esta conta tem ${ajustes} ajuste(s) de saldo registrados. Desative-a em vez de excluir, para preservar o histórico.`,
          };
        }
        set((state) => ({ accounts: state.accounts.filter((a) => a.id !== id) }));
        try {
          await deleteBankAccount(id);
          return { ok: true };
        } catch (err) {
          set({ error: (err as Error).message });
          return { ok: false, error: (err as Error).message };
        }
      },

      addAdjustment: async (input) => {
        if (!input.reason.trim()) {
          return { ok: false, error: "Descreva o motivo do ajuste." };
        }
        if (!input.amount || Math.abs(input.amount) < 0.005) {
          return { ok: false, error: "O saldo informado é igual ao calculado: nada a ajustar." };
        }

        const adjustment: BalanceAdjustment = {
          id: makeTreasuryId("adj"),
          accountId: input.accountId,
          date: input.date,
          amount: Number(input.amount.toFixed(2)),
          previousBalance: Number(input.previousBalance.toFixed(2)),
          newBalance: Number((input.previousBalance + input.amount).toFixed(2)),
          reason: input.reason.trim(),
          origin: input.origin,
          createdAt: new Date().toISOString(),
        };

        set((state) => ({ adjustments: [adjustment, ...state.adjustments] }));
        try {
          await saveBalanceAdjustment(adjustment);
          return { ok: true };
        } catch (err) {
          set({ error: (err as Error).message });
          return { ok: false, error: (err as Error).message };
        }
      },

      removeAdjustment: async (id) => {
        set((state) => ({ adjustments: state.adjustments.filter((a) => a.id !== id) }));
        try {
          await deleteBalanceAdjustment(id);
        } catch (err) {
          set({ error: (err as Error).message });
        }
      },

      reset: () => set({ accounts: [], adjustments: [], loading: false, error: null }),
    }),
    {
      name: "treasury-storage",
      partialize: (state) => ({
        accounts: isFirebaseConfigured() ? [] : state.accounts,
        adjustments: isFirebaseConfigured() ? [] : state.adjustments,
      }),
    }
  )
);

export const useBankAccounts = () => useTreasuryStore((state) => state.accounts);
export const useBalanceAdjustments = () => useTreasuryStore((state) => state.adjustments);
export const useLoadTreasury = () => useTreasuryStore((state) => state.loadTreasury);
export const useCreateBankAccount = () => useTreasuryStore((state) => state.createAccount);
export const useUpdateBankAccount = () => useTreasuryStore((state) => state.updateAccount);
export const useRemoveBankAccount = () => useTreasuryStore((state) => state.removeAccount);
export const useAddBalanceAdjustment = () => useTreasuryStore((state) => state.addAdjustment);
