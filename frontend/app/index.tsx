import React, { useState, useEffect, useRef } from 'react';
import { StyleSheet, View, Text, Alert } from 'react-native';
import MapView, { Marker, Polygon, PROVIDER_DEFAULT } from 'react-native-maps';
import * as Location from 'expo-location';
import FAB from '../components/ui/FAB';
import ReportModal from '../components/ReportModal';

// ⚠️ Ensure this matches your backend computer's local IP address
const API_URL = 'http://192.168.2.34:8000'; 

export default function MapScreen() {
  const mapRef = useRef<MapView>(null);
  const [location, setLocation] = useState<Location.LocationObject | null>(null);
  const [modalVisible, setModalVisible] = useState(false);
  
  const [gridPolygons, setGridPolygons] = useState<any[]>([]);
  const [userReports, setUserReports] = useState([]);

  const HAMILTON_REGION = {
    latitude: 43.2557,
    longitude: -79.8711,
    latitudeDelta: 0.08,
    longitudeDelta: 0.08,
  };

  const GRID_SIZE = 0.005; // Approx 500m square blocks

  // 1. GENERATE THE GRID (Capped Scoring Logic)
  const generateGrid = (allEvents: any[]) => {
    const grid: { [key: string]: { score: number, details: string[] } } = {};

    allEvents.forEach((event) => {
      if (!event.lat || !event.lng) return;

      const gridX = Math.floor(event.lng / GRID_SIZE);
      const gridY = Math.floor(event.lat / GRID_SIZE);
      const key = `${gridX},${gridY}`;

      if (!grid[key]) {
        // We start with a base score of 0
        grid[key] = { score: 0, details: [] };
      }

      let label = "";
      let penalty = 0;

      // DEFINE CATEGORIES
      if (['park', 'school', 'amenity'].includes(event.type)) {
        label = '✅ Park/School (+2)';
        penalty = 2;
      } else if (event.type === 'industrial') {
        label = '🏭 Industrial Zone (-5)';
        penalty = -5;
      } else if (event.type === 'noise_static') {
        label = '🚂 Highway/Rail Noise (-3)';
        penalty = -3;
      } else if (event.type === 'traffic') {
        label = '🚗 Traffic Incident (-3)';
        penalty = -3;
      }

      // THE FIX: Only apply the penalty ONCE per grid square per type
      // This prevents thousands of points from creating unrealistic -300 scores
      if (label && !grid[key].details.includes(label)) {
        grid[key].score += penalty;
        grid[key].details.push(label);
      }
    });

    const polygons = Object.keys(grid).map((key) => {
      const [gridX, gridY] = key.split(',').map(Number);
      const data = grid[key];
      const score = data.score;

      // COLOR ASSIGNMENT
      let fillColor = 'transparent'; 
      if (score >= 4) fillColor = 'rgba(0, 255, 0, 0.4)';         // 🟢 High Livability
      else if (score > 0) fillColor = 'rgba(144, 238, 144, 0.4)'; // 🟢 Moderate Livability
      else if (score <= -8) fillColor = 'rgba(255, 0, 0, 0.5)';   // 🔴 Low Livability
      else if (score < 0) fillColor = 'rgba(255, 165, 0, 0.4)';   // 🟠 Caution

      if (fillColor === 'transparent') return null;

      const minLng = gridX * GRID_SIZE;
      const minLat = gridY * GRID_SIZE;
      
      return {
        id: key,
        score: score,
        reasons: data.details,
        color: fillColor,
        coordinates: [
          { latitude: minLat, longitude: minLng },
          { latitude: minLat + GRID_SIZE, longitude: minLng },
          { latitude: minLat + GRID_SIZE, longitude: minLng + GRID_SIZE },
          { latitude: minLat, longitude: minLng + GRID_SIZE },
        ]
      };
    }).filter(Boolean);

    setGridPolygons(polygons);
  };

  const fetchEvents = async () => {
    try {
      const response = await fetch(`${API_URL}/events`);
      const data = await response.json();
      
      const reports = data.filter((e: any) => ['noise', 'safety'].includes(e.type));
      setUserReports(reports);

      generateGrid(data);
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
        {/* GRID LAYER */}
        {gridPolygons.map((poly: any) => (
          <Polygon
            key={poly.id}
            coordinates={poly.coordinates}
            fillColor={poly.color}
            strokeColor="rgba(255,255,255,0.3)" 
            strokeWidth={1}
            tappable={true}
            onPress={() => {
                let status = "Neutral Area";
                if (poly.score > 0) status = "✅ Livable Area";
                if (poly.score < 0) status = "⚠️ Caution Area";
                
                const reasonText = poly.reasons.length > 0 
                    ? poly.reasons.join('\n') 
                    : "Standard residential area.";

                Alert.alert(
                    status, 
                    `Total Score: ${poly.score}\n\nFactors Found:\n${reasonText}`
                );
            }}
          />
        ))}

        {/* USER PINS */}
        {userReports.map((event: any) => (
          <Marker
            key={event.id}
            coordinate={{ latitude: event.lat, longitude: event.lng }}
            title={event.type.toUpperCase()}
            pinColor={event.type === 'safety' ? 'gold' : 'red'}
          />
        ))}
      </MapView>

      {/* LEGEND (Heatmap + Pins) */}
      <View style={styles.legendContainer}>
        <Text style={styles.legendTitle}>Livability Index</Text>
        
        <View style={styles.legendItem}>
          <View style={[styles.legendBox, { backgroundColor: 'rgba(0, 255, 0, 0.4)' }]} />
          <Text style={styles.legendText}>High / Amenities</Text>
        </View>
        <View style={styles.legendItem}>
          <View style={[styles.legendBox, { backgroundColor: 'rgba(255, 0, 0, 0.5)' }]} />
          <Text style={styles.legendText}>Low / Industrial</Text>
        </View>

        <View style={styles.divider} />

        <View style={styles.legendItem}>
          <View style={[styles.legendCircle, { backgroundColor: 'gold' }]} />
          <Text style={styles.legendText}>Report: Safe</Text>
        </View>
        <View style={styles.legendItem}>
          <View style={[styles.legendCircle, { backgroundColor: 'red' }]} />
          <Text style={styles.legendText}>Report: Danger</Text>
        </View>
      </View>

      <FAB onPress={handleReportPress} />
      <ReportModal visible={modalVisible} onClose={() => setModalVisible(false)} onSubmit={handleSubmit} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  map: { width: '100%', height: '100%' },
  legendContainer: {
    position: 'absolute',
    bottom: 90, 
    left: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    padding: 12,
    borderRadius: 12,
    elevation: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
  },
  legendTitle: {
    fontSize: 11,
    fontWeight: 'bold',
    marginBottom: 8,
    color: '#222',
    textTransform: 'uppercase',
  },
  legendItem: { flexDirection: 'row', alignItems: 'center', marginBottom: 5 },
  legendBox: { width: 14, height: 14, marginRight: 8, borderRadius: 3 },
  legendCircle: { 
    width: 12, 
    height: 12, 
    marginRight: 8, 
    borderRadius: 6, 
    borderWidth: 1, 
    borderColor: '#ddd' 
  },
  legendText: { fontSize: 11, color: '#444' },
  divider: { height: 1, backgroundColor: '#eee', marginVertical: 6 }
});