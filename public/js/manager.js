// /js/manager.js
import { db } from './firebase-config.js';
import {
  collection, getDocs, addDoc, deleteDoc, doc, updateDoc,
  query, where, getDoc, setDoc, orderBy, limit, serverTimestamp, onSnapshot
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";
import { showAlert, formatDate, exportToExcel, calculateRouteCost } from './utils.js';

let map, markers = {};

// ✅ Mostrar nombre usuario
const nombreUsuario = sessionStorage.getItem('fullName');
const infoElement = document.getElementById('user-info');
if(infoElement && nombreUsuario) infoElement.textContent = `👔 ${nombreUsuario}`;

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
    showAlert(`❌ Error al cargar panel: ${err.message}`, 'danger');
    console.error(err);
  }
}

function setupListeners() {
  document.getElementById('btn-add-driver')?.addEventListener('click', addDriver);
  document.getElementById('btn-add-manager')?.addEventListener('click', addManager);
  document.getElementById('btn-save-prices')?.addEventListener('click', savePrices);
  document.getElementById('btn-refresh-alerts')?.addEventListener('click', loadAlerts);
  document.getElementById('btn-load-history')?.addEventListener('click', loadHistory);
  document.getElementById('btn-export-excel')?.addEventListener('click', exportHistory);
  // ✅ Nuevos listeners para crear viaje
  document.getElementById('btn-calc-trip')?.addEventListener('click', calculateManagerTrip);
  document.getElementById('btn-create-trip')?.addEventListener('click', createManagerTrip);
}

// ========== GESTION USUARIOS ==========
async function loadDrivers() {
  const tbody = document.getElementById('drivers-list');
  if(!tbody) return;
  tbody.innerHTML = '';

  const selectChofer = document.getElementById('trip-chofer');
  if(selectChofer) {
    selectChofer.innerHTML = '<option value="">-- Seleccionar chofer --</option>';
  }

  try {
    const snap = await getDocs(collection(db, 'users'));
    snap.forEach(d => {
      const data = d.data();
      if (data.role === 'owner') return;

      const etiquetaRol = data.role === 'manager' ? '👔 Administrador' : '🚐 Chofer';
      const claseActivo = data.activo ? 'badge-active' : 'badge-inactive';
      const textoActivo = data.activo ? 'Activo' : 'Inactivo';
      const textoBoton = data.activo ? '⏸ Desactivar' : '▶ Activar';

      if(selectChofer && data.role === 'driver' && data.activo) {
        const option = document.createElement('option');
        option.value = d.id;
        option.textContent = `${data.nombre} ${data.apellido}`;
        option.dataset.nombre = `${data.nombre} ${data.apellido}`;
        selectChofer.appendChild(option);
      }

      const mensajeWhatsApp = `Hola ${data.nombre} ${data.apellido}, te comunico desde la plataforma Traslados Vans.\n\nTus credenciales de acceso son:\nUsuario: ${data.nombre} ${data.apellido}\nContraseña: ${data.password}\n\nIngresá en: https://traslados-ops.vercel.app`;

      const fila = document.createElement('tr');
      fila.innerHTML = `
        <td>${data.nombre} ${data.apellido} <small>(${etiquetaRol})</small></td>
        <td><span class="badge ${claseActivo}">${textoActivo}</span></td>
        <td>
          <button class="btn btn-sm btn-info" onclick="toggleUser('${d.id}', ${!data.activo})">${textoBoton}</button>
          <button class="btn btn-sm btn-danger" onclick="deleteUser('${d.id}')">🗑 Eliminar</button>
          <a href="https://wa.me/?text=${encodeURIComponent(mensajeWhatsApp)}" target="_blank" class="btn btn-sm btn-success">📱 WhatsApp</a>
        </td>
      `;
      tbody.appendChild(fila);
    });
  } catch (err) {
    showAlert(`❌ No se pudo cargar lista: ${err.message}`, 'danger');
  }
}

window.addDriver = async () => {
  const nombre = document.getElementById('driver-nombre').value.trim();
  const apellido = document.getElementById('driver-apellido').value.trim();
  const clave = document.getElementById('driver-password').value;

  if (!nombre || !apellido || !clave) {
    return showAlert('️ Completa todos los datos del chofer', 'warning');
  }

  try {
    await addDoc(collection(db, 'users'), {
      nombre, apellido, password: clave,
      role: 'driver', activo: true,
      createdAt: serverTimestamp()
    });
    document.getElementById('driver-nombre').value = '';
    document.getElementById('driver-apellido').value = '';
    document.getElementById('driver-password').value = '';
    showAlert('✅ Chofer registrado correctamente', 'success');
    loadDrivers();
  } catch (err) {
    showAlert(` Error al agregar: ${err.message}`, 'danger');
  }
};

window.addManager = async () => {
  const nombre = document.getElementById('manager-nombre').value.trim();
  const apellido = document.getElementById('manager-apellido').value.trim();
  const clave = document.getElementById('manager-password').value;

  if (!nombre || !apellido || !clave) {
    return showAlert('⚠️ Completa todos los datos del administrador', 'warning');
  }

  try {
    await addDoc(collection(db, 'users'), {
      nombre, apellido, password: clave,
      role: 'manager', activo: true,
      createdAt: serverTimestamp()
    });
    document.getElementById('manager-nombre').value = '';
    document.getElementById('manager-apellido').value = '';
    document.getElementById('manager-password').value = '';
    showAlert('✅ Administrador registrado correctamente', 'success');
    loadDrivers();
  } catch (err) {
    showAlert(`❌ Error al agregar: ${err.message}`, 'danger');
  }
};

window.toggleUser = async (idUsuario, nuevoEstado) => {
  try {
    await updateDoc(doc(db, 'users', idUsuario), { activo: nuevoEstado });
    loadDrivers();
    showAlert('✅ Estado actualizado', 'success');
  } catch (err) {
    showAlert(`❌ No se pudo cambiar estado: ${err.message}`, 'danger');
  }
};

window.deleteUser = async (idUsuario) => {
  if (!confirm('¿Seguro que deseas eliminar este usuario?')) return;
  try {
    await deleteDoc(doc(db, 'users', idUsuario));
    loadDrivers();
    showAlert(' Usuario eliminado', 'success');
  } catch (err) {
    showAlert(`❌ No se pudo eliminar: ${err.message}`, 'danger');
  }
};

// ========== PRECIOS ==========
async function loadPrices() {
  const precioRef = doc(db, 'config', 'prices');
  const precioDoc = await getDoc(precioRef);
  if (precioDoc.exists()) {
    const p = precioDoc.data();
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
    showAlert(' Precios guardados correctamente', 'success');
  } catch (err) {
    showAlert(`❌ Error al guardar precios: ${err.message}`, 'danger');
  }
}

// ========== NUEVO: CREAR VIAJE DESDE ADMIN ==========
window.calculateManagerTrip = async () => {
  const origen = document.getElementById('manager-trip-origen')?.value.trim();
  const destino = document.getElementById('manager-trip-destino')?.value.trim();
  const personas = parseInt(document.getElementById('manager-trip-personas')?.value) || 1;

  if (!origen || !destino) {
    return showAlert("⚠️ Escribí origen y destino", "warning");
  }

  try {
    const priceSnap = await getDoc(doc(db, 'config', 'prices'));
    const precios = priceSnap.exists() ? priceSnap.data() : { porPersona:0, porZona:0, porKm:0, porHora:0 };
    const resultado = await calculateRouteCost(origen, destino, precios, personas);

    const resultDiv = document.getElementById('manager-trip-result');
    if(resultDiv) {
      resultDiv.style.display = 'block';
      document.getElementById('manager-trip-cost-display').textContent = resultado.costo;
      document.getElementById('manager-trip-distance-display').textContent = `📏 Distancia: ${resultado.distance}`;
      document.getElementById('manager-trip-duration-display').textContent = `⏱ Tiempo aprox: ${resultado.duration}`;
    }

    window._managerTripData = { ...resultado, origen, destino, personas };
    showAlert("✅ Cálculo realizado", "success");
  } catch (err) {
    showAlert(`❌ Error al calcular: ${err.message}`, "danger");
  }
};

window.createManagerTrip = async () => {
  if (!window._managerTripData) {
    return showAlert("ℹ️ Primero calculá el costo", "warning");
  }

  const choferSelect = document.getElementById('trip-chofer');
  const choferId = choferSelect?.value;
  const choferNombre = choferSelect?.selectedOptions[0]?.dataset.nombre || 'Asignado por admin';

  if (!choferId) {
    return showAlert("⚠️ Seleccioná un chofer para asignar el viaje", "warning");
  }

  const datos = window._managerTripData;
  try {
    await addDoc(collection(db, 'trips'), {
      userId: choferId,
      nombreConductor: choferNombre,
      origen: datos.origen,
      destino: datos.destino,
      pasajeros: datos.personas,
      costoTotal: datos.costo,
      distanciaKm: datos.distanceKm,
      horasEstimadas: datos.durationHours,
      estado: "asignado",
      creadoPor: "manager",
      fechaInicio: serverTimestamp()
    });

    document.getElementById('manager-trip-origen').value = '';
    document.getElementById('manager-trip-destino').value = '';
    document.getElementById('manager-trip-personas').value = '1';
    document.getElementById('manager-trip-result').style.display = 'none';
    window._managerTripData = null;
    choferSelect.value = '';

    showAlert("✅ Viaje creado y asignado correctamente", "success");
    loadHistory();
  } catch(err) {
    showAlert(`❌ No se pudo crear: ${err.message}`, "danger");
  }
};

// ========== MAPA ==========
function initLiveMap() {
  const contenedorMapa = document.getElementById('live-map');
  if(!contenedorMapa) return;

  map = L.map('live-map').setView([-34.6037, -58.3816], 12);
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '© OpenStreetMap contributors'
  }).addTo(map);

  escucharUbicacionesTodos();
}

function escucharUbicacionesTodos() {
  onSnapshot(collection(db, 'users'), (cambios) => {
    Object.values(markers).forEach(m => map.removeLayer(m));
    markers = {};

    cambios.forEach(docSnap => {
      const datos = docSnap.data();
      if (datos.activo && datos.lat && datos.lng) {
        const icono = datos.role === 'manager' ? '👔' : '🚐';
        const rolTexto = datos.role === 'manager' ? 'Administrador' : 'Chofer';
        markers[docSnap.id] = L.marker([datos.lat, datos.lng])
          .addTo(map)
          .bindPopup(`<b>${icono} ${datos.nombre} ${datos.apellido}</b><br>🟢 ${rolTexto}`);
      }
    });
  });
}

// ========== ALERTAS ==========
async function loadAlerts() {
  const contenedorAlertas = document.getElementById('alerts-list');
  if(!contenedorAlertas) return;
  contenedorAlertas.innerHTML = '';

  try {
    const snap = await getDocs(collection(db, 'alerts'));
    const alertas = [];
    snap.forEach(d => alertas.push({ id: d.id, ...d.data() }));
    alertas.sort((a, b) => {
      const dateA = a.fechaHora?.toDate?.() || a.createdAt?.toDate?.() || new Date(0);
      const dateB = b.fechaHora?.toDate?.() || b.createdAt?.toDate?.() || new Date(0);
      return dateB - dateA;
    });

    alertas.forEach(datosAlerta => {
      const tarjeta = document.createElement('div');
      tarjeta.className = 'card alert-card';
      tarjeta.innerHTML = `
        <strong style="color:var(--alert-red)">⚠️ ${datosAlerta.tipo || 'Alerta'}</strong> - ${datosAlerta.descripcion}
        <br><small> ${datosAlerta.nombreConductor || datosAlerta.userName || 'Sin nombre'} |  ${formatDate(datosAlerta.fechaHora || datosAlerta.createdAt)}</small>
        <div class="btn-group" style="margin-top:10px">
          <button class="btn btn-sm btn-danger" onclick="deleteAlert('${datosAlerta.id}')">🗑 Borrar</button>
          <button class="btn btn-sm btn-info" onclick="saveAlert('${datosAlerta.id}')">💾 Guardar</button>
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

// ========== HISTORIAL ==========
async function loadHistory() {
  const tablaHistorial = document.getElementById('history-list');
  if(!tablaHistorial) return;
  tablaHistorial.innerHTML = '';

  try {
    const snap = await getDocs(collection(db, 'trips'));
    const viajes = [];
    snap.forEach(d => viajes.push({ id: d.id, ...d.data() }));
    viajes.sort((a, b) => {
      const dateA = a.fechaInicio?.toDate?.() || a.createdAt?.toDate?.() || new Date(0);
      const dateB = b.fechaInicio?.toDate?.() || b.createdAt?.toDate?.() || new Date(0);
      return dateB - dateA;
    });

    viajes.forEach(datosViaje => {
      const fila = document.createElement('tr');
      fila.innerHTML = `
        <td>${datosViaje.nombreConductor || 'Sin asignar'}</td>
        <td>${datosViaje.origen || ''} ➡ ${datosViaje.destino || ''}</td>
        <td>$ ${datosViaje.costoTotal || datosViaje.costo || 0}</td>
        <td>${formatDate(datosViaje.fechaInicio || datosViaje.createdAt)}</td>
        <td><button class="btn btn-sm btn-danger" onclick="deleteTrip('${datosViaje.id}')">🗑 Eliminar</button></td>
      `;
      tablaHistorial.appendChild(fila);
    });
  } catch (err) {
    showAlert(`❌ No se pudo cargar historial: ${err.message}`, 'danger');
  }
}

window.deleteTrip = async (idViaje) => {
  if (!confirm('¿Eliminar este viaje?')) return;
  try {
    await deleteDoc(doc(db, 'trips', idViaje));
    loadHistory();
    showAlert('✅ Viaje eliminado', 'success');
  } catch (err) {
    showAlert(` Error al borrar viaje: ${err.message}`, 'danger');
  }
};

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
    console.warn('️ No se pudieron cargar estadísticas:', err);
  }
}

window.blockApp = () => showAlert(' Solo el propietario puede bloquear la aplicación', 'warning');
window.unblockApp = () => showAlert('⛔ Solo el propietario puede desbloquear la aplicación', 'warning');

init();