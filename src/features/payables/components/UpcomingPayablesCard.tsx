import { AlertTriangle, CalendarClock, CheckCircle2 } from "lucide-react";
import { useMemo } from "react";
import { formatCurrency } from "../../../lib/formatters";
import { usePayables } from "../../../store/payablesStore";
import {
  DUE_SOON_DAYS,
  daysUntilDue,
  formatISODateBR,
  getDerivedStatus,
  sumAmounts,
} from "../utils";

interface UpcomingPayablesCardProps {
  /** Leva o usuário para a aba de contas */
  onOpenPayables?: () => void;
}

/**
 * Lembrete de vencimentos na tela inicial: mostra o que já venceu e o que
 * vence nos próximos dias, para o usuário não precisar abrir a aba.
 */
export const UpcomingPayablesCard = ({ onOpenPayables }: UpcomingPayablesCardProps) => {
  const payables = usePayables();

  const { vencidos, aVencer } = useMemo(() => {
    const abertos = payables.filter((p) => p.status === "open");
    return {
      vencidos: abertos
        .filter((p) => getDerivedStatus(p) === "overdue")
        .sort((a, b) => a.dueDate.localeCompare(b.dueDate)),
      aVencer: abertos
        .filter((p) => getDerivedStatus(p) === "due-soon")
        .sort((a, b) => a.dueDate.localeCompare(b.dueDate)),
    };
  }, [payables]);

  const nadaPendente = vencidos.length === 0 && aVencer.length === 0;

  return (
    <div className="bg-gray-800/60 border border-gray-700/50 rounded-2xl p-5">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-bold text-white flex items-center gap-2">
          <CalendarClock size={18} className="text-teal-400" />
          Vencimentos
        </h3>
        {onOpenPayables && (
          <button
            type="button"
            onClick={onOpenPayables}
            className="text-sm text-teal-300 hover:text-teal-200 font-semibold"
          >
            Ver todas
          </button>
        )}
      </div>

      {nadaPendente ? (
        <div className="flex items-center gap-2 text-sm text-gray-400 py-4">
          <CheckCircle2 size={16} className="text-emerald-400" />
          Nenhuma conta vencida ou vencendo nos próximos {DUE_SOON_DAYS} dias.
        </div>
      ) : (
        <div className="space-y-4">
          {vencidos.length > 0 && (
            <section>
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-bold uppercase tracking-wide text-red-300 flex items-center gap-1.5">
                  <AlertTriangle size={14} />
                  Vencidas ({vencidos.length})
                </span>
                <span className="text-sm font-bold text-red-300">
                  {formatCurrency(sumAmounts(vencidos))}
                </span>
              </div>
              <ul className="space-y-1.5">
                {vencidos.slice(0, 5).map((p) => (
                  <li
                    key={p.id}
                    className="flex items-center justify-between gap-3 text-sm bg-red-500/5 border border-red-500/20 rounded-lg px-3 py-2"
                  >
                    <span className="truncate text-gray-200">{p.description}</span>
                    <span className="flex-shrink-0 text-xs text-red-300">
                      {formatISODateBR(p.dueDate)} · {Math.abs(daysUntilDue(p.dueDate))} dia(s)
                    </span>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {aVencer.length > 0 && (
            <section>
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-bold uppercase tracking-wide text-amber-300">
                  Vencem em até {DUE_SOON_DAYS} dias ({aVencer.length})
                </span>
                <span className="text-sm font-bold text-amber-300">
                  {formatCurrency(sumAmounts(aVencer))}
                </span>
              </div>
              <ul className="space-y-1.5">
                {aVencer.slice(0, 5).map((p) => {
                  const dias = daysUntilDue(p.dueDate);
                  return (
                    <li
                      key={p.id}
                      className="flex items-center justify-between gap-3 text-sm bg-amber-500/5 border border-amber-500/20 rounded-lg px-3 py-2"
                    >
                      <span className="truncate text-gray-200">{p.description}</span>
                      <span className="flex-shrink-0 text-xs text-amber-300">
                        {dias === 0 ? "vence hoje" : `em ${dias} dia(s)`}
                      </span>
                    </li>
                  );
                })}
              </ul>
            </section>
          )}
        </div>
      )}
    </div>
  );
};
