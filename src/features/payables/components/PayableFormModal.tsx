import { AlertCircle, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useCategoryCatalog } from "../../../store/financialStore";
import type { PayableDraft } from "../../../store/payablesStore";
import { useCreatePayable, useUpdatePayable } from "../../../store/payablesStore";
import type { Payable, PayableDirection } from "../types";
import { parseISODate, todayISO } from "../utils";

interface PayableFormModalProps {
  open: boolean;
  onClose: () => void;
  /** Quando presente, o modal edita em vez de criar */
  payable?: Payable | null;
  defaultDirection?: PayableDirection;
}

const inputClass =
  "w-full rounded-lg bg-gray-900 border border-gray-700 px-3 py-2 text-sm text-white placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-teal-500";

export const PayableFormModal = ({
  open,
  onClose,
  payable = null,
  defaultDirection = "pay",
}: PayableFormModalProps) => {
  const catalog = useCategoryCatalog();
  const createPayable = useCreatePayable();
  const updatePayable = useUpdatePayable();

  const categoryNames = useMemo(
    () => Object.keys(catalog).sort((a, b) => a.localeCompare(b, "pt-BR")),
    [catalog]
  );

  const [direction, setDirection] = useState<PayableDirection>(defaultDirection);
  const [description, setDescription] = useState("");
  const [counterparty, setCounterparty] = useState("");
  const [category, setCategory] = useState("");
  const [subcategory, setSubcategory] = useState("");
  const [account, setAccount] = useState("");
  const [amount, setAmount] = useState("");
  const [dueDate, setDueDate] = useState(todayISO());
  const [recurring, setRecurring] = useState(false);
  const [note, setNote] = useState("");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const isEditing = !!payable;
  const subcategoryOptions = catalog[category] ?? [];

  useEffect(() => {
    if (!open) return;
    setErrorMsg(null);
    if (payable) {
      setDirection(payable.direction);
      setDescription(payable.description);
      setCounterparty(payable.counterparty ?? "");
      setCategory(payable.category);
      setSubcategory(payable.subcategory ?? "");
      setAccount(payable.account ?? "");
      setAmount(String(payable.amount).replace(".", ","));
      setDueDate(payable.dueDate);
      setRecurring(false);
      setNote(payable.note ?? "");
    } else {
      setDirection(defaultDirection);
      setDescription("");
      setCounterparty("");
      setCategory("");
      setSubcategory("");
      setAccount("");
      setAmount("");
      setDueDate(todayISO());
      setRecurring(false);
      setNote("");
    }
  }, [open, payable, defaultDirection]);

  if (!open) return null;

  const handleSubmit = async () => {
    setErrorMsg(null);
    const valor = Number.parseFloat(amount.replace(/\./g, "").replace(",", "."));
    if (!description.trim()) return setErrorMsg("Informe a descrição da conta.");
    if (Number.isNaN(valor) || valor <= 0) return setErrorMsg("Informe um valor maior que zero.");
    if (!category) return setErrorMsg("Selecione uma categoria.");
    if (!dueDate) return setErrorMsg("Informe a data de vencimento.");

    const draft: PayableDraft = {
      direction,
      description: description.trim(),
      counterparty: counterparty.trim() || undefined,
      category,
      subcategory: subcategory || undefined,
      account: account.trim() || undefined,
      amount: valor,
      dueDate,
      note: note.trim() || undefined,
      recurrence: recurring
        ? { frequency: "monthly", dayOfMonth: parseISODate(dueDate).getDate() }
        : undefined,
    };

    setSaving(true);
    try {
      const result = payable
        ? await updatePayable({ ...payable, ...draft, recurrence: payable.recurrence })
        : await createPayable(draft);
      if (!result.ok) {
        setErrorMsg(result.error ?? "Não foi possível salvar.");
        return;
      }
      onClose();
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70">
      <div className="w-full max-w-2xl max-h-[90vh] overflow-y-auto bg-gray-800 border border-gray-700 rounded-2xl p-6 shadow-2xl">
        <div className="flex items-start justify-between mb-5">
          <h2 className="text-xl font-bold text-white">
            {isEditing ? "Editar conta" : "Nova conta"}
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

        {errorMsg && (
          <div className="flex items-start gap-2 bg-red-500/10 border border-red-500/30 rounded-lg px-3 py-2 mb-4">
            <AlertCircle size={16} className="text-red-400 mt-0.5 flex-shrink-0" />
            <p className="text-sm text-red-300">{errorMsg}</p>
          </div>
        )}

        <div className="flex gap-2 mb-5">
          {(["pay", "receive"] as PayableDirection[]).map((option) => (
            <button
              key={option}
              type="button"
              onClick={() => setDirection(option)}
              className={`flex-1 py-2 rounded-lg text-sm font-semibold transition-colors ${
                direction === option
                  ? option === "pay"
                    ? "bg-red-600 text-white"
                    : "bg-emerald-600 text-white"
                  : "bg-gray-900 text-gray-400 hover:text-white"
              }`}
            >
              {option === "pay" ? "A pagar" : "A receber"}
            </button>
          ))}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="sm:col-span-2">
            <label className="block text-sm text-gray-300 mb-1" htmlFor="pf-description">
              Descrição
            </label>
            <input
              id="pf-description"
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Ex.: Aluguel do escritório"
              className={inputClass}
            />
          </div>

          <div>
            <label className="block text-sm text-gray-300 mb-1" htmlFor="pf-counterparty">
              {direction === "pay" ? "Fornecedor" : "Cliente"} (opcional)
            </label>
            <input
              id="pf-counterparty"
              type="text"
              value={counterparty}
              onChange={(e) => setCounterparty(e.target.value)}
              className={inputClass}
            />
          </div>

          <div>
            <label className="block text-sm text-gray-300 mb-1" htmlFor="pf-amount">
              Valor (R$)
            </label>
            <input
              id="pf-amount"
              type="text"
              inputMode="decimal"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="0,00"
              className={inputClass}
            />
          </div>

          <div>
            <label className="block text-sm text-gray-300 mb-1" htmlFor="pf-category">
              Categoria
            </label>
            <select
              id="pf-category"
              value={category}
              onChange={(e) => {
                setCategory(e.target.value);
                setSubcategory("");
              }}
              className={inputClass}
            >
              <option value="">Selecione uma categoria…</option>
              {categoryNames.map((cat) => (
                <option key={cat} value={cat}>
                  {cat}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm text-gray-300 mb-1" htmlFor="pf-subcategory">
              Subcategoria (opcional)
            </label>
            <select
              id="pf-subcategory"
              value={subcategory}
              onChange={(e) => setSubcategory(e.target.value)}
              disabled={!category || subcategoryOptions.length === 0}
              className={`${inputClass} disabled:opacity-50`}
            >
              <option value="">—</option>
              {subcategoryOptions.map((sub) => (
                <option key={sub} value={sub}>
                  {sub}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm text-gray-300 mb-1" htmlFor="pf-due">
              Vencimento
            </label>
            <input
              id="pf-due"
              type="date"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
              className={inputClass}
            />
          </div>

          <div>
            <label className="block text-sm text-gray-300 mb-1" htmlFor="pf-account">
              Banco/Conta prevista (opcional)
            </label>
            <input
              id="pf-account"
              type="text"
              value={account}
              onChange={(e) => setAccount(e.target.value)}
              className={inputClass}
            />
          </div>

          <div className="sm:col-span-2">
            <label className="block text-sm text-gray-300 mb-1" htmlFor="pf-note">
              Observação (opcional)
            </label>
            <input
              id="pf-note"
              type="text"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              className={inputClass}
            />
          </div>
        </div>

        {!isEditing && (
          <label className="flex items-start gap-3 mt-5 p-3 rounded-lg bg-gray-900/60 border border-gray-700 cursor-pointer">
            <input
              type="checkbox"
              checked={recurring}
              onChange={(e) => setRecurring(e.target.checked)}
              className="mt-1 h-4 w-4 accent-teal-500"
            />
            <span className="text-sm text-gray-300">
              <span className="font-semibold text-white">Conta recorrente (mensal)</span>
              <br />
              Cria os próximos 12 meses de uma vez, sempre no dia {parseISODate(dueDate).getDate()}.
              A série é renovada automaticamente, então não é preciso recadastrar.
            </span>
          </label>
        )}

        {isEditing && payable?.seriesId && (
          <p className="mt-5 text-xs text-amber-300">
            Esta conta faz parte de uma série recorrente. A alteração vale apenas para este mês.
          </p>
        )}

        <div className="flex justify-end gap-3 mt-6">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-lg text-gray-300 hover:text-white hover:bg-gray-700"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={saving}
            className="px-5 py-2 rounded-lg bg-teal-600 hover:bg-teal-500 text-white font-semibold disabled:opacity-50"
          >
            {saving ? "Salvando..." : "Salvar"}
          </button>
        </div>
      </div>
    </div>
  );
};
