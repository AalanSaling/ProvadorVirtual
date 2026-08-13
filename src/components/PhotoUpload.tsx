import React, { useRef } from 'react';
import { Upload, X, Camera, Image as ImageIcon } from 'lucide-react';

interface PhotoUploadProps {
  photoUri: string | null;
  onUpload: (dataUrl: string) => void;
  onRemove: () => void;
  label: string;
  hint?: string;
  compact?: boolean;
  isDark?: boolean;
}

export const PhotoUpload: React.FC<PhotoUploadProps> = ({
  photoUri,
  onUpload,
  onRemove,
  label,
  hint = 'Toque para enviar ou arraste',
  compact = false,
  isDark = false,
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        onUpload(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        onUpload(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  if (photoUri) {
    return (
      <div
        className={`relative w-full rounded-2xl overflow-hidden border shadow-sm group ${
          compact ? 'aspect-square' : 'aspect-[4/5]'
        } ${isDark ? 'border-slate-700 bg-slate-800' : 'border-slate-200 bg-white'}`}
      >
        <img
          src={photoUri}
          alt={label}
          className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
        />
        <button
          onClick={onRemove}
          type="button"
          className="absolute top-3 right-3 w-9 h-9 rounded-full bg-slate-900/80 text-white flex items-center justify-center backdrop-blur-md hover:bg-rose-600 transition-colors shadow-lg"
          title="Remover imagem"
        >
          <X className="w-5 h-5" />
        </button>
        <div className="absolute bottom-0 left-0 right-0 p-2.5 bg-gradient-to-t from-black/80 via-black/40 to-transparent text-white">
          <p className="text-xs font-semibold text-center drop-shadow-xs">{label}</p>
        </div>
      </div>
    );
  }

  return (
    <div
      onDragOver={handleDragOver}
      onDrop={handleDrop}
      onClick={() => fileInputRef.current?.click()}
      className={`w-full rounded-2xl border-2 border-dashed flex flex-col items-center justify-center cursor-pointer transition-all ${
        compact ? 'aspect-square p-3' : 'aspect-[4/5] p-5'
      } ${
        isDark
          ? 'border-slate-700 bg-slate-800/50 hover:bg-slate-800 hover:border-blue-500'
          : 'border-slate-300 bg-slate-50/80 hover:bg-blue-50/50 hover:border-blue-500'
      }`}
    >
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileChange}
        accept="image/*"
        className="hidden"
      />

      <div className={`rounded-full flex items-center justify-center mb-2.5 transition-transform group-hover:scale-110 ${
        compact ? 'w-10 h-10 bg-blue-500/10 text-blue-500' : 'w-14 h-14 bg-blue-500/10 text-blue-500'
      }`}>
        <Upload className={compact ? 'w-5 h-5' : 'w-7 h-7'} />
      </div>

      <p className={`font-bold tracking-tight text-center ${compact ? 'text-xs' : 'text-sm'} ${
        isDark ? 'text-white' : 'text-slate-800'
      }`}>
        {label}
      </p>

      <p className={`text-[11px] text-center mt-1 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
        {hint}
      </p>

      <div className="flex items-center gap-2 mt-3 pt-2 border-t border-slate-200/50 dark:border-slate-700/50 text-[10px] text-blue-500 font-semibold">
        <Camera className="w-3.5 h-3.5" />
        <span>Tirar foto ou galeria</span>
      </div>
    </div>
  );
};
