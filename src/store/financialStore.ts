import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import { BUDGET_ALLOCATION_DEFAULTS, DEFAULT_CATEGORIES } from "../constants";
import {
  addHistoryEntry,
  type Baseline,
  deleteTransaction as fbDeleteTransaction,
  saveBaseline as fbSaveBaseline,
  saveCategoryCatalog as fbSaveCategoryCatalog,
  saveTransaction as fbSaveTransaction,
  fetchBaselines,
  fetchCategoryCatalog,
  fetchHistory,
  fetchTransactions,
  type ImportHistoryEntry,
  saveTransactionsBulk,
} from "../lib/firebase/financeService";
import { isFirebaseConfigured } from "../lib/firebase/firebaseConfig";
import type { CategoryMapping, Transaction } from "../types";

/** Normaliza um nome de categoria/subcategoria digitado pelo usuário */
const normalizeName = (value: string): string => value.trim().replace(/\s+/g, " ");

/** Chave de comparação: ignora caixa e acentuação para evitar duplicatas */
const comparableKey = (value: string): string =>
  normalizeName(value)
    .toLocaleLowerCase("pt-BR")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");

const findExisting = (names: string[], candidate: string): string | undefined =>
  names.find((name) => comparableKey(name) === comparableKey(candidate));

/**
 * Envia o catálogo para o Firestore quando o Firebase está configurado.
 * Falhas são registradas no estado de erro, sem desfazer a alteração local:
 * o usuário continua trabalhando e o localStorage mantém o dado.
 */
const syncCatalog = (catalog: CategoryMapping, onError: (message: string) => void): void => {
  if (!isFirebaseConfigured()) return;
  fbSaveCategoryCatalog(catalog).catch((err) => {
    console.error("Erro ao sincronizar categorias com o Firebase:", err);
    onError((err as Error).message);
  });
};

interface BudgetAllocation {
  needs: number;
  wants: number;
  savings: number;
}

interface CustomCategories {
  needs: string[];
  wants: string[];
  savings: string[];
}

interface BudgetPreferences {
  allocation: BudgetAllocation;
  customCategories: CustomCategories;
}

interface DateRange {
  start: Date | null;
  end: Date | null;
}

export interface CategoryMutationResult {
  ok: boolean;
  error?: string;
}

interface FinancialStore {
  // State
  transactions: Transaction[];
  dateRange: DateRange;
  budgetPreferences: BudgetPreferences;
  categoryCatalog: CategoryMapping;
  loading: boolean;
  error: string | null;
  firebaseEnabled: boolean;
  syncing: boolean;
  baselines: Baseline[];
  history: ImportHistoryEntry[];

  // Actions
  setTransactions: (
    transactions: Transaction[],
    meta?: { source?: string; fileName?: string }
  ) => void;
  addTransaction: (transaction: Transaction) => Promise<void>;
  updateTransaction: (transaction: Transaction) => Promise<void>;
  removeTransaction: (id: string) => Promise<void>;
  loadFromFirebase: () => Promise<void>;
  createBaseline: (name: string, notes?: string) => Promise<void>;
  loadBaselines: () => Promise<void>;
  loadHistory: () => Promise<void>;
  updateDateRange: (start: Date | null, end: Date | null) => void;
  updateBudgetAllocation: (allocation: BudgetAllocation) => void;
  updateCustomCategories: (type: keyof CustomCategories, categories: string[]) => void;

  // Categorias / subcategorias
  loadCategoryCatalog: () => Promise<void>;
  addCategory: (name: string) => CategoryMutationResult;
  renameCategory: (oldName: string, newName: string) => CategoryMutationResult;
  removeCategory: (name: string) => CategoryMutationResult;
  addSubcategory: (category: string, name: string) => CategoryMutationResult;
  renameSubcategory: (category: string, oldName: string, newName: string) => CategoryMutationResult;
  removeSubcategory: (category: string, name: string) => CategoryMutationResult;
  resetCategoryCatalog: () => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  clearError: () => void;
  reset: () => void;
}

const initialState = {
  transactions: [],
  dateRange: { start: null, end: null },
  budgetPreferences: {
    allocation: BUDGET_ALLOCATION_DEFAULTS,
    customCategories: {
      needs: [],
      wants: [],
      savings: [],
    },
  },
  categoryCatalog: DEFAULT_CATEGORIES as CategoryMapping,
  loading: false,
  error: null,
  firebaseEnabled: isFirebaseConfigured(),
  syncing: false,
  baselines: [] as Baseline[],
  history: [] as ImportHistoryEntry[],
};

/**
 * Financial Dashboard Store (Zustand)
 *
 * - Persistência local (localStorage) como cache/fallback
 * - Persistência remota no Firebase Firestore (lançamentos, baselines, histórico)
 * - Mesma API pública usada pelos componentes existentes, mais as novas
 *   ações para lançamento manual e sincronização com o Firebase.
 */
export const useFinancialStore = create<FinancialStore>()(
  persist(
    (set, get) => ({
      ...initialState,

      setTransactions: (transactions, meta) => {
        set({ transactions });
        if (isFirebaseConfigured()) {
          set({ syncing: true });
          saveTransactionsBulk(transactions)
            .then(() =>
              addHistoryEntry({
                fileName: meta?.fileName ?? "importação",
                fileType: (meta?.source as "csv" | "xlsx" | "manual") ?? "csv",
                transactionCount: transactions.length,
              })
            )
            .catch((err) => {
              console.error("Erro ao sincronizar com o Firebase:", err);
              console.error("Erro ao sincronizar com o Firebase:", err);
              console.error("Erro ao sincronizar com o Firebase:", err);
              set({ error: (err as Error).message });
            })
            .finally(() => set({ syncing: false }));
        }
      },

      addTransaction: async (transaction) => {
        set((state) => ({ transactions: [transaction, ...state.transactions] }));
        if (isFirebaseConfigured()) {
          set({ syncing: true });
          try {
            await fbSaveTransaction(transaction);
            await addHistoryEntry({
              fileName: "Lançamento manual",
              fileType: "manual",
              transactionCount: 1,
            });
          } catch (err) {
            console.error("Erro ao sincronizar com o Firebase:", err);
            console.error("Erro ao sincronizar com o Firebase:", err);
            set({ error: (err as Error).message });
          } finally {
            set({ syncing: false });
          }
        }
      },

      updateTransaction: async (transaction) => {
        set((state) => ({
          transactions: state.transactions.map((t) => (t.id === transaction.id ? transaction : t)),
        }));
        if (isFirebaseConfigured()) {
          try {
            await fbSaveTransaction(transaction);
          } catch (err) {
            console.error("Erro ao sincronizar com o Firebase:", err);
            console.error("Erro ao sincronizar com o Firebase:", err);
            set({ error: (err as Error).message });
          }
        }
      },

      removeTransaction: async (id) => {
        set((state) => ({ transactions: state.transactions.filter((t) => t.id !== id) }));
        if (isFirebaseConfigured()) {
          try {
            await fbDeleteTransaction(id);
          } catch (err) {
            console.error("Erro ao sincronizar com o Firebase:", err);
            console.error("Erro ao sincronizar com o Firebase:", err);
            set({ error: (err as Error).message });
          }
        }
      },

      loadFromFirebase: async () => {
        if (!isFirebaseConfigured()) return;
        set({ loading: true });
        try {
          const remote = await fetchTransactions();
          if (remote.length > 0) {
            set({ transactions: remote });
          }
        } catch (err) {
          console.error("Erro ao sincronizar com o Firebase:", err);
          set({ error: (err as Error).message });
        } finally {
          set({ loading: false });
        }
      },

      createBaseline: async (name, notes) => {
        const state = get();
        try {
          await fbSaveBaseline({
            name,
            notes,
            snapshot: {
              budgetPreferences: state.budgetPreferences,
              dateRange: {
                start: state.dateRange.start ? state.dateRange.start.toISOString() : null,
                end: state.dateRange.end ? state.dateRange.end.toISOString() : null,
              },
            },
          });
          await get().loadBaselines();
        } catch (err) {
          console.error("Erro ao sincronizar com o Firebase:", err);
          set({ error: (err as Error).message });
        }
      },

      loadBaselines: async () => {
        try {
          const baselines = await fetchBaselines();
          set({ baselines });
        } catch (err) {
          console.error("Erro ao sincronizar com o Firebase:", err);
          set({ error: (err as Error).message });
        }
      },

      loadHistory: async () => {
        try {
          const history = await fetchHistory();
          set({ history });
        } catch (err) {
          console.error("Erro ao sincronizar com o Firebase:", err);
          set({ error: (err as Error).message });
        }
      },

      updateDateRange: (start, end) => set({ dateRange: { start, end } }),

      updateBudgetAllocation: (allocation) =>
        set((state) => ({
          budgetPreferences: {
            ...state.budgetPreferences,
            allocation,
          },
        })),

      updateCustomCategories: (type, categories) =>
        set((state) => ({
          budgetPreferences: {
            ...state.budgetPreferences,
            customCategories: {
              ...state.budgetPreferences.customCategories,
              [type]: categories,
            },
          },
        })),

      // ------------------------------------------------------------------
      // Categorias e subcategorias
      // ------------------------------------------------------------------

      loadCategoryCatalog: async () => {
        if (!isFirebaseConfigured()) return;
        try {
          const remote = await fetchCategoryCatalog();
          if (remote && Object.keys(remote).length > 0) {
            set({ categoryCatalog: remote });
          } else {
            // Primeiro acesso do usuário: publica o catálogo padrão/local
            syncCatalog(get().categoryCatalog, (message) => set({ error: message }));
          }
        } catch (err) {
          console.error("Erro ao carregar categorias do Firebase:", err);
          set({ error: (err as Error).message });
        }
      },

      addCategory: (name) => {
        const clean = normalizeName(name);
        if (!clean) {
          return { ok: false, error: "Informe um nome para a categoria." };
        }
        const catalog = get().categoryCatalog;
        const duplicate = findExisting(Object.keys(catalog), clean);
        if (duplicate) {
          return { ok: false, error: `A categoria "${duplicate}" já existe.` };
        }
        const next: CategoryMapping = { ...catalog, [clean]: [] };
        set({ categoryCatalog: next });
        syncCatalog(next, (message) => set({ error: message }));
        return { ok: true };
      },

      renameCategory: (oldName, newName) => {
        const clean = normalizeName(newName);
        if (!clean) {
          return { ok: false, error: "Informe um nome para a categoria." };
        }
        const catalog = get().categoryCatalog;
        if (!(oldName in catalog)) {
          return { ok: false, error: "Categoria não encontrada." };
        }
        if (comparableKey(clean) !== comparableKey(oldName)) {
          const duplicate = findExisting(Object.keys(catalog), clean);
          if (duplicate) {
            return { ok: false, error: `A categoria "${duplicate}" já existe.` };
          }
        }

        // Preserva a ordem original das chaves ao renomear
        const next: CategoryMapping = {};
        Object.entries(catalog).forEach(([key, subs]) => {
          next[key === oldName ? clean : key] = subs;
        });

        // Reetiqueta os lançamentos que usavam o nome antigo
        const affected = get().transactions.filter((t) => t.category === oldName);
        if (affected.length > 0) {
          set((state) => ({
            transactions: state.transactions.map((t) =>
              t.category === oldName ? { ...t, category: clean } : t
            ),
          }));
          if (isFirebaseConfigured()) {
            saveTransactionsBulk(affected.map((t) => ({ ...t, category: clean }))).catch((err) => {
              console.error("Erro ao reetiquetar lançamentos no Firebase:", err);
              set({ error: (err as Error).message });
            });
          }
        }

        set({ categoryCatalog: next });
        syncCatalog(next, (message) => set({ error: message }));
        return { ok: true };
      },

      removeCategory: (name) => {
        const catalog = get().categoryCatalog;
        if (!(name in catalog)) {
          return { ok: false, error: "Categoria não encontrada." };
        }
        const inUse = get().transactions.filter((t) => t.category === name).length;
        if (inUse > 0) {
          return {
            ok: false,
            error: `Não é possível excluir: ${inUse} lançamento(s) usam esta categoria. Renomeie a categoria ou reclassifique os lançamentos primeiro.`,
          };
        }
        const next: CategoryMapping = { ...catalog };
        delete next[name];
        set({ categoryCatalog: next });
        syncCatalog(next, (message) => set({ error: message }));
        return { ok: true };
      },

      addSubcategory: (category, name) => {
        const clean = normalizeName(name);
        if (!clean) {
          return { ok: false, error: "Informe um nome para a subcategoria." };
        }
        const catalog = get().categoryCatalog;
        const current = catalog[category];
        if (!current) {
          return { ok: false, error: "Selecione uma categoria válida." };
        }
        const duplicate = findExisting(current, clean);
        if (duplicate) {
          return { ok: false, error: `A subcategoria "${duplicate}" já existe em ${category}.` };
        }
        const next: CategoryMapping = { ...catalog, [category]: [...current, clean] };
        set({ categoryCatalog: next });
        syncCatalog(next, (message) => set({ error: message }));
        return { ok: true };
      },

      renameSubcategory: (category, oldName, newName) => {
        const clean = normalizeName(newName);
        if (!clean) {
          return { ok: false, error: "Informe um nome para a subcategoria." };
        }
        const catalog = get().categoryCatalog;
        const current = catalog[category];
        if (!current?.includes(oldName)) {
          return { ok: false, error: "Subcategoria não encontrada." };
        }
        if (comparableKey(clean) !== comparableKey(oldName)) {
          const duplicate = findExisting(current, clean);
          if (duplicate) {
            return { ok: false, error: `A subcategoria "${duplicate}" já existe em ${category}.` };
          }
        }

        const next: CategoryMapping = {
          ...catalog,
          [category]: current.map((sub) => (sub === oldName ? clean : sub)),
        };

        const affected = get().transactions.filter(
          (t) => t.category === category && t.subcategory === oldName
        );
        if (affected.length > 0) {
          set((state) => ({
            transactions: state.transactions.map((t) =>
              t.category === category && t.subcategory === oldName
                ? { ...t, subcategory: clean }
                : t
            ),
          }));
          if (isFirebaseConfigured()) {
            saveTransactionsBulk(affected.map((t) => ({ ...t, subcategory: clean }))).catch(
              (err) => {
                console.error("Erro ao reetiquetar lançamentos no Firebase:", err);
                set({ error: (err as Error).message });
              }
            );
          }
        }

        set({ categoryCatalog: next });
        syncCatalog(next, (message) => set({ error: message }));
        return { ok: true };
      },

      removeSubcategory: (category, name) => {
        const catalog = get().categoryCatalog;
        const current = catalog[category];
        if (!current?.includes(name)) {
          return { ok: false, error: "Subcategoria não encontrada." };
        }
        const inUse = get().transactions.filter(
          (t) => t.category === category && t.subcategory === name
        ).length;
        if (inUse > 0) {
          return {
            ok: false,
            error: `Não é possível excluir: ${inUse} lançamento(s) usam esta subcategoria.`,
          };
        }
        const next: CategoryMapping = {
          ...catalog,
          [category]: current.filter((sub) => sub !== name),
        };
        set({ categoryCatalog: next });
        syncCatalog(next, (message) => set({ error: message }));
        return { ok: true };
      },

      resetCategoryCatalog: () => {
        const next = DEFAULT_CATEGORIES as CategoryMapping;
        set({ categoryCatalog: next });
        syncCatalog(next, (message) => set({ error: message }));
      },

      setLoading: (loading) => set({ loading }),
      setError: (error) => set({ error }),
      clearError: () => set({ error: null }),
      reset: () => set(initialState),
    }),
    {
      name: "financial-dashboard-storage",
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        budgetPreferences: state.budgetPreferences,
        categoryCatalog: state.categoryCatalog,
        // Quando o Firebase está configurado, ele é a fonte da verdade;
        // localStorage guarda transações apenas em modo 100% local/offline.
        transactions: isFirebaseConfigured() ? [] : state.transactions,
      }),
      // JSON.stringify converte Date em string; ao reidratar do localStorage
      // precisamos converter essas strings de volta para objetos Date.
      onRehydrateStorage: () => (state) => {
        if (state?.transactions?.length) {
          state.transactions = state.transactions.map((t) => ({
            ...t,
            date: t.date instanceof Date ? t.date : new Date(t.date as unknown as string),
          }));
        }
      },
    }
  )
);

// Transactions
export const useTransactions = () => useFinancialStore((state) => state.transactions);
export const useSetTransactions = () => useFinancialStore((state) => state.setTransactions);
export const useAddTransaction = () => useFinancialStore((state) => state.addTransaction);
export const useUpdateTransaction = () => useFinancialStore((state) => state.updateTransaction);
export const useRemoveTransaction = () => useFinancialStore((state) => state.removeTransaction);
export const useLoadFromFirebase = () => useFinancialStore((state) => state.loadFromFirebase);

// Baselines & Histórico
export const useBaselines = () => useFinancialStore((state) => state.baselines);
export const useCreateBaseline = () => useFinancialStore((state) => state.createBaseline);
export const useLoadBaselines = () => useFinancialStore((state) => state.loadBaselines);
export const useHistory = () => useFinancialStore((state) => state.history);
export const useLoadHistory = () => useFinancialStore((state) => state.loadHistory);
export const useFirebaseEnabled = () => useFinancialStore((state) => state.firebaseEnabled);
export const useSyncing = () => useFinancialStore((state) => state.syncing);

// Date Range
export const useDateRange = () => useFinancialStore((state) => state.dateRange);
export const useUpdateDateRange = () => useFinancialStore((state) => state.updateDateRange);

// Budget Preferences
export const useBudgetPreferences = () => useFinancialStore((state) => state.budgetPreferences);
export const useUpdateBudgetAllocation = () =>
  useFinancialStore((state) => state.updateBudgetAllocation);
export const useUpdateCustomCategories = () =>
  useFinancialStore((state) => state.updateCustomCategories);

// Categorias e subcategorias
export const useCategoryCatalog = () => useFinancialStore((state) => state.categoryCatalog);
export const useLoadCategoryCatalog = () => useFinancialStore((state) => state.loadCategoryCatalog);
export const useAddCategory = () => useFinancialStore((state) => state.addCategory);
export const useRenameCategory = () => useFinancialStore((state) => state.renameCategory);
export const useRemoveCategory = () => useFinancialStore((state) => state.removeCategory);
export const useAddSubcategory = () => useFinancialStore((state) => state.addSubcategory);
export const useRenameSubcategory = () => useFinancialStore((state) => state.renameSubcategory);
export const useRemoveSubcategory = () => useFinancialStore((state) => state.removeSubcategory);
export const useResetCategoryCatalog = () =>
  useFinancialStore((state) => state.resetCategoryCatalog);

// Loading & Error
export const useLoading = () => useFinancialStore((state) => state.loading);
export const useSetLoading = () => useFinancialStore((state) => state.setLoading);
export const useError = () => useFinancialStore((state) => state.error);
export const useSetError = () => useFinancialStore((state) => state.setError);
export const useClearError = () => useFinancialStore((state) => state.clearError);
