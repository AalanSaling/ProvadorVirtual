// src/components/ProductFormModal.tsx
import React, { useState, useEffect } from 'react';
import { View, Text, Modal, TextInput, TouchableOpacity, ScrollView, Image, StyleSheet } from 'react-native';
import { ClothingItem, Currency, GarmentCategory } from '../types';
import { usePhotoPicker } from '../hooks/usePhotoPicker';
import { X, Image as ImageIcon, Check, Sparkles } from 'lucide-react-native';

interface ProductFormModalProps {
  visible: boolean;
  initialProduct: ClothingItem | null;
  storeId: string;
  onSave: (product: ClothingItem, catalogBase64?: string, tryOnBase64?: string) => void;
  onClose: () => void;
  isDark?: boolean;
}

const CATEGORY_OPTIONS: { id: GarmentCategory; label: string }[] = [
  { id: 'upper_body', label: 'Parte Superior (Camisas, Blusas)' },
  { id: 'lower_body', label: 'Parte Inferior (Calças, Saias)' },
  { id: 'full_body', label: 'Corpo Inteiro (Vestidos, Macacões)' },
  { id: 'shoes', label: 'Calçados' },
  { id: 'accessories', label: 'Acessórios' },
];

const CURRENCY_OPTIONS: Currency[] = ['BRL', 'PYG', 'USD', 'EUR'];

export const ProductFormModal: React.FC<ProductFormModalProps> = ({
  visible,
  initialProduct,
  storeId,
  onSave,
  onClose,
  isDark = true,
}) => {
  const { pickFromGallery } = usePhotoPicker();

  const [name, setName] = useState('');
  const [category, setCategory] = useState<GarmentCategory>('full_body');
  const [garmentType, setGarmentType] = useState('Vestido');
  const [color, setColor] = useState('Preto');
  const [material, setMaterial] = useState('Algodão');
  const [fit, setFit] = useState('Regular');
  const [price, setPrice] = useState('');
  const [currency, setCurrency] = useState<Currency>('BRL');
  const [stock, setStock] = useState('10');
  const [sizesStr, setSizesStr] = useState('P, M, G');
  const [description, setDescription] = useState('');

  const [catalogImageUrl, setCatalogImageUrl] = useState('');
  const [catalogBase64, setCatalogBase64] = useState<string | undefined>(undefined);

  const [tryOnImageUrl, setTryOnImageUrl] = useState('');
  const [tryOnBase64, setTryOnBase64] = useState<string | undefined>(undefined);

  useEffect(() => {
    if (initialProduct) {
      setName(initialProduct.name);
      setCategory((initialProduct.category as GarmentCategory) || 'full_body');
      setGarmentType(initialProduct.garment_type || 'Vestido');
      setColor(initialProduct.color || '');
      setMaterial(initialProduct.material || '');
      setFit(initialProduct.fit || '');
      setPrice(initialProduct.price.toString());
      setCurrency(initialProduct.currency || 'BRL');
      setStock((initialProduct.stock ?? 10).toString());
      setSizesStr(initialProduct.sizes ? initialProduct.sizes.join(', ') : 'P, M, G');
      setDescription(initialProduct.description || '');
      setCatalogImageUrl(initialProduct.image || '');
      setTryOnImageUrl(initialProduct.try_on_reference_image || initialProduct.image || '');
    } else {
      setName('');
      setCategory('full_body');
      setGarmentType('Vestido');
      setColor('Preto');
      setMaterial('Seda');
      setFit('Ajustado');
      setPrice('299.00');
      setCurrency('BRL');
      setStock('10');
      setSizesStr('P, M, G');
      setDescription('Peça elegante com caimento perfeito.');
      const defaultImg = 'https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?w=800';
      setCatalogImageUrl(defaultImg);
      setTryOnImageUrl(defaultImg);
    }
  }, [initialProduct, visible]);

  if (!visible) return null;

  const handlePickCatalogImage = async () => {
    const res = await pickFromGallery();
    if (res?.base64 || res?.uri) {
      const src = res.base64 ? `data:image/jpeg;base64,${res.base64}` : res.uri;
      setCatalogImageUrl(src);
      setCatalogBase64(res.base64 ? `data:image/jpeg;base64,${res.base64}` : undefined);
      if (!tryOnImageUrl || tryOnImageUrl === catalogImageUrl) {
        setTryOnImageUrl(src);
        setTryOnBase64(res.base64 ? `data:image/jpeg;base64,${res.base64}` : undefined);
      }
    }
  };

  const handlePickTryOnImage = async () => {
    const res = await pickFromGallery();
    if (res?.base64 || res?.uri) {
      const src = res.base64 ? `data:image/jpeg;base64,${res.base64}` : res.uri;
      setTryOnImageUrl(src);
      setTryOnBase64(res.base64 ? `data:image/jpeg;base64,${res.base64}` : undefined);
    }
  };

  const handleSubmit = () => {
    if (!name.trim() || !price.trim()) {
      alert('Por favor, informe o nome e o preço do produto.');
      return;
    }

    if (!tryOnImageUrl) {
      alert('Atenção: É necessário definir uma foto de referência para o Provador IA.');
      return;
    }

    const sizesArr = sizesStr
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);

    const itemToSave: ClothingItem = {
      id: initialProduct ? initialProduct.id : Date.now().toString(),
      store_id: storeId,
      name: name.trim(),
      category,
      garment_type: garmentType.trim(),
      color: color.trim(),
      material: material.trim(),
      fit: fit.trim(),
      price: parseFloat(price) || 0,
      currency,
      sizes: sizesArr.length > 0 ? sizesArr : ['P', 'M', 'G'],
      stock: parseInt(stock, 10) || 0,
      active: true,
      description: description.trim(),
      image: catalogImageUrl,
      try_on_reference_image: tryOnImageUrl,
    };

    onSave(itemToSave, catalogBase64, tryOnBase64);
  };

  const cardBg = isDark ? '#0f172a' : '#ffffff';
  const textColor = isDark ? '#f8fafc' : '#0f172a';
  const subTextColor = isDark ? '#94a3b8' : '#64748b';
  const inputBg = isDark ? '#1e293b' : '#f1f5f9';
  const boxBorder = isDark ? '#334155' : '#e2e8f0';

  return (
    <Modal visible={visible} transparent animationType="slide">
      <View style={styles.overlay}>
        <View style={[styles.card, { backgroundColor: cardBg }]}>
          <View style={styles.header}>
            <Text style={[styles.title, { color: textColor }]}>
              {initialProduct ? 'Editar Peça do Catálogo' : 'Cadastrar Nova Peça'}
            </Text>
            <TouchableOpacity onPress={onClose}>
              <X color={subTextColor} size={22} />
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.formScroll} showsVerticalScrollIndicator={false}>
            {/* Catalog & Try-On Photos */}
            <View style={styles.photosGrid}>
              {/* Catalog Photo */}
              <View style={[styles.photoBox, { borderColor: boxBorder }]}>
                <Text style={[styles.label, { color: textColor }]}>1. Foto do Catálogo (Pública)</Text>
                {catalogImageUrl ? (
                  <Image source={{ uri: catalogImageUrl }} style={styles.previewImg} resizeMode="cover" />
                ) : null}
                <TouchableOpacity onPress={handlePickCatalogImage} style={styles.pickBtn}>
                  <ImageIcon color="#ffffff" size={14} />
                  <Text style={styles.pickBtnText}>Galeria Catálogo</Text>
                </TouchableOpacity>
              </View>

              {/* Try-On Reference Photo */}
              <View style={[styles.photoBox, { borderColor: '#3b82f6' }]}>
                <View style={styles.aiLabelRow}>
                  <Sparkles color="#3b82f6" size={14} />
                  <Text style={[styles.label, { color: '#3b82f6' }]}>2. Referência Provador IA</Text>
                </View>
                {tryOnImageUrl ? (
                  <Image source={{ uri: tryOnImageUrl }} style={styles.previewImg} resizeMode="cover" />
                ) : null}
                <TouchableOpacity onPress={handlePickTryOnImage} style={[styles.pickBtn, { backgroundColor: '#3b82f6' }]}>
                  <ImageIcon color="#ffffff" size={14} />
                  <Text style={styles.pickBtnText}>Galeria Ref. IA</Text>
                </TouchableOpacity>
              </View>
            </View>

            {/* Product Name */}
            <View style={styles.fieldGroup}>
              <Text style={[styles.label, { color: textColor }]}>Nome do Produto</Text>
              <TextInput
                value={name}
                onChangeText={setName}
                placeholder="Ex: Vestido Midi de Seda"
                placeholderTextColor={subTextColor}
                style={[styles.input, { backgroundColor: inputBg, color: textColor }]}
              />
            </View>

            {/* Category */}
            <View style={styles.fieldGroup}>
              <Text style={[styles.label, { color: textColor }]}>Categoria no Provador</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.catScroll}>
                {CATEGORY_OPTIONS.map((cat) => {
                  const isSel = category === cat.id;
                  return (
                    <React.Fragment key={cat.id}>
                      <TouchableOpacity
                        onPress={() => setCategory(cat.id)}
                        style={[
                          styles.catPill,
                          { backgroundColor: isSel ? '#3b82f6' : isDark ? '#1e293b' : '#f1f5f9' },
                        ]}
                      >
                        <Text style={[styles.catPillText, { color: isSel ? '#ffffff' : subTextColor }]}>
                          {cat.label}
                        </Text>
                      </TouchableOpacity>
                    </React.Fragment>
                  );
                })}
              </ScrollView>
            </View>

            {/* Currency & Price */}
            <View style={styles.rowTwo}>
              <View style={[styles.fieldGroup, { flex: 1 }]}>
                <Text style={[styles.label, { color: textColor }]}>Moeda</Text>
                <View style={styles.currencyRow}>
                  {CURRENCY_OPTIONS.map((curr) => (
                    <React.Fragment key={curr}>
                      <TouchableOpacity
                        onPress={() => setCurrency(curr)}
                        style={[
                          styles.currencyBtn,
                          { backgroundColor: currency === curr ? '#3b82f6' : isDark ? '#1e293b' : '#f1f5f9' },
                        ]}
                      >
                        <Text style={[styles.currencyText, { color: currency === curr ? '#ffffff' : subTextColor }]}>
                          {curr}
                        </Text>
                      </TouchableOpacity>
                    </React.Fragment>
                  ))}
                </View>
              </View>

              <View style={[styles.fieldGroup, { flex: 1 }]}>
                <Text style={[styles.label, { color: textColor }]}>Preço ({currency})</Text>
                <TextInput
                  value={price}
                  onChangeText={setPrice}
                  keyboardType="numeric"
                  placeholder="299.00"
                  placeholderTextColor={subTextColor}
                  style={[styles.input, { backgroundColor: inputBg, color: textColor }]}
                />
              </View>
            </View>

            {/* Garment Type, Color, Material */}
            <View style={styles.rowThree}>
              <View style={[styles.fieldGroup, { flex: 1 }]}>
                <Text style={[styles.label, { color: textColor }]}>Tipo de Peça</Text>
                <TextInput
                  value={garmentType}
                  onChangeText={setGarmentType}
                  placeholder="Vestido / Camisa"
                  placeholderTextColor={subTextColor}
                  style={[styles.input, { backgroundColor: inputBg, color: textColor }]}
                />
              </View>

              <View style={[styles.fieldGroup, { flex: 1 }]}>
                <Text style={[styles.label, { color: textColor }]}>Cor</Text>
                <TextInput
                  value={color}
                  onChangeText={setColor}
                  placeholder="Preto / Azul"
                  placeholderTextColor={subTextColor}
                  style={[styles.input, { backgroundColor: inputBg, color: textColor }]}
                />
              </View>

              <View style={[styles.fieldGroup, { flex: 1 }]}>
                <Text style={[styles.label, { color: textColor }]}>Material</Text>
                <TextInput
                  value={material}
                  onChangeText={setMaterial}
                  placeholder="Seda / Algodão"
                  placeholderTextColor={subTextColor}
                  style={[styles.input, { backgroundColor: inputBg, color: textColor }]}
                />
              </View>
            </View>

            {/* Sizes & Stock */}
            <View style={styles.rowTwo}>
              <View style={[styles.fieldGroup, { flex: 2 }]}>
                <Text style={[styles.label, { color: textColor }]}>Tamanhos (separados por vírgula)</Text>
                <TextInput
                  value={sizesStr}
                  onChangeText={setSizesStr}
                  placeholder="P, M, G, GG"
                  placeholderTextColor={subTextColor}
                  style={[styles.input, { backgroundColor: inputBg, color: textColor }]}
                />
              </View>

              <View style={[styles.fieldGroup, { flex: 1 }]}>
                <Text style={[styles.label, { color: textColor }]}>Estoque</Text>
                <TextInput
                  value={stock}
                  onChangeText={setStock}
                  keyboardType="numeric"
                  placeholder="10"
                  placeholderTextColor={subTextColor}
                  style={[styles.input, { backgroundColor: inputBg, color: textColor }]}
                />
              </View>
            </View>

            {/* Description */}
            <View style={styles.fieldGroup}>
              <Text style={[styles.label, { color: textColor }]}>Descrição</Text>
              <TextInput
                value={description}
                onChangeText={setDescription}
                multiline
                numberOfLines={3}
                placeholder="Detalhes sobre o modelo, caimento e tecidos..."
                placeholderTextColor={subTextColor}
                style={[styles.input, styles.multiline, { backgroundColor: inputBg, color: textColor }]}
              />
            </View>
          </ScrollView>

          <View style={styles.actions}>
            <TouchableOpacity
              activeOpacity={0.8}
              onPress={handleSubmit}
              style={[styles.saveBtn, { backgroundColor: '#3b82f6' }]}
            >
              <Check color="#ffffff" size={18} />
              <Text style={styles.saveBtnText}>Salvar no Catálogo da Loja</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
    justifyContent: 'flex-end',
  },
  card: {
    width: '100%',
    maxHeight: '92%',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    padding: 20,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  title: {
    fontSize: 18,
    fontWeight: '800',
  },
  formScroll: {
    marginBottom: 12,
  },
  fieldGroup: {
    marginBottom: 12,
  },
  label: {
    fontSize: 11,
    fontWeight: '700',
    marginBottom: 4,
  },
  input: {
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 12,
  },
  multiline: {
    height: 60,
    textAlignVertical: 'top',
  },
  photosGrid: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 12,
  },
  photoBox: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 16,
    padding: 10,
    gap: 6,
  },
  aiLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  previewImg: {
    width: '100%',
    height: 100,
    borderRadius: 12,
  },
  pickBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    borderRadius: 10,
    backgroundColor: '#0f172a',
    gap: 6,
  },
  pickBtnText: {
    color: '#ffffff',
    fontSize: 10,
    fontWeight: '700',
  },
  catScroll: {
    flexDirection: 'row',
  },
  catPill: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    marginRight: 6,
  },
  catPillText: {
    fontSize: 11,
    fontWeight: '700',
  },
  rowTwo: {
    flexDirection: 'row',
    gap: 10,
  },
  rowThree: {
    flexDirection: 'row',
    gap: 8,
  },
  currencyRow: {
    flexDirection: 'row',
    gap: 4,
  },
  currencyBtn: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 10,
    alignItems: 'center',
  },
  currencyText: {
    fontSize: 11,
    fontWeight: '800',
  },
  actions: {
    paddingTop: 8,
  },
  saveBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderRadius: 16,
    gap: 8,
  },
  saveBtnText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '800',
  },
});
