import React, { useState, useEffect } from 'react';
import { Modal, View, Text, TouchableOpacity, TextInput, StyleSheet, KeyboardAvoidingView, Platform, ActivityIndicator } from 'react-native';

interface ReportModalProps {
  visible: boolean;
  onClose: () => void;
  onSubmit: (reportData: { type: string; categoryLabel: string; description: string }) => void;
  isLoading: boolean; // 🆕 Added this prop
}

const CATEGORIES = [
  { id: 'safety', label: '⚠️ Safety', color: '#ff453a' },
  { id: 'noise', label: '📢 Noise', color: '#ff9f0a' },
  { id: 'maintenance', label: '🛠️ Maintenance', color: '#30d158' },
  { id: 'cleanliness', label: '🗑️ Trash', color: '#bf5af2' },
  { id: 'traffic', label: '🚗 Traffic', color: '#0a84ff' },
  { id: 'other', label: '❓ Other', color: '#8e8e93' },
];

export default function ReportModal({ visible, onClose, onSubmit, isLoading }: ReportModalProps) {
  const [step, setStep] = useState(1);
  const [selectedCat, setSelectedCat] = useState<{ id: string; label: string; color: string } | null>(null);
  const [description, setDescription] = useState('');

  useEffect(() => {
    if (visible) {
      setStep(1);
      setSelectedCat(null);
      setDescription('');
    }
  }, [visible]);

  const handleSubmit = () => {
    if (!selectedCat) return;
    onSubmit({
      type: selectedCat.id,
      categoryLabel: selectedCat.label,
      description: description || selectedCat.label 
    });
    // Don't close immediately here anymore, wait for the parent to finish loading
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={styles.overlay}>
        <View style={styles.card}>
          
          {/* STEP 1 */}
          {step === 1 && (
            <>
              <Text style={styles.title}>Report Issue</Text>
              <View style={styles.grid}>
                {CATEGORIES.map((cat) => (
                  <TouchableOpacity key={cat.id} style={[styles.catBtn, { borderColor: cat.color }]} onPress={() => { setSelectedCat(cat); setStep(2); }}>
                    <Text style={[styles.catText, { color: cat.color }]}>{cat.label}</Text>
                  </TouchableOpacity>
                ))}
              </View>
              <TouchableOpacity onPress={onClose} style={styles.closeBtn}><Text style={styles.closeText}>Cancel</Text></TouchableOpacity>
            </>
          )}

          {/* STEP 2 */}
          {step === 2 && (
            <>
              <Text style={styles.title}>{selectedCat?.label}</Text>
              <TextInput 
                style={styles.input} 
                placeholder="Describe the issue..." 
                placeholderTextColor="#666" 
                multiline 
                numberOfLines={3} 
                value={description} 
                onChangeText={setDescription} 
                textAlignVertical="top" 
              />
              
              <TouchableOpacity 
                style={[styles.submitBtn, { backgroundColor: selectedCat?.color, opacity: isLoading ? 0.7 : 1 }]} 
                onPress={handleSubmit}
                disabled={isLoading} // Disable button while loading
              >
                {isLoading ? (
                  <ActivityIndicator color="white" />
                ) : (
                  <Text style={styles.submitText}>Submit Report</Text>
                )}
              </TouchableOpacity>
              
              {!isLoading && (
                <TouchableOpacity onPress={() => setStep(1)} style={styles.backBtn}>
                  <Text style={styles.backText}>← Back</Text>
                </TouchableOpacity>
              )}
            </>
          )}
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'center', padding: 20 },
  card: { backgroundColor: '#1c1c1e', borderRadius: 20, padding: 25 },
  title: { color: 'white', fontSize: 22, fontWeight: 'bold', marginBottom: 15, textAlign: 'center' },
  grid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between' },
  catBtn: { width: '48%', borderWidth: 2, borderRadius: 12, padding: 15, marginBottom: 15, alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.05)' },
  catText: { fontWeight: 'bold' },
  input: { backgroundColor: '#2c2c2e', color: 'white', borderRadius: 12, padding: 15, height: 80, marginBottom: 20 },
  submitBtn: { padding: 15, borderRadius: 12, alignItems: 'center', marginBottom: 10, height: 50, justifyContent: 'center' },
  submitText: { color: 'white', fontWeight: 'bold', fontSize: 16 },
  backBtn: { alignItems: 'center', padding: 10 },
  backText: { color: '#888' },
  closeBtn: { marginTop: 10, alignItems: 'center' },
  closeText: { color: '#ff453a' }
});