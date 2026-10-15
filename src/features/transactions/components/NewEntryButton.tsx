import { CalendarClock, CheckCircle2, PlusCircle, X } from "lucide-react";
import { useState } from "react";
import { PayableFormModal } from "../../payables/components/PayableFormModal";
import type { PayableDirection } from "../../payables/types";
import { ManualEntryModal } from "./ManualEntryModal";

type Etapa = "fechado" | "escolha" | "realizado" | "previsto";

/**
 * Entrada única do sistema.
 *
 * O usuário não precisa saber se o dado vai para `transactions` (caixa) ou
 * `payables` (previsão): ele responde se já aconteceu ou se tem vencimento,
 * que é a pergunta que ele já faz naturalmente. O sistema escolhe a tabela.
 */
export const NewEntryButton = () => {
  const [etapa, setEtapa] = useState<Etapa>("fechado");
  const [direction, setDirection] = useState<PayableDirection>("pay");

  return (
    <>
      <button
        type="button"
        onClick={() => setEtapa("escolha")}
        className="group inline-flex items-center px-6 py-3 bg-gradient-to-r from-purple-600 to-purple-700 text-white font-semibold rounded-xl cursor-pointer hover:from-purple-500 hover:to-purple-600 transition-all duration-200 shadow-lg hover:shadow-purple-500/25"
      >
        <PlusCircle size={18} className="mr-2" />
        Novo Lançamento
      </button>

      {etapa === "escolha" && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70">
          <div className="w-full max-w-lg bg-gray-800 border border-gray-700 rounded-2xl p-6 shadow-2xl">
            <div className="flex items-start justify-between mb-1">
              <h2 className="text-xl font-bold text-white">Novo lançamento</h2>
              <button
                type="button"
                onClick={() => setEtapa("fechado")}
                className="text-gray-400 hover:text-white"
                aria-label="Fechar"
              >
                <X size={20} />
              </button>
            </div>
            <p className="text-sm text-gray-400 mb-5">Esse valor já foi pago ou recebido?</p>

            <div className="space-y-3">
              <button
                type="button"
                onClick={() => setEtapa("realizado")}
                className="w-full text-left p-4 rounded-xl bg-gray-900/70 border border-gray-700 hover:border-emerald-500/60 transition-colors"
              >
                <span className="flex items-center gap-2 text-white font-semibold">
                  <CheckCircle2 size={18} className="text-emerald-400" />
                  Já foi pago / recebido
                </span>
                <span className="block text-sm text-gray-400 mt-1">
                  Entra direto no caixa e nos indicadores. É o caso de um gasto de hoje ou de um
                  valor que já caiu na conta.
                </span>
              </button>

              <div className="p-4 rounded-xl bg-gray-900/70 border border-gray-700">
                <span className="flex items-center gap-2 text-white font-semibold">
                  <CalendarClock size={18} className="text-amber-400" />
                  Tem vencimento futuro
                </span>
                <span className="block text-sm text-gray-400 mt-1 mb-3">
                  Vira uma conta a pagar ou a receber. Só entra no caixa quando você der baixa.
                </span>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setDirection("pay");
                      setEtapa("previsto");
                    }}
                    className="flex-1 py-2 rounded-lg bg-red-600 hover:bg-red-500 text-white text-sm font-semibold"
                  >
                    A pagar
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setDirection("receive");
                      setEtapa("previsto");
                    }}
                    className="flex-1 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-semibold"
                  >
                    A receber
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      <ManualEntryModal
        hideTrigger
        open={etapa === "realizado"}
        onOpenChange={(aberto) => {
          if (!aberto) setEtapa("fechado");
        }}
      />

      <PayableFormModal
        open={etapa === "previsto"}
        onClose={() => setEtapa("fechado")}
        defaultDirection={direction}
      />
    </>
  );
};
