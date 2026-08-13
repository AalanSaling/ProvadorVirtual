import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Download, Share2, Sparkles, X, RotateCcw, Check, ShoppingBag } from 'lucide-react';
import confetti from 'canvas-confetti';

interface TryOnResultModalProps {
  visible: boolean;
  resultImage: string | null;
  personImage: string | null;
  garmentName: string;
  onClose: () => void;
  onTryAnother: () => void;
  isDark?: boolean;
}

export const TryOnResultModal: React.FC<TryOnResultModalProps> = ({
  visible,
  resultImage,
  personImage,
  garmentName,
  onClose,
  onTryAnother,
  isDark = false,
}) => {
  const [showComparison, setShowComparison] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (visible) {
      // Fire celebratory confetti!
      confetti({
        particleCount: 60,
        spread: 70,
        origin: { y: 0.6 },
      });
    }
  }, [visible]);

  if (!visible || !resultImage) return null;

  const handleDownload = () => {
    const link = document.createElement('a');
    link.href = resultImage;
    link.download = `provador-virtual-${garmentName.toLowerCase().replace(/\s+/g, '-')}.jpg`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: `Meu Look Virtual - ${garmentName}`,
          text: `Confira como ficou esse(a) ${garmentName} no meu Provador Virtual IA!`,
          url: window.location.href,
        });
      } catch (e) {
        console.error('Share error', e);
      }
    } else {
      navigator.clipboard.writeText(window.location.href);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/70 backdrop-blur-md">
        <motion.div
          initial={{ y: '100%', opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: '100%', opacity: 0 }}
          transition={{ type: 'spring', stiffness: 400, damping: 35 }}
          className={`w-full max-w-md rounded-t-3xl sm:rounded-3xl p-5 overflow-hidden shadow-2xl border-t sm:border ${
            isDark ? 'bg-slate-900 border-slate-800 text-white' : 'bg-white border-slate-100 text-slate-900'
          }`}
        >
          {/* Header */}
          <div className="flex justify-between items-center mb-3">
            <div className="flex items-center gap-2">
              <span className="p-1.5 rounded-full bg-blue-500/10 text-blue-500">
                <Sparkles className="w-4 h-4" />
              </span>
              <div>
                <h3 className="text-base font-extrabold tracking-tight">
                  Resultado do Provador
                </h3>
                <p className="text-[11px] text-slate-400">{garmentName}</p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-1.5 rounded-full hover:bg-slate-500/20 text-slate-400 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Image View / Comparison */}
          <div className="relative rounded-2xl overflow-hidden aspect-[3/4] bg-slate-950 mb-4 shadow-inner group">
            <img
              src={showComparison && personImage ? personImage : resultImage}
              alt="Resultado do Provador"
              className="w-full h-full object-cover"
            />

            {/* Toggle Antes / Depois */}
            {personImage && (
              <button
                onClick={() => setShowComparison(!showComparison)}
                className="absolute top-3 left-3 bg-slate-900/80 text-white text-[11px] font-bold px-3 py-1.5 rounded-full backdrop-blur-md hover:bg-slate-800 transition-colors border border-white/10"
              >
                {showComparison ? '◄ Ver Depois (Com Peça)' : '👁️ Comparar (Antes)'}
              </button>
            )}

            <div className="absolute bottom-3 left-3 right-3 flex justify-between items-center bg-slate-900/80 backdrop-blur-md px-3 py-2 rounded-xl border border-white/10 text-white">
              <span className="text-xs font-semibold truncate max-w-[200px]">
                {garmentName}
              </span>
              <span className="text-[10px] font-bold bg-emerald-500/20 text-emerald-300 px-2 py-0.5 rounded-md">
                Caimento IA Perfeito
              </span>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="grid grid-cols-2 gap-2 mb-3">
            <button
              onClick={handleDownload}
              className="py-3 px-4 bg-blue-500 hover:bg-blue-600 text-white rounded-2xl text-xs font-bold flex items-center justify-center gap-2 shadow-lg shadow-blue-500/20 transition-all active:scale-95"
            >
              <Download className="w-4 h-4" />
              <span>Baixar Look</span>
            </button>

            <button
              onClick={handleShare}
              className={`py-3 px-4 rounded-2xl text-xs font-bold flex items-center justify-center gap-2 transition-all active:scale-95 ${
                isDark ? 'bg-slate-800 hover:bg-slate-700 text-white' : 'bg-slate-100 hover:bg-slate-200 text-slate-800'
              }`}
            >
              {copied ? <Check className="w-4 h-4 text-emerald-500" /> : <Share2 className="w-4 h-4" />}
              <span>{copied ? 'Link Copiado!' : 'Compartilhar'}</span>
            </button>
          </div>

          <button
            onClick={onTryAnother}
            className={`w-full py-2.5 rounded-2xl text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors ${
              isDark ? 'text-slate-300 hover:bg-slate-800' : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Testar outra peça de roupa</span>
          </button>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
