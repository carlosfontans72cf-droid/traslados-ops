// /js/utils.js

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
    animation:fadeIn 0.3s ease;
  `;
  div.textContent = message;
  document.body.appendChild(div);
  setTimeout(() => { div.style.opacity = '0'; div.style.transition = 'opacity 0.3s'; setTimeout(() => div.remove(), 300); }, 4000);
}

export function formatDate(timestamp) {
  if (!timestamp) return '-';
  const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
  return date.toLocaleString('es-ES');
}

export function getCurrentLocation() {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) return reject('Geolocalización no soportada');
    navigator.geolocation.getCurrentPosition(
      pos => resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      err => reject(err),
      { enableHighAccuracy: true, timeout: 10000 }
    );
  });
}

export async function calculateRouteCost(origen, destino, precios, personas = 1) {
  // Geocodificar origen
  const origRes = await fetch(
    `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(origen)}&limit=1`,
    { headers: { 'Accept-Language': 'es' } }
  ).then(r => r.json());

  const destRes = await fetch(
    `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(destino)}&limit=1`,
    { headers: { 'Accept-Language': 'es' } }
  ).then(r => r.json());

  if (!origRes.length || !destRes.length) throw new Error('📍 Dirección no encontrada. Verifica origen y destino.');

  const oLat = parseFloat(origRes[0].lat);
  const oLng = parseFloat(origRes[0].lon);
  const dLat = parseFloat(destRes[0].lat);
  const dLng = parseFloat(destRes[0].lon);

  // Obtener ruta
  const routeRes = await fetch(
    `https://router.project-osrm.org/route/v1/driving/${oLng},${oLat};${dLng},${dLat}?overview=false&geometries=geojson`
  ).then(r => r.json());

  if (!routeRes.routes?.length) throw new Error('No se pudo calcular la ruta');

  const distanceKm = routeRes.routes[0].distance / 1000;
  const durationHours = routeRes.routes[0].duration / 3600;

  // Calcular costo con fórmula del dueño
  const costo = (
    (distanceKm * (precios.porKm || 0)) +
    (durationHours * (precios.porHora || 0)) +
    (personas * (precios.porPersona || 0)) +
    (1 * (precios.porZona || 0))
  ).toFixed(2);

  return {
    costo: `$${costo}`,
    distance: `${distanceKm.toFixed(1)} km`,
    duration: `${durationHours.toFixed(1)} h`,
    distanceKm,
    durationHours
  };
}

export function exportToExcel(data, filename = 'historial.xlsx') {
  if (typeof XLSX === 'undefined') {
    return showAlert('Librería Excel no cargada', 'warning');
  }
  const ws = XLSX.utils.json_to_sheet(data);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Datos');
  XLSX.writeFile(wb, filename);
}