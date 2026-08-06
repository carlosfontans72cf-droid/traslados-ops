// /js/owner.js
import { db } from './firebase-config.js';
import {
  collection, getDocs, addDoc, deleteDoc, doc, updateDoc,
  query, where, getDoc, setDoc, orderBy, limit, serverTimestamp, onSnapshot
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";
import { showAlert, formatDate, exportToExcel } from './utils.js';

let map, markers = {};

document.getElementById('user-info').textContent = `👑 ${sessionStorage.getItem('userName')}`;

// ========== INICIO ==========
async function init() {
  await Promise.all([loadDrivers(), loadPrices(), loadAlerts(), loadStats(), initLiveMap()]);
  setupListeners();
}

function setupListeners() {
  document.getElementById('btn-add-driver')?.addEventListener('click', addDriver);
  document.getElementById('btn-add-manager')?.addEventListener('click', addManager);
  document.getElementById('btn-save-prices')?.addEventListener('click', savePrices);
  document.getElementById('btn-refresh-alerts')?.addEventListener('click', loadAlerts);
  document.getElementById('btn-load-history')?.addEventListener('click', loadHistory);
  document.getElementById('btn-export-excel')?.addEventListener('click', exportHistory);
  document.getElementById('btn-block-app')?.addEventListener('click', blockApp);
  document.getElementById('btn-unblock-app')?.addEventListener('click', unblockApp);
}

// ========== CHOFERES ==========
async function loadDrivers() {
  const snap = await getDocs(collection(db, 'users'));
  const tbody = document.getElementById('drivers-list');
  tbody.innerHTML = '';

  snap.forEach(d => {
    const data = d.data();
    // Solo mostrar choferes y admins (no dueños)
    if (data.role === 'owner') return;

    const roleLabel = data.role === 'manager' ? '👔 Admin' : '🚐 Chofer';
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${data.nombre} ${data.apellido} <small>(${roleLabel})</small></td>
      <td><span class="badge ${data.activo ? 'badge-active' : 'badge-inactive'}">${data.activo ? 'Activo' : 'Inactivo'}</span></td>
      <td>
        <button class="btn btn-sm btn-info" onclick="toggleUser('${d.id}', ${!data.activo})">${data.activo ? '⏸' : '▶'}</button>
        <button class="btn btn-sm btn-danger" onclick="deleteUser('${d.id}')">🗑</button>
        <a href="https://wa.me/?text=Hola%20${data.nombre},%20te%20comunicas%20desde%20la%20app" target="_blank" class="btn btn-sm btn-success">📱</a>
      </td>
    `;
    tbody.appendChild(tr);
  });
}

window.addDriver = async () => {
  const n = document.getElementById('driver-nombre').value.trim();
  const a = document.getElementById('driver-apellido').value.trim();
  const p = document.getElementById('driver-password').value;
  if (!n || !a || !p) return showAlert('Completa todos los campos', 'warning');

  await addDoc(collection(db, 'users'), {
    nombre: n,
    apellido: a,
    password: p,
    role: 'driver',
    activo: true,
    createdAt: serverTimestamp()
  });

  document.getElementById('driver-nombre').value = '';
  document.getElementById('driver-apellido').value = '';
  document.getElementById('driver-password').value = '';
  showAlert('✅ Chofer agregado', 'success');
  loadDrivers();
};

window.addManager = async () => {
  const n = document.getElementById('manager-nombre').value.trim();
  const a = document.getElementById('manager-apellido').value.trim();
  const p = document.getElementById('manager-password').value;
  if (!n || !a || !p) return showAlert('Completa todos los campos', 'warning');

  await addDoc(collection(db, 'users'), {
    nombre: n,
    apellido: a,
    password: p,
    role: 'manager',
    activo: true,
    createdAt: serverTimestamp()
  });

  document.getElementById('manager-nombre').value = '';
  document.getElementById('manager-apellido').value = '';
  document.getElementById('manager-password').value = '';
  showAlert('✅ Administrador agregado', 'success');
  loadDrivers();
};

window.toggleUser = async (id, state) => {
  await updateDoc(doc(db, 'users', id), { activo: state });
  showAlert(state ? '✅ Usuario activado' : '⏸ Usuario desactivado', 'info');
  loadDrivers();
};

window.deleteUser = async (id) => {
  if (!confirm('¿Seguro que deseas eliminar este usuario?')) return;
  await deleteDoc(doc(db, 'users', id));
  showAlert('🗑 Usuario eliminado', 'danger');
  loadDrivers();
};

// ========== PRECIOS ==========
async function loadPrices() {
  const d = await getDoc(doc(db, 'config', 'prices'));
  if (d.exists()) {
    const p = d.data();
    document.getElementById('price-persona').value = p.porPersona || 0;
    document.getElementById('price-zona').value = p.porZona || 0;
    document.getElementById('price-km').value = p.porKm || 0;
    document.getElementById('price-hora').value = p.porHora || 0;
  }
}

async function savePrices() {
  await setDoc(doc(db, 'config', 'prices'), {
    porPersona: parseFloat(document.getElementById('price-persona').value) || 0,
    porZona: parseFloat(document.getElementById('price-zona').value) || 0,
    porKm: parseFloat(document.getElementById('price-km').value) || 0,
    porHora: parseFloat(document.getElementById('price-hora').value) || 0,
    updatedAt: serverTimestamp()
  });
  showAlert('💰 Precios guardados', 'success');
}

// ========== MAPA EN VIVO ==========
function initLiveMap() {
  map = L.map('live-map').setView([-34.6037, -58.3816], 12);
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '© OpenStreetMap'
  }).addTo(map);
  listenDriversLocation();
}

function listenDriversLocation() {
  const q = query(collection(db, 'users'), where('role', '==', 'driver'), where('activo', '==', true));
  onSnapshot(q, snap => {
    snap.docChanges().forEach(change => {
      const id = change.doc.id;
      const data = change.doc.data();
      if (data.lat && data.lng) {
        if (markers[id]) {
          markers[id].setLatLng([data.lat, data.lng]);
        } else {
          markers[id] = L.marker([data.lat, data.lng]).addTo(map)
            .bindPopup(`<b>${data.nombre} ${data.apellido}</b><br>🟢 En línea`);
        }
      }
      if (change.type === 'removed' && markers[id]) {
        map.removeLayer(markers[id]);
        delete markers[id];
      }
    });
  });
}

// ========== ALERTAS ==========
async function loadAlerts() {
  const snap = await getDocs(query(collection(db, 'alerts'), orderBy('createdAt', 'desc'), limit(50)));
  const div = document.getElementById('alerts-list');
  div.innerHTML = '';

  snap.forEach(d => {
    const a = d.data();
    const card = document.createElement('div');
    card.className = 'card alert-card';
    card.innerHTML = `
      <strong style="color:var(--alert-red)">⚠️ ${a.tipo}</strong> - ${a.descripcion}
      <br><small>${a.userName} | ${formatDate(a.createdAt)}</small>
      <div class="btn-group" style="margin-top:10px">
        <button class="btn btn-sm btn-danger" onclick="deleteAlert('${d.id}')">🗑 Borrar</button>
        <button class="btn btn-sm btn-info" onclick="saveAlert('${d.id}')">💾 Guardar</button>
      </div>
    `;
    div.appendChild(card);
  });
}

window.deleteAlert = (id) => deleteDoc(doc(db, 'alerts', id)).then(loadAlerts);
window.saveAlert = async (id) => {
  const d = await getDoc(doc(db, 'alerts', id));
  await addDoc(collection(db, 'saved_alerts'), { ...d.data(), savedAt: serverTimestamp() });
  showAlert('Alerta guardada', 'success');
};

// ========== HISTORIAL ==========
async function loadHistory() {
  const snap = await getDocs(query(collection(db, 'trips'), orderBy('createdAt', 'desc')));
  const tbody = document.getElementById('history-list');
  tbody.innerHTML = '';

  snap.forEach(d => {
    const t = d.data();
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${t.userName}</td>
      <td>${t.origen} → ${t.destino}</td>
      <td>${t.costo}</td>
      <td>${formatDate(t.createdAt)}</td>
      <td><button class="btn btn-sm btn-danger" onclick="deleteTrip('${d.id}')">🗑</button></td>
    `;
    tbody.appendChild(tr);
  });
}

window.deleteTrip = (id) => confirm('¿Borrar este viaje?') && deleteDoc(doc(db, 'trips', id)).then(loadHistory);

function exportHistory() {
  const rows = [];
  document.querySelectorAll('#history-list tr').forEach(tr => {
    const cells = tr.querySelectorAll('td');
    if (cells.length >= 4) {
      rows.push({
        Chofer: cells[0].textContent,
        Ruta: cells[1].textContent,
        Costo: cells[2].textContent,
        Fecha: cells[3].textContent
      });
    }
  });
  if (rows.length === 0) return showAlert('No hay datos para exportar', 'warning');
  exportToExcel(rows, 'historial_traslados.xlsx');
  showAlert('📊 Excel exportado', 'success');
}

// ========== BLOQUEAR APP (Solo Dueño) ==========
async function blockApp() {
  if (!confirm('⚠️ ¿BLOQUEAR la app para TODOS los usuarios?')) return;
  await setDoc(doc(db, 'config', 'appStatus'), {
    blocked: true,
    blockedBy: sessionStorage.getItem('userId'),
    at: serverTimestamp()
  });
  showAlert('🔒 App BLOQUEADA completamente', 'danger');
}

async function unblockApp() {
  await setDoc(doc(db, 'config', 'appStatus'), { blocked: false }, { merge: true });
  showAlert('✅ App DESBLOQUEADA', 'success');
}

// ========== STATS ==========
async function loadStats() {
  const [usersSnap, tripsSnap, alertsSnap] = await Promise.all([
    getDocs(collection(db, 'users')),
    getDocs(collection(db, 'trips')),
    getDocs(collection(db, 'alerts'))
  ]);
  document.getElementById('stat-drivers').textContent = usersSnap.size;
  document.getElementById('stat-trips').textContent = tripsSnap.size;
  document.getElementById('stat-alerts').textContent = alertsSnap.size;
}

init();