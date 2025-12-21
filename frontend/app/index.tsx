import React, { useState, useEffect, useRef } from 'react';
import { StyleSheet, View, Text } from 'react-native';
import MapView, { Marker, Polygon, PROVIDER_DEFAULT } from 'react-native-maps';
import * as Location from 'expo-location';
import FAB from '../components/ui/FAB';
import ReportModal from '../components/ReportModal';

const API_URL = 'http://192.168.2.34:8000'; // ⚠️ Check your IP

export default function MapScreen() {
  const mapRef = useRef<MapView>(null);
  const [location, setLocation] = useState<Location.LocationObject | null>(null);
  const [modalVisible, setModalVisible] = useState(false);
  
  // The Grid Data
  const [gridPolygons, setGridPolygons] = useState<any[]>([]);
  const [userReports, setUserReports] = useState([]);

  const HAMILTON_REGION = {
    latitude: 43.2557,
    longitude: -79.8711,
    latitudeDelta: 0.08,
    longitudeDelta: 0.08,
  };

  // 📐 SETTINGS: How big are the squares?
  // 0.005 degrees is roughly 500m (a few city blocks)
  const GRID_SIZE = 0.005; 

  const generateGrid = (allEvents: any[]) => {
    const grid: { [key: string]: number } = {};

    // 1. BINNING: Put every point into a "Box"
    allEvents.forEach((event) => {
      if (!event.lat || !event.lng) return;

      // Calculate Grid Coordinates (Round down to nearest grid line)
      const gridX = Math.floor(event.lng / GRID_SIZE);
      const gridY = Math.floor(event.lat / GRID_SIZE);
      const key = `${gridX},${gridY}`;

      if (!grid[key]) grid[key] = 0;

      // 2. SCORING LOGIC
      // Customize this to change how the map looks!
      if (['park', 'school', 'amenity'].includes(event.type)) {
        grid[key] += 2; // Green Points add score
      } else if (['traffic', 'noise', 'industrial'].includes(event.type)) {
        // Use the weight from DB, or default to -5 for danger
        const dangerWeight = event.weight > 0 ? event.weight : 1;
        grid[key] -= (dangerWeight * 3); // Red Points subtract score
      }
    });

    // 3. CREATE POLYGONS
    const polygons = Object.keys(grid).map((key) => {
      const [gridX, gridY] = key.split(',').map(Number);
      const score = grid[key];

      // Determine Color based on Score
      let fillColor = 'rgba(128, 128, 128, 0.2)'; // Default Grey (Neutral)
      
      if (score > 5) fillColor = 'rgba(0, 255, 0, 0.4)';       // 🟢 Very Safe
      else if (score > 0) fillColor = 'rgba(144, 238, 144, 0.4)'; // 🟢 Safeish
      else if (score < -10) fillColor = 'rgba(255, 0, 0, 0.5)';   // 🔴 Dangerous
      else if (score < 0) fillColor = 'rgba(255, 165, 0, 0.4)';   // 🟠 Caution

      // Create the Square Shape
      const minLng = gridX * GRID_SIZE;
      const minLat = gridY * GRID_SIZE;
      
      return {
        id: key,
        score: score,
        color: fillColor,
        coordinates: [
          { latitude: minLat, longitude: minLng },
          { latitude: minLat + GRID_SIZE, longitude: minLng },
          { latitude: minLat + GRID_SIZE, longitude: minLng + GRID_SIZE },
          { latitude: minLat, longitude: minLng + GRID_SIZE },
        ]
      };
    });

    setGridPolygons(polygons);
  };

  const fetchEvents = async () => {
    try {
      const response = await fetch(`${API_URL}/events`);
      const data = await response.json();
      
      // Separate User Reports (Pins) from Background Data (Grid)
      const reports = data.filter((e: any) => ['noise', 'safety'].includes(e.type));
      setUserReports(reports);

      // Generate the Grid with EVERYTHING else
      generateGrid(data);

      console.log(`Generated ${data.length} data points into Grid.`);
    } catch (error) {
      console.error("Error fetching events:", error);
    }
  };

  const handleReportPress = () => setModalVisible(true);
  
  const handleSubmit = async (type: string) => {
    setModalVisible(false);
    let { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== 'granted') return;
    let loc = await Location.getCurrentPositionAsync({});
    
    // Jitter
    const jitter = (Math.random() - 0.5) * 0.0005;

    const payload = {
      type: type,
      lat: loc.coords.latitude + jitter,
      lng: loc.coords.longitude + jitter,
      description: `User reported ${type}`,
      weight: 1 
    };

    try {
      await fetch(`${API_URL}/events`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      fetchEvents();
    } catch (error) { console.error(error); }
  };

  useEffect(() => {
    (async () => {
      let { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') return;
      fetchEvents();
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
      >
        {/* 🔲 THE GRID LAYER */}
        {gridPolygons.map((poly) => (
          <Polygon
            key={poly.id}
            coordinates={poly.coordinates}
            fillColor={poly.color}
            strokeColor="rgba(255,255,255,0.5)" // White borders like your reference image
            strokeWidth={1}
            tappable={true}
            onPress={() => alert(`Livability Score: ${poly.score}`)}
          />
        ))}

        {/* 📍 USER PINS (Layered on top) */}
        {userReports.map((event: any) => (
          <Marker
            key={event.id}
            coordinate={{ latitude: event.lat, longitude: event.lng }}
            title={event.type.toUpperCase()}
            pinColor={event.type === 'safety' ? 'gold' : 'red'}
          />
        ))}

      </MapView>
      <FAB onPress={handleReportPress} />
      <ReportModal visible={modalVisible} onClose={() => setModalVisible(false)} onSubmit={handleSubmit} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  map: { width: '100%', height: '100%' },
});