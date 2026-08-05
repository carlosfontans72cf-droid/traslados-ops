import { db, auth } from './firebase-config.js';
import {
  collection, getDocs, addDoc, deleteDoc, doc, updateDoc,
  query, where, getDoc, setDoc, orderBy, limit, serverTimestamp, onSnapshot
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
import { showAlert, formatDate } from './utils.js';

let map, markers = {};

onAuthStateChanged(auth, user => {
  if (!user) return window.location.href = '/';
  document.getElementById('user-info').textContent = `👔 ${sessionStorage.getItem('userName')}`;
  initManager();
});

async function initManager() {
  await Promise.all([loadDrivers(), loadPrices(), loadAlerts(), loadStats(), initLiveMap()]);
  setupListeners();
}

function setupListeners() {
  document.getElementById('btn-add-driver')?.addEventListener('click', addDriver);
  document.getElementById('btn-save-prices')?.addEventListener('click', savePrices);
  document.getElementById('btn-refresh-alerts')?.addEventListener('click', loadAlerts);
  document.getElementById('btn-load-history')?.addEventListener('click', loadHistory);
  document.getElementById('btn-export-excel')?.addEventListener('click', () => showAlert('Ver utils.js para Excel', 'info'));
}

// ========== COPIAR FUNCIONES DE owner.js: loadDrivers, addDriver, toggleDriver, deleteDriver,
// loadPrices, savePrices, initLiveMap, listenDriversLocation, loadAlerts, deleteAlert, saveAlert,
// loadHistory, deleteTrip, loadStats ==========
// (Son IDÉNTICAS al owner.js, solo cambia el bloque de "BLOQUEAR APP")

// ========== BLOQUEO (Solo aviso) ==========
window.blockApp = () => showAlert('⛔ Solo el dueño puede bloquear la app completamente', 'warning');