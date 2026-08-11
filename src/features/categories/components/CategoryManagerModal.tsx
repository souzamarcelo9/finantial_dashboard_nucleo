import { AlertCircle, Check, ChevronRight, Pencil, Plus, RotateCcw, Trash2, X } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  useAddCategory,
  useAddSubcategory,
  useCategoryCatalog,
  useRemoveCategory,
  useRemoveSubcategory,
  useRenameCategory,
  useRenameSubcategory,
  useResetCategoryCatalog,
  useTransactions,
} from "../../../store/financialStore";

interface CategoryManagerModalProps {
  open: boolean;
  onClose: () => void;
  /** Qual campo recebe o foco ao abrir o modal */
  initialFocus?: "category" | "subcategory";
  /** Categoria pré-selecionada (ex.: ao abrir a partir de um clique no treemap) */
  initialCategory?: string;
}

type EditingTarget = { scope: "category" | "subcategory"; name: string } | null;

export const CategoryManagerModal = ({
  open,
  onClose,
  initialFocus = "category",
  initialCategory,
}: CategoryManagerModalProps) => {
  const catalog = useCategoryCatalog();
  const transactions = useTransactions();
  const addCategory = useAddCategory();
  const renameCategory = useRenameCategory();
  const removeCategory = useRemoveCategory();
  const addSubcategory = useAddSubcategory();
  const renameSubcategory = useRenameSubcategory();
  const removeSubcategory = useRemoveSubcategory();
  const resetCatalog = useResetCategoryCatalog();

  const categories = useMemo(
    () => Object.keys(catalog).sort((a, b) => a.localeCompare(b)),
    [catalog]
  );

  const [selected, setSelected] = useState<string>(initialCategory ?? categories[0] ?? "");
  const [newCategory, setNewCategory] = useState("");
  const [newSubcategory, setNewSubcategory] = useState("");
  const [editing, setEditing] = useState<EditingTarget>(null);
  const [editValue, setEditValue] = useState("");
  const [feedback, setFeedback] = useState<{ type: "error" | "success"; message: string } | null>(
    null
  );
  const [confirmReset, setConfirmReset] = useState(false);

  const categoryInputRef = useRef<HTMLInputElement>(null);
  const subcategoryInputRef = useRef<HTMLInputElement>(null);

  // Contagem de uso por categoria/subcategoria: é o que explica ao usuário
  // por que uma exclusão foi bloqueada.
  const usage = useMemo(() => {
    const byCategory = new Map<string, number>();
    const bySubcategory = new Map<string, number>();
    transactions.forEach((t) => {
      byCategory.set(t.category, (byCategory.get(t.category) ?? 0) + 1);
      const key = `${t.category}||${t.subcategory}`;
      bySubcategory.set(key, (bySubcategory.get(key) ?? 0) + 1);
    });
    return { byCategory, bySubcategory };
  }, [transactions]);

  useEffect(() => {
    if (!open) return;
    setFeedback(null);
    setEditing(null);
    setConfirmReset(false);
    if (initialCategory) {
      setSelected(initialCategory);
    }
    const target = initialFocus === "subcategory" ? subcategoryInputRef : categoryInputRef;
    // Aguarda a pintura do modal antes de focar
    const id = window.setTimeout(() => target.current?.focus(), 50);
    return () => window.clearTimeout(id);
  }, [open, initialFocus, initialCategory]);

  // Se a categoria selecionada deixar de existir (exclusão/renomeação), cai na primeira
  useEffect(() => {
    if (selected && !catalog[selected]) {
      setSelected(categories[0] ?? "");
    }
  }, [catalog, categories, selected]);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, onClose]);

  if (!open) return null;

  const subcategories = catalog[selected] ?? [];

  const report = (result: { ok: boolean; error?: string }, successMessage: string) => {
    setFeedback(
      result.ok
        ? { type: "success", message: successMessage }
        : { type: "error", message: result.error ?? "Não foi possível concluir a operação." }
    );
    return result.ok;
  };

  const handleAddCategory = () => {
    const name = newCategory;
    if (report(addCategory(name), `Categoria "${name.trim()}" criada.`)) {
      setSelected(name.trim().replace(/\s+/g, " "));
      setNewCategory("");
    }
  };

  const handleAddSubcategory = () => {
    if (!selected) {
      setFeedback({ type: "error", message: "Crie ou selecione uma categoria primeiro." });
      return;
    }
    const name = newSubcategory;
    if (report(addSubcategory(selected, name), `Subcategoria "${name.trim()}" criada.`)) {
      setNewSubcategory("");
    }
  };

  const startEditing = (scope: "category" | "subcategory", name: string) => {
    setEditing({ scope, name });
    setEditValue(name);
    setFeedback(null);
  };

  const commitEditing = () => {
    if (!editing) return;
    const result =
      editing.scope === "category"
        ? renameCategory(editing.name, editValue)
        : renameSubcategory(selected, editing.name, editValue);
    if (report(result, "Nome atualizado. Os lançamentos existentes foram reetiquetados.")) {
      if (editing.scope === "category") {
        setSelected(editValue.trim().replace(/\s+/g, " "));
      }
      setEditing(null);
    }
  };

  const handleRemoveCategory = (name: string) => {
    report(removeCategory(name), `Categoria "${name}" excluída.`);
  };

  const handleRemoveSubcategory = (name: string) => {
    report(removeSubcategory(selected, name), `Subcategoria "${name}" excluída.`);
  };

  const inputClass =
    "w-full rounded-lg bg-gray-900 border border-gray-700 px-3 py-2 text-sm text-white placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-teal-500";
  const iconButtonClass =
    "p-1.5 rounded-md text-gray-400 hover:text-white hover:bg-gray-700/70 transition-colors";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70">
      <div className="w-full max-w-3xl max-h-[90vh] overflow-y-auto bg-gray-800 border border-gray-700 rounded-2xl p-6 shadow-2xl">
        <div className="flex items-start justify-between mb-4 gap-4">
          <div>
            <h2 className="text-xl font-bold text-white">Categorias e subcategorias</h2>
            <p className="text-sm text-gray-400 mt-1">
              As categorias criadas aqui ficam disponíveis nos lançamentos e nos gráficos.
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

        {feedback && (
          <div
            className={`flex items-start gap-2 rounded-lg px-3 py-2 mb-4 border ${
              feedback.type === "error"
                ? "bg-red-500/10 border-red-500/30 text-red-300"
                : "bg-emerald-500/10 border-emerald-500/30 text-emerald-300"
            }`}
          >
            {feedback.type === "error" ? (
              <AlertCircle size={16} className="mt-0.5 flex-shrink-0" />
            ) : (
              <Check size={16} className="mt-0.5 flex-shrink-0" />
            )}
            <p className="text-sm">{feedback.message}</p>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {/* Categorias */}
          <section className="bg-gray-900/40 border border-gray-700/60 rounded-xl p-4">
            <h3 className="text-sm font-semibold text-gray-200 uppercase tracking-wide mb-3">
              Categorias ({categories.length})
            </h3>

            <div className="flex gap-2 mb-3">
              <input
                ref={categoryInputRef}
                type="text"
                value={newCategory}
                onChange={(e) => setNewCategory(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    handleAddCategory();
                  }
                }}
                placeholder="Nova categoria"
                className={inputClass}
              />
              <button
                type="button"
                onClick={handleAddCategory}
                className="inline-flex items-center gap-1 px-3 py-2 rounded-lg bg-teal-600 hover:bg-teal-500 text-white text-sm font-semibold transition-colors"
              >
                <Plus size={16} />
                Criar
              </button>
            </div>

            <ul className="space-y-1 max-h-72 overflow-y-auto pr-1">
              {categories.map((category) => {
                const isEditing = editing?.scope === "category" && editing.name === category;
                const count = usage.byCategory.get(category) ?? 0;
                return (
                  <li key={category}>
                    {isEditing ? (
                      <div className="flex gap-2 items-center">
                        <input
                          type="text"
                          value={editValue}
                          onChange={(e) => setEditValue(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") {
                              e.preventDefault();
                              commitEditing();
                            }
                            if (e.key === "Escape") setEditing(null);
                          }}
                          className={inputClass}
                        />
                        <button
                          type="button"
                          onClick={commitEditing}
                          className={iconButtonClass}
                          aria-label="Salvar"
                        >
                          <Check size={16} />
                        </button>
                        <button
                          type="button"
                          onClick={() => setEditing(null)}
                          className={iconButtonClass}
                          aria-label="Cancelar"
                        >
                          <X size={16} />
                        </button>
                      </div>
                    ) : (
                      <div
                        className={`flex items-center gap-2 rounded-lg px-2 py-1.5 ${
                          selected === category ? "bg-teal-500/15 border border-teal-500/40" : ""
                        }`}
                      >
                        <button
                          type="button"
                          onClick={() => setSelected(category)}
                          className="flex-1 min-w-0 flex items-center gap-2 text-left text-sm text-white"
                        >
                          <ChevronRight
                            size={14}
                            className={selected === category ? "text-teal-300" : "text-gray-600"}
                          />
                          <span className="truncate">{category}</span>
                          <span className="text-xs text-gray-500 flex-shrink-0">
                            {(catalog[category] ?? []).length} sub · {count} lanç.
                          </span>
                        </button>
                        <button
                          type="button"
                          onClick={() => startEditing("category", category)}
                          className={iconButtonClass}
                          aria-label={`Renomear ${category}`}
                        >
                          <Pencil size={14} />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleRemoveCategory(category)}
                          className={`${iconButtonClass} hover:text-red-300`}
                          aria-label={`Excluir ${category}`}
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
          </section>

          {/* Subcategorias */}
          <section className="bg-gray-900/40 border border-gray-700/60 rounded-xl p-4">
            <h3 className="text-sm font-semibold text-gray-200 uppercase tracking-wide mb-3">
              Subcategorias de <span className="text-teal-300 normal-case">{selected || "—"}</span>
            </h3>

            <div className="flex gap-2 mb-3">
              <input
                ref={subcategoryInputRef}
                type="text"
                value={newSubcategory}
                onChange={(e) => setNewSubcategory(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    handleAddSubcategory();
                  }
                }}
                placeholder="Nova subcategoria"
                disabled={!selected}
                className={`${inputClass} disabled:opacity-50`}
              />
              <button
                type="button"
                onClick={handleAddSubcategory}
                disabled={!selected}
                className="inline-flex items-center gap-1 px-3 py-2 rounded-lg bg-teal-600 hover:bg-teal-500 text-white text-sm font-semibold transition-colors disabled:opacity-50"
              >
                <Plus size={16} />
                Criar
              </button>
            </div>

            {subcategories.length === 0 ? (
              <p className="text-sm text-gray-500 py-4 text-center">
                {selected
                  ? "Nenhuma subcategoria cadastrada."
                  : "Selecione uma categoria à esquerda."}
              </p>
            ) : (
              <ul className="space-y-1 max-h-72 overflow-y-auto pr-1">
                {subcategories.map((sub) => {
                  const isEditing = editing?.scope === "subcategory" && editing.name === sub;
                  const count = usage.bySubcategory.get(`${selected}||${sub}`) ?? 0;
                  return (
                    <li key={sub}>
                      {isEditing ? (
                        <div className="flex gap-2 items-center">
                          <input
                            type="text"
                            value={editValue}
                            onChange={(e) => setEditValue(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === "Enter") {
                                e.preventDefault();
                                commitEditing();
                              }
                              if (e.key === "Escape") setEditing(null);
                            }}
                            className={inputClass}
                          />
                          <button
                            type="button"
                            onClick={commitEditing}
                            className={iconButtonClass}
                            aria-label="Salvar"
                          >
                            <Check size={16} />
                          </button>
                          <button
                            type="button"
                            onClick={() => setEditing(null)}
                            className={iconButtonClass}
                            aria-label="Cancelar"
                          >
                            <X size={16} />
                          </button>
                        </div>
                      ) : (
                        <div className="flex items-center gap-2 rounded-lg px-2 py-1.5 hover:bg-gray-800/60">
                          <span className="flex-1 min-w-0 truncate text-sm text-white">{sub}</span>
                          <span className="text-xs text-gray-500 flex-shrink-0">{count} lanç.</span>
                          <button
                            type="button"
                            onClick={() => startEditing("subcategory", sub)}
                            className={iconButtonClass}
                            aria-label={`Renomear ${sub}`}
                          >
                            <Pencil size={14} />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleRemoveSubcategory(sub)}
                            className={`${iconButtonClass} hover:text-red-300`}
                            aria-label={`Excluir ${sub}`}
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      )}
                    </li>
                  );
                })}
              </ul>
            )}
          </section>
        </div>

        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 mt-5 pt-4 border-t border-gray-700/60">
          {confirmReset ? (
            <div className="flex items-center gap-2 text-sm">
              <span className="text-amber-300">Restaurar o catálogo padrão?</span>
              <button
                type="button"
                onClick={() => {
                  resetCatalog();
                  setConfirmReset(false);
                  setFeedback({ type: "success", message: "Catálogo padrão restaurado." });
                }}
                className="px-3 py-1.5 rounded-lg bg-amber-600 hover:bg-amber-500 text-white font-semibold"
              >
                Confirmar
              </button>
              <button
                type="button"
                onClick={() => setConfirmReset(false)}
                className="px-3 py-1.5 rounded-lg text-gray-300 hover:text-white hover:bg-gray-700"
              >
                Cancelar
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setConfirmReset(true)}
              className="inline-flex items-center gap-1.5 text-sm text-gray-400 hover:text-white"
            >
              <RotateCcw size={14} />
              Restaurar padrão
            </button>
          )}

          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2 rounded-lg bg-gray-700 hover:bg-gray-600 text-white text-sm font-semibold"
          >
            Concluir
          </button>
        </div>
      </div>
    </div>
  );
};

export default CategoryManagerModal;
