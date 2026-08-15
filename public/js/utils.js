// /js/utils.js

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

// 🚘 Calcular distancia, duración y costo del viaje
// ✅ MEJORADO: Más tolerante con direcciones, agrega ", Argentina" si no encuentra
export async function calculateRouteCost(origen, destino, precios, personas = 1) {
  if (!origen?.trim() || !destino?.trim()) {
    throw new Error('️ Escribí correctamente Origen y Destino');
  }

  // Helper para geocodificar con fallback a agregar ", Argentina"
  async function geocode(query, label) {
    let res;
    try {
      res = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&limit=3`,
        { headers: { 'Accept-Language': 'es' } }
      ).then(r => r.json());
    } catch {
      throw new Error(` Error de conexión al buscar ${label}`);
    }

    if (!Array.isArray(res) || res.length === 0) {
      // Intentar agregando ", Argentina" al final
      try {
        res = await fetch(
          `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query + ', Argentina')}&limit=3`,
          { headers: { 'Accept-Language': 'es' } }
        ).then(r => r.json());
      } catch {
        throw new Error(`🌐 Error de conexión al buscar ${label}`);
      }
    }

    if (!Array.isArray(res) || res.length === 0) {
      throw new Error(`📍 No encontré: "${query}". Intentá ser más específico (calle, número, ciudad, provincia)`);
    }

    return res;
  }

  // Geocodificar ORIGEN
  const origRes = await geocode(origen.trim(), 'origen');
  const oLat = parseFloat(origRes[0].lat);
  const oLng = parseFloat(origRes[0].lon);

  // Geocodificar DESTINO
  const destRes = await geocode(destino.trim(), 'destino');
  const dLat = parseFloat(destRes[0].lat);
  const dLng = parseFloat(destRes[0].lon);

  if(isNaN(oLat)||isNaN(oLng)||isNaN(dLat)||isNaN(dLng)){
    throw new Error(' Coordenadas inválidas en una dirección');
  }

  // 🛣️ Consultar ruta y distancia (OSRM público)
  let routeRes;
  try {
    routeRes = await fetch(
      `https://router.project-osrm.org/route/v1/driving/${oLng},${oLat};${dLng},${dLat}?overview=false`
    ).then(r => r.json());
  } catch {
    throw new Error('🛣️ Servicio de rutas no disponible, intentá en unos segundos');
  }

  if (!routeRes?.routes?.length) {
    throw new Error('❌ No se pudo calcular la ruta entre los puntos');
  }

  const distanceKm = Number((routeRes.routes[0].distance / 1000).toFixed(2));
  const durationHours = Number((routeRes.routes[0].duration / 3600).toFixed(2));

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
    distance: `${distanceKm.toFixed(1)} km`,
    duration: `${durationHours.toFixed(1)} h`,
    distanceKm,
    durationHours
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
    showAlert(' Archivo Excel generado correctamente', 'success');
  } catch (err) {
    showAlert(`❌ No se pudo exportar: ${err.message}`, 'danger');
  }
}