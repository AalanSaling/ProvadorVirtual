// src/components/AdminPasswordModal.tsx
// Modal para solicitação de senha de administrador ao realizar alterações no catálogo

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Lock, KeyRound, Eye, EyeOff, X } from 'lucide-react';
import { saveAdminPassword } from '../lib/storage';

interface AdminPasswordModalProps {
  visible: boolean;
  onConfirm: (password: string) => void;
  onClose: () => void;
  isDark?: boolean;
}

export const AdminPasswordModal: React.FC<AdminPasswordModalProps> = ({
  visible,
  onConfirm,
  onClose,
  isDark = false,
}) => {
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [remember, setRemember] = useState(true);

  if (!visible) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!password.trim()) return;

    if (remember) {
      saveAdminPassword(password.trim());
    }

    onConfirm(password.trim());
  };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
        <motion.div
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.9, opacity: 0 }}
          className={`w-full max-w-sm rounded-3xl p-6 shadow-2xl border ${
            isDark ? 'bg-slate-900 border-slate-800 text-white' : 'bg-white border-slate-100 text-slate-900'
          }`}
        >
          <div className="flex justify-between items-center mb-4">
            <div className="flex items-center gap-2">
              <div className="p-2 rounded-2xl bg-amber-500/10 text-amber-500">
                <Lock className="w-5 h-5" />
              </div>
              <h3 className="text-base font-extrabold tracking-tight">
                Autenticação de Admin
              </h3>
            </div>
            <button
              onClick={onClose}
              className="p-1 rounded-full text-slate-400 hover:bg-slate-500/20"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <p className={`text-xs mb-4 leading-relaxed ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>
            Por razões de segurança, informe a senha de administrador do sistema para modificar o catálogo de produtos.
          </p>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                required
                autoFocus
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Senha administrativa"
                className={`w-full pr-10 pl-3.5 py-3 text-xs rounded-2xl border focus:outline-none focus:ring-2 focus:ring-amber-500 ${
                  isDark ? 'bg-slate-800 border-slate-700 text-white' : 'bg-slate-50 border-slate-200 text-slate-900'
                }`}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-3 text-slate-400 hover:text-slate-200"
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>

            <label className="flex items-center gap-2 text-xs font-semibold cursor-pointer">
              <input
                type="checkbox"
                checked={remember}
                onChange={(e) => setRemember(e.target.checked)}
                className="rounded border-slate-300 text-amber-500 focus:ring-amber-500"
              />
              <span className={isDark ? 'text-slate-300' : 'text-slate-600'}>
                Lembrar senha neste dispositivo
              </span>
            </label>

            <div className="flex gap-2 pt-1">
              <button
                type="submit"
                className="flex-1 py-3 bg-amber-500 text-white rounded-2xl text-xs font-bold hover:bg-amber-600 transition-colors shadow-md shadow-amber-500/20"
              >
                Confirmar
              </button>
              <button
                type="button"
                onClick={onClose}
                className={`px-4 py-3 rounded-2xl text-xs font-bold transition-colors ${
                  isDark ? 'bg-slate-800 text-slate-300' : 'bg-slate-100 text-slate-700'
                }`}
              >
                Cancelar
              </button>
            </div>
          </form>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
