import React from 'react';
import { TouchableOpacity, StyleSheet, Text, View } from 'react-native';

// This is the big "+" button
export default function FAB({ onPress }: { onPress: () => void }) {
  return (
    <View style={styles.container}>
      <TouchableOpacity style={styles.button} onPress={onPress}>
        <Text style={styles.icon}>+</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    bottom: 30, // Distance from bottom
    right: 20,  // Distance from right
    zIndex: 999, // Floating above the map
  },
  button: {
    width: 60,
    height: 60,
    borderRadius: 30, // Makes it a perfect circle
    backgroundColor: '#007AFF', // Nice blue color
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 5, // Shadow on Android
    shadowColor: '#000', // Shadow on iOS
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
  },
  icon: {
    fontSize: 32,
    color: 'white',
    fontWeight: 'bold',
    marginTop: -2, // Slight adjustment to center the +
  },
});