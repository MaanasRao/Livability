import React, { useState, useEffect } from 'react';
import { StyleSheet, View, Alert } from 'react-native'; // Removed 'Text' import
import MapView, { Marker, PROVIDER_DEFAULT } from 'react-native-maps';
import * as Location from 'expo-location';
import FAB from '../components/ui/FAB'; // <--- Import the new button!

// Keep your IP address here!
const API_URL = 'http://192.168.2.34:8000'; 

export default function MapScreen() {
  const [location, setLocation] = useState<Location.LocationObject | null>(null);
  const [events, setEvents] = useState([]);

  const HAMILTON_REGION = {
    latitude: 43.2557,
    longitude: -79.8711,
    latitudeDelta: 0.05,
    longitudeDelta: 0.05,
  };

  const fetchEvents = async () => {
    try {
      const response = await fetch(`${API_URL}/events`);
      const data = await response.json();
      setEvents(data);
    } catch (error) {
      console.error(error);
      // Removed the annoying Alert on load, just log it
    }
  };

  // New Function: Handles the Button Click
  const handleReportPress = () => {
    Alert.alert("Report Event", "Reporting logic coming soon!");
  };

  useEffect(() => {
    (async () => {
      let { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') return;
      let loc = await Location.getCurrentPositionAsync({});
      setLocation(loc);
      fetchEvents();
    })();
  }, []);

  return (
    <View style={styles.container}>
      <MapView
        style={styles.map}
        initialRegion={HAMILTON_REGION}
        showsUserLocation={true}
        provider={PROVIDER_DEFAULT} 
      >
        {events.map((event: any) => (
          <Marker
            key={event.id}
            coordinate={{ latitude: event.lat, longitude: event.lng }}
            title={event.type.toUpperCase()}
            description={event.description}
            pinColor={event.type === 'noise' ? 'red' : 'blue'}
          />
        ))}
      </MapView>

      {/* Add the FAB Button here */}
      <FAB onPress={handleReportPress} />
      
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  map: { width: '100%', height: '100%' },
});