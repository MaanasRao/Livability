import React, { useState, useEffect, useRef } from 'react';
import { StyleSheet, View, Text, Alert, TouchableOpacity, Animated, ActivityIndicator, StatusBar, BackHandler } from 'react-native';
import MapView, { Marker, Polygon, PROVIDER_DEFAULT } from 'react-native-maps';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Location from 'expo-location';
import { GooglePlacesAutocomplete } from 'react-native-google-places-autocomplete';
import { Ionicons } from '@expo/vector-icons'; 
import { SafeAreaView } from 'react-native-safe-area-context'; 
import FAB from '../components/ui/FAB';
import ReportModal from '../components/ReportModal';
import DisclaimerModal from '../components/DisclaimerModal';

// ⚠️ CONFIGURATION
const API_URL = "http://192.168.2.34:8000";
const GOOGLE_API_KEY = process.env.EXPO_PUBLIC_GOOGLE_API_KEY;
const STORAGE_KEY = '@voted_reports';


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
  const [searchMode, setSearchMode] = useState(false); 
  const [gridPolygons, setGridPolygons] = useState<any[]>([]);
  const [userReports, setUserReports] = useState<any[]>([]);
  const [selectedBlock, setSelectedBlock] = useState<any>(null);
  const [selectedReport, setSelectedReport] = useState<any>(null); // 🆕 Track selected Pin
  const [votedReportIds, setVotedReportIds] = useState<number[]>([]); // 🛡️ Anti-Spam tracker
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
    (async () => {
      try {
        const stored = await AsyncStorage.getItem(STORAGE_KEY);
        if (stored) setVotedReportIds(JSON.parse(stored));
      } catch {
        setVotedReportIds([]);
      }
    })();
  }, []);

  const persistVotes = async (ids: number[]) => {
    setVotedReportIds(ids);
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(ids));
  };


  // Handle Android Back Button
  useEffect(() => {
    const backAction = () => {
      if (searchMode) {
        setSearchMode(false);
        return true;
      }
      return false;
    };
    const backHandler = BackHandler.addEventListener("hardwareBackPress", backAction);
    return () => backHandler.remove();
  }, [searchMode]);

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

      let label = ""; let weight = 0;
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
    if (selectedBlock || selectedReport) {
      Animated.spring(slideAnim, { toValue: 0, useNativeDriver: true, friction: 8 }).start();
    } else {
      Animated.timing(slideAnim, { toValue: 500, duration: 250, useNativeDriver: true }).start();
    }
  }, [selectedBlock, selectedReport, slideAnim]);

  // --- 🚀 VOTING LOGIC ---
const handleVote = async (id: number, type: 'up' | 'down') => {
  if (votedReportIds.includes(id)) return;

  try {
    const res = await fetch(
      `${API_URL}/reports/${id}/vote?vote_type=${type}`,
      { method: 'POST' }
    );
    const data = await res.json();

    // ✅ Persist vote safely (no race conditions)
    setVotedReportIds(prev => {
      const updated = [...prev, id];
      AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
      return updated;
    });

    // ✅ Update report list
    setUserReports(prev =>
      prev.map(r => (r.id === id ? { ...r, votes: data.votes } : r))
    );

    // ✅ Update open card instantly
    setSelectedReport(prev =>
      prev ? { ...prev, votes: data.votes } : prev
    );
  } catch {
    Alert.alert('Error', 'Vote failed');
  }
};


  // --- SEARCH LOGIC ---
  const handleSearchSelect = (data: any, details: any = null) => {
    if (!details) { Alert.alert("Error", "No details found"); return; }
    const { lat, lng } = details.geometry.location;
    setDisplayAddress(data.description || "Selected Location");
    setSearchMode(false); 
    
    setTimeout(() => {
        mapRef.current?.animateToRegion({ latitude: lat, longitude: lng, latitudeDelta: 0.01, longitudeDelta: 0.01 }, 1000);
    }, 100); 

    const gridX = Math.floor(lng / GRID_SIZE);
    const gridY = Math.floor(lat / GRID_SIZE);
    const key = `${gridX},${gridY}`;
    const targetBlock = gridPolygons.find(p => p.id === key);

    setSelectedReport(null);
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
      
      <View style={[styles.mapContainer, { height: searchMode ? 0 : '100%', opacity: searchMode ? 0 : 1 }]}>
        <TouchableOpacity style={styles.fakeSearchWrapper} activeOpacity={0.8} onPress={() => setSearchMode(true)}>
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
            onPress={() => { setSelectedBlock(null); setSelectedReport(null); }}
        >
            {isDataLoaded && gridPolygons.map((poly: any, index: number) => (
            <Polygon 
                key={index} 
                coordinates={poly.coordinates} 
                fillColor={poly.color} 
                strokeColor="rgba(255,255,255,0.2)" 
                strokeWidth={1} 
                tappable={true}
                onPress={(e) => { e.stopPropagation(); setSelectedReport(null); setSelectedBlock(poly); }}
            />
            ))}
            {isDataLoaded && userReports.map((event: any) => (
            <Marker 
                key={event.id} 
                coordinate={{ latitude: event.lat, longitude: event.lng }} 
                pinColor={event.type === 'safety' ? 'red' : 'gold'}
                onPress={(e) => { e.stopPropagation(); setSelectedBlock(null); setSelectedReport(event); }}
            />
            ))}
        </MapView>

        {isLoading && (
            <View style={styles.loadingOverlay}>
            <ActivityIndicator size="large" color="#fbbf24" />
            <Text style={styles.loadingText}>Analyzing Hamilton...</Text>
            </View>
        )}

        {/* 🟡 INFO CARD (Conditional for Block or Report) */}
        {(selectedBlock || selectedReport) && !isLoading && !searchMode && (
            <Animated.View style={[styles.card, { transform: [{ translateY: slideAnim }] }]}>
            <View style={styles.cardHandle} />
            
            {selectedBlock ? (
              // BLOCK UI
              <>
                <View style={styles.cardHeader}>
                    <View style={{flex: 1}}>
                        <Text style={styles.cardZoneName}>{selectedBlock.rent?.name || "Hamilton Area"}</Text>
                        <View style={styles.rentRow}>
                        <Text style={styles.rentLabel}>1BR</Text><Text style={styles.rentValue}>${selectedBlock.rent?.p1}</Text>
                        <View style={styles.rentDivider} /><Text style={styles.rentLabel}>2BR</Text><Text style={styles.rentValue}>${selectedBlock.rent?.p2}</Text>
                        </View>
                    </View>
                    <View style={[styles.scoreBadge, { backgroundColor: selectedBlock.score >= 0 ? '#22c55e' : '#ef4444' }]}>
                        <Text style={styles.scoreText}>{selectedBlock.score}</Text>
                    </View>
                </View>
                <View style={styles.divider} />
                <View style={styles.reasonsContainer}>
                    {selectedBlock.reasons?.map((r: string, i: number) => <Text key={i} style={styles.reasonText}>{r}</Text>)}
                </View>
              </>
            ) : (
              // REPORT UI
              <>
                <View style={styles.reportHeaderRow}>
                    <Ionicons name={selectedReport.type === 'safety' ? 'warning' : 'volume-high'} size={24} color={selectedReport.type === 'safety' ? '#ef4444' : '#fbbf24'} />
                    <Text style={styles.reportTitle}>{selectedReport.type === 'safety' ? 'Safety Alert' : 'Noise'}</Text>
                </View>
                <Text style={styles.reportDescription}>"{selectedReport.description}"</Text>
                <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 10 }}>
                  <Text style={styles.voteText}>
                    Community Trust Score: {selectedReport.votes || 0}
                  </Text>

                  {votedReportIds.includes(selectedReport.id) && (
                    <View style={styles.votedBadge}>
                      <Ionicons name="checkmark-circle" size={14} color="#22c55e" />
                      <Text style={styles.votedBadgeText}>Voted</Text>
                    </View>
                  )}
                </View>

                <View style={styles.divider} />
                <View style={{flexDirection: 'row', justifyContent: 'space-between'}}>
                    <TouchableOpacity 
                      disabled={votedReportIds.includes(selectedReport.id)}
                      style={[styles.voteButton, {backgroundColor: '#fee2e2', opacity: votedReportIds.includes(selectedReport.id) ? 0.5 : 1}]} 
                      onPress={() => handleVote(selectedReport.id, 'down')}
                    >
                        <Ionicons name="thumbs-down" size={18} color="#ef4444" /><Text style={{color:'#ef4444', fontWeight:'bold', marginLeft:5}}>Fake</Text>
                    </TouchableOpacity>
                    <TouchableOpacity 
                      disabled={votedReportIds.includes(selectedReport.id)}
                      style={[styles.voteButton, {backgroundColor: '#dcfce7', opacity: votedReportIds.includes(selectedReport.id) ? 0.5 : 1}]} 
                      onPress={() => handleVote(selectedReport.id, 'up')}
                    >
                        <Ionicons name="thumbs-up" size={18} color="#22c55e" /><Text style={{color:'#22c55e', fontWeight:'bold', marginLeft:5}}>Verify</Text>
                    </TouchableOpacity>
                </View>
              </>
            )}
            
            <TouchableOpacity style={styles.closeButton} onPress={() => {setSelectedBlock(null); setSelectedReport(null);}}>
                <Ionicons name="close-circle" size={28} color="#555" />
            </TouchableOpacity>
            </Animated.View>
        )}

        {!selectedBlock && !selectedReport && !isLoading && !searchMode && (
            <View style={styles.legendContainer}>
            <Text style={styles.legendTitle}>Livability Index</Text>
            <View style={styles.legendItem}><View style={[styles.legendBox, { backgroundColor: 'rgba(0, 255, 0, 0.4)' }]} /><Text style={styles.legendText}>High</Text></View>
            <View style={styles.legendItem}><View style={[styles.legendBox, { backgroundColor: 'rgba(255, 0, 0, 0.5)' }]} /><Text style={styles.legendText}>Low</Text></View>
            </View>
        )}

        {!isLoading && !searchMode && <FAB onPress={() => setModalVisible(true)} />}
      </View>

      {searchMode && (
        <SafeAreaView style={styles.searchScreenContainer}>
          <View style={styles.modalHeader}>
            <TouchableOpacity onPress={() => setSearchMode(false)} style={styles.backButton}>
              <Ionicons name="arrow-back" size={24} color="white" />
            </TouchableOpacity>
            <Text style={styles.modalTitle}>Search Location</Text>
            <View style={{width: 24}} /> 
          </View>
          <View style={styles.searchBody}>
            <GooglePlacesAutocomplete
                placeholder='Enter address...'
                fetchDetails={true}
                autoFocus={true} 
                debounce={400}
                onPress={handleSearchSelect}
                keyboardShouldPersistTaps='always'
                query={{ key: GOOGLE_API_KEY, language: 'en', components: 'country:ca', location: '43.2557,-79.8711', radius: '10000', strictbounds: true }}
                styles={{
                    container: { flex: 1, backgroundColor: '#000' },
                    textInput: styles.modalInput,
                    description: { color: 'white' },
                    row: { backgroundColor: '#000' },
                }}
            />
          </View>
        </SafeAreaView>
      )}
      
      <ReportModal visible={modalVisible} onClose={() => setModalVisible(false)} onSubmit={handleSubmit} isLoading={isSubmitting} />
      {showDisclaimer && <DisclaimerModal />}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  mapContainer: { width: '100%', overflow: 'hidden' }, 
  map: { width: '100%', height: '100%' },
  fakeSearchWrapper: { position: 'absolute', top: 60, width: '90%', alignSelf: 'center', zIndex: 100, backgroundColor: '#1c1c1e', height: 50, borderRadius: 25, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, borderWidth: 1, borderColor: '#333' },
  fakeSearchText: { fontSize: 16, fontWeight: '500' },
  searchScreenContainer: { flex: 1, backgroundColor: '#000' },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 10 },
  modalTitle: { fontSize: 18, fontWeight: 'bold', color: 'white' },
  searchBody: { flex: 1, padding: 15 }, 
  modalInput: { backgroundColor: '#1c1c1e', borderRadius: 8, height: 50, paddingHorizontal: 15, fontSize: 16, color: 'white' },
  loadingOverlay: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: '#000', justifyContent: 'center', alignItems: 'center', zIndex: 999 },
  loadingText: { color: '#fbbf24', marginTop: 15, fontSize: 16, fontWeight: 'bold' },
  card: { position: 'absolute', bottom: 30, left: 15, right: 15, backgroundColor: '#1c1c1e', borderRadius: 24, padding: 20, zIndex: 50 },
  cardHandle: { width: 40, height: 4, backgroundColor: '#333', borderRadius: 2, alignSelf: 'center', marginBottom: 15 },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  cardZoneName: { color: 'white', fontSize: 20, fontWeight: '800' },
  rentRow: { flexDirection: 'row', alignItems: 'center', marginTop: 4 },
  rentLabel: { color: '#888', fontSize: 13, marginRight: 4 },
  rentValue: { color: '#fbbf24', fontSize: 14, fontWeight: '700' },
  rentDivider: { width: 1, height: 14, backgroundColor: '#444', marginHorizontal: 10 },
  scoreBadge: { width: 45, height: 45, borderRadius: 15, justifyContent: 'center', alignItems: 'center' },
  scoreText: { color: 'white', fontSize: 20, fontWeight: 'bold' },
  closeButton: { position: 'absolute', top: 15, right: 15 },
  divider: { height: 1, backgroundColor: '#333', marginVertical: 15 },
  reasonsContainer: { flexDirection: 'row', flexWrap: 'wrap' },
  reasonText: { color: '#eee', backgroundColor: '#333', padding: 6, borderRadius: 8, marginRight: 8, marginBottom: 8, fontSize: 12 },
  reportHeaderRow: { flexDirection: 'row', alignItems: 'center' },
  reportTitle: { color: 'white', fontSize: 18, fontWeight: 'bold', marginLeft: 10 },
  reportDescription: { color: '#ccc', marginTop: 8, fontStyle: 'italic' },
  voteText: { color: '#888', fontSize: 12, marginTop: 10 },
  voteButton: { flex: 0.48, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', padding: 12, borderRadius: 12 },
  legendContainer: { position: 'absolute', bottom: 100, left: 20, backgroundColor: 'rgba(28,28,30,0.9)', padding: 10, borderRadius: 10 },
  legendTitle: { color: '#888', fontSize: 10, fontWeight: 'bold', marginBottom: 4 },
  legendItem: { flexDirection: 'row', alignItems: 'center', marginBottom: 5 },
  legendBox: { width: 12, height: 12, borderRadius: 3, marginRight: 8 },
  legendText: { color: '#ccc', fontSize: 12 },
  votedBadge: {
  flexDirection: 'row',
  alignItems: 'center',
  backgroundColor: '#052e16',
  borderRadius: 12,
  paddingHorizontal: 8,
  paddingVertical: 3,
  marginLeft: 8,
},

votedBadgeText: {
  color: '#22c55e',
  fontSize: 11,
  fontWeight: 'bold',
  marginLeft: 4,
},

});