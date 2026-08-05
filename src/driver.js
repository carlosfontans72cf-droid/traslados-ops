// src/js/driver.js
import { db } from './firebase-config.js';
import { doc, getDoc, updateDoc, collection, addDoc, query, where, getDocs, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";
import { showAlert, getCurrentLocation, calculateRouteCost } from './utils.js';

let driverId = sessionStorage.getItem('userId');
let driverName = sessionStorage.getItem('userName');
let map, marker;
let watchId = null;
let tripActive = false;
let tripStartTime = null;

if (!driverId) window.location.href = '/';

document.getElementById('driver-name').textContent = driverName;

// ========== MAPA ==========
async function initMap() {
  try {
    const pos = await getCurrentLocation();
    map = L.map('driver-map').setView([pos.lat, pos.lng], 15);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { attribution: '© OSM' }).addTo(map);
    marker = L.marker([pos.lat, pos.lng]).addTo(map).bindPopup('📍 Tú').openPopup();
    startGPS();
  } catch (e) {
    map = L.map('driver-map').setView([-34.6037, -58.3816], 12);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { attribution: '© OSM' }).addTo(map);
    startGPS();
  }
}

// ========== GPS ==========
function startGPS() {
  if (!navigator.geolocation) return;
  watchId = navigator.geolocation.watchPosition(
    async pos => {
      const { latitude, longitude } = pos.coords;
      if (marker) marker.setLatLng([latitude, longitude]);
      await updateDoc(doc(db, 'users', driverId), {
        lat: latitude, lng: longitude, lastUpdate: serverTimestamp()
      });
    },
    err => console.error('GPS error:', err),
    { enableHighAccuracy: true, timeout: 10000, maximumAge: 5000 }
  );
}

// ========== CALCULAR COSTO ==========
window.calculateCost = async () => {
  const origen = document.getElementById('trip-origen').value.trim();
  const destino = document.getElementById('trip-destino').value.trim();
  const personas = parseInt(document.getElementById('trip-personas').value) || 1;

  if (!origen || !destino) return showAlert('Ingresa origen y destino', 'warning');

  const priceDoc = await getDoc(doc(db, 'config', 'prices'));
  const precios = priceDoc.exists() ? priceDoc.data() : { porPersona: 0, porZona: 0, porKm: 0, porHora: 0 };

  try {
    const result = await calculateRouteCost(origen, destino, precios, personas);
    document.getElementById('trip-result').style.display = 'block';
    document.getElementById('trip-cost-display').textContent = result.costo;
    document.getElementById('trip-distance-display').textContent = `📏 ${result.distance}`;
    document.getElementById('trip-duration-display').textContent = `⏱ ${result.duration}`;
    window._lastCalc = { ...result, origen, destino, personas, precios };
    showAlert('🧮 Costo calculado', 'success');
  } catch (e) {
    showAlert(e.message, 'danger');
  }
};

// ========== INICIAR VIAJE ==========
window.startTrip = async () => {
  if (tripActive) return showAlert('Ya hay un viaje en curso', 'warning');
  if (!window._lastCalc) return showAlert('Primero calcula el costo', 'warning');

  const c = window._lastCalc;
  await addDoc(collection(db, 'trips'), {
    userId: driverId,
    userName: driverName,
    origen: c.origen,
    destino: c.destino,
    personas: c.personas,
    costo: c.costo,
    distanceKm: c.distanceKm,
    durationHours: c.durationHours,
    estado: 'en_curso',
    startedAt: serverTimestamp()
  });

  tripActive = true;
  tripStartTime = Date.now();
  showAlert('🚐 Viaje INICIADO', 'success');
};

// ========== FINALIZAR VIAJE ==========
window.endTrip = async () => {
  if (!tripActive) return showAlert('No hay viaje en curso', 'warning');

  const q = query(collection(db, 'trips'), where('userId', '==', driverId), where('estado', '==', 'en_curso'));
  const snap = await getDocs(q);
  if (snap.empty) { tripActive = false; return showAlert('No hay viaje activo', 'warning'); }

  await updateDoc(doc(db, 'trips', snap.docs[0].id), {
    estado: 'finalizado',
    endedAt: serverTimestamp()
  });

  tripActive = false;
  tripStartTime = null;
  showAlert('✅ Viaje FINALIZADO', 'success');
};

// ========== ALERTAS ==========
window.sendAlert = async (tipo) => {
  const desc = document.getElementById('alert-descripcion').value.trim();
  if (!desc) return showAlert('Describe brevemente el detalle', 'warning');

  await addDoc(collection(db, 'alerts'), {
    tipo,
    descripcion: desc,
    userId: driverId,
    userName: driverName,
    lat: (await getDoc(doc(db, 'users', driverId))).data().lat || null,
    lng: (await getDoc(doc(db, 'users', driverId))).data().lng || null,
    createdAt: serverTimestamp()
  });

  showAlert(`🚨 Alerta "${tipo}" enviada`, 'danger');
  document.getElementById('alert-descripcion').value = '';
  document.getElementById('panic-dropdown').classList.remove('show');
};

// ========== PÁNICO ==========
document.getElementById('panic-btn')?.addEventListener('click', () => {
  document.getElementById('panic-dropdown').classList.toggle('show');
});
document.addEventListener('click', e => {
  if (!e.target.closest('.panic-container')) {
    document.getElementById('panic-dropdown')?.classList.remove('show');
  }
});

initMap();