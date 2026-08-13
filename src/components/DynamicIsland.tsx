import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Music, Bell, CheckCircle2, Play, Pause, Sparkles } from 'lucide-react';

export const DynamicIsland: React.FC = () => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [isPlaying, setIsPlaying] = useState(true);
  const [activeAlert, setActiveAlert] = useState<'music' | 'status' | 'ai'>('music');

  return (
    <div className="w-full flex justify-center py-1 relative z-40 select-none">
      <motion.div
        layout
        onClick={() => setIsExpanded(!isExpanded)}
        className="bg-black text-white cursor-pointer shadow-xl flex items-center overflow-hidden border border-white/10"
        style={{
          borderRadius: isExpanded ? 28 : 20,
        }}
        animate={{
          width: isExpanded ? 320 : 125,
          height: isExpanded ? 80 : 32,
        }}
        transition={{
          type: 'spring',
          stiffness: 400,
          damping: 30,
        }}
      >
        <AnimatePresence mode="wait">
          {!isExpanded ? (
            <motion.div
              key="collapsed"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="w-full h-full px-3 flex items-center justify-between text-xs"
            >
              <div className="flex items-center gap-1.5 text-emerald-400">
                <Sparkles className="w-3 h-3 animate-pulse" />
                <span className="text-[11px] font-medium tracking-tight text-white/90">iOS App</span>
              </div>
              <div className="w-2 h-2 rounded-full bg-emerald-500 animate-ping" />
            </motion.div>
          ) : (
            <motion.div
              key="expanded"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="w-full h-full p-3.5 flex items-center justify-between"
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-indigo-500 to-purple-500 flex items-center justify-center shadow-inner">
                  <Music className="w-5 h-5 text-white" />
                </div>
                <div>
                  <p className="text-xs font-semibold text-white tracking-tight">Apple HIG UI Kit</p>
                  <p className="text-[11px] text-white/60">Optimizado para iOS Web</p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setIsPlaying(!isPlaying);
                  }}
                  className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center hover:bg-white/30 transition-colors"
                >
                  {isPlaying ? <Pause className="w-4 h-4 text-white" /> : <Play className="w-4 h-4 text-white fill-white ml-0.5" />}
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </div>
  );
};
