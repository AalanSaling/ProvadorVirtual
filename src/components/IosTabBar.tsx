import React from 'react';
import { TabType } from '../types';
import { Sparkles, Shirt, Settings } from 'lucide-react';
import { motion } from 'motion/react';

interface IosTabBarProps {
  activeTab: TabType;
  setActiveTab: (tab: TabType) => void;
  isDark?: boolean;
}

export const IosTabBar: React.FC<IosTabBarProps> = ({ activeTab, setActiveTab, isDark = false }) => {
  const tabs = [
    { id: 'provador' as TabType, label: 'Provador', icon: Sparkles },
    { id: 'catalog' as TabType, label: 'Catálogo', icon: Shirt },
    { id: 'settings' as TabType, label: 'Ajustes', icon: Settings },
  ];

  return (
    <div className={`w-full fixed bottom-0 left-0 right-0 z-40 backdrop-blur-xl border-t transition-colors ${
      isDark ? 'bg-slate-900/85 border-slate-800 text-white' : 'bg-white/85 border-slate-200/80 text-slate-800'
    }`}>
      <div className="max-w-md mx-auto px-6 pt-2 pb-2 flex justify-around items-center">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;

          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className="relative flex flex-col items-center justify-center w-20 py-1 group focus:outline-none cursor-pointer"
            >
              {isActive && (
                <motion.div
                  layoutId="activeTabGlow"
                  className={`absolute inset-0 rounded-2xl ${
                    isDark ? 'bg-white/10' : 'bg-blue-500/10'
                  }`}
                  transition={{ type: 'spring', stiffness: 500, damping: 35 }}
                />
              )}
              <Icon
                className={`w-5 h-5 transition-transform duration-200 ${
                  isActive ? 'scale-110 text-blue-500' : isDark ? 'text-slate-400 group-hover:text-slate-200' : 'text-slate-400 group-hover:text-slate-600'
                }`}
              />
              <span
                className={`text-[10px] font-medium mt-1 tracking-tight transition-colors ${
                  isActive ? 'text-blue-500 font-bold' : isDark ? 'text-slate-400' : 'text-slate-500'
                }`}
              >
                {tab.label}
              </span>
            </button>
          );
        })}
      </div>

      {/* iOS Home Indicator Bar */}
      <div className="w-full flex justify-center pb-2">
        <div className={`w-32 h-1 rounded-full ${isDark ? 'bg-white/30' : 'bg-slate-300'}`} />
      </div>
    </div>
  );
};
