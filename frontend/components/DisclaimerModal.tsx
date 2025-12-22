import React, { useEffect, useState } from 'react';
import { Modal, View, Text, TouchableOpacity, StyleSheet, Switch } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

export default function DisclaimerModal() {
  const [visible, setVisible] = useState(false);
  const [dontShowAgain, setDontShowAgain] = useState(false);

  useEffect(() => {
    checkStatus();
  }, []);

  const checkStatus = async () => {
    const hasSeen = await AsyncStorage.getItem('hasSeenDisclaimer');
    if (hasSeen !== 'true') {
      setVisible(true);
    }
  };

  const handleClose = async () => {
    if (dontShowAgain) {
      await AsyncStorage.setItem('hasSeenDisclaimer', 'true');
    }
    setVisible(false);
  };

  return (
    <Modal visible={visible} transparent animationType="fade">
      <View style={styles.overlay}>
        <View style={styles.card}>
          <Text style={styles.title}>Welcome to LiveHamilton 🇨🇦</Text>
          
          <Text style={styles.sectionTitle}>⚠️ Important Data Notice</Text>
          <Text style={styles.body}>
            1. <Text style={styles.bold}>Rent Estimates:</Text> Prices shown are **Zonal Averages** based on CMHC 2025 data. Actual rent for individual units may vary.
            {"\n\n"}
            2. <Text style={styles.bold}>Livability Scores:</Text> Scores are generated algorithmically based on proximity to amenities, safety reports, and noise levels.
            {"\n\n"}
            3. <Text style={styles.bold}>Community Reports:</Text> Safety and noise data is crowdsourced and may not reflect official police records.
          </Text>

          <View style={styles.row}>
            <Text style={styles.switchText}>Don't show this again</Text>
            <Switch value={dontShowAgain} onValueChange={setDontShowAgain} />
          </View>

          <TouchableOpacity style={styles.button} onPress={handleClose}>
            <Text style={styles.buttonText}>I Understand</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.75)', justifyContent: 'center', padding: 25 },
  card: { backgroundColor: '#1c1c1e', borderRadius: 20, padding: 25, borderWidth: 1, borderColor: '#333' },
  title: { color: 'white', fontSize: 22, fontWeight: 'bold', marginBottom: 20, textAlign: 'center' },
  sectionTitle: { color: '#FFD700', fontSize: 16, fontWeight: 'bold', marginBottom: 10, textTransform: 'uppercase' },
  body: { color: '#ccc', fontSize: 14, lineHeight: 22, marginBottom: 20 },
  bold: { fontWeight: 'bold', color: 'white' },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20, backgroundColor: 'rgba(255,255,255,0.05)', padding: 10, borderRadius: 10 },
  switchText: { color: 'white', fontSize: 14 },
  button: { backgroundColor: '#007AFF', padding: 15, borderRadius: 12, alignItems: 'center' },
  buttonText: { color: 'white', fontWeight: 'bold', fontSize: 16 }
});