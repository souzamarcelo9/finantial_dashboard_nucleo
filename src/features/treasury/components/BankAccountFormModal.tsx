import { AlertCircle, X } from "lucide-react";
import { useEffect, useState } from "react";
import type { BankAccountDraft } from "../../../store/treasuryStore";
import { useCreateBankAccount, useUpdateBankAccount } from "../../../store/treasuryStore";
import { todayISO } from "../../payables/utils";
import { BANK_ACCOUNT_TYPE_LABEL, type BankAccount, type BankAccountType } from "../types";

interface BankAccountFormModalProps {
  open: boolean;
  onClose: () => void;
  account?: BankAccount | null;
}

const inputClass =
  "w-full rounded-lg bg-gray-900 border border-gray-700 px-3 py-2 text-sm text-white placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-teal-500";

export const BankAccountFormModal = ({
  open,
  onClose,
  account = null,
}: BankAccountFormModalProps) => {
  const createAccount = useCreateBankAccount();
  const updateAccount = useUpdateBankAccount();

  const [name, setName] = useState("");
  const [bank, setBank] = useState("");
  const [type, setType] = useState<BankAccountType>("checking");
  const [branch, setBranch] = useState("");
  const [number, setNumber] = useState("");
  const [openingBalance, setOpeningBalance] = useState("");
  const [openingDate, setOpeningDate] = useState(todayISO());
  const [active, setActive] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setErrorMsg(null);
    if (account) {
      setName(account.name);
      setBank(account.bank ?? "");
      setType(account.type);
      setBranch(account.branch ?? "");
      setNumber(account.number ?? "");
      setOpeningBalance(account.openingBalance.toFixed(2).replace(".", ","));
      setOpeningDate(account.openingDate);
      setActive(account.active);
    } else {
      setName("");
      setBank("");
      setType("checking");
      setBranch("");
      setNumber("");
      setOpeningBalance("0,00");
      setOpeningDate(todayISO());
      setActive(true);
    }
  }, [open, account]);

  if (!open) return null;

  const handleSubmit = async () => {
    setErrorMsg(null);
    const saldo = Number.parseFloat(openingBalance.replace(/\./g, "").replace(",", "."));
    if (!name.trim()) return setErrorMsg("Informe o nome da conta.");
    if (Number.isNaN(saldo)) return setErrorMsg("Informe um saldo inicial válido (pode ser 0).");
    if (!openingDate) return setErrorMsg("Informe a data do saldo inicial.");

    const draft: BankAccountDraft = {
      name: name.trim(),
      bank: bank.trim() || undefined,
      type,
      branch: branch.trim() || undefined,
      number: number.trim() || undefined,
      openingBalance: saldo,
      openingDate,
      active,
    };

    setSaving(true);
    try {
      const result = account
        ? await updateAccount({ ...account, ...draft })
        : await createAccount(draft);
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
            {account ? "Editar conta" : "Nova conta bancária"}
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

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="sm:col-span-2">
            <label className="block text-sm text-gray-300 mb-1" htmlFor="ba-name">
              Nome da conta
            </label>
            <input
              id="ba-name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ex.: Banco Domínio"
              className={inputClass}
            />
            <p className="text-xs text-gray-500 mt-1">
              Use exatamente o mesmo nome que aparece no campo Conta/Carteira dos lançamentos; é por
              ele que o saldo é calculado.
            </p>
          </div>

          <div>
            <label className="block text-sm text-gray-300 mb-1" htmlFor="ba-bank">
              Instituição (opcional)
            </label>
            <input
              id="ba-bank"
              type="text"
              value={bank}
              onChange={(e) => setBank(e.target.value)}
              className={inputClass}
            />
          </div>

          <div>
            <label className="block text-sm text-gray-300 mb-1" htmlFor="ba-type">
              Tipo
            </label>
            <select
              id="ba-type"
              value={type}
              onChange={(e) => setType(e.target.value as BankAccountType)}
              className={inputClass}
            >
              {(Object.keys(BANK_ACCOUNT_TYPE_LABEL) as BankAccountType[]).map((option) => (
                <option key={option} value={option}>
                  {BANK_ACCOUNT_TYPE_LABEL[option]}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm text-gray-300 mb-1" htmlFor="ba-branch">
              Agência (opcional)
            </label>
            <input
              id="ba-branch"
              type="text"
              value={branch}
              onChange={(e) => setBranch(e.target.value)}
              className={inputClass}
            />
          </div>

          <div>
            <label className="block text-sm text-gray-300 mb-1" htmlFor="ba-number">
              Conta (opcional)
            </label>
            <input
              id="ba-number"
              type="text"
              value={number}
              onChange={(e) => setNumber(e.target.value)}
              className={inputClass}
            />
          </div>

          <div>
            <label className="block text-sm text-gray-300 mb-1" htmlFor="ba-opening">
              Saldo inicial (R$)
            </label>
            <input
              id="ba-opening"
              type="text"
              inputMode="decimal"
              value={openingBalance}
              onChange={(e) => setOpeningBalance(e.target.value)}
              className={inputClass}
            />
          </div>

          <div>
            <label className="block text-sm text-gray-300 mb-1" htmlFor="ba-opening-date">
              Data do saldo inicial
            </label>
            <input
              id="ba-opening-date"
              type="date"
              value={openingDate}
              onChange={(e) => setOpeningDate(e.target.value)}
              className={inputClass}
            />
            <p className="text-xs text-gray-500 mt-1">
              Lançamentos anteriores a esta data são ignorados: o saldo inicial já os representa.
            </p>
          </div>
        </div>

        <label className="flex items-center gap-3 mt-5 text-sm text-gray-300">
          <input
            type="checkbox"
            checked={active}
            onChange={(e) => setActive(e.target.checked)}
            className="h-4 w-4 accent-teal-500"
          />
          Conta ativa
        </label>

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
