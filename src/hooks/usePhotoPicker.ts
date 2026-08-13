// src/hooks/usePhotoPicker.ts
import { useState } from 'react';
import * as ImagePicker from 'expo-image-picker';
import * as ImageManipulator from 'expo-image-manipulator';

export interface PhotoPickerResult {
  uri: string;
  base64?: string;
}

export function usePhotoPicker() {
  const [loading, setLoading] = useState(false);

  // Redimensionar e comprimir foto mantendo qualidade adequada para IA
  const compressImage = async (uri: string): Promise<PhotoPickerResult> => {
    try {
      const result = await ImageManipulator.manipulateAsync(
        uri,
        [{ resize: { width: 1080 } }],
        { compress: 0.8, format: ImageManipulator.SaveFormat.JPEG, base64: true }
      );
      return {
        uri: result.uri,
        base64: result.base64 ? `data:image/jpeg;base64,${result.base64}` : undefined,
      };
    } catch (e) {
      console.warn('Falha na manipulação de imagem, usando original:', e);
      return { uri };
    }
  };

  // Abrir galeria do dispositivo
  const pickFromGallery = async (): Promise<PhotoPickerResult | null> => {
    setLoading(true);
    try {
      const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permission.granted) {
        alert('É necessária permissão para acessar a galeria de fotos.');
        setLoading(false);
        return null;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [3, 4],
        quality: 0.8,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        const selected = result.assets[0];
        const compressed = await compressImage(selected.uri);
        setLoading(false);
        return compressed;
      }
    } catch (e) {
      console.error('Erro ao escolher imagem da galeria:', e);
    }
    setLoading(false);
    return null;
  };

  // Tirar foto com a câmera do dispositivo
  const takePhotoWithCamera = async (): Promise<PhotoPickerResult | null> => {
    setLoading(true);
    try {
      const permission = await ImagePicker.requestCameraPermissionsAsync();
      if (!permission.granted) {
        alert('É necessária permissão para usar a câmera do aparelho.');
        setLoading(false);
        return null;
      }

      const result = await ImagePicker.launchCameraAsync({
        allowsEditing: true,
        aspect: [3, 4],
        quality: 0.8,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        const photo = result.assets[0];
        const compressed = await compressImage(photo.uri);
        setLoading(false);
        return compressed;
      }
    } catch (e) {
      console.error('Erro ao capturar foto com a câmera:', e);
    }
    setLoading(false);
    return null;
  };

  return {
    pickFromGallery,
    takePhotoWithCamera,
    loading,
  };
}
