import React from 'react';
import { Check, Sparkles } from 'lucide-react';
import { ClothingItem } from '../types';
import { formatPrice } from '../lib/vtonService';

interface CatalogCardProps {
  item: ClothingItem;
  selected: boolean;
  onSelect: () => void;
  onQuickTryOn?: (item: ClothingItem) => void;
  isDark?: boolean;
}

export const CatalogCard: React.FC<CatalogCardProps> = ({
  item,
  selected,
  onSelect,
  onQuickTryOn,
  isDark = false,
}) => {
  return (
    <div
      onClick={onSelect}
      className={`group relative rounded-2xl overflow-hidden border transition-all cursor-pointer shadow-xs ${
        selected
          ? 'border-blue-500 ring-2 ring-blue-500/30 shadow-md scale-[1.02]'
          : isDark
          ? 'bg-slate-800 border-slate-700/80 hover:border-slate-600'
          : 'bg-white border-slate-200/80 hover:border-slate-300'
      }`}
    >
      {/* Image Container */}
      <div className="relative aspect-[3/4] w-full overflow-hidden bg-slate-100 dark:bg-slate-900">
        <img
          src={item.image}
          alt={item.name}
          className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
        />

        {/* Selected Overlay Checkmark */}
        {selected && (
          <div className="absolute inset-0 bg-blue-500/20 backdrop-blur-[1px] flex items-start justify-end p-2.5">
            <div className="w-7 h-7 rounded-full bg-blue-500 text-white flex items-center justify-center shadow-lg">
              <Check className="w-4 h-4 stroke-[3]" />
            </div>
          </div>
        )}

        {/* Gradient Overlay for Text Readability */}
        <div className="absolute inset-x-0 bottom-0 h-28 bg-gradient-to-t from-slate-950/90 via-slate-950/40 to-transparent p-3 flex flex-col justify-end text-white">
          <span className="text-[10px] font-bold text-blue-300 uppercase tracking-wider">
            {item.category}
          </span>
          <h4 className="text-xs font-bold leading-snug truncate drop-shadow-xs">
            {item.name}
          </h4>
          <p className="text-xs font-extrabold text-slate-100 mt-0.5">
            {formatPrice(item.price)}
          </p>
        </div>
      </div>

      {/* Quick Try-On Button */}
      {onQuickTryOn && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onQuickTryOn(item);
          }}
          className={`w-full py-2 px-3 text-[11px] font-bold flex items-center justify-center gap-1.5 transition-colors ${
            selected
              ? 'bg-blue-500 text-white'
              : isDark
              ? 'bg-slate-700/80 text-blue-400 hover:bg-slate-700'
              : 'bg-blue-50 text-blue-600 hover:bg-blue-100'
          }`}
        >
          <Sparkles className="w-3.5 h-3.5" />
          <span>{selected ? 'Selecionado para Provador' : 'Provador Virtual'}</span>
        </button>
      )}
    </div>
  );
};
