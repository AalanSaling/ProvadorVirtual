// src/App.tsx
import React, { useState, useEffect } from 'react';
import { ClothingItem } from './types';
import { initialCatalog } from './data/catalog';
import { getProducts } from './lib/products';
import { ProvadorTab } from './components/tabs/ProvadorTab';
import { CatalogTab } from './components/tabs/CatalogTab';
import { SettingsTab } from './components/tabs/SettingsTab';
import { Sparkles, ShoppingBag, Settings, Shield } from 'lucide-react';

export function App() {
  const [activeTab, setActiveTab] = useState<'provador' | 'catalog' | 'settings'>('provador');
  const [catalog, setCatalog] = useState<ClothingItem[]>(initialCatalog);
  const [selectedGarment, setSelectedGarment] = useState<ClothingItem | null>(initialCatalog[0] || null);
  const [isDark, setIsDark] = useState<boolean>(true);

  const loadCatalog = async () => {
    try {
      const items = await getProducts();
      if (items && items.length > 0) {
        setCatalog(items);
        if (!selectedGarment) {
          setSelectedGarment(items[0]);
        }
      }
    } catch (e) {
      console.warn('Erro ao carregar catálogo remoto:', e);
    }
  };

  useEffect(() => {
    loadCatalog();
  }, []);

  return (
    <div className={`min-h-screen transition-colors duration-200 ${
      isDark ? 'bg-slate-950 text-slate-100' : 'bg-slate-50 text-slate-900'
    }`}>
      {/* Container Principal Mobile & Desktop */}
      <div className="max-w-xl mx-auto min-h-screen flex flex-col relative px-4 pt-4">
        {/* Main Content Area */}
        <main className="flex-1">
          {activeTab === 'provador' && (
            <ProvadorTab
              catalog={catalog}
              isDark={isDark}
              onNavigateToCatalog={() => setActiveTab('catalog')}
            />
          )}

          {activeTab === 'catalog' && (
            <CatalogTab
              catalog={catalog}
              selectedItem={selectedGarment}
              onSelectGarment={(item) => setSelectedGarment(item)}
              onRefreshCatalog={loadCatalog}
              onGoToProvador={() => setActiveTab('provador')}
              isDark={isDark}
            />
          )}

          {activeTab === 'settings' && (
            <SettingsTab
              isDark={isDark}
              onToggleTheme={() => setIsDark(!isDark)}
            />
          )}
        </main>

        {/* Floating Bottom Navigation Bar */}
        <nav className="fixed bottom-4 left-1/2 -translate-x-1/2 w-[calc(100%-2rem)] max-w-lg z-40">
          <div className={`p-2 rounded-3xl backdrop-blur-xl border shadow-2xl flex justify-around items-center ${
            isDark ? 'bg-slate-900/90 border-slate-800' : 'bg-white/90 border-slate-200'
          }`}>
            <button
              onClick={() => setActiveTab('provador')}
              className={`flex flex-col items-center gap-1 py-2 px-5 rounded-2xl transition-all ${
                activeTab === 'provador'
                  ? 'bg-blue-500 text-white shadow-lg shadow-blue-500/25 scale-105 font-black'
                  : isDark
                  ? 'text-slate-400 hover:text-white'
                  : 'text-slate-500 hover:text-slate-900'
              }`}
            >
              <Sparkles className="w-5 h-5" />
              <span className="text-[10px] font-bold">Provador</span>
            </button>

            <button
              onClick={() => setActiveTab('catalog')}
              className={`flex flex-col items-center gap-1 py-2 px-5 rounded-2xl transition-all ${
                activeTab === 'catalog'
                  ? 'bg-blue-500 text-white shadow-lg shadow-blue-500/25 scale-105 font-black'
                  : isDark
                  ? 'text-slate-400 hover:text-white'
                  : 'text-slate-500 hover:text-slate-900'
              }`}
            >
              <ShoppingBag className="w-5 h-5" />
              <span className="text-[10px] font-bold">Catálogo</span>
            </button>

            <button
              onClick={() => setActiveTab('settings')}
              className={`flex flex-col items-center gap-1 py-2 px-5 rounded-2xl transition-all ${
                activeTab === 'settings'
                  ? 'bg-blue-500 text-white shadow-lg shadow-blue-500/25 scale-105 font-black'
                  : isDark
                  ? 'text-slate-400 hover:text-white'
                  : 'text-slate-500 hover:text-slate-900'
              }`}
            >
              <Settings className="w-5 h-5" />
              <span className="text-[10px] font-bold">Ajustes</span>
            </button>
          </div>
        </nav>
      </div>
    </div>
  );
}

export default App;
