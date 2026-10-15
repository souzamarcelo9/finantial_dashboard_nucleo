import { ChevronLeft, ChevronRight } from "lucide-react";
import { useMemo, useState } from "react";
import { formatCurrency } from "../../../lib/formatters";
import type { Payable } from "../types";
import { formatISODateBR, getDerivedStatus, sumAmounts, todayISO, toISODate } from "../utils";

interface PayablesCalendarProps {
  payables: Payable[];
}

const WEEKDAYS = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
const MONTHS = [
  "Janeiro",
  "Fevereiro",
  "Março",
  "Abril",
  "Maio",
  "Junho",
  "Julho",
  "Agosto",
  "Setembro",
  "Outubro",
  "Novembro",
  "Dezembro",
];

export const PayablesCalendar = ({ payables }: PayablesCalendarProps) => {
  const hoje = todayISO();
  const [cursor, setCursor] = useState(() => {
    const now = new Date();
    return { year: now.getFullYear(), month: now.getMonth() };
  });
  const [selectedDay, setSelectedDay] = useState<string | null>(null);

  // Agrupa por dia uma única vez; o calendário só consulta o mapa.
  const porDia = useMemo(() => {
    const mapa = new Map<string, Payable[]>();
    payables.forEach((p) => {
      mapa.set(p.dueDate, [...(mapa.get(p.dueDate) ?? []), p]);
    });
    return mapa;
  }, [payables]);

  const dias = useMemo(() => {
    const primeiro = new Date(cursor.year, cursor.month, 1);
    const totalDias = new Date(cursor.year, cursor.month + 1, 0).getDate();
    const vazios = primeiro.getDay();
    const celulas: (string | null)[] = Array.from({ length: vazios }, () => null);
    for (let dia = 1; dia <= totalDias; dia++) {
      celulas.push(toISODate(cursor.year, cursor.month, dia));
    }
    return celulas;
  }, [cursor]);

  const navegar = (delta: number) => {
    setSelectedDay(null);
    setCursor((prev) => {
      const data = new Date(prev.year, prev.month + delta, 1);
      return { year: data.getFullYear(), month: data.getMonth() };
    });
  };

  const doDia = selectedDay ? (porDia.get(selectedDay) ?? []) : [];

  return (
    <div className="bg-gray-800/60 border border-gray-700/50 rounded-2xl p-5">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-bold text-white">
          {MONTHS[cursor.month]} de {cursor.year}
        </h3>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => navegar(-1)}
            className="p-2 rounded-lg bg-gray-700/70 hover:bg-gray-600 text-white"
            aria-label="Mês anterior"
          >
            <ChevronLeft size={16} />
          </button>
          <button
            type="button"
            onClick={() => navegar(1)}
            className="p-2 rounded-lg bg-gray-700/70 hover:bg-gray-600 text-white"
            aria-label="Próximo mês"
          >
            <ChevronRight size={16} />
          </button>
        </div>
      </div>

      <div className="grid grid-cols-7 gap-1 mb-1">
        {WEEKDAYS.map((dia) => (
          <div key={dia} className="text-center text-xs font-semibold text-gray-500 py-1">
            {dia}
          </div>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-1">
        {dias.map((iso, index) => {
          if (!iso) {
            // Células vazias antes do dia 1 não têm identidade própria
            return <div key={`vazio-${cursor.year}-${cursor.month}-${index}`} />;
          }
          const contas = porDia.get(iso) ?? [];
          const temVencido = contas.some((p) => getDerivedStatus(p) === "overdue");
          const temAberto = contas.some((p) => p.status === "open");
          const todasPagas = contas.length > 0 && !temAberto;
          const ehHoje = iso === hoje;

          return (
            <button
              key={iso}
              type="button"
              onClick={() => setSelectedDay(contas.length ? iso : null)}
              className={`aspect-square rounded-lg p-1 flex flex-col items-center justify-center text-sm transition-colors ${
                selectedDay === iso ? "ring-2 ring-teal-400" : ""
              } ${ehHoje ? "bg-blue-500/15 text-white font-bold" : "text-gray-300"} ${
                contas.length ? "hover:bg-gray-700/60 cursor-pointer" : "cursor-default"
              }`}
            >
              <span>{Number(iso.slice(8, 10))}</span>
              {contas.length > 0 && (
                <span
                  className={`mt-0.5 h-1.5 w-1.5 rounded-full ${
                    temVencido ? "bg-red-400" : todasPagas ? "bg-emerald-400" : "bg-amber-400"
                  }`}
                />
              )}
            </button>
          );
        })}
      </div>

      {selectedDay && doDia.length > 0 && (
        <div className="mt-4 pt-4 border-t border-gray-700/60">
          <p className="text-sm font-semibold text-white mb-2">
            {formatISODateBR(selectedDay)} · {formatCurrency(sumAmounts(doDia))}
          </p>
          <ul className="space-y-1.5 max-h-48 overflow-y-auto">
            {doDia.map((p) => (
              <li key={p.id} className="flex items-center justify-between gap-3 text-sm">
                <span className="truncate text-gray-300">{p.description}</span>
                <span
                  className={`flex-shrink-0 font-semibold ${
                    p.direction === "pay" ? "text-red-300" : "text-emerald-300"
                  }`}
                >
                  {p.direction === "pay" ? "-" : "+"}
                  {formatCurrency(p.amount)}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="flex flex-wrap items-center gap-4 mt-4 pt-3 border-t border-gray-700/60 text-xs text-gray-400">
        <span className="flex items-center gap-1.5">
          <span className="h-1.5 w-1.5 rounded-full bg-red-400" /> Vencido
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-1.5 w-1.5 rounded-full bg-amber-400" /> Em aberto
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" /> Pago
        </span>
      </div>
    </div>
  );
};
