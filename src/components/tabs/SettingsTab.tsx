// src/components/tabs/SettingsTab.tsx
import React, { useState } from 'react';
import {
  getApiKey,
  saveApiKey,
  deleteApiKey,
  getAdminPassword,
  saveAdminPassword,
  deleteAdminPassword,
  removeSavedUserPhoto,
} from '../../lib/storage';
import { Key, Lock, ShieldCheck, ShieldAlert, Moon, Sun, Trash2, Info, Eye, EyeOff, Save } from 'lucide-react';

interface SettingsTabProps {
  isDark: boolean;
  onToggleTheme: () => void;
}

export const SettingsTab: React.FC<SettingsTabProps> = ({ isDark, onToggleTheme }) => {
  const [apiKey, setApiKeyInput] = useState<string>(getApiKey() || '');
  const [showApiKey, setShowApiKey] = useState<boolean>(false);
  const [apiKeySaved, setApiKeySaved] = useState<boolean>(Boolean(getApiKey()));

  const [adminPwd, setAdminPwdInput] = useState<string>(getAdminPassword() || '');
  const [showAdminPwd, setShowAdminPwd] = useState<boolean>(false);
  const [adminPwdSaved, setAdminPwdSaved] = useState<boolean>(Boolean(getAdminPassword()));

  const handleSaveKey = () => {
    if (!apiKey.trim()) {
      deleteApiKey();
      setApiKeySaved(false);
      alert('Chave de API removida.');
      return;
    }
    saveApiKey(apiKey.trim());
    setApiKeySaved(true);
    alert('Chave de API salva com sucesso!');
  };

  const handleSaveAdminPwd = () => {
    if (!adminPwd.trim()) {
      deleteAdminPassword();
      setAdminPwdSaved(false);
      alert('Senha administrativa removida.');
      return;
    }
    saveAdminPassword(adminPwd.trim());
    setAdminPwdSaved(true);
    alert('Senha de administrador salva no dispositivo!');
  };

  const handleClearUserPhoto = () => {
    removeSavedUserPhoto();
    alert('Sua foto de corpo foi excluída do dispositivo.');
  };

  return (
    <div className="space-y-4 pb-24 animate-in fade-in duration-300">
      {/* Header */}
      <div className={`p-5 rounded-3xl border shadow-sm ${
        isDark ? 'bg-slate-800/80 border-slate-700/60' : 'bg-white/90 border-slate-200/80'
      }`}>
        <h1 className="text-xl font-extrabold tracking-tight">Ajustes & Segurança</h1>
        <p className="text-xs text-slate-400 mt-0.5">
          Configurações de chaves, aparência e privacidade
        </p>
      </div>

      {/* Security Warning Box for Web vs Native (Correction 4) */}
      <div className={`p-4 rounded-3xl border flex items-start gap-3 ${
        isDark ? 'bg-amber-950/20 border-amber-800/40 text-amber-200' : 'bg-amber-50 border-amber-200 text-amber-900'
      }`}>
        <Info className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
        <div className="text-xs space-y-1">
          <p className="font-extrabold">Aviso sobre Armazenamento Seguro</p>
          <p className="leading-relaxed opacity-90">
            No <strong>iOS e Android (App Expo)</strong>, as chaves e senhas são encriptadas via <code>Keychain / Keystore (SecureStore)</code>. No ambiente Web, os dados são mantidos no navegador do seu dispositivo.
          </p>
        </div>
      </div>

      {/* BYOK: PerfectCorp API Key */}
      <div className={`p-5 rounded-3xl border shadow-sm space-y-3 ${
        isDark ? 'bg-slate-800/80 border-slate-700/60' : 'bg-white/90 border-slate-200/80'
      }`}>
        <div className="flex items-center gap-2">
          <div className="p-2 rounded-2xl bg-blue-500/10 text-blue-500">
            <Key className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-sm font-bold">API Key - PerfectCorp / Replicate</h3>
            <p className="text-[11px] text-slate-400">Modelo BYOK (Bring Your Own Key)</p>
          </div>
        </div>

        <div className="relative">
          <input
            type={showApiKey ? 'text' : 'password'}
            value={apiKey}
            onChange={(e) => setApiKeyInput(e.target.value)}
            placeholder="Cole sua API Key aqui (ex: r8_...)"
            className={`w-full pl-3.5 pr-10 py-3 text-xs rounded-2xl border focus:outline-none focus:ring-2 focus:ring-blue-500 ${
              isDark ? 'bg-slate-900 border-slate-700 text-white' : 'bg-slate-50 border-slate-200 text-slate-900'
            }`}
          />
          <button
            type="button"
            onClick={() => setShowApiKey(!showApiKey)}
            className="absolute right-3 top-3 text-slate-400 hover:text-slate-200"
          >
            {showApiKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
          </button>
        </div>

        <div className="flex gap-2">
          <button
            onClick={handleSaveKey}
            className="flex-1 py-2.5 px-4 bg-blue-500 hover:bg-blue-600 text-white font-bold text-xs rounded-2xl flex items-center justify-center gap-1.5 shadow-md shadow-blue-500/20"
          >
            <Save className="w-4 h-4" />
            <span>Salvar Chave</span>
          </button>
          {apiKeySaved && (
            <button
              onClick={() => {
                deleteApiKey();
                setApiKeyInput('');
                setApiKeySaved(false);
              }}
              className="py-2.5 px-4 bg-rose-500/10 text-rose-500 font-bold text-xs rounded-2xl hover:bg-rose-500/20"
            >
              Remover
            </button>
          )}
        </div>
      </div>

      {/* Admin Password Storage */}
      <div className={`p-5 rounded-3xl border shadow-sm space-y-3 ${
        isDark ? 'bg-slate-800/80 border-slate-700/60' : 'bg-white/90 border-slate-200/80'
      }`}>
        <div className="flex items-center gap-2">
          <div className="p-2 rounded-2xl bg-amber-500/10 text-amber-500">
            <Lock className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-sm font-bold">Senha de Administrador</h3>
            <p className="text-[11px] text-slate-400">Usada para cadastrar e excluir roupas</p>
          </div>
        </div>

        <div className="relative">
          <input
            type={showAdminPwd ? 'text' : 'password'}
            value={adminPwd}
            onChange={(e) => setAdminPwdInput(e.target.value)}
            placeholder="Senha de admin para operações do catálogo"
            className={`w-full pl-3.5 pr-10 py-3 text-xs rounded-2xl border focus:outline-none focus:ring-2 focus:ring-amber-500 ${
              isDark ? 'bg-slate-900 border-slate-700 text-white' : 'bg-slate-50 border-slate-200 text-slate-900'
            }`}
          />
          <button
            type="button"
            onClick={() => setShowAdminPwd(!showAdminPwd)}
            className="absolute right-3 top-3 text-slate-400 hover:text-slate-200"
          >
            {showAdminPwd ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
          </button>
        </div>

        <div className="flex gap-2">
          <button
            onClick={handleSaveAdminPwd}
            className="flex-1 py-2.5 px-4 bg-amber-500 hover:bg-amber-600 text-white font-bold text-xs rounded-2xl flex items-center justify-center gap-1.5 shadow-md shadow-amber-500/20"
          >
            <Save className="w-4 h-4" />
            <span>Salvar Senha</span>
          </button>
          {adminPwdSaved && (
            <button
              onClick={() => {
                deleteAdminPassword();
                setAdminPwdInput('');
                setAdminPwdSaved(false);
              }}
              className="py-2.5 px-4 bg-rose-500/10 text-rose-500 font-bold text-xs rounded-2xl hover:bg-rose-500/20"
            >
              Remover
            </button>
          )}
        </div>
      </div>

      {/* Theme & Privacy Options */}
      <div className={`p-5 rounded-3xl border shadow-sm space-y-4 ${
        isDark ? 'bg-slate-800/80 border-slate-700/60' : 'bg-white/90 border-slate-200/80'
      }`}>
        {/* Toggle Theme */}
        <div className="flex justify-between items-center">
          <div className="flex items-center gap-2">
            {isDark ? <Moon className="w-4 h-4 text-indigo-400" /> : <Sun className="w-4 h-4 text-amber-500" />}
            <div>
              <p className="text-xs font-bold">Modo Escuro</p>
              <p className="text-[10px] text-slate-400">Alternar tema do aplicativo</p>
            </div>
          </div>
          <button
            onClick={onToggleTheme}
            className={`w-12 h-6 rounded-full p-1 transition-colors ${
              isDark ? 'bg-indigo-600' : 'bg-slate-300'
            }`}
          >
            <div className={`w-4 h-4 rounded-full bg-white transition-transform ${
              isDark ? 'translate-x-6' : 'translate-x-0'
            }`} />
          </button>
        </div>

        {/* Delete User Photo */}
        <div className="pt-3 border-t border-slate-700/30 flex justify-between items-center">
          <div>
            <p className="text-xs font-bold text-rose-500">Limpar Dados de Foto</p>
            <p className="text-[10px] text-slate-400">Remove sua foto salva neste dispositivo</p>
          </div>
          <button
            onClick={handleClearUserPhoto}
            className="py-2 px-3 bg-rose-500/10 text-rose-500 hover:bg-rose-500/20 rounded-xl text-xs font-bold flex items-center gap-1"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>Excluir</span>
          </button>
        </div>
      </div>
    </div>
  );
};
