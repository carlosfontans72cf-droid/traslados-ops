// /js/driver.js
import { db } from './firebase-config.js';
import { doc, getDoc, updateDoc, collection, addDoc, query, where, getDocs, serverTimestamp } 
from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";
import { showAlert, getCurrentLocation, calculateRouteCost } from './utils.js';

// Recuperar datos sesión (CORREGIDO: fullName en vez de userName)
let driverId = sessionStorage.getItem('userId');
let driverName = sessionStorage.getItem('fullName');

// ✅ Empresa del usuario logueado — todo el panel opera dentro de este "cajón"
const companyId = sessionStorage.getItem('companyId');

// Redirigir si NO hay sesión activa
if (!driverId || !driverName || !companyId) {
    window.location.href = '/';
}

let map, marker;
let watchId = null;
let tripActive = false;
let tripStartTime = null;
let capaRuta = null;      // polyline de la ruta dibujada en el mapa
let marcadoresRuta = [];  // marcadores de origen/destino

// Mostrar nombre en pantalla
const nombreElemento = document.getElementById('driver-name');
if(nombreElemento) nombreElemento.textContent = driverName;

// ========== INICIALIZAR MAPA ==========
async function initMap() {
  try {
    // Obtener ubicación actual
    const pos = await getCurrentLocation();
    // Cargar mapa en posición actual
    map = L.map('driver-map').setView([pos.lat, pos.lng], 15);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { 
        attribution: '© OpenStreetMap contributors' 
    }).addTo(map);
    // Marcador propio
    marker = L.marker([pos.lat, pos.lng]).addTo(map)
           .bindPopup('📍 Tu ubicación')
           .openPopup();
    startGPS(); // Iniciar seguimiento continuo
  } catch (e) {
    // Si falla ubicación: carga mapa en ubicación por defecto
    console.warn("Ubicación no disponible, cargando mapa general:", e);
    map = L.map('driver-map').setView([-34.6037, -58.3816], 12);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { 
        attribution: '© OpenStreetMap contributors' 
    }).addTo(map);
    startGPS();
  }
}

// ========== SEGUIMIENTO GPS ACTUALIZA EN TIEMPO REAL ==========
function startGPS() {
  if (!navigator.geolocation) {
    showAlert("GPS no soportado en este dispositivo", "warning");
    return;
  }
  watchId = navigator.geolocation.watchPosition(
    async (pos) => {
      const { latitude, longitude } = pos.coords;
      // Actualizar posición marcador en mapa
      if (marker) marker.setLatLng([latitude, longitude]);
      // Guardar ubicación actualizada en usuario
      try {
        await updateDoc(doc(db, 'companies', companyId, 'users', driverId), {
          lat: latitude, 
          lng: longitude, 
          lastUpdate: serverTimestamp()
        });
      } catch(err) {
        console.log("No se pudo actualizar ubicación:", err);
      }
    },
    (err) => {
      console.error("⚠️ Error recepción GPS:", err);
      showAlert("⚠️ Señal GPS débil o sin señal", "warning");
    },
    { enableHighAccuracy: true, timeout: 10000, maximumAge: 5000 }
  );
}

// ========== CARGAR ZONAS DISPONIBLES PARA ELEGIR AL CREAR VIAJE ==========
async function cargarZonasDisponibles() {
  const select = document.getElementById('trip-zona');
  if (!select) return;
  try {
    const priceSnap = await getDoc(doc(db, 'companies', companyId, 'config', 'prices'));
    const zonas = priceSnap.exists() ? (priceSnap.data().zonas || []) : [];
    select.innerHTML = '<option value="">-- Seleccionar zona --</option>' +
      zonas.map(z => `<option value="${z.nombre}">${z.nombre} ($${z.precioPorKm}/km)</option>`).join('');
  } catch (err) {
    console.warn('No se pudieron cargar las zonas:', err);
  }
}

// Mostrar/ocultar el select de zona según el modo de tarifa elegido
function setupModoTarifaToggle() {
  const selectModo = document.getElementById('trip-modo');
  const wrapZona = document.getElementById('zona-select-wrap');
  if (!selectModo || !wrapZona) return;

  const actualizar = () => {
    wrapZona.classList.toggle('visible', selectModo.value === 'zona');
  };
  selectModo.addEventListener('change', actualizar);
  actualizar();
}

// ========== DIBUJAR RUTA EN EL MAPA ==========
function dibujarRutaEnMapa(resultado) {
  if (!map) return;

  // Limpiar ruta/marcadores anteriores
  if (capaRuta) { map.removeLayer(capaRuta); capaRuta = null; }
  marcadoresRuta.forEach(m => map.removeLayer(m));
  marcadoresRuta = [];

  if (!resultado.rutaPuntos || resultado.rutaPuntos.length === 0) return;

  capaRuta = L.polyline(resultado.rutaPuntos, { color: '#2563eb', weight: 5, opacity: 0.85 }).addTo(map);

  const mOrigen = L.marker([resultado.origenCoords.lat, resultado.origenCoords.lng])
    .addTo(map).bindPopup('🟢 Origen');
  const mDestino = L.marker([resultado.destinoCoords.lat, resultado.destinoCoords.lng])
    .addTo(map).bindPopup('🔴 Destino');
  marcadoresRuta.push(mOrigen, mDestino);

  // Ajustar el zoom para que se vea toda la ruta
  map.fitBounds(capaRuta.getBounds(), { padding: [30, 30] });
}

// ========== ABRIR RUTA EN GOOGLE MAPS (navegación real) ==========
function construirUrlGoogleMaps(origen, destino) {
  return `https://www.google.com/maps/dir/?api=1&origin=${encodeURIComponent(origen)}&destination=${encodeURIComponent(destino)}&travelmode=driving`;
}

window.abrirEnGoogleMaps = () => {
  const datos = window._ultimoCalculo;
  if (!datos) {
    return showAlert("ℹ️ Primero calculá el costo del viaje", "warning");
  }
  window.open(construirUrlGoogleMaps(datos.origen, datos.destino), '_blank');
};

// ========== CALCULAR PRECIO Y DATOS DEL VIAJE ==========
window.calculateCost = async () => {
  const origen = document.getElementById('trip-origen').value.trim();
  const destino = document.getElementById('trip-destino').value.trim();
  const personas = parseInt(document.getElementById('trip-personas').value) || 1;
  const modo = document.getElementById('trip-modo')?.value || 'km';
  const zonaNombre = document.getElementById('trip-zona')?.value || null;

  if (!origen || !destino) {
    return showAlert("⚠️ Escribe punto de ORIGEN y DESTINO", "warning");
  }
  if (modo === 'zona' && !zonaNombre) {
    return showAlert("📍 Seleccioná una zona", "warning");
  }

  try {
    // Leer lista de precios configurada
    const priceSnap = await getDoc(doc(db, 'companies', companyId, 'config', 'prices'));
    const precios = priceSnap.exists() ? priceSnap.data() : { porPersona:0, porKm:0, porHora:0, zonas:[] };

    // Calcular distancia, tiempo y monto (un solo modo, no se suman)
    const resultado = await calculateRouteCost(origen, destino, precios, personas, modo, zonaNombre);

    // Mostrar resultados en pantalla
    document.getElementById('trip-result').style.display = 'block';
    document.getElementById('trip-cost-display').textContent = resultado.costo;
    document.getElementById('trip-distance-display').textContent = `📏 Distancia: ${resultado.distance}`;
    document.getElementById('trip-duration-display').textContent = `⏱ Tiempo aprox: ${resultado.duration} · ${resultado.etiquetaModo}`;

    // Guardar datos para iniciar luego
    window._ultimoCalculo = { 
        ...resultado, origen, destino, personas 
    };

    // 🗺️ Dibujar la ruta real en el mapa
    dibujarRutaEnMapa(resultado);

    // Mostrar botón para abrir navegación en Google Maps
    const btnGoogleMaps = document.getElementById('btn-google-maps');
    if (btnGoogleMaps) btnGoogleMaps.style.display = 'block';

    showAlert("✅ Cálculo realizado correctamente", "success");

  } catch (err) {
    showAlert(`❌ Error al calcular: ${err.message}`, "danger");
  }
};

// ========== COMENZAR VIAJE ==========
window.startTrip = async () => {
  if (tripActive) {
    return showAlert("️ Ya estás realizando un viaje ahora mismo", "warning");
  }
  if (!window._ultimoCalculo) {
    return showAlert("ℹ️ Primero calcula el costo antes de iniciar", "warning");
  }

  const datos = window._ultimoCalculo;

  // 🗺️ Abrir Google Maps con la ruta lista para navegar
  // (se hace ANTES de cualquier await, para que el navegador no bloquee la ventana emergente)
  window.open(construirUrlGoogleMaps(datos.origen, datos.destino), '_blank');

  try {
    // Registrar viaje en base de datos
    await addDoc(collection(db, 'companies', companyId, 'trips'), {
      userId: driverId,
      nombreConductor: driverName,
      origen: datos.origen,
      destino: datos.destino,
      pasajeros: datos.personas,
      costoTotal: datos.costo,
      distanciaKm: datos.distanceKm,
      horasEstimadas: datos.durationHours,
      modoTarifa: datos.modo,
      zonaAplicada: datos.zonaNombre,
      estado: "en_curso",
      fechaInicio: serverTimestamp(),
      latInicio: marker ? marker.getLatLng().lat : null,
      lngInicio: marker ? marker.getLatLng().lng : null
    });

    tripActive = true;
    tripStartTime = Date.now();
    showAlert(" ¡Viaje INICIADO con éxito!", "success");

  } catch(err) {
    showAlert(`❌ No se pudo iniciar: ${err.message}`, "danger");
  }
};

// ========== FINALIZAR Y CERRAR VIAJE ==========
window.endTrip = async () => {
  if (!tripActive) {
    return showAlert("ℹ️ No hay ningún viaje activo para finalizar", "warning");
  }

  try {
    // Buscar viaje propio que quede abierto/en curso
    const consulta = query(
      collection(db, 'companies', companyId, 'trips'),
      where('userId', '==', driverId),
      where('estado', '==', 'en_curso')
    );
    const resultado = await getDocs(consulta);

    if (resultado.empty) {
      tripActive = false;
      return showAlert("ℹ️ No se encontró viaje activo", "warning");
    }

    // Cerrar registrando hora final
    const viajeDoc = resultado.docs[0];
    await updateDoc(doc(db, 'companies', companyId, 'trips', viajeDoc.id), {
      estado: "finalizado",
      fechaFin: serverTimestamp(),
      latFin: marker ? marker.getLatLng().lat : null,
      lngFin: marker ? marker.getLatLng().lng : null
    });

    tripActive = false;
    tripStartTime = null;

    // Limpiar ruta dibujada y ocultar botón de Google Maps
    if (capaRuta) { map.removeLayer(capaRuta); capaRuta = null; }
    marcadoresRuta.forEach(m => map.removeLayer(m));
    marcadoresRuta = [];
    const btnGoogleMaps = document.getElementById('btn-google-maps');
    if (btnGoogleMaps) btnGoogleMaps.style.display = 'none';

    showAlert("✅ Viaje FINALIZADO y guardado correctamente", "success");

  } catch(err) {
    showAlert(`❌ Error al cerrar viaje: ${err.message}`, "danger");
  }
};

// ========== ENVIAR AVISO / ALERTA ==========
window.sendAlert = async (tipoAlerta) => {
  const descripcion = document.getElementById('alert-descripcion').value.trim();
  if (!descripcion) {
    return showAlert("⚠️ Escribe detalles del aviso antes de enviar", "warning");
  }

  try {
    // Obtener ubicación actual para adjuntar
    const ubicacionUser = await getDoc(doc(db, 'companies', companyId, 'users', driverId));
    const datosUser = ubicacionUser.exists() ? ubicacionUser.data() : {};

    await addDoc(collection(db, 'companies', companyId, 'alerts'), {
      tipo: tipoAlerta,
      descripcion: descripcion,
      userId: driverId,
      nombreConductor: driverName,
      lat: datosUser.lat || null,
      lng: datosUser.lng || null,
      fechaHora: serverTimestamp()
    });

    showAlert(`🚨 Alerta enviada: ${tipoAlerta}`, "danger");
    document.getElementById('alert-descripcion').value = "";
    // Cerrar menú
    const menu = document.getElementById('panic-dropdown');
    if(menu) menu.classList.remove('show');

  } catch(err) {
    showAlert(`❌ No se pudo enviar alerta: ${err.message}`, "danger");
  }
};

// ========== MENÚ PÁNICO / ALERTAS ==========
const btnPanico = document.getElementById('panic-btn');
if(btnPanico) {
    btnPanico.addEventListener('click', () => {
        const menu = document.getElementById('panic-dropdown');
        if(menu) menu.classList.toggle('show');
    });
}
// Cierra menú al tocar fuera
document.addEventListener('click', (e) => {
  if (!e.target.closest('.panic-container')) {
    const menu = document.getElementById('panic-dropdown');
    if(menu) menu.classList.remove('show');
  }
});

// INICIAR TODO AL CARGAR
initMap();
cargarZonasDisponibles();
setupModoTarifaToggle();