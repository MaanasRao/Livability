import React, { useState, useEffect, useRef } from 'react';
import { StyleSheet, View, Alert } from 'react-native';
import MapView, { Marker, PROVIDER_DEFAULT } from 'react-native-maps'; // Back to Markers!
import * as Location from 'expo-location';

// Custom Components
import FAB from '../components/ui/FAB';
import ReportModal from '../components/ReportModal';

// ⚠️ YOUR LOCAL IP ADDRESS
const API_URL = 'http://192.168.2.34:8000'; 

export default function MapScreen() {
  const mapRef = useRef<MapView>(null);

  const [location, setLocation] = useState<Location.LocationObject | null>(null);
  const [events, setEvents] = useState([]);
  const [modalVisible, setModalVisible] = useState(false);

  const HAMILTON_REGION = {
    latitude: 43.2557,
    longitude: -79.8711,
    latitudeDelta: 0.05,
    longitudeDelta: 0.05,
  };

  const setHamiltonBoundaries = () => {
    if (mapRef.current) {
      mapRef.current.setMapBoundaries(
        { latitude: 43.4500, longitude: -79.6000 },
        { latitude: 43.1000, longitude: -80.0500 }
      );
    }
  };

  const fetchEvents = async () => {
    try {
      const response = await fetch(`${API_URL}/events`);
      const data = await response.json();
      setEvents(data);
    } catch (error) {
      console.error("Error fetching events:", error);
    }
  };

  const handleReportPress = () => {
    setModalVisible(true);
  };

  const handleSubmit = async (type: string) => {
    setModalVisible(false);

    let { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert("Permission Denied", "We need your location to save the report!");
      return;
    }
    
    let loc = await Location.getCurrentPositionAsync({});
    
    // 🎲 JITTER LOGIC:
    // We add a tiny random number (-0.0001 to +0.0001) to the coordinates.
    // This moves the pin about 5-10 meters. 
    // This prevents "Safety" and "Noise" pins from stacking perfectly on top of each other.
    const jitter = (Math.random() - 0.5) * 0.0005;

    const payload = {
      type: type,
      lat: loc.coords.latitude + jitter,
      lng: loc.coords.longitude + jitter,
      description: `User reported ${type}` 
    };

    try {
      const response = await fetch(`${API_URL}/events`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (response.ok) {
        Alert.alert("Success", "Report added! 📍");
        fetchEvents();
      } else {
        Alert.alert("Error", "Server rejected the report.");
      }
    } catch (error) {
      console.error(error);
      Alert.alert("Connection Error", "Could not reach the server.");
    }
  };

  useEffect(() => {
    (async () => {
      let { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') return;
      let loc = await Location.getCurrentPositionAsync({});
      setLocation(loc);
      fetchEvents();

      setTimeout(() => {
        setHamiltonBoundaries();
      }, 1000);
    })();
  }, []);

  return (
    <View style={styles.container}>
      <MapView
        ref={mapRef}
        style={styles.map}
        initialRegion={HAMILTON_REGION}
        showsUserLocation={true}
        provider={PROVIDER_DEFAULT}
        minZoomLevel={11}
        maxZoomLevel={20}
      >
        {/* 📍 PINS ARE BACK */}
        {events.map((event: any) => (
          <Marker
            key={event.id}
            coordinate={{ latitude: event.lat, longitude: event.lng }}
            title={event.type.toUpperCase()}
            description={event.description}
            // Distinct Colors:
            // Noise = Red
            // Safety = Gold
            pinColor={
              event.type === 'noise' ? 'red' : 
              event.type === 'safety' ? 'gold' : 'blue'
            }
          />
        ))}
      </MapView>

      <FAB onPress={handleReportPress} />
      
      <ReportModal 
        visible={modalVisible} 
        onClose={() => setModalVisible(false)}
        onSubmit={handleSubmit}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  map: { width: '100%', height: '100%' },
});