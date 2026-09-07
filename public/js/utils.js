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

// 🗺️ Geocodificación usando nuestro servidor (sin CORS)
async function googleGeocode(address) {
  if (!address?.trim()) {
    throw new Error(' La dirección está vacía');
  }

  const url = `/api/route?type=geocode&address=${encodeURIComponent(address)}`;

  let response;
  try {
    response = await fetch(url).then(r => r.json());
  } catch {
    throw new Error(' Error de conexión al buscar dirección');
  }

  if (response.error) {
    throw new Error(response.error);
  }

  if (response.status !== 'OK' || !response.results || !response.results.length) {
    throw new Error(`📍 No encontré: "${address}". Intentá ser más específico (calle, número, ciudad)`);
  }

  return response.results[0];
}

// 🚘 Calcular distancia, duración y costo del viaje
// ✅ USA NUESTRO SERVIDOR - SIN CORS - SIN SERVICE WORKER INTERFIRIENDO
//
// 💰 SISTEMA DE TARIFA ÚNICA: cada viaje se cobra con UN SOLO modo de tarifa,
// nunca se suman. Los modos posibles son:
//   'km'      -> distanciaKm * precios.porKm
//   'hora'    -> duracionHoras * precios.porHora
//   'persona' -> cantidadPersonas * precios.porPersona
//   'zona'    -> distanciaKm * precio-por-km DE LA ZONA elegida (zonaNombre)
//
// precios.zonas es un array de { nombre, precioPorKm } que administra el
// dueño/manager desde "Configuración de Precios".
export async function calculateRouteCost(origen, destino, precios, personas = 1, modo = 'km', zonaNombre = null) {
  if (!origen?.trim() || !destino?.trim()) {
    throw new Error('️ Escribí correctamente Origen y Destino');
  }

  // Geocodificar usando nuestro servidor
  const origResult = await googleGeocode(origen);
  const destResult = await googleGeocode(destino);

  const oLat = origResult.geometry.location.lat;
  const oLng = origResult.geometry.location.lng;
  const dLat = destResult.geometry.location.lat;
  const dLng = destResult.geometry.location.lng;

  // Consultar ruta usando nuestro servidor
  const directionsUrl = `/api/route?type=directions&origin=${oLat},${oLng}&destination=${dLat},${dLng}&mode=driving`;

  let dirResponse;
  try {
    dirResponse = await fetch(directionsUrl).then(r => r.json());
  } catch {
    throw new Error('🛣️ Error de conexión al calcular la ruta');
  }

  if (dirResponse.error) {
    throw new Error(dirResponse.error);
  }

  if (dirResponse.status !== 'OK' || !dirResponse.routes || !dirResponse.routes.length) {
    throw new Error('❌ No se pudo calcular la ruta entre los puntos');
  }

  const route = dirResponse.routes[0];
  const leg = route.legs[0];

  const distanceKm = Number((leg.distance.value / 1000).toFixed(2));
  const durationHours = Number((leg.duration.value / 3600).toFixed(2));
  const cantPersonas = Math.max(1, Number(personas) || 1);

  // 💰 Cálculo de costo — SOLO el modo elegido, nunca se suman entre sí
  let costoTotal = 0;
  let etiquetaModo = '';

  if (modo === 'zona') {
    const zona = (precios?.zonas || []).find(z => z.nombre === zonaNombre);
    if (!zona) {
      throw new Error('📍 Seleccioná una zona válida configurada por tu empresa');
    }
    costoTotal = distanceKm * (Number(zona.precioPorKm) || 0);
    etiquetaModo = `Zona: ${zona.nombre} ($${zona.precioPorKm}/km)`;

  } else if (modo === 'hora') {
    const pHora = Number(precios?.porHora) || 0;
    costoTotal = durationHours * pHora;
    etiquetaModo = `Por hora ($${pHora}/h)`;

  } else if (modo === 'persona') {
    const pPersona = Number(precios?.porPersona) || 0;
    costoTotal = cantPersonas * pPersona;
    etiquetaModo = `Por persona ($${pPersona} x ${cantPersonas})`;

  } else {
    // 'km' es el modo por defecto
    const pKm = Number(precios?.porKm) || 0;
    costoTotal = distanceKm * pKm;
    etiquetaModo = `Por kilómetro ($${pKm}/km)`;
  }

  costoTotal = Number(costoTotal.toFixed(2));

  return {
    costo: `$${costoTotal}`,
    costoNumero: costoTotal,
    distance: `${leg.distance.text} (${distanceKm.toFixed(1)} km)`,
    duration: `${leg.duration.text} (${durationHours.toFixed(1)} h)`,
    distanceKm,
    durationHours,
    modo,
    zonaNombre: modo === 'zona' ? zonaNombre : null,
    etiquetaModo,
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
    showAlert(' Archivo Excel generado correctamente', 'success');
  } catch (err) {
    showAlert(`❌ No se pudo exportar: ${err.message}`, 'danger');
  }
}