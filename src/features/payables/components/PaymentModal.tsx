import { AlertCircle, X } from "lucide-react";
import { useEffect, useState } from "react";
import { formatCurrency } from "../../../lib/formatters";
import { useMarkPayableAsPaid } from "../../../store/payablesStore";
import { AccountInput } from "../../treasury/components/AccountInput";
import type { Payable } from "../types";
import { formatISODateBR, todayISO } from "../utils";

interface PaymentModalProps {
  payable: Payable | null;
  onClose: () => void;
}

const inputClass =
  "w-full rounded-lg bg-gray-900 border border-gray-700 px-3 py-2 text-sm text-white placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-emerald-500";

export const PaymentModal = ({ payable, onClose }: PaymentModalProps) => {
  const markAsPaid = useMarkPayableAsPaid();

  const [paidAt, setPaidAt] = useState(todayISO());
  const [paidAmount, setPaidAmount] = useState("");
  const [account, setAccount] = useState("");
  const [note, setNote] = useState("");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!payable) return;
    setPaidAt(todayISO());
    setPaidAmount(payable.amount.toFixed(2).replace(".", ","));
    setAccount(payable.account ?? "");
    setNote("");
    setErrorMsg(null);
  }, [payable]);

  if (!payable) return null;

  const isPayment = payable.direction === "pay";

  const handleConfirm = async () => {
    setErrorMsg(null);
    const valor = Number.parseFloat(paidAmount.replace(/\./g, "").replace(",", "."));
    if (Number.isNaN(valor) || valor <= 0) return setErrorMsg("Informe o valor.");
    if (!account.trim()) return setErrorMsg("Informe o banco/conta.");

    setSaving(true);
    try {
      const result = await markAsPaid(payable.id, {
        paidAt,
        paidAmount: valor,
        account,
        note: note || payable.description,
      });
      if (!result.ok) {
        setErrorMsg(result.error ?? "Não foi possível dar baixa.");
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
          <h2 className="text-xl font-bold text-white">
            {isPayment ? "Registrar pagamento" : "Registrar recebimento"}
          </h2>
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
          <p className="text-white font-semibold">{payable.description}</p>
          <p className="text-sm text-gray-400 mt-0.5">
            Vencimento {formatISODateBR(payable.dueDate)} · {formatCurrency(payable.amount)}
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
            <label className="block text-sm text-gray-300 mb-1" htmlFor="pm-date">
              Data {isPayment ? "do pagamento" : "do recebimento"}
            </label>
            <input
              id="pm-date"
              type="date"
              value={paidAt}
              onChange={(e) => setPaidAt(e.target.value)}
              className={inputClass}
            />
          </div>

          <div>
            <label className="block text-sm text-gray-300 mb-1" htmlFor="pm-amount">
              Valor {isPayment ? "pago" : "recebido"} (R$)
            </label>
            <input
              id="pm-amount"
              type="text"
              inputMode="decimal"
              value={paidAmount}
              onChange={(e) => setPaidAmount(e.target.value)}
              className={inputClass}
            />
            <p className="text-xs text-gray-500 mt-1">
              Pode ser diferente do previsto (juros, desconto); o lançamento usa o valor real.
            </p>
          </div>

          <div>
            <label className="block text-sm text-gray-300 mb-1" htmlFor="pm-account">
              Banco/Conta
            </label>
            <AccountInput
              id="pm-account"
              value={account}
              onChange={setAccount}
              placeholder="Ex.: Banco Domínio"
              className={inputClass}
            />
          </div>

          <div>
            <label className="block text-sm text-gray-300 mb-1" htmlFor="pm-note">
              Observação (opcional)
            </label>
            <input
              id="pm-note"
              type="text"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              className={inputClass}
            />
          </div>
        </div>

        <p className="text-xs text-gray-500 mt-4">
          A baixa cria automaticamente o lançamento de {isPayment ? "despesa" : "receita"} na tela
          de Lançamentos.
        </p>

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
            disabled={saving}
            className="px-5 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-semibold disabled:opacity-50"
          >
            {saving ? "Registrando..." : "Confirmar baixa"}
          </button>
        </div>
      </div>
    </div>
  );
};
