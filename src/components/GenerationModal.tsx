import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Sparkles, Loader2, Shirt, UserCheck, Wand2 } from 'lucide-react';

interface GenerationModalProps {
  visible: boolean;
  statusText: string;
  isDark?: boolean;
}

export const GenerationModal: React.FC<GenerationModalProps> = ({
  visible,
  statusText,
  isDark = false,
}) => {
  return (
    <AnimatePresence>
      {visible && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.9, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 400, damping: 30 }}
            className={`w-full max-w-sm rounded-3xl p-6 text-center shadow-2xl border ${
              isDark ? 'bg-slate-900 border-slate-800 text-white' : 'bg-white border-slate-100 text-slate-900'
            }`}
          >
            {/* Animated Magic Icon */}
            <div className="w-16 h-16 rounded-full bg-gradient-to-tr from-blue-500 to-indigo-600 text-white mx-auto flex items-center justify-center shadow-lg shadow-blue-500/30 mb-4 relative">
              <Sparkles className="w-8 h-8 animate-pulse" />
              <div className="absolute inset-0 rounded-full border-2 border-white/30 animate-ping" />
            </div>

            <h3 className="text-lg font-extrabold tracking-tight mb-1">
              Gerando Provador Virtual IA
            </h3>

            <p className={`text-xs font-semibold mb-5 ${isDark ? 'text-blue-400' : 'text-blue-600'}`}>
              {statusText || 'Processando modelo de vestir...'}
            </p>

            {/* Spinner */}
            <div className="flex justify-center mb-5">
              <Loader2 className="w-8 h-8 text-blue-500 animate-spin" />
            </div>

            {/* Progress Steps Indicator */}
            <div className="space-y-2 text-left bg-slate-100 dark:bg-slate-800/60 p-3.5 rounded-2xl text-[11px]">
              <div className="flex items-center gap-2 text-emerald-500 font-semibold">
                <UserCheck className="w-3.5 h-3.5" />
                <span>Identificação de silhueta corporal</span>
              </div>
              <div className="flex items-center gap-2 text-blue-500 font-semibold">
                <Shirt className="w-3.5 h-3.5" />
                <span>Mapeamento de tecido e textura</span>
              </div>
              <div className="flex items-center gap-2 text-purple-500 font-semibold animate-pulse">
                <Wand2 className="w-3.5 h-3.5" />
                <span>Ajuste de caimento e iluminação</span>
              </div>
            </div>

            <p className={`text-[10px] mt-4 ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
              Isso leva apenas alguns segundos...
            </p>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};
