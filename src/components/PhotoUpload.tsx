// src/components/PhotoUpload.tsx
import React, { useState } from 'react';
import { View, Text, Image, TouchableOpacity, Modal, StyleSheet, ActivityIndicator } from 'react-native';
import { usePhotoPicker } from '../hooks/usePhotoPicker';
import { Camera, Image as ImageIcon, Trash2, Check, RefreshCw, X, User } from 'lucide-react-native';

interface PhotoUploadProps {
  photoUri: string | null;
  onUpload: (uri: string) => void;
  onRemove: () => void;
  label?: string;
  hint?: string;
  isDark?: boolean;
}

export const PhotoUpload: React.FC<PhotoUploadProps> = ({
  photoUri,
  onUpload,
  onRemove,
  label = 'Sua Foto',
  hint = 'Sua foto é processada apenas localmente e via IA',
  isDark = true,
}) => {
  const { pickFromGallery, takePhotoWithCamera, loading } = usePhotoPicker();
  const [modalVisible, setModalVisible] = useState(false);
  const [previewUri, setPreviewUri] = useState<string | null>(null);

  const cardBg = isDark ? '#1e293b' : '#ffffff';
  const textColor = isDark ? '#f8fafc' : '#0f172a';
  const subTextColor = isDark ? '#94a3b8' : '#64748b';
  const borderColor = isDark ? '#334155' : '#e2e8f0';

  const handlePickGallery = async () => {
    const res = await pickFromGallery();
    if (res?.uri) {
      setPreviewUri(res.uri);
      setModalVisible(true);
    }
  };

  const handleTakePhoto = async () => {
    const res = await takePhotoWithCamera();
    if (res?.uri) {
      setPreviewUri(res.uri);
      setModalVisible(true);
    }
  };

  const handleConfirmPhoto = () => {
    if (previewUri) {
      onUpload(previewUri);
      setPreviewUri(null);
      setModalVisible(false);
    }
  };

  return (
    <View style={styles.container}>
      {photoUri ? (
        <View style={[styles.photoCard, { backgroundColor: cardBg, borderColor }]}>
          <Image source={{ uri: photoUri }} style={styles.previewImage} resizeMode="cover" />
          
          <View style={styles.actionRow}>
            <TouchableOpacity
              activeOpacity={0.8}
              onPress={handlePickGallery}
              style={[styles.actionBtn, { backgroundColor: '#3b82f6' }]}
            >
              <RefreshCw color="#ffffff" size={14} />
              <Text style={styles.actionBtnText}>Substituir</Text>
            </TouchableOpacity>

            <TouchableOpacity
              activeOpacity={0.8}
              onPress={onRemove}
              style={[styles.actionBtn, { backgroundColor: 'rgba(239, 68, 68, 0.15)' }]}
            >
              <Trash2 color="#ef4444" size={14} />
              <Text style={[styles.actionBtnText, { color: '#ef4444' }]}>Excluir</Text>
            </TouchableOpacity>
          </View>
        </View>
      ) : (
        <View style={[styles.uploadBox, { backgroundColor: cardBg, borderColor }]}>
          <View style={styles.iconCircle}>
            <User color="#3b82f6" size={28} />
          </View>
          <Text style={[styles.labelTitle, { color: textColor }]}>{label}</Text>
          <Text style={[styles.hintText, { color: subTextColor }]}>{hint}</Text>

          {loading ? (
            <ActivityIndicator color="#3b82f6" style={{ marginTop: 12 }} />
          ) : (
            <View style={styles.buttonRow}>
              <TouchableOpacity
                activeOpacity={0.8}
                onPress={handleTakePhoto}
                style={[styles.pickerButton, { backgroundColor: '#3b82f6' }]}
              >
                <Camera color="#ffffff" size={16} />
                <Text style={styles.pickerButtonText}>Tirar Foto</Text>
              </TouchableOpacity>

              <TouchableOpacity
                activeOpacity={0.8}
                onPress={handlePickGallery}
                style={[
                  styles.pickerButton,
                  { backgroundColor: isDark ? '#334155' : '#f1f5f9' },
                ]}
              >
                <ImageIcon color={isDark ? '#93c5fd' : '#2563eb'} size={16} />
                <Text style={[styles.pickerButtonText, { color: isDark ? '#93c5fd' : '#2563eb' }]}>
                  Galeria
                </Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
      )}

      {/* MODAL PREVIEW E CONFIRMAÇÃO DA FOTO */}
      <Modal visible={modalVisible} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={[styles.modalCard, { backgroundColor: isDark ? '#0f172a' : '#ffffff' }]}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: textColor }]}>Confirmar Foto de Corpo</Text>
              <TouchableOpacity onPress={() => setModalVisible(false)}>
                <X color={subTextColor} size={20} />
              </TouchableOpacity>
            </View>

            {previewUri && (
              <Image source={{ uri: previewUri }} style={styles.confirmPreview} resizeMode="cover" />
            )}

            <Text style={[styles.confirmHint, { color: subTextColor }]}>
              Certifique-se de que a foto mostra o corpo/busto de forma clara para o provador.
            </Text>

            <View style={styles.confirmActions}>
              <TouchableOpacity
                activeOpacity={0.8}
                onPress={handleConfirmPhoto}
                style={[styles.confirmBtn, { backgroundColor: '#10b981' }]}
              >
                <Check color="#ffffff" size={18} />
                <Text style={styles.confirmBtnText}>Confirmar e Usar Foto</Text>
              </TouchableOpacity>

              <TouchableOpacity
                activeOpacity={0.8}
                onPress={() => setModalVisible(false)}
                style={[styles.cancelBtn, { backgroundColor: isDark ? '#334155' : '#e2e8f0' }]}
              >
                <Text style={[styles.cancelBtnText, { color: textColor }]}>Cancelar</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginVertical: 4,
  },
  photoCard: {
    borderRadius: 20,
    overflow: 'hidden',
    borderWidth: 1,
    padding: 8,
  },
  previewImage: {
    width: '100%',
    height: 240,
    borderRadius: 16,
  },
  actionRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 8,
  },
  actionBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    borderRadius: 12,
    gap: 6,
  },
  actionBtnText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '700',
  },
  uploadBox: {
    borderRadius: 20,
    borderWidth: 1,
    borderStyle: 'dashed',
    padding: 16,
    alignItems: 'center',
  },
  iconCircle: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: 'rgba(59, 130, 246, 0.12)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  labelTitle: {
    fontSize: 14,
    fontWeight: '800',
    marginBottom: 2,
  },
  hintText: {
    fontSize: 11,
    textAlign: 'center',
    marginBottom: 12,
  },
  buttonRow: {
    flexDirection: 'row',
    gap: 8,
    width: '100%',
  },
  pickerButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    borderRadius: 14,
    gap: 6,
  },
  pickerButtonText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '700',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalCard: {
    width: '100%',
    maxWidth: 380,
    borderRadius: 24,
    padding: 20,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: '800',
  },
  confirmPreview: {
    width: '100%',
    height: 280,
    borderRadius: 16,
    marginBottom: 12,
  },
  confirmHint: {
    fontSize: 11,
    textAlign: 'center',
    marginBottom: 16,
  },
  confirmActions: {
    gap: 8,
  },
  confirmBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: 14,
    gap: 8,
  },
  confirmBtnText: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '800',
  },
  cancelBtn: {
    paddingVertical: 10,
    borderRadius: 14,
    alignItems: 'center',
  },
  cancelBtnText: {
    fontSize: 12,
    fontWeight: '700',
  },
});
