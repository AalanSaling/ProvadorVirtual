import React, { useState } from 'react';
import { Smartphone, Monitor } from 'lucide-react';

interface IosDeviceFrameProps {
  children: React.ReactNode;
  isDark: boolean;
}

export const IosDeviceFrame: React.FC<IosDeviceFrameProps> = ({ children, isDark }) => {
  const [deviceFrameMode, setDeviceFrameMode] = useState<boolean>(false);

  return (
    <div className={`min-h-screen transition-colors duration-300 ${
      isDark ? 'bg-slate-950 text-slate-100' : 'bg-slate-100 text-slate-900'
    }`}>
      {/* Top Bar with Device Mode Selector for Desktop Preview */}
      <div className={`hidden md:flex items-center justify-between px-6 py-2.5 border-b backdrop-blur-md sticky top-0 z-50 text-xs font-semibold ${
        isDark ? 'bg-slate-900/80 border-slate-800 text-slate-300' : 'bg-white/80 border-slate-200 text-slate-600'
      }`}>
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
          <span>Visualizador iOS (Apple HIG)</span>
        </div>

        <div className="flex items-center gap-1 bg-slate-200 dark:bg-slate-800 p-1 rounded-xl">
          <button
            onClick={() => setDeviceFrameMode(false)}
            className={`flex items-center gap-1.5 px-3 py-1 rounded-lg transition-all ${
              !deviceFrameMode
                ? 'bg-white dark:bg-slate-700 text-blue-500 font-bold shadow-xs'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Monitor className="w-3.5 h-3.5" />
            <span>Responsivo Tela Cheia</span>
          </button>
          <button
            onClick={() => setDeviceFrameMode(true)}
            className={`flex items-center gap-1.5 px-3 py-1 rounded-lg transition-all ${
              deviceFrameMode
                ? 'bg-white dark:bg-slate-700 text-blue-500 font-bold shadow-xs'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Smartphone className="w-3.5 h-3.5" />
            <span>Moldura iPhone 16 Pro</span>
          </button>
        </div>
      </div>

      {/* Main Content Area */}
      {deviceFrameMode ? (
        <div className="py-8 flex justify-center items-center min-h-[calc(100vh-50px)]">
          {/* iPhone Mockup Frame */}
          <div className="w-[390px] h-[812px] bg-black rounded-[50px] p-3 shadow-2xl ring-1 ring-white/20 relative overflow-hidden flex flex-col border-[6px] border-slate-800">
            {/* Inner Screen */}
            <div className={`w-full h-full rounded-[42px] overflow-y-auto overflow-x-hidden relative flex flex-col scrollbar-none ${
              isDark ? 'bg-slate-900' : 'bg-slate-50'
            }`}>
              {children}
            </div>
          </div>
        </div>
      ) : (
        <div className="max-w-md mx-auto min-h-screen relative shadow-2xl border-x border-slate-200/50 dark:border-slate-800/50">
          {children}
        </div>
      )}
    </div>
  );
};
