/**
 * Camada Firestore da tesouraria.
 *
 * Duas coleções: `bankAccounts` (cadastro) e `balanceAdjustments` (histórico
 * de ajustes). Os ajustes ficam em coleção própria, e não embutidos na conta,
 * porque são registro de auditoria: crescem indefinidamente e nunca são
 * reescritos.
 */
import {
  collection,
  deleteDoc,
  doc,
  getDocs,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  where,
} from "firebase/firestore";
import type { BalanceAdjustment, BankAccount } from "../../features/treasury/types";
import { db, getCurrentUserId, isFirebaseConfigured } from "./firebaseConfig";

const ACCOUNTS_COLLECTION = "bankAccounts";
const ADJUSTMENTS_COLLECTION = "balanceAdjustments";

const stripUndefined = <T extends Record<string, unknown>>(value: T): Record<string, unknown> =>
  Object.fromEntries(Object.entries(value).filter(([, fieldValue]) => fieldValue !== undefined));

const requireUserId = (): string => {
  const userId = getCurrentUserId();
  if (!userId) {
    throw new Error("Você precisa estar autenticado para acessar seus dados.");
  }
  return userId;
};

export const saveBankAccount = async (account: BankAccount): Promise<void> => {
  if (!isFirebaseConfigured() || !db) return;
  const userId = requireUserId();
  await setDoc(
    doc(db, ACCOUNTS_COLLECTION, String(account.id)),
    stripUndefined({ ...account, userId, updatedAt: serverTimestamp() })
  );
};

export const deleteBankAccount = async (id: string): Promise<void> => {
  if (!isFirebaseConfigured() || !db) return;
  requireUserId();
  await deleteDoc(doc(db, ACCOUNTS_COLLECTION, String(id)));
};

export const fetchBankAccounts = async (): Promise<BankAccount[]> => {
  if (!isFirebaseConfigured() || !db) return [];
  const userId = getCurrentUserId();
  if (!userId) return [];
  const snap = await getDocs(
    query(collection(db, ACCOUNTS_COLLECTION), where("userId", "==", userId))
  );
  return snap.docs.map((d) => d.data() as BankAccount);
};

export const saveBalanceAdjustment = async (adjustment: BalanceAdjustment): Promise<void> => {
  if (!isFirebaseConfigured() || !db) return;
  const userId = requireUserId();
  await setDoc(
    doc(db, ADJUSTMENTS_COLLECTION, String(adjustment.id)),
    stripUndefined({ ...adjustment, userId, createdAt: serverTimestamp() })
  );
};

export const deleteBalanceAdjustment = async (id: string): Promise<void> => {
  if (!isFirebaseConfigured() || !db) return;
  requireUserId();
  await deleteDoc(doc(db, ADJUSTMENTS_COLLECTION, String(id)));
};

export const fetchBalanceAdjustments = async (): Promise<BalanceAdjustment[]> => {
  if (!isFirebaseConfigured() || !db) return [];
  const userId = getCurrentUserId();
  if (!userId) return [];
  const snap = await getDocs(
    query(
      collection(db, ADJUSTMENTS_COLLECTION),
      where("userId", "==", userId),
      orderBy("date", "desc")
    )
  );
  return snap.docs.map((d) => d.data() as BalanceAdjustment);
};
