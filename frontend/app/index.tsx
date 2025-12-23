import React, { useState, useEffect, useRef } from 'react';
import { StyleSheet, View, Text, Alert, TouchableOpacity, Animated, ActivityIndicator, Keyboard, Modal, StatusBar } from 'react-native';
import MapView, { Marker, Polygon, PROVIDER_DEFAULT } from 'react-native-maps';
import * as Location from 'expo-location';
import { GooglePlacesAutocomplete } from 'react-native-google-places-autocomplete';
import { Ionicons } from '@expo/vector-icons'; 
import { SafeAreaView } from 'react-native-safe-area-context'; 
import FAB from '../components/ui/FAB';
import ReportModal from '../components/ReportModal';
import DisclaimerModal from '../components/DisclaimerModal';

// ⚠️ CONFIGURATION
const API_URL = 'http://192.168.2.34:8000'; 
const GOOGLE_API_KEY = process.env.EXPO_PUBLIC_GOOGLE_API_KEY || 'YOUR_GOOGLE_API_KEY';

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
  
  // -- STATE --
  const [modalVisible, setModalVisible] = useState(false);
  const [searchModalVisible, setSearchModalVisible] = useState(false);
  const [gridPolygons, setGridPolygons] = useState<any[]>([]);
  const [userReports, setUserReports] = useState<any[]>([]);
  const [selectedBlock, setSelectedBlock] = useState<any>(null);
  const [displayAddress, setDisplayAddress] = useState(""); 
  
  const [isMapReady, setIsMapReady] = useState(false); 
  const [isDataLoaded, setIsDataLoaded] = useState(false); 
  const [isSubmitting, setIsSubmitting] = useState(false); 
  const [showDisclaimer, setShowDisclaimer] = useState(false); 

  const slideAnim = useRef(new Animated.Value(500)).current; 
  const HAMILTON_REGION = { latitude: 43.2557, longitude: -79.8711, latitudeDelta: 0.08, longitudeDelta: 0.08 };
  const GRID_SIZE = 0.009; 

  const isLoading = !isMapReady || !isDataLoaded;

  useEffect(() => {
    if (!isLoading) {
      const timer = setTimeout(() => setShowDisclaimer(true), 500);
      return () => clearTimeout(timer);
    }
  }, [isLoading]);

  // --- RENT & GRID LOGIC ---
  const getRentForBlock = (lat: number, lng: number) => {
    let closest = RENT_ZONES[0];
    let minDist = 9999;
    RENT_ZONES.forEach(zone => {
      const dist = Math.sqrt(Math.pow(zone.lat - lat, 2) + Math.pow(zone.lng - lng, 2));
      if (dist < minDist) { minDist = dist; closest = zone; }
    });
    return closest;
  };

  const generateGrid = (staticEvents: any[]) => {
    if (!Array.isArray(staticEvents)) return;
    const grid: { [key: string]: { score: number, details: string[] } } = {};

    staticEvents.forEach((event) => {
      if (!event.lat || !event.lng) return;
      const gridX = Math.floor(event.lng / GRID_SIZE);
      const gridY = Math.floor(event.lat / GRID_SIZE);
      const key = `${gridX},${gridY}`;

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
      const rentData = getRentForBlock(minLat, minLng);
      return {
        id: key, score, rent: rentData, reasons: details, color: fillColor,
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
      const [staticRes, reportsRes] = await Promise.all([
        fetch(`${API_URL}/events`),
        fetch(`${API_URL}/user_reports`)
      ]);
      if (staticRes.ok) generateGrid(await staticRes.json());
      if (reportsRes.ok) setUserReports(await reportsRes.json());
    } catch (e) { console.error("Fetch error:", e); } 
    finally { setIsDataLoaded(true); }
  };

  const handleSubmit = async (reportData: any) => {
    setIsSubmitting(true);
    let { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== 'granted') {
        Alert.alert("Permission denied", "We need location access.");
        setIsSubmitting(false);
        return;
    }
    let loc = await Location.getCurrentPositionAsync({});
    const jitter = (Math.random() - 0.5) * 0.0005;
    
    try {
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
      await fetchData(); 
      Alert.alert("Success", "Report Pinned! 📍");
      setModalVisible(false); 
    } catch (e) { Alert.alert("Error", "Failed to submit."); } 
    finally { setIsSubmitting(false); }
  };

  useEffect(() => { fetchData(); }, []);

  useEffect(() => {
    if (selectedBlock) {
      Animated.spring(slideAnim, { toValue: 0, useNativeDriver: true, friction: 8 }).start();
    } else {
      Animated.timing(slideAnim, { toValue: 500, duration: 250, useNativeDriver: true }).start();
    }
  }, [selectedBlock, slideAnim]);

  // --- SEARCH LOGIC (Cleaned) ---
  const handleSearchSelect = (data: any, details: any = null) => {
    if (!details) { Alert.alert("Error", "No details found"); return; }
    
    const { lat, lng } = details.geometry.location;
    
    setDisplayAddress(data.description || "Selected Location");
    setSearchModalVisible(false);
    
    setTimeout(() => {
        mapRef.current?.animateToRegion({ latitude: lat, longitude: lng, latitudeDelta: 0.01, longitudeDelta: 0.01 }, 1000);
    }, 500);

    const gridX = Math.floor(lng / GRID_SIZE);
    const gridY = Math.floor(lat / GRID_SIZE);
    const key = `${gridX},${gridY}`;
    const targetBlock = gridPolygons.find(p => p.id === key);

    if (targetBlock) {
        setSelectedBlock(targetBlock);
    } else {
        const rent = getRentForBlock(lat, lng);
        setSelectedBlock({ score: 0, reasons: ["No specific data here."], rent, id: 'temp' });
    }
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" />
      
      {/* 🟢 FAKE SEARCH BAR (Opens Modal) */}
      <TouchableOpacity 
        style={styles.fakeSearchWrapper} 
        activeOpacity={0.8} 
        onPress={() => setSearchModalVisible(true)}
      >
        <Ionicons name="search" size={20} color="#bbb" style={{ marginRight: 10 }} />
        <Text style={[styles.fakeSearchText, { color: displayAddress ? 'white' : '#bbb' }]} numberOfLines={1}>
          {displayAddress || "Search Hamilton address..."}
        </Text>
      </TouchableOpacity>

      <MapView
        ref={mapRef} 
        style={styles.map} 
        initialRegion={HAMILTON_REGION} 
        showsUserLocation={true} 
        provider={PROVIDER_DEFAULT}
        userInterfaceStyle="dark"
        onMapReady={() => setIsMapReady(true)} 
        onPress={() => { setSelectedBlock(null); }}
      >
        {isDataLoaded && gridPolygons.map((poly: any, index: number) => (
          <Polygon 
            key={index} 
            coordinates={poly.coordinates} 
            fillColor={poly.color} 
            strokeColor="rgba(255,255,255,0.2)" 
            strokeWidth={1} 
            tappable={true}
            onPress={(e) => { e.stopPropagation(); setSelectedBlock(poly); }}
          />
        ))}
        {isDataLoaded && userReports.map((event: any) => (
          <Marker 
            key={event.id} 
            coordinate={{ latitude: event.lat, longitude: event.lng }} 
            pinColor={event.type === 'safety' ? 'red' : 'gold'}
            onPress={(e) => { e.stopPropagation(); Alert.alert("User Report", event.description); }}
          />
        ))}
      </MapView>

      {/* 🔴 SEARCH MODAL (Fixed Double Tap + No Red Error) */}
      <Modal visible={searchModalVisible} animationType="slide" presentationStyle="fullScreen">
        <SafeAreaView style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <TouchableOpacity onPress={() => setSearchModalVisible(false)} style={styles.backButton}>
              <Ionicons name="arrow-back" size={24} color="white" />
            </TouchableOpacity>
            <Text style={styles.modalTitle}>Search Location</Text>
            <View style={{width: 24}} /> 
          </View>
          
          <View style={styles.searchBody}>
            {/* ⚡️ REMOVED SCROLLVIEW WRAPPER TO FIX ERROR */}
            <GooglePlacesAutocomplete
                placeholder='Enter address...'
                fetchDetails={true}
                autoFocus={true} 
                debounce={400}
                minLength={2}
                onPress={handleSearchSelect}
                
                // ⚡️ THE FIX: This prop allows touches even when keyboard is up
                keyboardShouldPersistTaps='handled'
                
                query={{ 
                    key: GOOGLE_API_KEY, language: 'en', components: 'country:ca', 
                    location: '43.2557,-79.8711', radius: '10000', strictbounds: true 
                }}
                styles={{
                    container: { flex: 1, backgroundColor: '#000' },
                    textInputContainer: { backgroundColor: '#000', paddingHorizontal: 10 },
                    textInput: styles.modalInput,
                    listView: { backgroundColor: '#000' },
                    row: { backgroundColor: '#000', paddingVertical: 15, borderBottomColor: '#333', borderBottomWidth: 1 },
                    description: { color: 'white', fontSize: 16 },
                    poweredContainer: { backgroundColor: '#000' }
                }}
                textInputProps={{ placeholderTextColor: '#666' }}
            />
          </View>
        </SafeAreaView>
      </Modal>

      {/* 🌀 LOADING */}
      {isLoading && (
        <View style={styles.loadingOverlay}>
          <ActivityIndicator size="large" color="#fbbf24" />
          <Text style={styles.loadingText}>Analyzing Hamilton...</Text>
        </View>
      )}

      {/* 🎫 CARD */}
      {selectedBlock && !isLoading && (
        <Animated.View style={[styles.card, { transform: [{ translateY: slideAnim }] }]}>
          <View style={styles.cardHandle} />
          <View style={styles.cardHeader}>
            <View style={{flex: 1}}>
                <Text style={styles.cardZoneName}>{selectedBlock.rent?.name || "Unknown Zone"}</Text>
                <View style={styles.rentRow}>
                  <Text style={styles.rentLabel}>1BR</Text>
                  <Text style={styles.rentValue}>${selectedBlock.rent?.p1}</Text>
                  <View style={styles.rentDivider} />
                  <Text style={styles.rentLabel}>2BR</Text>
                  <Text style={styles.rentValue}>${selectedBlock.rent?.p2}</Text>
                </View>
                <Text style={styles.cardSubtitle}>Zonal Average (CMHC 2025)</Text>
            </View>
            <View style={[styles.scoreBadge, { backgroundColor: selectedBlock.score >= 0 ? '#22c55e' : '#ef4444' }]}>
                <Text style={styles.scoreTitle}>SCORE</Text>
                <Text style={styles.scoreText}>{selectedBlock.score}</Text>
            </View>
          </View>
          <TouchableOpacity style={styles.closeButton} onPress={() => setSelectedBlock(null)}>
             <Ionicons name="close-circle" size={28} color="#555" />
          </TouchableOpacity>
          <View style={styles.divider} />
          <Text style={styles.reasonsTitle}>LIVABILITY FACTORS</Text>
          <View style={styles.reasonsContainer}>
            {selectedBlock.reasons && selectedBlock.reasons.map((r: string, i: number) => (
              <Text key={i} style={styles.reasonText}>{r}</Text>
            ))}
            {(!selectedBlock.reasons || selectedBlock.reasons.length === 0) && <Text style={styles.reasonText}>No significant data recorded.</Text>}
          </View>
        </Animated.View>
      )}

      {/* LEGEND */}
      {!selectedBlock && !isLoading && (
        <View style={styles.legendContainer}>
          <Text style={styles.legendTitle}>Livability Index</Text>
          <View style={styles.legendItem}><View style={[styles.legendBox, { backgroundColor: 'rgba(0, 255, 0, 0.4)' }]} /><Text style={styles.legendText}>High</Text></View>
          <View style={styles.legendItem}><View style={[styles.legendBox, { backgroundColor: 'rgba(255, 0, 0, 0.5)' }]} /><Text style={styles.legendText}>Low</Text></View>
        </View>
      )}

      {/* ⚡️ FAB VISIBILITY: ONLY WHEN NOT LOADING */}
      {!isLoading && <FAB onPress={() => setModalVisible(true)} />}
      
      <ReportModal visible={modalVisible} onClose={() => setModalVisible(false)} onSubmit={handleSubmit} isLoading={isSubmitting} />
      {showDisclaimer && <DisclaimerModal />}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  map: { width: '100%', height: '100%' },
  
  fakeSearchWrapper: { 
    position: 'absolute', top: 60, width: '90%', alignSelf: 'center', zIndex: 100,
    backgroundColor: '#1c1c1e', height: 50, borderRadius: 25,
    flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20,
    shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, elevation: 8,
    borderWidth: 1, borderColor: '#333'
  },
  fakeSearchText: { fontSize: 16, fontWeight: '500' },

  // MODAL
  modalContainer: { flex: 1, backgroundColor: '#000' }, 
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#333' },
  backButton: { padding: 5 },
  modalTitle: { fontSize: 18, fontWeight: 'bold', color: 'white' },
  searchBody: { flex: 1, padding: 15, backgroundColor: '#000' }, 
  modalInput: { backgroundColor: '#1c1c1e', borderRadius: 8, height: 50, paddingHorizontal: 15, fontSize: 16, color: 'white', marginBottom: 10 },

  loadingOverlay: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: '#000', justifyContent: 'center', alignItems: 'center', zIndex: 999 },
  loadingText: { color: '#fbbf24', marginTop: 15, fontSize: 16, fontWeight: 'bold', letterSpacing: 1 },

  card: { position: 'absolute', bottom: 30, left: 15, right: 15, backgroundColor: '#1c1c1e', borderRadius: 24, padding: 24, paddingTop: 12, shadowColor: '#000', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.5, shadowRadius: 15, elevation: 20, zIndex: 50 },
  cardHandle: { width: 40, height: 4, backgroundColor: '#333', borderRadius: 2, alignSelf: 'center', marginBottom: 15 },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', paddingRight: 30 },
  cardZoneName: { color: 'white', fontSize: 20, fontWeight: '800', marginBottom: 8, letterSpacing: 0.5 },
  rentRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 4 },
  rentLabel: { color: '#888', fontSize: 13, fontWeight: '600', marginRight: 4 },
  rentValue: { color: '#fbbf24', fontSize: 16, fontWeight: '700' },
  rentDivider: { width: 1, height: 14, backgroundColor: '#444', marginHorizontal: 12 },
  cardSubtitle: { color: '#666', fontSize: 11, fontStyle: 'italic', marginTop: 4 },
  scoreBadge: { width: 56, height: 56, borderRadius: 16, justifyContent: 'center', alignItems: 'center', shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.3, shadowRadius: 3 },
  scoreTitle: { color: 'rgba(255,255,255,0.8)', fontSize: 8, fontWeight: 'bold' },
  scoreText: { color: 'white', fontSize: 22, fontWeight: '900' },
  closeButton: { position: 'absolute', top: 15, right: 15, zIndex: 10 },
  divider: { height: 1, backgroundColor: '#333', marginVertical: 18 },
  reasonsTitle: { color: '#666', fontSize: 11, fontWeight: '800', marginBottom: 10, letterSpacing: 1 },
  reasonsContainer: { flexDirection: 'row', flexWrap: 'wrap' },
  reasonText: { color: '#e5e5e5', fontSize: 13, marginRight: 8, marginBottom: 8, backgroundColor: '#2c2c2e', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8, overflow:'hidden', fontWeight: '500' },
  legendContainer: { position: 'absolute', bottom: 100, left: 20, backgroundColor: 'rgba(28,28,30,0.9)', padding: 10, borderRadius: 10 },
  legendTitle: { color: '#888', fontSize: 10, fontWeight: 'bold', marginBottom: 4 },
  legendItem: { flexDirection: 'row', alignItems: 'center', marginBottom: 5 },
  legendBox: { width: 12, height: 12, borderRadius: 3, marginRight: 8 },
  legendText: { color: '#ccc', fontSize: 12 }
});