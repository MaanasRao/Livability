import React, { useState, useEffect, useRef } from 'react';
import { StyleSheet, View, Text, Alert, TouchableOpacity } from 'react-native';
import MapView, { Marker, Polygon, PROVIDER_DEFAULT } from 'react-native-maps';
import * as Location from 'expo-location';
import { Ionicons } from '@expo/vector-icons'; 
import FAB from '../components/ui/FAB';
import ReportModal from '../components/ReportModal';
import DisclaimerModal from '../components/DisclaimerModal';

const API_URL = 'http://192.168.2.34:8000'; 

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
  const [userReports, setUserReports] = useState<any[]>([]);
  const [selectedReport, setSelectedReport] = useState<any>(null);
  
  // 🆕 Loading State
  const [isSubmitting, setIsSubmitting] = useState(false);

  const HAMILTON_REGION = { latitude: 43.2557, longitude: -79.8711, latitudeDelta: 0.08, longitudeDelta: 0.08 };
  const GRID_SIZE = 0.005;

  const getRentForBlock = (lat: number, lng: number) => {
    let closest = RENT_ZONES[0];
    let minDist = 9999;
    RENT_ZONES.forEach(zone => {
      const dist = Math.sqrt(Math.pow(zone.lat - lat, 2) + Math.pow(zone.lng - lng, 2));
      if (dist < minDist) { minDist = dist; closest = zone; }
    });
    return `💰 ${closest.name}\n   1BR: $${closest.p1} | 2BR: $${closest.p2}`;
  };

  const generateGrid = (staticEvents: any[]) => {
    if (!Array.isArray(staticEvents)) return;
    const grid: { [key: string]: { score: number, details: string[] } } = {};

    staticEvents.forEach((event) => {
      if (!event.lat || !event.lng) return;
      const key = `${Math.floor(event.lng / GRID_SIZE)},${Math.floor(event.lat / GRID_SIZE)}`;
      if (!grid[key]) grid[key] = { score: 0, details: [] };

      let label = "";
      let weight = 0;

      if (['park', 'school', 'amenity'].includes(event.type)) { label = '✅ Park/School (+2)'; weight = 2; } 
      else if (event.type === 'grocery') { label = '🛒 Grocery Nearby (+2)'; weight = 2; }
      else if (event.type === 'healthcare') { label = '🏥 Healthcare (+3)'; weight = 3; } 
      else if (event.type === 'mobility') { label = '🚌 Transit (+2)'; weight = 2; }
      else if (event.type === 'industrial') { label = '🏭 Industrial (-5)'; weight = -5; } 
      else if (event.type === 'noise_static') { label = '🚂 Noise Zone (-3)'; weight = -3; } 

      if (label && !grid[key].details.includes(label)) {
        grid[key].score += weight;
        grid[key].details.push(label);
      }
    });

    const polygons = Object.keys(grid).map((key) => {
      const [gx, gy] = key.split(',').map(Number);
      const { score, details } = grid[key];
      let fillColor = 'transparent'; 
      if (score >= 5) fillColor = 'rgba(0, 255, 0, 0.4)';         
      else if (score > 0) fillColor = 'rgba(144, 238, 144, 0.4)'; 
      else if (score <= -8) fillColor = 'rgba(255, 0, 0, 0.5)';   
      else if (score < 0) fillColor = 'rgba(255, 165, 0, 0.4)';   

      if (fillColor === 'transparent') return null;

      const minLng = gx * GRID_SIZE;
      const minLat = gy * GRID_SIZE;
      const rentInfo = getRentForBlock(minLat, minLng);
      return {
        id: key, score, reasons: [rentInfo, ...details], color: fillColor,
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

  const fetchData = async () => {
    try {
      const staticRes = await fetch(`${API_URL}/events`);
      if (staticRes.ok) generateGrid(await staticRes.json());
      const reportsRes = await fetch(`${API_URL}/user_reports`);
      if (reportsRes.ok) setUserReports(await reportsRes.json());
    } catch (e) { console.error("Fetch error:", e); }
  };

  const handleSubmit = async (reportData: any) => {
    // 1. START LOADING
    setIsSubmitting(true);
    
    let { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== 'granted') {
        Alert.alert("Permission denied", "We need location access to drop the pin.");
        setIsSubmitting(false);
        return;
    }

    let loc = await Location.getCurrentPositionAsync({});
    const jitter = (Math.random() - 0.5) * 0.0005;
    
    try {
      // 2. SEND DATA
      await fetch(`${API_URL}/user_reports`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: reportData.type,
          lat: loc.coords.latitude + jitter,
          lng: loc.coords.longitude + jitter,
          description: reportData.description
        }),
      });
      
      // 3. REFRESH MAP
      await fetchData(); 
      
      // 4. SHOW SUCCESS
      Alert.alert("Success", "Your report has been pinned to the map! 📍");
      setModalVisible(false); // Close only on success
    } catch (e) { 
      Alert.alert("Error", "Failed to submit report. Please try again.");
      console.error(e); 
    } finally {
      // 5. STOP LOADING
      setIsSubmitting(false);
    }
  };

  const handleResolve = async () => {
    if (!selectedReport) return;
    Alert.alert("Resolve Issue?", "Is this issue fixed?", [
      { text: "Cancel", style: "cancel" },
      { text: "Yes", style: "destructive", onPress: async () => {
          try {
            await fetch(`${API_URL}/user_reports?id=${selectedReport.id}`, { method: 'DELETE' });
            setSelectedReport(null);
            fetchData();
          } catch(e) { console.error(e); }
        } 
      }
    ]);
  };

  useEffect(() => { fetchData(); }, []);

  return (
    <View style={styles.container}>
      <MapView
        ref={mapRef} style={styles.map} initialRegion={HAMILTON_REGION} showsUserLocation={true} provider={PROVIDER_DEFAULT}
        onPress={() => setSelectedReport(null)}
      >
        {gridPolygons.map((poly: any) => (
          <Polygon key={poly.id} coordinates={poly.coordinates} fillColor={poly.color} strokeColor="rgba(255,255,255,0.3)" strokeWidth={1} tappable={true}
            onPress={(e) => { e.stopPropagation(); Alert.alert("Area Score", `Score: ${poly.score}\n\n${poly.reasons.join('\n\n')}`); }}
          />
        ))}
        {userReports.map((event: any) => (
          <Marker key={event.id} coordinate={{ latitude: event.lat, longitude: event.lng }} pinColor={event.type === 'safety' ? 'red' : 'gold'}
            onPress={(e) => { e.stopPropagation(); setSelectedReport(event); }}
          />
        ))}
      </MapView>

      {selectedReport && (
        <View style={styles.reportCard}>
          <View style={styles.reportHeader}>
            <Text style={styles.reportTitle}>{selectedReport.type === 'safety' ? '⚠️ Safety Issue' : '💬 Report'}</Text>
            <TouchableOpacity onPress={() => setSelectedReport(null)}><Ionicons name="close-circle" size={24} color="#888" /></TouchableOpacity>
          </View>
          <Text style={styles.reportDesc}>{selectedReport.description || "No description provided."}</Text>
          <TouchableOpacity style={styles.resolveBtn} onPress={handleResolve}><Text style={styles.resolveBtnText}>✅ Mark Resolved</Text></TouchableOpacity>
        </View>
      )}

      {!selectedReport && (
        <View style={styles.legendContainer}>
          <Text style={styles.legendTitle}>Livability Index</Text>
          <View style={styles.legendItem}><View style={[styles.legendBox, { backgroundColor: 'rgba(0, 255, 0, 0.4)' }]} /><Text style={styles.legendText}>High / Amenities</Text></View>
          <View style={styles.legendItem}><View style={[styles.legendBox, { backgroundColor: 'rgba(255, 0, 0, 0.5)' }]} /><Text style={styles.legendText}>Low / Industrial</Text></View>
        </View>
      )}

      <FAB onPress={() => setModalVisible(true)} />
      
      <ReportModal 
        visible={modalVisible} 
        onClose={() => setModalVisible(false)} 
        onSubmit={handleSubmit} 
        isLoading={isSubmitting} 
      />
      
      <DisclaimerModal />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  map: { width: '100%', height: '100%' },
  reportCard: { position: 'absolute', bottom: 30, left: 20, right: 20, backgroundColor: '#1c1c1e', borderRadius: 16, padding: 20, elevation: 10 },
  reportHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  reportTitle: { color: 'white', fontSize: 18, fontWeight: 'bold' },
  reportDesc: { color: '#ccc', fontSize: 14, marginBottom: 10 },
  resolveBtn: { backgroundColor: '#30d158', padding: 12, borderRadius: 10, alignItems: 'center' },
  resolveBtnText: { color: 'white', fontWeight: 'bold' },
  legendContainer: { position: 'absolute', bottom: 90, left: 20, backgroundColor: 'rgba(255, 255, 255, 0.95)', padding: 12, borderRadius: 12 },
  legendTitle: { fontSize: 11, fontWeight: 'bold', marginBottom: 5, color: '#222' },
  legendItem: { flexDirection: 'row', alignItems: 'center', marginBottom: 5 },
  legendBox: { width: 14, height: 14, marginRight: 8, borderRadius: 3 },
  legendText: { fontSize: 11, color: '#444' }
});