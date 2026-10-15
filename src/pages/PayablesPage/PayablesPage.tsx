import { ArrowDownCircle, ArrowUpCircle, Link2, Plus } from "lucide-react";
import { useMemo, useState } from "react";
import {
  PayableFormModal,
  PayablesCalendar,
  PayablesTable,
  PaymentModal,
  ReconcilePayablesModal,
  UpcomingPayablesCard,
} from "../../features/payables";
import type { Payable, PayableDirection } from "../../features/payables/types";
import { getDerivedStatus, sumAmounts } from "../../features/payables/utils";
import { formatCurrency } from "../../lib/formatters";
import { usePayables } from "../../store/payablesStore";

interface ResumoCardProps {
  titulo: string;
  valor: number;
  quantidade: number;
  tom: "red" | "emerald" | "amber";
}

const TONS: Record<ResumoCardProps["tom"], string> = {
  red: "border-red-500/30 text-red-300",
  emerald: "border-emerald-500/30 text-emerald-300",
  amber: "border-amber-500/30 text-amber-300",
};

const ResumoCard = ({ titulo, valor, quantidade, tom }: ResumoCardProps) => (
  <div className={`bg-gray-800/60 border rounded-2xl p-4 ${TONS[tom]}`}>
    <p className="text-xs uppercase tracking-wide text-gray-400">{titulo}</p>
    <p className="text-2xl font-extrabold mt-1">{formatCurrency(valor)}</p>
    <p className="text-xs text-gray-500 mt-0.5">{quantidade} conta(s)</p>
  </div>
);

export const PayablesPage = () => {
  const payables = usePayables();
  const [formOpen, setFormOpen] = useState(false);
  const [formDirection, setFormDirection] = useState<PayableDirection>("pay");
  const [editing, setEditing] = useState<Payable | null>(null);
  const [paying, setPaying] = useState<Payable | null>(null);
  const [reconciling, setReconciling] = useState(false);

  const resumo = useMemo(() => {
    const abertos = payables.filter((p) => p.status === "open");
    const vencidos = abertos.filter((p) => getDerivedStatus(p) === "overdue");
    const aPagar = abertos.filter((p) => p.direction === "pay");
    const aReceber = abertos.filter((p) => p.direction === "receive");
    return { vencidos, aPagar, aReceber };
  }, [payables]);

  const abrirNovo = (direction: PayableDirection) => {
    setEditing(null);
    setFormDirection(direction);
    setFormOpen(true);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-white">Contas a Pagar e a Receber</h2>
          <p className="text-sm text-gray-400 mt-1">
            Previsões de caixa. Ao dar baixa, o lançamento é criado automaticamente.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setReconciling(true)}
            title="Procurar nos lançamentos contas que já foram pagas"
            className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-gray-700 hover:bg-gray-600 text-white text-sm font-semibold transition-colors"
          >
            <Link2 size={16} />
            Conciliar importação
          </button>
          <button
            type="button"
            onClick={() => abrirNovo("pay")}
            className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-red-600 hover:bg-red-500 text-white text-sm font-semibold transition-colors"
          >
            <ArrowUpCircle size={16} />
            Nova conta a pagar
          </button>
          <button
            type="button"
            onClick={() => abrirNovo("receive")}
            className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-semibold transition-colors"
          >
            <ArrowDownCircle size={16} />
            Nova conta a receber
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <ResumoCard
          titulo="Vencidas"
          valor={sumAmounts(resumo.vencidos)}
          quantidade={resumo.vencidos.length}
          tom="red"
        />
        <ResumoCard
          titulo="A pagar (em aberto)"
          valor={sumAmounts(resumo.aPagar)}
          quantidade={resumo.aPagar.length}
          tom="amber"
        />
        <ResumoCard
          titulo="A receber (em aberto)"
          valor={sumAmounts(resumo.aReceber)}
          quantidade={resumo.aReceber.length}
          tom="emerald"
        />
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        <div className="xl:col-span-2">
          <PayablesTable
            payables={payables}
            onEdit={(payable) => {
              setEditing(payable);
              setFormOpen(true);
            }}
            onPay={setPaying}
          />
        </div>
        <div className="space-y-6">
          <PayablesCalendar payables={payables} />
          <UpcomingPayablesCard />
        </div>
      </div>

      {payables.length === 0 && (
        <div className="text-center py-10 bg-gray-800/40 border border-gray-700/40 rounded-2xl">
          <Plus size={28} className="mx-auto text-gray-600 mb-2" />
          <p className="text-gray-400 text-sm">
            Nenhuma conta cadastrada ainda. Comece criando uma conta a pagar ou a receber.
          </p>
        </div>
      )}

      <PayableFormModal
        open={formOpen}
        onClose={() => {
          setFormOpen(false);
          setEditing(null);
        }}
        payable={editing}
        defaultDirection={formDirection}
      />
      <PaymentModal payable={paying} onClose={() => setPaying(null)} />
      <ReconcilePayablesModal open={reconciling} onClose={() => setReconciling(false)} />
    </div>
  );
};

export default PayablesPage;
