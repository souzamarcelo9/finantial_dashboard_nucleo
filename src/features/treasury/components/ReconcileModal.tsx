import { AlertCircle, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { formatCurrency } from "../../../lib/formatters";
import { useAddBalanceAdjustment } from "../../../store/treasuryStore";
import { todayISO } from "../../payables/utils";
import type { AccountBalance } from "../types";

interface ReconcileModalProps {
  balance: AccountBalance | null;
  onClose: () => void;
}

const inputClass =
  "w-full rounded-lg bg-gray-900 border border-gray-700 px-3 py-2 text-sm text-white placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-teal-500";

/**
 * Conciliação: a cliente informa o saldo do extrato e o sistema registra a
 * DIFERENÇA como ajuste. Ela nunca sobrescreve o saldo — é a diferença que
 * fica gravada, com data e motivo, podendo ser auditada depois.
 */
export const ReconcileModal = ({ balance, onClose }: ReconcileModalProps) => {
  const addAdjustment = useAddBalanceAdjustment();

  const [statementBalance, setStatementBalance] = useState("");
  const [date, setDate] = useState(todayISO());
  const [reason, setReason] = useState("");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!balance) return;
    setStatementBalance(balance.currentBalance.toFixed(2).replace(".", ","));
    setDate(todayISO());
    setReason("");
    setErrorMsg(null);
  }, [balance]);

  const diferenca = useMemo(() => {
    if (!balance) return 0;
    const informado = Number.parseFloat(statementBalance.replace(/\./g, "").replace(",", "."));
    if (Number.isNaN(informado)) return 0;
    return informado - balance.currentBalance;
  }, [statementBalance, balance]);

  if (!balance) return null;

  const handleConfirm = async () => {
    setErrorMsg(null);
    const informado = Number.parseFloat(statementBalance.replace(/\./g, "").replace(",", "."));
    if (Number.isNaN(informado)) return setErrorMsg("Informe o saldo do extrato.");
    if (!reason.trim()) return setErrorMsg("Descreva o motivo do ajuste.");

    setSaving(true);
    try {
      const result = await addAdjustment({
        accountId: balance.account.id,
        date,
        amount: diferenca,
        previousBalance: balance.currentBalance,
        reason,
        origin: "conciliation",
      });
      if (!result.ok) {
        setErrorMsg(result.error ?? "Não foi possível registrar o ajuste.");
        return;
      }
      onClose();
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70">
      <div className="w-full max-w-md bg-gray-800 border border-gray-700 rounded-2xl p-6 shadow-2xl">
        <div className="flex items-start justify-between mb-4">
          <h2 className="text-xl font-bold text-white">Conciliar saldo</h2>
          <button
            type="button"
            onClick={onClose}
            className="text-gray-400 hover:text-white"
            aria-label="Fechar"
          >
            <X size={20} />
          </button>
        </div>

        <div className="rounded-lg bg-gray-900/60 border border-gray-700 p-3 mb-4">
          <p className="text-white font-semibold">{balance.account.name}</p>
          <p className="text-sm text-gray-400 mt-0.5">
            Saldo calculado pelo sistema:{" "}
            <span className="font-bold text-gray-200">
              {formatCurrency(balance.currentBalance)}
            </span>
          </p>
        </div>

        {errorMsg && (
          <div className="flex items-start gap-2 bg-red-500/10 border border-red-500/30 rounded-lg px-3 py-2 mb-4">
            <AlertCircle size={16} className="text-red-400 mt-0.5 flex-shrink-0" />
            <p className="text-sm text-red-300">{errorMsg}</p>
          </div>
        )}

        <div className="space-y-4">
          <div>
            <label className="block text-sm text-gray-300 mb-1" htmlFor="rc-balance">
              Saldo real do extrato (R$)
            </label>
            <input
              id="rc-balance"
              type="text"
              inputMode="decimal"
              value={statementBalance}
              onChange={(e) => setStatementBalance(e.target.value)}
              className={inputClass}
            />
          </div>

          <div
            className={`rounded-lg px-3 py-2 border text-sm ${
              Math.abs(diferenca) < 0.005
                ? "bg-gray-700/30 border-gray-600/40 text-gray-400"
                : diferenca > 0
                  ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-300"
                  : "bg-red-500/10 border-red-500/30 text-red-300"
            }`}
          >
            Ajuste a registrar:{" "}
            <span className="font-bold">
              {diferenca > 0 ? "+" : ""}
              {formatCurrency(diferenca)}
            </span>
            {Math.abs(diferenca) < 0.005 && " — saldos já conferem, nada a lançar."}
          </div>

          <div>
            <label className="block text-sm text-gray-300 mb-1" htmlFor="rc-date">
              Data do ajuste
            </label>
            <input
              id="rc-date"
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className={inputClass}
            />
          </div>

          <div>
            <label className="block text-sm text-gray-300 mb-1" htmlFor="rc-reason">
              Motivo
            </label>
            <input
              id="rc-reason"
              type="text"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Ex.: tarifas bancárias não lançadas"
              className={inputClass}
            />
            <p className="text-xs text-gray-500 mt-1">
              Fica no histórico da conta. É o que permite entender depois por que o saldo mudou.
            </p>
          </div>
        </div>

        <div className="flex justify-end gap-3 mt-5">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-lg text-gray-300 hover:text-white hover:bg-gray-700"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            disabled={saving || Math.abs(diferenca) < 0.005}
            className="px-5 py-2 rounded-lg bg-teal-600 hover:bg-teal-500 text-white font-semibold disabled:opacity-50"
          >
            {saving ? "Registrando..." : "Registrar ajuste"}
          </button>
        </div>
      </div>
    </div>
  );
};
