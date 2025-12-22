import React, { useState, useEffect, useRef } from 'react';
import { StyleSheet, View, Text, Alert } from 'react-native';
import MapView, { Marker, Polygon, PROVIDER_DEFAULT } from 'react-native-maps';
import * as Location from 'expo-location';
import FAB from '../components/ui/FAB';
import ReportModal from '../components/ReportModal';
import DisclaimerModal from '../components/DisclaimerModal';

// ⚠️ Ensure this matches your backend computer's local IP address
const API_URL = 'http://192.168.2.34:8000'; 

// 💰 RENT ZONES (Hardcoded for 100% Coverage)
const RENT_ZONES = [
  { name: "Downtown Core", lat: 43.256, lng: -79.868, p1: 1398, p2: 1643 },
  { name: "Central East", lat: 43.252, lng: -79.835, p1: 1102, p2: 1291 },
  { name: "East End", lat: 43.235, lng: -79.780, p1: 1279, p2: 1464 },
  { name: "Central", lat: 43.242, lng: -79.820, p1: 1365, p2: 1506 },
  { name: "West End", lat: 43.261, lng: -79.905, p1: 1462, p2: 1633 },
  { name: "Mountain", lat: 43.230, lng: -79.880, p1: 1320, p2: 1479 },
  { name: "Stoney Creek", lat: 43.220, lng: -79.750, p1: 1230, p2: 1408 },
  { name: "Burlington", lat: 43.325, lng: -79.799, p1: 1749, p2: 2057 },
  { name: "Ancaster/Dundas", lat: 43.235, lng: -79.945, p1: 1493, p2: 1811 }
];

export default function MapScreen() {
  const mapRef = useRef<MapView>(null);
  const [modalVisible, setModalVisible] = useState(false);
  
  const [gridPolygons, setGridPolygons] = useState<any[]>([]);
  const [userReports, setUserReports] = useState([]);

  const HAMILTON_REGION = {
    latitude: 43.2557,
    longitude: -79.8711,
    latitudeDelta: 0.08,
    longitudeDelta: 0.08,
  };

  const GRID_SIZE = 0.005; // ~500m blocks

  // Helper: Find closest rent zone for ANY block
  const getRentForBlock = (lat: number, lng: number) => {
    let closest = RENT_ZONES[0];
    let minDist = 9999;

    RENT_ZONES.forEach(zone => {
      const dist = Math.sqrt(Math.pow(zone.lat - lat, 2) + Math.pow(zone.lng - lng, 2));
      if (dist < minDist) {
        minDist = dist;
        closest = zone;
      }
    });
    return `💰 ${closest.name} (Zonal Avg)\n   1BR: $${closest.p1} | 2BR: $${closest.p2}`;
  };

  const generateGrid = (allEvents: any[]) => {
    const grid: { [key: string]: { score: number, details: string[] } } = {};

    allEvents.forEach((event) => {
      if (!event.lat || !event.lng) return;

      const gridX = Math.floor(event.lng / GRID_SIZE);
      const gridY = Math.floor(event.lat / GRID_SIZE);
      const key = `${gridX},${gridY}`;

      if (!grid[key]) grid[key] = { score: 0, details: [] };

      let label = "";
      let weight = 0;

      // --- 🟢 POSITIVE FACTORS ---
      if (['park', 'school', 'amenity'].includes(event.type)) { 
        label = '✅ Park/School (+2)'; 
        weight = 2; 
      } 
      else if (event.type === 'grocery') { 
        label = '🛒 Grocery Nearby (+2)'; 
        weight = 2; 
      }
      else if (event.type === 'healthcare') { 
        label = '🏥 Healthcare (+3)'; 
        weight = 3; 
      } 
      else if (event.type === 'mobility') { 
        label = '🚌 Transit (+2)'; 
        weight = 2; 
      }

      // --- 🔴 NEGATIVE FACTORS (Infrastructure) ---
      else if (event.type === 'industrial') { 
        label = '🏭 Industrial (-5)'; 
        weight = -5; 
      } 
      else if (event.type === 'noise_static') { 
        label = '🚂 Noise (-3)'; 
        weight = -3; 
      } 
      else if (event.type === 'traffic') { 
        label = '🚗 Traffic (-3)'; 
        weight = -3; 
      }

      // --- 🔴 COMMUNITY REPORTS (User Feedback) ---
      else if (event.type === 'noise_complaint') {
        label = '📢 Reported Noise (-2)';
        weight = -2;
      }
      else if (event.type === 'poor_lighting') {
        label = '💡 Dark/Unlit Area (-1)';
        weight = -1;
      }
      else if (event.type === 'trash_dump') {
        label = '🗑️ Trash Complaint (-1)';
        weight = -1;
      }
      else if (event.type === 'safety_hazard') {
        label = '⚠️ Safety Concern (-3)';
        weight = -3;
      }

      if (label && !grid[key].details.includes(label)) {
        grid[key].score += weight;
        grid[key].details.push(label);
      }
    });

    const polygons = Object.keys(grid).map((key) => {
      const [gridX, gridY] = key.split(',').map(Number);
      const data = grid[key];
      const score = data.score;

      // Color Logic
      let fillColor = 'transparent'; 
      if (score >= 5) fillColor = 'rgba(0, 255, 0, 0.4)';         
      else if (score > 0) fillColor = 'rgba(144, 238, 144, 0.4)'; 
      else if (score <= -8) fillColor = 'rgba(255, 0, 0, 0.5)';   
      else if (score < 0) fillColor = 'rgba(255, 165, 0, 0.4)';   

      if (fillColor === 'transparent') return null;

      const minLng = gridX * GRID_SIZE;
      const minLat = gridY * GRID_SIZE;
      
      // 🟢 AUTOMATICALLY ADD RENT TO EVERY BLOCK
      const rentInfo = getRentForBlock(minLat, minLng);
      // Put rent at the top of the list
      const finalReasons = [rentInfo, ...data.details]; 

      return {
        id: key,
        score: score,
        reasons: finalReasons,
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
      
      // Filter for pins we want to show physically on map (Community Reports)
      const reports = data.filter((e: any) => 
        ['noise_complaint', 'safety_hazard', 'poor_lighting', 'trash_dump'].includes(e.type)
      );
      setUserReports(reports);
      generateGrid(data);
    } catch (error) { console.error("Error fetching events:", error); }
  };

  const handleReportPress = () => setModalVisible(true);
  
  const handleSubmit = async (type: string) => {
    setModalVisible(false);
    let { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== 'granted') return;
    let loc = await Location.getCurrentPositionAsync({});
    
    // Add jitter so pins don't stack perfectly
    const jitter = (Math.random() - 0.5) * 0.0005;
    
    try {
      await fetch(`${API_URL}/events`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: type,
          lat: loc.coords.latitude + jitter,
          lng: loc.coords.longitude + jitter,
          description: `Community Report: ${type}`,
          weight: 1 
        }),
      });
      fetchEvents(); // Refresh immediately
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
                    ? poly.reasons.join('\n\n') 
                    : "Standard residential area.";

                Alert.alert(
                    status, 
                    `Total Score: ${poly.score}\n\n${reasonText}`
                );
            }}
          />
        ))}

        {userReports.map((event: any) => (
          <Marker
            key={event.id}
            coordinate={{ latitude: event.lat, longitude: event.lng }}
            pinColor={event.type === 'safety_hazard' ? 'red' : 'gold'}
            title={event.description}
          />
        ))}
      </MapView>

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
          <Text style={styles.legendText}>Report: Minor Issue</Text>
        </View>
        <View style={styles.legendItem}>
          <View style={[styles.legendCircle, { backgroundColor: 'red' }]} />
          <Text style={styles.legendText}>Report: Safety Hazard</Text>
        </View>
      </View>

      <FAB onPress={handleReportPress} />
      <ReportModal visible={modalVisible} onClose={() => setModalVisible(false)} onSubmit={handleSubmit} />
      <DisclaimerModal />
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
  legendTitle: { fontSize: 11, fontWeight: 'bold', marginBottom: 8, color: '#222', textTransform: 'uppercase' },
  legendItem: { flexDirection: 'row', alignItems: 'center', marginBottom: 5 },
  legendBox: { width: 14, height: 14, marginRight: 8, borderRadius: 3 },
  legendCircle: { width: 12, height: 12, marginRight: 8, borderRadius: 6, borderWidth: 1, borderColor: '#ddd' },
  legendText: { fontSize: 11, color: '#444' },
  divider: { height: 1, backgroundColor: '#eee', marginVertical: 6 }
});