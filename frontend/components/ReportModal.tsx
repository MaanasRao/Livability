import React from 'react';
import { Modal, View, Text, TouchableOpacity, StyleSheet } from 'react-native';

type Props = {
  visible: boolean;
  onClose: () => void;
  onSubmit: (type: string) => void;
};

export default function ReportModal({ visible, onClose, onSubmit }: Props) {
  return (
    <Modal
      animationType="slide"
      transparent={true}
      visible={visible}
      onRequestClose={onClose}
    >
      <View style={styles.centeredView}>
        <View style={styles.modalView}>
          <Text style={styles.title}>What's happening?</Text>

          {/* Option 1: NOISE (Red) */}
          <TouchableOpacity 
            style={[styles.btn, { backgroundColor: '#FF3B30' }]} 
            onPress={() => onSubmit('noise')}
          >
            <Text style={styles.btnText}>📢 Loud Noise</Text>
          </TouchableOpacity>

          {/* Option 2: SAFETY (Gold/Yellow) */}
          <TouchableOpacity 
            style={[styles.btn, { backgroundColor: '#FFCC00' }]} 
            onPress={() => onSubmit('safety')}
          >
            {/* We override the text color to black because white text is hard to read on yellow */}
            <Text style={[styles.btnText, { color: 'black' }]}>⚠️ Safety Issue</Text>
          </TouchableOpacity>

          {/* CLOSE Button */}
          <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
            <Text style={styles.closeText}>Cancel</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  centeredView: {
    flex: 1,
    justifyContent: 'flex-end', // Aligns to bottom
    backgroundColor: 'rgba(0,0,0,0.5)', // Dimmed background
  },
  modalView: {
    backgroundColor: 'white',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 35,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5,
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 20,
  },
  btn: {
    width: '100%',
    padding: 15,
    borderRadius: 10,
    marginBottom: 10,
    alignItems: 'center',
  },
  btnText: {
    color: 'white',
    fontWeight: 'bold',
    fontSize: 16,
  },
  closeBtn: {
    marginTop: 10,
  },
  closeText: {
    color: '#666',
    fontSize: 16,
  },
});