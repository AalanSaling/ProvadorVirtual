import React from 'react';
import { motion } from 'motion/react';

interface SegmentOption {
  id: string;
  label: string;
}

interface IosSegmentedControlProps {
  options: SegmentOption[];
  selectedId: string;
  onChange: (id: string) => void;
  isDark?: boolean;
}

export const IosSegmentedControl: React.FC<IosSegmentedControlProps> = ({
  options,
  selectedId,
  onChange,
  isDark = false,
}) => {
  return (
    <div
      className={`relative flex p-1 rounded-xl select-none ${
        isDark ? 'bg-slate-800/80 border border-slate-700/50' : 'bg-slate-200/70 border border-slate-300/40'
      }`}
    >
      {options.map((option) => {
        const isSelected = selectedId === option.id;
        return (
          <button
            key={option.id}
            onClick={() => onChange(option.id)}
            className={`relative flex-1 py-1.5 text-xs font-semibold rounded-lg transition-colors z-10 ${
              isSelected
                ? isDark
                  ? 'text-white'
                  : 'text-slate-900'
                : isDark
                ? 'text-slate-400 hover:text-slate-200'
                : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            {isSelected && (
              <motion.div
                layoutId="segmentedControlActive"
                className={`absolute inset-0 rounded-lg shadow-sm ${
                  isDark ? 'bg-slate-700' : 'bg-white'
                }`}
                transition={{ type: 'spring', stiffness: 500, damping: 35 }}
              />
            )}
            <span className="relative z-10">{option.label}</span>
          </button>
        );
      })}
    </div>
  );
};
