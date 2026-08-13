// src/components/tabs/ProvadorTab.tsx
import React, { useState } from 'react';
import { PhotoUpload } from '../PhotoUpload';
import { CatalogCard } from '../CatalogCard';
import { GenerationModal } from '../GenerationModal';
import { TryOnResultModal } from '../TryOnResultModal';
import { LgpdConsentModal } from '../LgpdConsentModal';
import { ClothingItem, GarmentCategory, SavedTryOn } from '../../types';
import { generateTryOn, mapGarmentCategory } from '../../lib/replicate';
import {
  addTryOnToHistory,
  getApiKey,
  getSavedUserPhoto,
  saveUserPhoto,
  removeSavedUserPhoto,
  hasUserConsentedLgpd,
  saveLgpdConsent,
} from '../../lib/storage';
import { Sparkles, Shirt, User, Sliders, History, ArrowRight, Wand2, Trash2, ShieldAlert } from 'lucide-react';

interface ProvadorTabProps {
  catalog: ClothingItem[];
  isDark: boolean;
  onNavigateToCatalog: () => void;
}

export const ProvadorTab: React.FC<ProvadorTabProps> = ({
  catalog,
  isDark,
  onNavigateToCatalog,
}) => {
  // State
  const [personImage, setPersonImage] = useState<string | null>(getSavedUserPhoto());
  const [selectedGarment, setSelectedGarment] = useState<ClothingItem | null>(catalog[0] || null);
  const [customGarmentImage, setCustomGarmentImage] = useState<string | null>(null);
  const [garmentCategory, setGarmentCategory] = useState<GarmentCategory>('upper_body');

  // LGPD & Modals
  const [showLgpdModal, setShowLgpdModal] = useState<boolean>(false);
  const [lgpdAccepted, setLgpdAccepted] = useState<boolean>(hasUserConsentedLgpd());

  // Generation & Modals
  const [isGenerating, setIsGenerating] = useState(false);
  const [statusText, setStatusText] = useState('');
  const [resultImage, setResultImage] = useState<string | null>(null);
  const [showResultModal, setShowResultModal] = useState(false);

  // Default sample model photos for quick testing
  const samplePersonPhotos = [
    {
      name: 'Modelo 1',
      url: 'https://images.pexels.com/photos/1036623/pexels-photo-1036623.jpeg?auto=compress&cs=tinysrgb&h=800&w=600',
    },
    {
      name: 'Modelo 2',
      url: 'https://images.pexels.com/photos/157675/fashion-men-s-individuality-black-and-white-157675.jpeg?auto=compress&cs=tinysrgb&h=800&w=600',
    },
    {
      name: 'Modelo 3',
      url: 'https://images.pexels.com/photos/220453/pexels-photo-220453.jpeg?auto=compress&cs=tinysrgb&h=800&w=600',
    },
  ];

  const activeGarmentImage = customGarmentImage || selectedGarment?.image || null;
  const activeGarmentName = customGarmentImage
    ? 'Sua Peça Personalizada'
    : selectedGarment?.name || 'Peça Selecionada';

  const handlePersonPhotoUpload = (dataUrl: string) => {
    setPersonImage(dataUrl);
    saveUserPhoto(dataUrl);
  };

  const handleDeleteUserPhoto = () => {
    removeSavedUserPhoto();
    setPersonImage(null);
  };

  const handleSelectGarment = (item: ClothingItem) => {
    setSelectedGarment(item);
    setCustomGarmentImage(null);
    setGarmentCategory(mapGarmentCategory(item.category));
  };

  const executeTryOnGeneration = async () => {
    if (!personImage) {
      alert('Por favor, envie ou selecione uma foto de uma pessoa primeiro.');
      return;
    }
    if (!activeGarmentImage) {
      alert('Por favor, escolha uma peça de roupa do catálogo ou envie uma imagem.');
      return;
    }

    setIsGenerating(true);
    setStatusText('Analisando silhueta da foto de forma segura...');

    setTimeout(() => setStatusText('Mapeando pontos da peça de roupa...'), 800);
    setTimeout(() => setStatusText('Ajustando caimento, dobras e textura com IA...'), 1600);

    const apiKey = getApiKey() || '';
    const res = await generateTryOn(apiKey, personImage, activeGarmentImage, garmentCategory);

    setIsGenerating(false);

    if (res.status === 'success' && res.output) {
      setResultImage(res.output);
      setShowResultModal(true);

      // Save to history
      const historyItem: SavedTryOn = {
        id: Date.now().toString(),
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        personImage,
        garmentImage: activeGarmentImage,
        garmentName: activeGarmentName,
        resultImage: res.output,
      };
      addTryOnToHistory(historyItem);
    } else {
      alert(res.error || 'Não foi possível gerar o provador. Tente novamente.');
    }
  };

  const handleGenerateClick = () => {
    if (!lgpdAccepted) {
      setShowLgpdModal(true);
      return;
    }
    executeTryOnGeneration();
  };

  return (
    <div className="space-y-5 pb-24 animate-in fade-in duration-300">
      {/* Header */}
      <div className={`p-5 rounded-3xl backdrop-blur-md shadow-sm border transition-all ${
        isDark ? 'bg-slate-800/80 border-slate-700/60 text-white' : 'bg-white/90 border-slate-200/80 text-slate-900'
      }`}>
        <div className="flex items-center gap-2.5 mb-1">
          <div className="w-8 h-8 rounded-2xl bg-gradient-to-tr from-blue-500 to-indigo-600 text-white flex items-center justify-center shadow-md shadow-blue-500/20">
            <Sparkles className="w-4 h-4" />
          </div>
          <div>
            <h1 className="text-xl font-black tracking-tight">Provador Virtual IA</h1>
            <p className="text-[11px] text-slate-400 font-medium">
              Sua foto permanece protegida e nunca é salva no servidor
            </p>
          </div>
        </div>
      </div>

      {/* Step 1: Person Photo Upload */}
      <div className={`p-5 rounded-3xl border shadow-sm ${
        isDark ? 'bg-slate-800/80 border-slate-700/60' : 'bg-white/90 border-slate-200/80'
      }`}>
        <div className="flex justify-between items-center mb-3">
          <div className="flex items-center gap-2">
            <span className="w-6 h-6 rounded-full bg-blue-500/10 text-blue-500 font-extrabold flex items-center justify-center text-xs">
              1
            </span>
            <h3 className={`text-sm font-bold ${isDark ? 'text-white' : 'text-slate-900'}`}>
              Sua Foto (Corpo Inteiro ou Busto)
            </h3>
          </div>
          {personImage && (
            <button
              onClick={handleDeleteUserPhoto}
              className="text-[11px] font-bold text-rose-500 flex items-center gap-1 hover:underline"
              title="Excluir minha foto permanentemente do dispositivo"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Excluir minha foto</span>
            </button>
          )}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 items-center">
          <PhotoUpload
            photoUri={personImage}
            onUpload={handlePersonPhotoUpload}
            onRemove={handleDeleteUserPhoto}
            label="Sua Foto"
            hint="Sua foto é processada apenas localmente e via IA"
            isDark={isDark}
          />

          {/* Quick sample models */}
          <div className="space-y-2">
            <p className={`text-[11px] font-bold ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>
              Ou experimente com fotos de amostra:
            </p>
            <div className="grid grid-cols-3 gap-2">
              {samplePersonPhotos.map((m, idx) => (
                <button
                  key={idx}
                  onClick={() => handlePersonPhotoUpload(m.url)}
                  className={`group relative rounded-xl overflow-hidden border aspect-[3/4] transition-all hover:scale-105 ${
                    personImage === m.url
                      ? 'ring-2 ring-blue-500 border-blue-500'
                      : isDark
                      ? 'border-slate-700'
                      : 'border-slate-200'
                  }`}
                >
                  <img src={m.url} alt={m.name} className="w-full h-full object-cover" />
                  <div className="absolute inset-x-0 bottom-0 bg-black/60 p-1 text-[9px] font-bold text-white text-center">
                    {m.name}
                  </div>
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Step 2: Choose Clothing Item */}
      <div className={`p-5 rounded-3xl border shadow-sm ${
        isDark ? 'bg-slate-800/80 border-slate-700/60' : 'bg-white/90 border-slate-200/80'
      }`}>
        <div className="flex justify-between items-center mb-3">
          <div className="flex items-center gap-2">
            <span className="w-6 h-6 rounded-full bg-blue-500/10 text-blue-500 font-extrabold flex items-center justify-center text-xs">
              2
            </span>
            <h3 className={`text-sm font-bold ${isDark ? 'text-white' : 'text-slate-900'}`}>
              Escolha a Roupa do Catálogo
            </h3>
          </div>
          <button
            onClick={onNavigateToCatalog}
            className="text-xs font-bold text-blue-500 flex items-center gap-1 hover:underline"
          >
            <span>Ver Tudo ({catalog.length})</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Selected item preview */}
        {selectedGarment && (
          <div className="mb-4 p-3 rounded-2xl bg-blue-500/10 border border-blue-500/30 flex items-center gap-3">
            <img
              src={selectedGarment.image}
              alt={selectedGarment.name}
              className="w-12 h-16 rounded-xl object-cover shrink-0"
            />
            <div className="flex-1 min-w-0">
              <span className="text-[10px] font-bold uppercase text-blue-500 tracking-wider">
                {selectedGarment.category}
              </span>
              <p className={`text-xs font-bold truncate ${isDark ? 'text-white' : 'text-slate-900'}`}>
                {selectedGarment.name}
              </p>
              <p className="text-[11px] font-semibold text-blue-500">
                {selectedGarment.price.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
              </p>
            </div>
          </div>
        )}

        {/* Horizontal Scroll of Catalog Items */}
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 max-h-80 overflow-y-auto pr-1">
          {catalog.slice(0, 6).map((item) => (
            <CatalogCard
              key={item.id}
              item={item}
              selected={selectedGarment?.id === item.id && !customGarmentImage}
              onSelect={() => handleSelectGarment(item)}
              isDark={isDark}
            />
          ))}
        </div>
      </div>

      {/* Step 3: Category & Try-On Action Button */}
      <div className={`p-5 rounded-3xl border shadow-sm ${
        isDark ? 'bg-slate-800/80 border-slate-700/60' : 'bg-white/90 border-slate-200/80'
      }`}>
        <div className="mb-4">
          <label className={`block text-xs font-bold mb-2 ${isDark ? 'text-white' : 'text-slate-900'}`}>
            3. Tipo de Peça de Roupa
          </label>
          <div className="grid grid-cols-3 gap-2">
            {[
              { id: 'upper_body' as GarmentCategory, label: 'Parte Superior' },
              { id: 'lower_body' as GarmentCategory, label: 'Parte Inferior' },
              { id: 'full_body' as GarmentCategory, label: 'Corpo Inteiro' },
            ].map((cat) => (
              <button
                key={cat.id}
                type="button"
                onClick={() => setGarmentCategory(cat.id)}
                className={`py-2.5 px-2 rounded-2xl text-[11px] font-bold text-center transition-all ${
                  garmentCategory === cat.id
                    ? 'bg-blue-500 text-white shadow-md'
                    : isDark
                    ? 'bg-slate-700/60 text-slate-300 hover:bg-slate-700'
                    : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                }`}
              >
                {cat.label}
              </button>
            ))}
          </div>
        </div>

        {/* MAIN GENERATE BUTTON */}
        <button
          onClick={handleGenerateClick}
          className="w-full py-4 px-6 bg-gradient-to-r from-blue-500 via-indigo-600 to-purple-600 hover:from-blue-600 hover:to-purple-700 text-white rounded-2xl font-extrabold text-sm flex items-center justify-center gap-2 shadow-xl shadow-blue-500/25 transition-all hover:scale-[1.01] active:scale-98"
        >
          <Wand2 className="w-5 h-5 animate-bounce" />
          <span>GERAR PROVADOR VIRTUAL COM IA</span>
        </button>
      </div>

      {/* Modals */}
      <LgpdConsentModal
        visible={showLgpdModal}
        onAccept={() => {
          saveLgpdConsent(true);
          setLgpdAccepted(true);
          setShowLgpdModal(false);
          executeTryOnGeneration();
        }}
        onDecline={() => {
          setShowLgpdModal(false);
          alert('Para utilizar o provador virtual com inteligência artificial é necessário aceitar os termos de privacidade.');
        }}
        isDark={isDark}
      />

      <GenerationModal
        visible={isGenerating}
        statusText={statusText}
        isDark={isDark}
      />

      <TryOnResultModal
        visible={showResultModal}
        resultImage={resultImage}
        personImage={personImage}
        garmentName={activeGarmentName}
        onClose={() => setShowResultModal(false)}
        onTryAnother={() => {
          setShowResultModal(false);
          onNavigateToCatalog();
        }}
        isDark={isDark}
      />
    </div>
  );
};
