import { AlertTriangle, Landmark, Pencil, Plus, Scale, Trash2 } from "lucide-react";
import { useMemo, useState } from "react";
import { BankAccountFormModal } from "../../features/treasury/components/BankAccountFormModal";
import { ReconcileModal } from "../../features/treasury/components/ReconcileModal";
import {
  type AccountBalance,
  BANK_ACCOUNT_TYPE_LABEL,
  type BankAccount,
} from "../../features/treasury/types";
import { calculateAllBalances, findUnlinkedAccountNames } from "../../features/treasury/utils";
import { formatCurrency } from "../../lib/formatters";
import { useTransactions } from "../../store/financialStore";
import {
  useBalanceAdjustments,
  useBankAccounts,
  useRemoveBankAccount,
  useTreasuryStore,
} from "../../store/treasuryStore";

const formatISODateBR = (iso: string): string => {
  if (!iso) return "-";
  const [year, month, day] = iso.split("-");
  return `${day}/${month}/${year}`;
};

export const TreasuryPage = () => {
  const accounts = useBankAccounts();
  const adjustments = useBalanceAdjustments();
  const transactions = useTransactions();
  const removeAccount = useRemoveBankAccount();
  const removeAdjustment = useTreasuryStore((state) => state.removeAdjustment);

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<BankAccount | null>(null);
  const [reconciling, setReconciling] = useState<AccountBalance | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);

  const balances = useMemo(
    () => calculateAllBalances(accounts, transactions, adjustments),
    [accounts, transactions, adjustments]
  );

  const totalGeral = balances
    .filter((b) => b.account.active)
    .reduce((total, b) => total + b.currentBalance, 0);

  const avulsas = useMemo(
    () => findUnlinkedAccountNames(accounts, transactions),
    [accounts, transactions]
  );

  const handleRemove = async (account: BankAccount) => {
    const result = await removeAccount(account.id);
    if (!result.ok) setFeedback(result.error ?? null);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-white">Tesouraria</h2>
          <p className="text-sm text-gray-400 mt-1">
            Saldo = saldo inicial + lançamentos + ajustes. Nenhum saldo é digitado direto.
          </p>
        </div>
        <button
          type="button"
          onClick={() => {
            setEditing(null);
            setFormOpen(true);
          }}
          className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-teal-600 hover:bg-teal-500 text-white text-sm font-semibold transition-colors"
        >
          <Plus size={16} />
          Nova conta
        </button>
      </div>

      {feedback && (
        <div className="flex items-start gap-2 bg-amber-500/10 border border-amber-500/30 rounded-lg px-3 py-2">
          <AlertTriangle size={16} className="text-amber-400 mt-0.5 flex-shrink-0" />
          <p className="text-sm text-amber-200 flex-1">{feedback}</p>
          <button
            type="button"
            onClick={() => setFeedback(null)}
            className="text-amber-300 text-sm font-semibold"
          >
            ok
          </button>
        </div>
      )}

      <div className="bg-gradient-to-r from-teal-600/20 to-emerald-600/10 border border-teal-500/30 rounded-2xl p-5">
        <p className="text-xs uppercase tracking-wide text-teal-200">Saldo total (contas ativas)</p>
        <p className="text-3xl font-extrabold text-white mt-1">{formatCurrency(totalGeral)}</p>
      </div>

      {accounts.length === 0 ? (
        <div className="text-center py-12 bg-gray-800/40 border border-gray-700/40 rounded-2xl">
          <Landmark size={28} className="mx-auto text-gray-600 mb-2" />
          <p className="text-gray-400 text-sm">
            Nenhuma conta cadastrada. Comece cadastrando os bancos da empresa com o saldo de
            abertura.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {balances.map((balance) => (
            <div
              key={balance.account.id}
              className={`bg-gray-800/60 border rounded-2xl p-5 ${
                balance.account.active ? "border-gray-700/50" : "border-gray-700/30 opacity-60"
              }`}
            >
              <div className="flex items-start justify-between gap-3 mb-3">
                <div className="min-w-0">
                  <h3 className="text-lg font-bold text-white truncate">{balance.account.name}</h3>
                  <p className="text-xs text-gray-500">
                    {BANK_ACCOUNT_TYPE_LABEL[balance.account.type]}
                    {balance.account.bank ? ` · ${balance.account.bank}` : ""}
                    {balance.account.active ? "" : " · inativa"}
                  </p>
                </div>
                <div className="flex items-center gap-1 flex-shrink-0">
                  <button
                    type="button"
                    onClick={() => {
                      setEditing(balance.account);
                      setFormOpen(true);
                    }}
                    className="p-1.5 rounded-md text-gray-400 hover:text-white hover:bg-gray-700"
                    aria-label={`Editar ${balance.account.name}`}
                  >
                    <Pencil size={14} />
                  </button>
                  <button
                    type="button"
                    onClick={() => handleRemove(balance.account)}
                    className="p-1.5 rounded-md text-gray-400 hover:text-red-300 hover:bg-gray-700"
                    aria-label={`Excluir ${balance.account.name}`}
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>

              <p
                className={`text-2xl font-extrabold ${
                  balance.currentBalance < 0 ? "text-red-300" : "text-emerald-300"
                }`}
              >
                {formatCurrency(balance.currentBalance)}
              </p>

              <dl className="mt-3 space-y-1 text-xs text-gray-400">
                <div className="flex justify-between">
                  <dt>Saldo inicial ({formatISODateBR(balance.account.openingDate)})</dt>
                  <dd className="text-gray-300">{formatCurrency(balance.openingBalance)}</dd>
                </div>
                <div className="flex justify-between">
                  <dt>Lançamentos ({balance.transactionsCount})</dt>
                  <dd className="text-gray-300">{formatCurrency(balance.transactionsTotal)}</dd>
                </div>
                <div className="flex justify-between">
                  <dt>Ajustes</dt>
                  <dd className="text-gray-300">{formatCurrency(balance.adjustmentsTotal)}</dd>
                </div>
              </dl>

              <button
                type="button"
                onClick={() => setReconciling(balance)}
                className="mt-4 w-full inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg bg-gray-700 hover:bg-gray-600 text-white text-sm font-semibold transition-colors"
              >
                <Scale size={15} />
                Conciliar saldo
              </button>
            </div>
          ))}
        </div>
      )}

      {avulsas.length > 0 && (
        <div className="bg-amber-500/5 border border-amber-500/20 rounded-2xl p-5">
          <h3 className="text-sm font-bold text-amber-200 flex items-center gap-2 mb-2">
            <AlertTriangle size={16} />
            Contas usadas em lançamentos mas não cadastradas
          </h3>
          <p className="text-xs text-gray-400 mb-3">
            Esses valores ficam fora do saldo da tesouraria. Normalmente é diferença de digitação no
            nome — cadastre a conta com o mesmo nome ou corrija os lançamentos.
          </p>
          <ul className="flex flex-wrap gap-2">
            {avulsas.map((item) => (
              <li
                key={item.name}
                className="px-3 py-1.5 rounded-full bg-gray-800 border border-gray-700 text-xs text-gray-300"
              >
                {item.name} · {item.count} lanç.
              </li>
            ))}
          </ul>
        </div>
      )}

      {adjustments.length > 0 && (
        <div className="bg-gray-800/60 border border-gray-700/50 rounded-2xl overflow-hidden">
          <h3 className="text-lg font-bold text-white p-5 pb-3">Histórico de ajustes</h3>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px]">
              <thead className="bg-gray-900/70">
                <tr className="text-left text-xs uppercase tracking-wide text-gray-400">
                  <th className="p-3">Data</th>
                  <th className="p-3">Conta</th>
                  <th className="p-3">Motivo</th>
                  <th className="p-3">Origem</th>
                  <th className="p-3 text-right">De</th>
                  <th className="p-3 text-right">Ajuste</th>
                  <th className="p-3 text-right">Para</th>
                  <th className="p-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-700/50">
                {adjustments.map((adjustment) => {
                  const conta = accounts.find((a) => a.id === adjustment.accountId);
                  return (
                    <tr key={adjustment.id} className="hover:bg-gray-700/30">
                      <td className="p-3 text-sm text-gray-200 whitespace-nowrap">
                        {formatISODateBR(adjustment.date)}
                      </td>
                      <td className="p-3 text-sm text-gray-200">{conta?.name ?? "—"}</td>
                      <td className="p-3 text-sm text-gray-300">{adjustment.reason}</td>
                      <td className="p-3 text-xs text-gray-500">
                        {adjustment.origin === "conciliation" ? "Conciliação" : "Manual"}
                      </td>
                      <td className="p-3 text-sm text-right text-gray-400 whitespace-nowrap">
                        {formatCurrency(adjustment.previousBalance)}
                      </td>
                      <td
                        className={`p-3 text-sm text-right font-bold whitespace-nowrap ${
                          adjustment.amount < 0 ? "text-red-300" : "text-emerald-300"
                        }`}
                      >
                        {adjustment.amount > 0 ? "+" : ""}
                        {formatCurrency(adjustment.amount)}
                      </td>
                      <td className="p-3 text-sm text-right text-gray-200 whitespace-nowrap">
                        {formatCurrency(adjustment.newBalance)}
                      </td>
                      <td className="p-3 text-right">
                        <button
                          type="button"
                          onClick={() => removeAdjustment(adjustment.id)}
                          className="p-1.5 rounded-md text-gray-500 hover:text-red-300 hover:bg-gray-700"
                          aria-label="Excluir ajuste"
                        >
                          <Trash2 size={14} />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <BankAccountFormModal
        open={formOpen}
        onClose={() => {
          setFormOpen(false);
          setEditing(null);
        }}
        account={editing}
      />
      <ReconcileModal balance={reconciling} onClose={() => setReconciling(null)} />
    </div>
  );
};

export default TreasuryPage;
