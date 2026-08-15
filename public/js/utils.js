// /js/utils.js

// 🔑 API Key de Google Maps (restringida a tu dominio)
const GOOGLE_MAPS_API_KEY = 'AIzaSyAF2Yqau-KETXUes3P-ST5CkIeWLvSGhBc';

// 📢 Mostrar aviso temporal en esquina superior derecha
export function showAlert(message, type = 'info') {
  const colors = {
    success: '#28a745',
    danger: '#dc3545',
    warning: '#ffc107',
    info: '#17a2b8'
  };

  const div = document.createElement('div');
  div.style.cssText = `
    position:fixed;top:20px;right:20px;z-index:9999;
    padding:15px 25px;border-radius:8px;color:white;
    font-weight:600;background:${colors[type] || colors.info};
    box-shadow:0 4px 15px rgba(0,0,0,0.3);
    transition: all 0.3s ease; opacity:1;
  `;
  div.textContent = message;
  document.body.appendChild(div);

  setTimeout(() => {
    div.style.opacity = '0';
    div.style.transform = 'translateY(-10px)';
    setTimeout(() => div.remove(), 300);
  }, 4000);
}

// 📅 Formatear fecha/hora legible
export function formatDate(timestamp) {
  if (!timestamp) return '—';
  try {
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    if (isNaN(date.getTime())) return 'Fecha inválida';
    return date.toLocaleString('es-ES', {
      day:'2-digit', month:'2-digit', year:'numeric',
      hour:'2-digit', minute:'2-digit'
    });
  } catch {
    return '—';
  }
}

// 📍 Obtener ubicación actual GPS
export function getCurrentLocation() {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      return reject(new Error(' Geolocalización no soportada'));
    }
    navigator.geolocation.getCurrentPosition(
      pos => resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      err => {
        let mensaje = 'No se pudo obtener ubicación';
        if(err.code===1) mensaje=' Permiso denegado para ubicación';
        else if(err.code===2) mensaje=' Señal GPS no disponible';
        else if(err.code===3) mensaje=' Tiempo agotado buscando ubicación';
        reject(new Error(mensaje));
      },
      { enableHighAccuracy: true, timeout: 12000, maximumAge:0 }
    );
  });
}

// 🗺️ Geocodificación con Google Maps (mucho mejor que Nominatim)
async function googleGeocode(address) {
  if (!address?.trim()) {
    throw new Error(' La dirección está vacía');
  }

  // Agregar contexto de Uruguay/Maldonado para mejorar búsquedas
  let query = address.trim();
  // Si no parece tener país, agregar Uruguay
  if (!/uruguay|argentina|brasil|brazil/i.test(query)) {
    query = query + ', Uruguay';
  }

  const url = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(query)}&key=${GOOGLE_MAPS_API_KEY}&language=es`;

  let response;
  try {
    response = await fetch(url).then(r => r.json());
  } catch {
    throw new Error('🌐 Error de conexión con Google Maps');
  }

  if (response.status !== 'OK') {
    const errorMessages = {
      'ZERO_RESULTS': `📍 No encontré: "${address}". Intentá ser más específico (calle, número, ciudad)`,
      'OVER_QUERY_LIMIT': '⚠️ Límite de consultas alcanzado. Intentá en unos minutos',
      'REQUEST_DENIED': '❌ Google Maps rechazó la consulta. Verificá la API Key',
      'INVALID_REQUEST': ' Petición inválida. Verificá la dirección'
    };
    throw new Error(errorMessages[response.status] || `Error de Google Maps: ${response.status}`);
  }

  if (!response.results || response.results.length === 0) {
    throw new Error(` No encontré: "${address}". Intentá ser más específico`);
  }

  return response.results[0];
}

// 🚘 Calcular distancia, duración y costo del viaje (usando Google Maps)
export async function calculateRouteCost(origen, destino, precios, personas = 1) {
  if (!origen?.trim() || !destino?.trim()) {
    throw new Error('⚠️ Escribí correctamente Origen y Destino');
  }

  // Geocodificar con Google Maps
  const origResult = await googleGeocode(origen);
  const destResult = await googleGeocode(destino);

  const oLat = origResult.geometry.location.lat;
  const oLng = origResult.geometry.location.lng;
  const dLat = destResult.geometry.location.lat;
  const dLng = destResult.geometry.location.lng;

  // Consultar ruta con Google Directions API
  const directionsUrl = `https://maps.googleapis.com/maps/api/directions/json?origin=${oLat},${oLng}&destination=${dLat},${dLng}&mode=driving&key=${GOOGLE_MAPS_API_KEY}&language=es`;

  let dirResponse;
  try {
    dirResponse = await fetch(directionsUrl).then(r => r.json());
  } catch {
    throw new Error('🛣️ Error de conexión al calcular la ruta');
  }

  if (dirResponse.status !== 'OK' || !dirResponse.routes || !dirResponse.routes.length) {
    const errorMessages = {
      'ZERO_RESULTS': '❌ No hay ruta entre los dos puntos',
      'MAX_WAYPOINTS_EXCEEDED': '❌ Demasiados puntos intermedios',
      'OVER_QUERY_LIMIT': '️ Límite de consultas alcanzado',
      'REQUEST_DENIED': '❌ Google Maps rechazó la consulta',
      'INVALID_REQUEST': ' Petición inválida'
    };
    throw new Error(errorMessages[dirResponse.status] || '❌ No se pudo calcular la ruta');
  }

  const route = dirResponse.routes[0];
  const leg = route.legs[0];

  const distanceKm = Number((leg.distance.value / 1000).toFixed(2));
  const durationHours = Number((leg.duration.value / 3600).toFixed(2));

  // 💰 Cálculo de costo
  const pKm = Number(precios?.porKm) || 0;
  const pHora = Number(precios?.porHora) || 0;
  const pPersona = Number(precios?.porPersona) || 0;
  const pZona = Number(precios?.porZona) || 0;
  const cantPersonas = Math.max(1, Number(personas) || 1);

  const costoTotal = (
    distanceKm * pKm +
    durationHours * pHora +
    cantPersonas * pPersona +
    pZona
  ).toFixed(2);

  return {
    costo: `$${costoTotal}`,
    distance: `${leg.distance.text} (${distanceKm.toFixed(1)} km)`,
    duration: `${leg.duration.text} (${durationHours.toFixed(1)} h)`,
    distanceKm,
    durationHours,
    direccionCompletaOrigen: origResult.formatted_address,
    direccionCompletaDestino: destResult.formatted_address
  };
}

//  Exportar a Excel
export function exportToExcel(data, filename = 'historial_traslados.xlsx') {
  if (typeof XLSX === 'undefined') {
    return showAlert(' Librería Excel no cargada', 'warning');
  }
  if (!Array.isArray(data) || data.length === 0) {
    return showAlert('ℹ️ No hay registros para generar archivo', 'info');
  }
  try {
    const hoja = XLSX.utils.json_to_sheet(data);
    const libro = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(libro, hoja, 'Datos');
    XLSX.writeFile(libro, filename);
    showAlert('📊 Archivo Excel generado correctamente', 'success');
  } catch (err) {
    showAlert(`❌ No se pudo exportar: ${err.message}`, 'danger');
  }
}