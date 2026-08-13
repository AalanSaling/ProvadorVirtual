import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, Upload, Plus, Check, ImageIcon } from 'lucide-react';
import { ClothingItem } from '../types';
import { categories } from '../data/catalog';

interface ProductFormModalProps {
  visible: boolean;
  initialProduct?: ClothingItem | null;
  onSave: (product: ClothingItem) => void;
  onClose: () => void;
  isDark?: boolean;
}

export const ProductFormModal: React.FC<ProductFormModalProps> = ({
  visible,
  initialProduct,
  onSave,
  onClose,
  isDark = false,
}) => {
  const [name, setName] = useState('');
  const [category, setCategory] = useState(categories[1] || 'Vestidos');
  const [price, setPrice] = useState('');
  const [description, setDescription] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [selectedSizes, setSelectedSizes] = useState<string[]>(['P', 'M', 'G']);
  const [stock, setStock] = useState('10');

  const availableSizes = ['PP', 'P', 'M', 'G', 'GG', 'XG'];

  useEffect(() => {
    if (initialProduct) {
      setName(initialProduct.name);
      setCategory(initialProduct.category);
      setPrice(initialProduct.price.toString());
      setDescription(initialProduct.description);
      setImageUrl(initialProduct.image);
      setSelectedSizes(initialProduct.sizes || ['P', 'M', 'G']);
      setStock((initialProduct.stock || 10).toString());
    } else {
      setName('');
      setCategory('Vestidos');
      setPrice('199');
      setDescription('');
      setImageUrl('https://images.pexels.com/photos/19895958/pexels-photo-19895958.jpeg?auto=compress&cs=tinysrgb&h=650&w=940');
      setSelectedSizes(['P', 'M', 'G']);
      setStock('10');
    }
  }, [initialProduct, visible]);

  if (!visible) return null;

  const toggleSize = (size: string) => {
    if (selectedSizes.includes(size)) {
      setSelectedSizes(selectedSizes.filter((s) => s !== size));
    } else {
      setSelectedSizes([...selectedSizes, size]);
    }
  };

  const handleImageFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setImageUrl(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !price) return;

    const numPrice = parseFloat(price.replace(',', '.')) || 0;
    const numStock = parseInt(stock, 10) || 1;

    const productToSave: ClothingItem = {
      id: initialProduct ? initialProduct.id : Date.now().toString(),
      name: name.trim(),
      category,
      price: numPrice,
      description: description.trim() || 'Peça de roupa para provador virtual',
      image: imageUrl || 'https://images.pexels.com/photos/19895958/pexels-photo-19895958.jpeg?auto=compress&cs=tinysrgb&h=650&w=940',
      sizes: selectedSizes,
      stock: numStock,
    };

    onSave(productToSave);
  };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm overflow-y-auto">
        <motion.div
          initial={{ scale: 0.95, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.95, opacity: 0 }}
          className={`w-full max-w-lg rounded-3xl p-6 shadow-2xl border my-auto max-h-[90vh] overflow-y-auto ${
            isDark ? 'bg-slate-900 border-slate-800 text-white' : 'bg-white border-slate-100 text-slate-900'
          }`}
        >
          {/* Header */}
          <div className="flex justify-between items-center mb-5 pb-3 border-b border-slate-200/50 dark:border-slate-800">
            <h3 className="text-base font-extrabold tracking-tight">
              {initialProduct ? 'Editar Peça do Catálogo' : 'Adicionar Nova Peça de Roupa'}
            </h3>
            <button
              onClick={onClose}
              className="p-1.5 rounded-full hover:bg-slate-500/20 text-slate-400 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4 text-xs">
            {/* Image Preview & Upload */}
            <div>
              <label className="block font-bold mb-1.5">Foto do Produto</label>
              <div className="flex gap-3 items-center">
                <div className="w-20 h-24 rounded-2xl overflow-hidden bg-slate-100 dark:bg-slate-800 border flex shrink-0 items-center justify-center">
                  {imageUrl ? (
                    <img src={imageUrl} alt="Preview" className="w-full h-full object-cover" />
                  ) : (
                    <ImageIcon className="w-8 h-8 text-slate-400" />
                  )}
                </div>
                <div className="flex-1 space-y-2">
                  <input
                    type="text"
                    value={imageUrl}
                    onChange={(e) => setImageUrl(e.target.value)}
                    placeholder="URL da imagem (http...)"
                    className={`w-full p-2.5 rounded-xl border focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                      isDark ? 'bg-slate-800 border-slate-700 text-white' : 'bg-slate-50 border-slate-200'
                    }`}
                  />
                  <label className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-500/10 text-blue-500 font-bold rounded-xl cursor-pointer hover:bg-blue-500/20 transition-colors">
                    <Upload className="w-3.5 h-3.5" />
                    <span>Upload da imagem</span>
                    <input type="file" accept="image/*" onChange={handleImageFile} className="hidden" />
                  </label>
                </div>
              </div>
            </div>

            {/* Name */}
            <div>
              <label className="block font-bold mb-1">Nome da Peça *</label>
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Ex: Vestido Festa Seda"
                className={`w-full p-3 rounded-xl border focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                  isDark ? 'bg-slate-800 border-slate-700 text-white' : 'bg-slate-50 border-slate-200'
                }`}
              />
            </div>

            {/* Category & Price */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block font-bold mb-1">Categoria</label>
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  className={`w-full p-3 rounded-xl border focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                    isDark ? 'bg-slate-800 border-slate-700 text-white' : 'bg-slate-50 border-slate-200'
                  }`}
                >
                  {categories.filter((c) => c !== 'Todos').map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block font-bold mb-1">Preço (R$) *</label>
                <input
                  type="number"
                  step="0.01"
                  required
                  value={price}
                  onChange={(e) => setPrice(e.target.value)}
                  placeholder="299.00"
                  className={`w-full p-3 rounded-xl border focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                    isDark ? 'bg-slate-800 border-slate-700 text-white' : 'bg-slate-50 border-slate-200'
                  }`}
                />
              </div>
            </div>

            {/* Sizes */}
            <div>
              <label className="block font-bold mb-1.5">Tamanhos Disponíveis</label>
              <div className="flex flex-wrap gap-2">
                {availableSizes.map((size) => {
                  const isSelected = selectedSizes.includes(size);
                  return (
                    <button
                      type="button"
                      key={size}
                      onClick={() => toggleSize(size)}
                      className={`px-3 py-1.5 rounded-xl font-bold transition-all ${
                        isSelected
                          ? 'bg-blue-500 text-white shadow-xs'
                          : isDark
                          ? 'bg-slate-800 border border-slate-700 text-slate-400'
                          : 'bg-slate-100 border border-slate-200 text-slate-600'
                      }`}
                    >
                      {size}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Description */}
            <div>
              <label className="block font-bold mb-1">Descrição</label>
              <textarea
                rows={2}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Detalhes sobre tecido, caimento e estilo..."
                className={`w-full p-3 rounded-xl border focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none ${
                  isDark ? 'bg-slate-800 border-slate-700 text-white' : 'bg-slate-50 border-slate-200'
                }`}
              />
            </div>

            {/* Action Buttons */}
            <div className="pt-3 flex gap-2">
              <button
                type="submit"
                className="flex-1 py-3 bg-blue-500 text-white rounded-2xl font-bold hover:bg-blue-600 transition-colors shadow-lg shadow-blue-500/20"
              >
                Salvar no Catálogo
              </button>
              <button
                type="button"
                onClick={onClose}
                className={`px-5 py-3 rounded-2xl font-bold transition-colors ${
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
