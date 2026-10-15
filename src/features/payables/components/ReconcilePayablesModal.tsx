import { Link2, Search, X } from "lucide-react";
import { useMemo, useState } from "react";
import { formatCurrency } from "../../../lib/formatters";
import { useTransactions } from "../../../store/financialStore";
import { useLinkPayableToTransaction, usePayables } from "../../../store/payablesStore";
import { transactionISODate } from "../../treasury/utils";
import type { Payable } from "../types";
import { formatISODateBR } from "../utils";

interface ReconcilePayablesModalProps {
  open: boolean;
  onClose: () => void;
}

interface Sugestao {
  payable: Payable;
  transactionId: string;
  transactionDate: string;
  transactionAmount: number;
  transactionAccount: string;
  diferencaDias: number;
}

/** Janela de tolerância, em dias, entre vencimento e data do lançamento */
const JANELA_DIAS = 7;
/** Tolerância de valor: 1% ou R$ 0,05, o que for maior */
const toleranciaValor = (valor: number) => Math.max(0.05, valor * 0.01);

const diffEmDias = (a: string, b: string): number => {
  const [ay, am, ad] = a.split("-").map(Number);
  const [by, bm, bd] = b.split("-").map(Number);
  const dataA = new Date(ay, (am ?? 1) - 1, ad ?? 1).getTime();
  const dataB = new Date(by, (bm ?? 1) - 1, bd ?? 1).getTime();
  return Math.round((dataA - dataB) / 86_400_000);
};

/**
 * Conciliação pós-importação.
 *
 * Depois de importar o extrato, as contas em aberto que já foram pagas
 * continuam abertas e o lançamento correspondente já está no caixa. Baixar na
 * mão criaria um lançamento DUPLICADO — por isso aqui a baixa apenas vincula
 * a conta ao lançamento que já existe, sem criar nada novo.
 */
export const ReconcilePayablesModal = ({ open, onClose }: ReconcilePayablesModalProps) => {
  const payables = usePayables();
  const transactions = useTransactions();
  const linkPayable = useLinkPayableToTransaction();

  const [selecionados, setSelecionados] = useState<Set<string>>(new Set());
  const [salvando, setSalvando] = useState(false);

  const sugestoes = useMemo<Sugestao[]>(() => {
    if (!open) return [];

    // Lançamentos já vinculados a alguma conta não podem ser reaproveitados.
    const jaVinculados = new Set(
      payables.map((p) => p.transactionId).filter((id): id is string => !!id)
    );

    const abertas = payables.filter((p) => p.status === "open");
    const usados = new Set<string>();
    const resultado: Sugestao[] = [];

    abertas.forEach((payable) => {
      const tiposValidos =
        payable.direction === "pay" ? ["Expense", "Transfer-Out"] : ["Income", "Transfer-In"];

      const candidatos = transactions
        .filter((t) => {
          const id = String(t.id);
          if (jaVinculados.has(id) || usados.has(id)) return false;
          if (!tiposValidos.includes(t.type)) return false;
          const valor = Math.abs(Number(t.amount) || 0);
          if (Math.abs(valor - payable.amount) > toleranciaValor(payable.amount)) return false;
          return Math.abs(diffEmDias(transactionISODate(t.date), payable.dueDate)) <= JANELA_DIAS;
        })
        .sort(
          (a, b) =>
            Math.abs(diffEmDias(transactionISODate(a.date), payable.dueDate)) -
            Math.abs(diffEmDias(transactionISODate(b.date), payable.dueDate))
        );

      const melhor = candidatos[0];
      if (!melhor) return;
      usados.add(String(melhor.id));
      resultado.push({
        payable,
        transactionId: String(melhor.id),
        transactionDate: transactionISODate(melhor.date),
        transactionAmount: Math.abs(Number(melhor.amount) || 0),
        transactionAccount: melhor.account ?? "",
        diferencaDias: diffEmDias(transactionISODate(melhor.date), payable.dueDate),
      });
    });

    return resultado;
  }, [open, payables, transactions]);

  if (!open) return null;

  const alternar = (id: string) => {
    setSelecionados((prev) => {
      const proximo = new Set(prev);
      if (proximo.has(id)) {
        proximo.delete(id);
      } else {
        proximo.add(id);
      }
      return proximo;
    });
  };

  const confirmar = async () => {
    setSalvando(true);
    try {
      for (const sugestao of sugestoes) {
        if (!selecionados.has(sugestao.payable.id)) continue;
        await linkPayable(sugestao.payable.id, {
          transactionId: sugestao.transactionId,
          paidAt: sugestao.transactionDate,
          paidAmount: sugestao.transactionAmount,
          account: sugestao.transactionAccount,
        });
      }
      setSelecionados(new Set());
      onClose();
    } finally {
      setSalvando(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70">
      <div className="w-full max-w-3xl max-h-[90vh] overflow-y-auto bg-gray-800 border border-gray-700 rounded-2xl p-6 shadow-2xl">
        <div className="flex items-start justify-between mb-4">
          <div>
            <h2 className="text-xl font-bold text-white">Conciliar com os lançamentos</h2>
            <p className="text-sm text-gray-400 mt-1">
              Contas em aberto que parecem já ter sido pagas, com base nos lançamentos importados. A
              baixa vincula o lançamento existente, sem duplicar.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-gray-400 hover:text-white"
            aria-label="Fechar"
          >
            <X size={20} />
          </button>
        </div>

        {sugestoes.length === 0 ? (
          <div className="text-center py-10">
            <Search size={26} className="mx-auto text-gray-600 mb-2" />
            <p className="text-sm text-gray-400">
              Nenhuma correspondência encontrada. São consideradas contas em aberto com lançamento
              de valor equivalente (até 1% de diferença) dentro de {JANELA_DIAS} dias do vencimento.
            </p>
          </div>
        ) : (
          <>
            <div className="flex items-center justify-between mb-3">
              <p className="text-sm text-gray-300">
                {sugestoes.length} correspondência(s) ·{" "}
                <span className="text-teal-300 font-semibold">{selecionados.size}</span>{" "}
                selecionada(s)
              </p>
              <button
                type="button"
                onClick={() =>
                  setSelecionados(
                    selecionados.size === sugestoes.length
                      ? new Set()
                      : new Set(sugestoes.map((s) => s.payable.id))
                  )
                }
                className="text-sm text-teal-300 hover:text-teal-200 font-semibold"
              >
                {selecionados.size === sugestoes.length ? "Limpar seleção" : "Selecionar todas"}
              </button>
            </div>

            <ul className="space-y-2">
              {sugestoes.map((sugestao) => (
                <li key={sugestao.payable.id}>
                  <label className="flex items-start gap-3 p-3 rounded-xl bg-gray-900/60 border border-gray-700 hover:border-teal-500/50 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={selecionados.has(sugestao.payable.id)}
                      onChange={() => alternar(sugestao.payable.id)}
                      className="mt-1 h-4 w-4 accent-teal-500"
                    />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold text-white truncate">
                        {sugestao.payable.description}
                      </p>
                      <p className="text-xs text-gray-400 mt-0.5">
                        Vence {formatISODateBR(sugestao.payable.dueDate)} ·{" "}
                        {formatCurrency(sugestao.payable.amount)}
                      </p>
                      <p className="text-xs text-teal-300 mt-1 flex items-center gap-1.5">
                        <Link2 size={12} />
                        Lançamento de {formatISODateBR(sugestao.transactionDate)} ·{" "}
                        {formatCurrency(sugestao.transactionAmount)}
                        {sugestao.transactionAccount ? ` · ${sugestao.transactionAccount}` : ""}
                        {sugestao.diferencaDias !== 0 &&
                          ` (${sugestao.diferencaDias > 0 ? "+" : ""}${sugestao.diferencaDias}d)`}
                      </p>
                    </div>
                  </label>
                </li>
              ))}
            </ul>
          </>
        )}

        <div className="flex justify-end gap-3 mt-6">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-lg text-gray-300 hover:text-white hover:bg-gray-700"
          >
            Fechar
          </button>
          <button
            type="button"
            onClick={confirmar}
            disabled={salvando || selecionados.size === 0}
            className="px-5 py-2 rounded-lg bg-teal-600 hover:bg-teal-500 text-white font-semibold disabled:opacity-50"
          >
            {salvando ? "Baixando..." : `Dar baixa (${selecionados.size})`}
          </button>
        </div>
      </div>
    </div>
  );
};
