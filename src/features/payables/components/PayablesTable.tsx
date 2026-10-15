import {
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Pencil,
  Repeat,
  RotateCcw,
  Search,
  Trash2,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { formatCurrency } from "../../../lib/formatters";
import {
  useRemovePayable,
  useRemoveSeries,
  useUndoPayablePayment,
} from "../../../store/payablesStore";
import type { Payable, PayableDerivedStatus, PayableDirection } from "../types";
import {
  DERIVED_STATUS_CLASS,
  DERIVED_STATUS_LABEL,
  formatISODateBR,
  getDerivedStatus,
} from "../utils";

interface PayablesTableProps {
  payables: Payable[];
  onEdit: (payable: Payable) => void;
  onPay: (payable: Payable) => void;
}

const PAGE_SIZE_OPTIONS = [10, 25, 50, 100];

export const PayablesTable = ({ payables, onEdit, onPay }: PayablesTableProps) => {
  const removePayable = useRemovePayable();
  const removeSeries = useRemoveSeries();
  const undoPayment = useUndoPayablePayment();

  const [search, setSearch] = useState("");
  const [directionFilter, setDirectionFilter] = useState<PayableDirection | "all">("all");
  const [statusFilter, setStatusFilter] = useState<PayableDerivedStatus | "all" | "pending">(
    "pending"
  );
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [confirmDelete, setConfirmDelete] = useState<Payable | null>(null);

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    return payables.filter((p) => {
      const derived = getDerivedStatus(p);
      if (directionFilter !== "all" && p.direction !== directionFilter) return false;
      if (statusFilter === "pending" && p.status === "paid") return false;
      if (statusFilter !== "all" && statusFilter !== "pending" && derived !== statusFilter) {
        return false;
      }
      if (!term) return true;
      return (
        p.description.toLowerCase().includes(term) ||
        (p.counterparty ?? "").toLowerCase().includes(term) ||
        p.category.toLowerCase().includes(term)
      );
    });
  }, [payables, search, directionFilter, statusFilter]);

  const totalItems = filtered.length;
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
  const safePage = Math.min(page, totalPages);
  const startIndex = (safePage - 1) * pageSize;
  const pageItems = filtered.slice(startIndex, startIndex + pageSize);

  useEffect(() => {
    setPage(1);
  }, []);

  const handleDelete = async (payable: Payable, série: boolean) => {
    if (série && payable.seriesId) {
      await removeSeries(payable.seriesId);
    } else {
      await removePayable(payable.id);
    }
    setConfirmDelete(null);
  };

  return (
    <div className="bg-gray-800/60 border border-gray-700/50 rounded-2xl overflow-hidden">
      {/* Filtros */}
      <div className="p-4 flex flex-col lg:flex-row gap-3 lg:items-center border-b border-gray-700/50">
        <div className="relative flex-1 min-w-0">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
          <input
            type="text"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            placeholder="Buscar por descrição, fornecedor ou categoria"
            className="w-full rounded-lg bg-gray-900 border border-gray-700 pl-9 pr-3 py-2 text-sm text-white placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-teal-500"
          />
        </div>

        <select
          value={directionFilter}
          onChange={(e) => {
            setDirectionFilter(e.target.value as PayableDirection | "all");
            setPage(1);
          }}
          className="rounded-lg bg-gray-900 border border-gray-700 px-3 py-2 text-sm text-white"
          aria-label="Filtrar por tipo"
        >
          <option value="all">Todas</option>
          <option value="pay">A pagar</option>
          <option value="receive">A receber</option>
        </select>

        <select
          value={statusFilter}
          onChange={(e) => {
            setStatusFilter(e.target.value as PayableDerivedStatus | "all" | "pending");
            setPage(1);
          }}
          className="rounded-lg bg-gray-900 border border-gray-700 px-3 py-2 text-sm text-white"
          aria-label="Filtrar por situação"
        >
          <option value="pending">Em aberto</option>
          <option value="overdue">Vencidas</option>
          <option value="due-soon">A vencer</option>
          <option value="paid">Pagas</option>
          <option value="all">Todas as situações</option>
        </select>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[900px]">
          <thead className="bg-gray-900/70">
            <tr className="text-left text-xs uppercase tracking-wide text-gray-400">
              <th className="p-3">Vencimento</th>
              <th className="p-3">Descrição</th>
              <th className="p-3">Categoria</th>
              <th className="p-3">Tipo</th>
              <th className="p-3 text-right">Valor</th>
              <th className="p-3">Situação</th>
              <th className="p-3 text-right">Ações</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-700/50">
            {pageItems.map((p) => {
              const derived = getDerivedStatus(p);
              return (
                <tr key={p.id} className="hover:bg-gray-700/30 transition-colors">
                  <td className="p-3 text-sm text-gray-100 whitespace-nowrap">
                    {formatISODateBR(p.dueDate)}
                  </td>
                  <td className="p-3 text-sm text-white">
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{p.description}</span>
                      {p.seriesId && (
                        <Repeat size={14} className="text-teal-400" aria-label="Conta recorrente" />
                      )}
                    </div>
                    {p.counterparty && (
                      <span className="text-xs text-gray-500">{p.counterparty}</span>
                    )}
                  </td>
                  <td className="p-3 text-sm text-gray-300">
                    {p.category}
                    {p.subcategory ? ` · ${p.subcategory}` : ""}
                  </td>
                  <td className="p-3">
                    <span
                      className={`px-2 py-1 text-xs font-bold rounded-full border ${
                        p.direction === "pay"
                          ? "bg-red-500/10 text-red-300 border-red-500/30"
                          : "bg-emerald-500/10 text-emerald-300 border-emerald-500/30"
                      }`}
                    >
                      {p.direction === "pay" ? "A pagar" : "A receber"}
                    </span>
                  </td>
                  <td className="p-3 text-sm font-bold text-right text-gray-100 whitespace-nowrap">
                    {formatCurrency(p.amount)}
                  </td>
                  <td className="p-3">
                    <span
                      className={`px-2 py-1 text-xs font-bold rounded-full border ${DERIVED_STATUS_CLASS[derived]}`}
                      title={
                        p.status === "paid" && p.paidAt
                          ? `Baixado em ${formatISODateBR(p.paidAt)}`
                          : undefined
                      }
                    >
                      {DERIVED_STATUS_LABEL[derived]}
                    </span>
                  </td>
                  <td className="p-3">
                    <div className="flex items-center justify-end gap-1.5">
                      {p.status === "open" ? (
                        <button
                          type="button"
                          onClick={() => onPay(p)}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold transition-colors"
                        >
                          <CheckCircle2 size={14} />
                          {p.direction === "pay" ? "Pagar" : "Receber"}
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={() => undoPayment(p.id)}
                          title="Estornar baixa e excluir o lançamento gerado"
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-gray-700 hover:bg-gray-600 text-gray-200 text-xs font-semibold transition-colors"
                        >
                          <RotateCcw size={14} />
                          Estornar
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => onEdit(p)}
                        className="p-1.5 rounded-md text-gray-400 hover:text-white hover:bg-gray-700"
                        aria-label={`Editar ${p.description}`}
                      >
                        <Pencil size={14} />
                      </button>
                      <button
                        type="button"
                        onClick={() => setConfirmDelete(p)}
                        className="p-1.5 rounded-md text-gray-400 hover:text-red-300 hover:bg-gray-700"
                        aria-label={`Excluir ${p.description}`}
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>

        {totalItems === 0 && (
          <p className="text-center text-gray-500 py-10 text-sm">
            Nenhuma conta encontrada com os filtros atuais.
          </p>
        )}
      </div>

      {totalItems > 0 && (
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 p-4 border-t border-gray-700/50">
          <div className="flex items-center gap-3">
            <p className="text-sm text-gray-300">
              Exibindo{" "}
              <span className="font-bold text-white">
                {startIndex + 1}-{Math.min(startIndex + pageSize, totalItems)}
              </span>{" "}
              de <span className="font-bold text-white">{totalItems}</span>
            </p>
            <select
              value={pageSize}
              onChange={(e) => {
                setPageSize(Number(e.target.value));
                setPage(1);
              }}
              className="rounded-lg bg-gray-900 border border-gray-700 px-2 py-1.5 text-sm text-white"
              aria-label="Itens por página"
            >
              {PAGE_SIZE_OPTIONS.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setPage(Math.max(safePage - 1, 1))}
              disabled={safePage === 1}
              className="p-2 rounded-lg bg-gray-700/70 hover:bg-gray-600 text-white disabled:opacity-40"
              aria-label="Página anterior"
            >
              <ChevronLeft size={16} />
            </button>
            <span className="text-sm text-gray-300">
              Página <span className="font-bold text-white">{safePage}</span> de {totalPages}
            </span>
            <button
              type="button"
              onClick={() => setPage(Math.min(safePage + 1, totalPages))}
              disabled={safePage === totalPages}
              className="p-2 rounded-lg bg-gray-700/70 hover:bg-gray-600 text-white disabled:opacity-40"
              aria-label="Próxima página"
            >
              <ChevronRight size={16} />
            </button>
          </div>
        </div>
      )}

      {confirmDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70">
          <div className="w-full max-w-sm bg-gray-800 border border-gray-700 rounded-2xl p-5">
            <h3 className="text-lg font-bold text-white mb-2">Excluir conta</h3>
            <p className="text-sm text-gray-300 mb-4">
              {confirmDelete.description} — {formatISODateBR(confirmDelete.dueDate)}
            </p>
            <div className="flex flex-col gap-2">
              <button
                type="button"
                onClick={() => handleDelete(confirmDelete, false)}
                className="px-4 py-2 rounded-lg bg-red-600 hover:bg-red-500 text-white text-sm font-semibold"
              >
                Excluir apenas esta
              </button>
              {confirmDelete.seriesId && (
                <button
                  type="button"
                  onClick={() => handleDelete(confirmDelete, true)}
                  className="px-4 py-2 rounded-lg bg-red-700 hover:bg-red-600 text-white text-sm font-semibold"
                >
                  Excluir a série inteira (só as em aberto)
                </button>
              )}
              <button
                type="button"
                onClick={() => setConfirmDelete(null)}
                className="px-4 py-2 rounded-lg text-gray-300 hover:text-white hover:bg-gray-700 text-sm"
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
