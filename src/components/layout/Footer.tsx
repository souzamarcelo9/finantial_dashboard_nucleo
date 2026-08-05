import { Heart } from "lucide-react";

export const Footer = () => (
  <footer className="text-center mt-12 mb-8">
    <div className="bg-gradient-to-r from-gray-800/50 via-gray-800/80 to-gray-800/50 backdrop-blur-sm rounded-2xl p-6 border border-gray-700/50 relative overflow-hidden">
      {/* Background accent */}
      <div className="absolute inset-0 bg-gradient-to-r from-blue-600/5 via-purple-600/5 to-pink-600/5"></div>

      <div className="relative z-10 flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-3 min-w-0">
          <img
            src="/logo-nucleo-mark.png"
            alt="Núcleo Organização Contábil LTDA"
            className="h-8 w-8 shrink-0 object-contain"
          />
          <span className="text-gray-300 font-medium">Painel Financeiro</span>
          <span className="text-gray-500 truncate">
            &copy; 2026 Núcleo Organização Contábil LTDA
          </span>
        </div>

        <div className="flex items-center gap-2 text-gray-400 sm:shrink-0">
          <span className="text-sm">Feito com</span>
          <Heart size={16} className="text-red-400 animate-pulse" />
          <span className="text-sm">para melhores insights financeiros</span>
        </div>
      </div>

      {/* Bottom gradient line */}
      <div className="absolute bottom-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-blue-600 to-transparent"></div>
    </div>
  </footer>
);
