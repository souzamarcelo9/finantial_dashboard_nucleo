/**
 * Camada Firestore das contas a pagar/receber (coleção `payables`).
 *
 * Mesma política das demais coleções: todo documento carrega `userId` e toda
 * consulta filtra por ele, com as regras de segurança reforçando no servidor.
 * Todas as funções são no-op seguro quando o Firebase não está configurado.
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
  writeBatch,
} from "firebase/firestore";
import type { Payable } from "../../features/payables/types";
import { db, getCurrentUserId, isFirebaseConfigured } from "./firebaseConfig";

const PAYABLES_COLLECTION = "payables";

const stripUndefined = <T extends Record<string, unknown>>(value: T): Record<string, unknown> =>
  Object.fromEntries(Object.entries(value).filter(([, fieldValue]) => fieldValue !== undefined));

const requireUserId = (): string => {
  const userId = getCurrentUserId();
  if (!userId) {
    throw new Error("Você precisa estar autenticado para acessar seus dados.");
  }
  return userId;
};

export const savePayable = async (payable: Payable): Promise<void> => {
  if (!isFirebaseConfigured() || !db) return;
  const userId = requireUserId();
  await setDoc(
    doc(db, PAYABLES_COLLECTION, String(payable.id)),
    stripUndefined({ ...payable, userId, updatedAt: serverTimestamp() })
  );
};

/**
 * Grava várias contas de uma vez (série recorrente).
 * Usa writeBatch para que a série inteira entre ou nenhuma entre — meia série
 * no banco seria pior que erro nenhum.
 */
export const savePayablesBulk = async (payables: Payable[]): Promise<void> => {
  if (!isFirebaseConfigured() || !db || payables.length === 0) return;
  const userId = requireUserId();
  // TS perde o narrowing de `db` dentro dos callbacks abaixo.
  const database = db;
  // O Firestore limita um batch a 500 operações.
  const chunks: Payable[][] = [];
  for (let i = 0; i < payables.length; i += 400) {
    chunks.push(payables.slice(i, i + 400));
  }
  for (const chunk of chunks) {
    const batch = writeBatch(database);
    chunk.forEach((payable) => {
      batch.set(
        doc(database, PAYABLES_COLLECTION, String(payable.id)),
        stripUndefined({ ...payable, userId, updatedAt: serverTimestamp() })
      );
    });
    await batch.commit();
  }
};

export const deletePayable = async (id: string): Promise<void> => {
  if (!isFirebaseConfigured() || !db) return;
  requireUserId();
  await deleteDoc(doc(db, PAYABLES_COLLECTION, String(id)));
};

export const deletePayablesBulk = async (ids: string[]): Promise<void> => {
  if (!isFirebaseConfigured() || !db || ids.length === 0) return;
  requireUserId();
  const database = db;
  const batch = writeBatch(database);
  ids.forEach((id) => {
    batch.delete(doc(database, PAYABLES_COLLECTION, String(id)));
  });
  await batch.commit();
};

export const fetchPayables = async (): Promise<Payable[]> => {
  if (!isFirebaseConfigured() || !db) return [];
  const userId = getCurrentUserId();
  if (!userId) return [];
  const q = query(
    collection(db, PAYABLES_COLLECTION),
    where("userId", "==", userId),
    orderBy("dueDate", "asc")
  );
  const snap = await getDocs(q);
  return snap.docs.map((d) => d.data() as Payable);
};
