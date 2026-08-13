// src/components/LgpdConsentModal.tsx
// Modal de consentimento de privacidade (LGPD) antes do primeiro uso do provador virtual

import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { ShieldCheck, Lock, EyeOff, AlertTriangle } from 'lucide-react';

interface LgpdConsentModalProps {
  visible: boolean;
  onAccept: () => void;
  onDecline: () => void;
  isDark?: boolean;
}

export const LgpdConsentModal: React.FC<LgpdConsentModalProps> = ({
  visible,
  onAccept,
  onDecline,
  isDark = false,
}) => {
  if (!visible) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-md">
        <motion.div
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.9, opacity: 0 }}
          transition={{ type: 'spring', stiffness: 400, damping: 30 }}
          className={`w-full max-w-sm rounded-3xl p-6 text-center shadow-2xl border ${
            isDark ? 'bg-slate-900 border-slate-800 text-white' : 'bg-white border-slate-100 text-slate-900'
          }`}
        >
          {/* Shield Icon */}
          <div className="w-16 h-16 rounded-full bg-emerald-500/10 text-emerald-500 mx-auto flex items-center justify-center mb-4">
            <ShieldCheck className="w-9 h-9 stroke-[2.5]" />
          </div>

          <h3 className="text-lg font-extrabold tracking-tight mb-2">
            Privacidade & Proteção de Dados (LGPD)
          </h3>

          <p className={`text-xs leading-relaxed mb-4 ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>
            A sua foto de corpo é tratada como dado pessoal sensível. Para usar o Provador Virtual IA, você precisa concordar com os termos abaixo:
          </p>

          <div className={`p-3.5 rounded-2xl text-left space-y-2 mb-5 text-[11px] ${
            isDark ? 'bg-slate-800/80 border border-slate-700/60' : 'bg-slate-50 border border-slate-200/80'
          }`}>
            <div className="flex items-start gap-2">
              <Lock className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
              <span><strong>Sem Armazenamento em Nuvem:</strong> Sua foto não é salva no servidor do app.</span>
            </div>

            <div className="flex items-start gap-2">
              <EyeOff className="w-4 h-4 text-blue-500 shrink-0 mt-0.5" />
              <span><strong>Processamento Temporário:</strong> A foto é enviada de forma criptografada à API da PerfectCorp/Replicate apenas para gerar a visualização da roupa.</span>
            </div>

            <div className="flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
              <span><strong>Controle Total:</strong> Você pode excluir sua foto a qualquer momento no app.</span>
            </div>
          </div>

          <div className="space-y-2">
            <button
              onClick={onAccept}
              className="w-full py-3.5 px-4 bg-emerald-500 hover:bg-emerald-600 text-white rounded-2xl font-bold text-xs shadow-lg shadow-emerald-500/25 transition-all active:scale-95"
            >
              Concordar e Usar o Provador
            </button>

            <button
              onClick={onDecline}
              className={`w-full py-2.5 px-4 rounded-2xl text-xs font-semibold transition-colors ${
                isDark ? 'text-slate-400 hover:bg-slate-800' : 'text-slate-500 hover:bg-slate-100'
              }`}
            >
              Recusar (Navegar Apenas no Catálogo)
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
