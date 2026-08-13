import React, { useState, useEffect } from 'react';
import { Wifi, Battery, Signal } from 'lucide-react';

interface IosStatusBarProps {
  isDark?: boolean;
}

export const IosStatusBar: React.FC<IosStatusBarProps> = ({ isDark = false }) => {
  const [time, setTime] = useState<string>('');

  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      setTime(now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false }));
    };
    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className={`w-full px-6 pt-3 pb-1 flex justify-between items-center text-xs font-semibold select-none z-50 transition-colors ${
      isDark ? 'text-white' : 'text-slate-900'
    }`}>
      {/* Time */}
      <span className="tracking-tight text-[13px] font-medium">{time || '09:41'}</span>

      {/* Status Icons */}
      <div className="flex items-center gap-1.5">
        <Signal className="w-3.5 h-3.5 fill-current stroke-[2]" />
        <Wifi className="w-3.5 h-3.5 stroke-[2.5]" />
        <div className="flex items-center gap-0.5">
          <div className={`w-5 h-2.5 rounded-[3px] border p-[1px] flex items-center ${
            isDark ? 'border-white/60' : 'border-slate-800/60'
          }`}>
            <div className={`h-full w-[85%] rounded-[1.5px] ${isDark ? 'bg-white' : 'bg-slate-900'}`} />
          </div>
          <div className={`w-[1.5px] h-1 rounded-r-xs ${isDark ? 'bg-white/60' : 'bg-slate-800/60'}`} />
        </div>
      </div>
    </div>
  );
};
