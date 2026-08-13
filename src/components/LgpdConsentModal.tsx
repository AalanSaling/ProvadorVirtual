// src/components/LgpdConsentModal.tsx
import React from 'react';
import { View, Text, Modal, TouchableOpacity, StyleSheet } from 'react-native';
import { ShieldCheck, Lock, EyeOff, AlertTriangle } from 'lucide-react-native';

interface LgpdConsentModalProps {
  visible: boolean;
  onAccept: () => void;
  onDecline: () => void;
  isDark?: boolean;
}

export const LgpdConsentModal: React.FC<LgpdConsentModalProps> = ({
  visible,
  onAccept,
  onDecline,
  isDark = true,
}) => {
  if (!visible) return null;

  const cardBg = isDark ? '#0f172a' : '#ffffff';
  const textColor = isDark ? '#f8fafc' : '#0f172a';
  const subTextColor = isDark ? '#94a3b8' : '#64748b';
  const boxBg = isDark ? '#1e293b' : '#f8fafc';

  return (
    <Modal visible={visible} transparent animationType="fade">
      <View style={styles.overlay}>
        <View style={[styles.card, { backgroundColor: cardBg }]}>
          <View style={styles.iconCircle}>
            <ShieldCheck color="#10b981" size={32} />
          </View>

          <Text style={[styles.title, { color: textColor }]}>
            Privacidade & Proteção de Dados (LGPD)
          </Text>

          <Text style={[styles.description, { color: subTextColor }]}>
            A sua foto de corpo é tratada com total sigilo. Para prosseguir com o Provador Virtual, confirme sua concordância com os termos:
          </Text>

          <View style={[styles.infoBox, { backgroundColor: boxBg }]}>
            <View style={styles.infoRow}>
              <Lock color="#10b981" size={16} />
              <Text style={[styles.infoText, { color: textColor }]}>
                <Text style={styles.boldText}>Sem Armazenamento Público: </Text>
                Sua foto fica no seu dispositivo e não é pública.
              </Text>
            </View>

            <View style={styles.infoRow}>
              <EyeOff color="#3b82f6" size={16} />
              <Text style={[styles.infoText, { color: textColor }]}>
                <Text style={styles.boldText}>Processamento Seguro: </Text>
                Transmissão criptografada diretamente para serviços autorizados de IA.
              </Text>
            </View>

            <View style={styles.infoRow}>
              <AlertTriangle color="#f59e0b" size={16} />
              <Text style={[styles.infoText, { color: textColor }]}>
                <Text style={styles.boldText}>Controle Total: </Text>
                Você pode apagar sua foto a qualquer momento nas configurações.
              </Text>
            </View>
          </View>

          <View style={styles.actions}>
            <TouchableOpacity
              activeOpacity={0.8}
              onPress={onAccept}
              style={[styles.acceptBtn, { backgroundColor: '#10b981' }]}
            >
              <Text style={styles.acceptBtnText}>Concordar e Usar o Provador</Text>
            </TouchableOpacity>

            <TouchableOpacity
              activeOpacity={0.8}
              onPress={onDecline}
              style={styles.declineBtn}
            >
              <Text style={[styles.declineBtnText, { color: subTextColor }]}>
                Recusar (Apenas Catálogo)
              </Text>
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
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  card: {
    width: '100%',
    maxWidth: 380,
    borderRadius: 24,
    padding: 20,
    alignItems: 'center',
  },
  iconCircle: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: 'rgba(16, 185, 129, 0.12)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  title: {
    fontSize: 16,
    fontWeight: '800',
    textAlign: 'center',
    marginBottom: 8,
  },
  description: {
    fontSize: 12,
    textAlign: 'center',
    lineHeight: 18,
    marginBottom: 16,
  },
  infoBox: {
    width: '100%',
    borderRadius: 16,
    padding: 12,
    gap: 10,
    marginBottom: 18,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
  },
  infoText: {
    fontSize: 11,
    flex: 1,
    lineHeight: 16,
  },
  boldText: {
    fontWeight: '800',
  },
  actions: {
    width: '100%',
    gap: 8,
  },
  acceptBtn: {
    width: '100%',
    paddingVertical: 14,
    borderRadius: 16,
    alignItems: 'center',
  },
  acceptBtnText: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '800',
  },
  declineBtn: {
    paddingVertical: 10,
    alignItems: 'center',
  },
  declineBtnText: {
    fontSize: 12,
    fontWeight: '700',
  },
});
