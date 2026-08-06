// /js/manager.js
import { db } from './firebase-config.js';
import {
  collection, getDocs, addDoc, deleteDoc, doc, updateDoc,
  query, where, getDoc, setDoc, orderBy, limit, serverTimestamp, onSnapshot
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";
import { showAlert, formatDate, exportToExcel } from './utils.js';

let map, markers = {};

// ✅ Mostrar nombre usuario, con protección por si falta elemento
const nombreUsuario = sessionStorage.getItem('userName');
const infoElement = document.getElementById('user-info');
if(infoElement && nombreUsuario) infoElement.textContent = `👔 ${nombreUsuario}`;

// ✅ Inicio general
async function init() {
  try {
    await Promise.all([
      loadDrivers(),
      loadPrices(),
      loadAlerts(),
      loadStats(),
      initLiveMap()
    ]);
    setupListeners();
  } catch (err) {
    showAlert(`Error al cargar panel: ${err.message}`, 'danger');
    console.error(err);
  }
}

// ✅ Asignar eventos botones
function setupListeners() {
  document.getElementById('btn-add-driver')?.addEventListener('click', addDriver);
  document.getElementById('btn-add-manager')?.addEventListener('click', addManager);
  document.getElementById('btn-save-prices')?.addEventListener('click', savePrices);
  document.getElementById('btn-refresh-alerts')?.addEventListener('click', loadAlerts);
  document.getElementById('btn-load-history')?.addEventListener('click', loadHistory);
  document.getElementById('btn-export-excel')?.addEventListener('click', exportHistory);
}

// ========== GESTION USUARIOS: CHOFERES / ADMINISTRADORES ==========
async function loadDrivers() {
  const tbody = document.getElementById('drivers-list');
  if(!tbody) return;
  tbody.innerHTML = '';

  try {
    const snap = await getDocs(collection(db, 'users'));
    snap.forEach(d => {
      const data = d.data();
      // Omitir dueño de la lista
      if (data.role === 'owner') return;

      const etiquetaRol = data.role === 'manager' ? '👔 Administrador' : '🚐 Chofer';
      const claseActivo = data.activo ? 'badge-active' : 'badge-inactive';
      const textoActivo = data.activo ? 'Activo' : 'Inactivo';
      const textoBoton = data.activo ? '⏸ Desactivar' : '▶ Activar';

      const fila = document.createElement('tr');
      fila.innerHTML = `
        <td>${data.nombre} ${data.apellido} <small>(${etiquetaRol})</small></td>
        <td><span class="badge ${claseActivo}">${textoActivo}</span></td>
        <td>
          <button class="btn btn-sm btn-info" onclick="toggleUser('${d.id}', ${!data.activo})">${textoBoton}</button>
          <button class="btn btn-sm btn-danger" onclick="deleteUser('${d.id}')">🗑 Eliminar</button>
          <a href="https://wa.me/?text=Hola%20${encodeURIComponent(data.nombre)}%2C%20te%20comunico%20desde%20la%20plataforma" target="_blank" class="btn btn-sm btn-success">📱 WhatsApp</a>
        </td>
      `;
      tbody.appendChild(fila);
    });
  } catch (err) {
    showAlert(`No se pudo cargar lista: ${err.message}`, 'danger');
  }
}

// Agregar nuevo chofer
window.addDriver = async () => {
  const nombre = document.getElementById('driver-nombre').value.trim();
  const apellido = document.getElementById('driver-apellido').value.trim();
  const clave = document.getElementById('driver-password').value;

  if (!nombre || !apellido || !clave) {
    return showAlert('⚠️ Completa todos los datos del chofer', 'warning');
  }

  try {
    await addDoc(collection(db, 'users'), {
      nombre: nombre,
      apellido: apellido,
      password: clave,
      role: 'driver',
      activo: true,
      createdAt: serverTimestamp()
    });
    // Limpiar campos
    document.getElementById('driver-nombre').value = '';
    document.getElementById('driver-apellido').value = '';
    document.getElementById('driver-password').value = '';
    showAlert('✅ Chofer registrado correctamente', 'success');
    loadDrivers();
  } catch (err) {
    showAlert(`❌ Error al agregar: ${err.message}`, 'danger');
  }
};

// Agregar administrador
window.addManager = async () => {
  const nombre = document.getElementById('manager-nombre').value.trim();
  const apellido = document.getElementById('manager-apellido').value.trim();
  const clave = document.getElementById('manager-password').value;

  if (!nombre || !apellido || !clave) {
    return showAlert('⚠️ Completa todos los datos del administrador', 'warning');
  }

  try {
    await addDoc(collection(db, 'users'), {
      nombre: nombre,
      apellido: apellido,
      password: clave,
      role: 'manager',
      activo: true,
      createdAt: serverTimestamp()
    });
    // Limpiar campos
    document.getElementById('manager-nombre').value = '';
    document.getElementById('manager-apellido').value = '';
    document.getElementById('manager-password').value = '';
    showAlert('✅ Administrador registrado correctamente', 'success');
    loadDrivers();
  } catch (err) {
    showAlert(`❌ Error al agregar: ${err.message}`, 'danger');
  }
};

// Activar / Desactivar usuario
window.toggleUser = async (idUsuario, nuevoEstado) => {
  try {
    await updateDoc(doc(db, 'users', idUsuario), { activo: nuevoEstado });
    loadDrivers();
    showAlert('✅ Estado actualizado', 'success');
  } catch (err) {
    showAlert(`❌ No se pudo cambiar estado: ${err.message}`, 'danger');
  }
};

// Eliminar usuario
window.deleteUser = async (idUsuario) => {
  if (!confirm('¿Seguro que deseas eliminar este usuario?')) return;
  try {
    await deleteDoc(doc(db, 'users', idUsuario));
    loadDrivers();
    showAlert('🗑 Usuario eliminado', 'success');
  } catch (err) {
    showAlert(`❌ No se pudo eliminar: ${err.message}`, 'danger');
  }
};

// ========== CONFIGURACIÓN DE PRECIOS ==========
async function loadPrices() {
  const precioRef = doc(db, 'config', 'prices');
  const precioDoc = await getDoc(precioRef);
  if (precioDoc.exists()) {
    const p = precioDoc.data();
    // Asignar valores con protección
    const elPersona = document.getElementById('price-persona');
    const elZona = document.getElementById('price-zona');
    const elKm = document.getElementById('price-km');
    const elHora = document.getElementById('price-hora');
    if(elPersona) elPersona.value = p.porPersona || 0;
    if(elZona) elZona.value = p.porZona || 0;
    if(elKm) elKm.value = p.porKm || 0;
    if(elHora) elHora.value = p.porHora || 0;
  }
}

async function savePrices() {
  try {
    await setDoc(doc(db, 'config', 'prices'), {
      porPersona: parseFloat(document.getElementById('price-persona').value) || 0,
      porZona: parseFloat(document.getElementById('price-zona').value) || 0,
      porKm: parseFloat(document.getElementById('price-km').value) || 0,
      porHora: parseFloat(document.getElementById('price-hora').value) || 0,
      updatedAt: serverTimestamp()
    });
    showAlert('💰 Precios guardados correctamente', 'success');
  } catch (err) {
    showAlert(`❌ Error al guardar precios: ${err.message}`, 'danger');
  }
}

// ========== MAPA UBICACIONES EN TIEMPO REAL ==========
function initLiveMap() {
  const contenedorMapa = document.getElementById('live-map');
  if(!contenedorMapa) return;

  // Iniciar mapa
  map = L.map('live-map').setView([-34.6037, -58.3816], 12);
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '© OpenStreetMap contributors'
  }).addTo(map);

  escucharUbicacionesChoferes();
}

function escucharUbicacionesChoferes() {
  const consultaUbic = query(
    collection(db, 'users'),
    where('role', '==', 'driver'),
    where('activo', '==', true)
  );

  onSnapshot(consultaUbic, (cambios) => {
    cambios.docChanges().forEach(cambio => {
      const idChofer = cambio.doc.id;
      const datos = cambio.doc.data();

      // Actualizar o agregar marcador si tiene coordenadas
      if (datos.lat && datos.lng) {
        if (markers[idChofer]) {
          markers[idChofer].setLatLng([datos.lat, datos.lng]);
        } else {
          markers[idChofer] = L.marker([datos.lat, datos.lng])
            .addTo(map)
            .bindPopup(`<b>${datos.nombre} ${datos.apellido}</b><br>🟢 En servicio`)
            .openPopup();
        }
      }
      // Quitar marcador si ya no cumple condición
      if (cambio.type === 'removed' && markers[idChofer]) {
        map.removeLayer(markers[idChofer]);
        delete markers[idChofer];
      }
    });
  });
}

// ========== LISTA DE ALERTAS ==========
async function loadAlerts() {
  const contenedorAlertas = document.getElementById('alerts-list');
  if(!contenedorAlertas) return;
  contenedorAlertas.innerHTML = '';

  try {
    const snap = await getDocs(query(
      collection(db, 'alerts'),
      orderBy('createdAt', 'desc'),
      limit(50)
    ));

    snap.forEach(d => {
      const datosAlerta = d.data();
      const tarjeta = document.createElement('div');
      tarjeta.className = 'card alert-card';
      tarjeta.innerHTML = `
        <strong style="color:var(--alert-red)">⚠️ ${datosAlerta.tipo || 'Alerta'}</strong> - ${datosAlerta.descripcion}
        <br><small>👤 ${datosAlerta.userName || 'Sin nombre'} | 🕒 ${formatDate(datosAlerta.createdAt)}</small>
        <div class="btn-group" style="margin-top:10px">
          <button class="btn btn-sm btn-danger" onclick="deleteAlert('${d.id}')">🗑 Borrar</button>
          <button class="btn btn-sm btn-info" onclick="saveAlert('${d.id}')">💾 Guardar</button>
        </div>
      `;
      contenedorAlertas.appendChild(tarjeta);
    });
  } catch (err) {
    showAlert(`❌ No se pudieron cargar alertas: ${err.message}`, 'danger');
  }
}

window.deleteAlert = async (idAlerta) => {
  try {
    await deleteDoc(doc(db, 'alerts', idAlerta));
    loadAlerts();
    showAlert('✅ Alerta eliminada', 'success');
  } catch (err) {
    showAlert(`❌ Error al borrar: ${err.message}`, 'danger');
  }
};

window.saveAlert = async (idAlerta) => {
  try {
    const docAlerta = await getDoc(doc(db, 'alerts', idAlerta));
    if(docAlerta.exists()){
      await addDoc(collection(db, 'saved_alerts'), {
        ...docAlerta.data(),
        guardadoEn: serverTimestamp()
      });
      showAlert('✅ Alerta guardada correctamente', 'success');
    }
  } catch (err) {
    showAlert(`❌ Error al guardar: ${err.message}`, 'danger');
  }
};

// ========== HISTORIAL DE VIAJES ==========
async function loadHistory() {
  const tablaHistorial = document.getElementById('history-list');
  if(!tablaHistorial) return;
  tablaHistorial.innerHTML = '';

  try {
    const snap = await getDocs(query(collection(db, 'trips'), orderBy('createdAt', 'desc')));
    snap.forEach(d => {
      const datosViaje = d.data();
      const fila = document.createElement('tr');
      fila.innerHTML = `
        <td>${datosViaje.userName || 'Sin asignar'}</td>
        <td>${datosViaje.origen} ➡ ${datosViaje.destino}</td>
        <td>$ ${datosViaje.costo || 0}</td>
        <td>${formatDate(datosViaje.createdAt)}</td>
        <td><button class="btn btn-sm btn-danger" onclick="deleteTrip('${d.id}')">🗑 Eliminar</button></td>
      `;
      tablaHistorial.appendChild(fila);
    });
  } catch (err) {
    showAlert(`❌ No se pudo cargar historial: ${err.message}`, 'danger');
  }
}

window.deleteTrip = async (idViaje) => {
  if (!confirm('¿Eliminar este viaje del historial?')) return;
  try {
    await deleteDoc(doc(db, 'trips', idViaje));
    loadHistory();
    showAlert('✅ Viaje eliminado', 'success');
  } catch (err) {
    showAlert(`❌ Error al borrar viaje: ${err.message}`, 'danger');
  }
};

// Exportar historial a Excel
function exportHistory() {
  const filas = [];
  document.querySelectorAll('#history-list tr').forEach(fila => {
    const celdas = fila.querySelectorAll('td');
    if (celdas.length >= 4) {
      filas.push({
        Chofer: celdas[0].textContent.trim(),
        Ruta: celdas[1].textContent.trim(),
        Costo: celdas[2].textContent.trim(),
        Fecha: celdas[3].textContent.trim()
      });
    }
  });
  if (filas.length === 0) return showAlert('ℹ️ No hay registros para exportar', 'warning');
  exportToExcel(filas, 'historial_traslados.xlsx');
  showAlert('📊 Exportado correctamente a Excel', 'success');
}

// ========== DATOS / ESTADÍSTICAS ==========
async function loadStats() {
  try {
    const [usuarios, viajes, alertas] = await Promise.all([
      getDocs(collection(db, 'users')),
      getDocs(collection(db, 'trips')),
      getDocs(collection(db, 'alerts'))
    ]);
    const statDrivers = document.getElementById('stat-drivers');
    const statTrips = document.getElementById('stat-trips');
    if(statDrivers) statDrivers.textContent = usuarios.size;
    if(statTrips) statTrips.textContent = viajes.size;
  } catch (err) {
    console.warn('No se pudieron cargar estadísticas:', err);
  }
}

// ========== RESTRICCIÓN FUNCIONES EXCLUSIVAS DUEÑO ==========
window.blockApp = () => showAlert('⛔ Solo el propietario puede bloquear la aplicación', 'warning');
window.unblockApp = () => showAlert('⛔ Solo el propietario puede desbloquear la aplicación', 'warning');

// INICIAR TODO AL CARGAR
init();