// /js/superadmin.js
import { auth, db } from './firebase-config.js';
import { signInWithCustomToken } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
import {
  collection, getDocs, doc, setDoc, updateDoc, deleteDoc,
  query, where, limit, serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

const panelLogin = document.getElementById('panel-login');
const panelAdmin = document.getElementById('panel-admin');
const msg = document.getElementById('msg');
const msgCrear = document.getElementById('msg-crear');
const toast = document.getElementById('toast');

// URL base de la app (se arma sola según dónde esté desplegada)
const URL_APP = `${window.location.origin}/index.html`;

let empresasCache = []; // guardamos la última carga para el buscador

// ========== TOAST (aviso flotante) ==========
function mostrarToast(texto) {
  toast.textContent = texto;
  toast.classList.add('mostrar');
  setTimeout(() => toast.classList.remove('mostrar'), 2500);
}

// ========== LOGIN ==========
document.getElementById('btn-sa-login').addEventListener('click', async () => {
  const nombre = document.getElementById('sa-nombre').value.trim();
  const password = document.getElementById('sa-password').value;
  msg.textContent = '';

  if (!nombre || !password) {
    msg.textContent = '⚠️ Completá usuario y contraseña';
    return;
  }

  try {
    const resp = await fetch('/api/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ superadmin: true, nombre, password }),
    });
    const data = await resp.json();

    if (!resp.ok) {
      msg.textContent = `❌ ${data.error || 'No se pudo ingresar'}`;
      return;
    }

    await signInWithCustomToken(auth, data.token);

    panelLogin.style.display = 'none';
    panelAdmin.style.display = 'block';
    cargarEmpresas();

  } catch (err) {
    console.error(err);
    msg.textContent = '⚠️ Error de conexión';
  }
});

// ========== CREAR EMPRESA ==========
document.getElementById('btn-crear-empresa').addEventListener('click', async () => {
  const companyId = document.getElementById('nueva-empresa-id').value.trim().toLowerCase();
  const companyNombre = document.getElementById('nueva-empresa-nombre').value.trim();
  const ownerNombre = document.getElementById('owner-nombre').value.trim();
  const ownerApellido = document.getElementById('owner-apellido').value.trim();
  const ownerPassword = document.getElementById('owner-password').value;

  msgCrear.style.color = '#f87171';
  msgCrear.textContent = '';

  if (!companyId || !companyNombre || !ownerNombre || !ownerApellido || !ownerPassword) {
    msgCrear.textContent = '⚠️ Completá todos los campos';
    return;
  }
  if (!/^[a-z0-9-]+$/.test(companyId)) {
    msgCrear.textContent = '⚠️ El código de empresa solo puede tener letras minúsculas, números y guiones';
    return;
  }

  try {
    await setDoc(doc(db, 'companies', companyId), {
      nombre: companyNombre,
      activo: true,
      createdAt: serverTimestamp(),
    });

    await setDoc(doc(db, 'companies', companyId, 'users', 'owner-inicial'), {
      nombre: ownerNombre,
      apellido: ownerApellido,
      password: ownerPassword,
      role: 'owner',
      activo: true,
      createdAt: serverTimestamp(),
    });

    msgCrear.style.color = '#86efac';
    msgCrear.textContent = `✅ Empresa "${companyNombre}" creada. Código: ${companyId}`;

    document.getElementById('nueva-empresa-id').value = '';
    document.getElementById('nueva-empresa-nombre').value = '';
    document.getElementById('owner-nombre').value = '';
    document.getElementById('owner-apellido').value = '';
    document.getElementById('owner-password').value = '';

    cargarEmpresas();

  } catch (err) {
    console.error(err);
    msgCrear.textContent = `❌ Error al crear: ${err.message}`;
  }
});

// ========== ARMAR MENSAJE DE CREDENCIALES ==========
function armarMensajeCredenciales(companyId, companyNombre, owner) {
  return (
    `Hola! 👋 Acá tenés el acceso a tu app de traslados (${companyNombre}):\n\n` +
    `🔗 Enlace: ${URL_APP}\n` +
    `🏢 Código de empresa: ${companyId}\n` +
    `👤 Usuario: ${owner ? `${owner.nombre} ${owner.apellido}` : '(sin usuario dueño creado)'}\n` +
    `🔑 Contraseña: ${owner ? owner.password : '-'}\n\n` +
    `Cualquier duda, estamos para ayudarte 🚐`
  );
}

// ========== BUSCAR AL DUEÑO DE UNA EMPRESA ==========
async function buscarOwner(companyId) {
  const q = query(
    collection(db, 'companies', companyId, 'users'),
    where('role', '==', 'owner'),
    limit(1)
  );
  const snap = await getDocs(q);
  if (snap.empty) return null;
  return snap.docs[0].data();
}

// ========== COMPARTIR POR WHATSAPP ==========
async function compartirEmpresa(companyId, companyNombre) {
  try {
    const owner = await buscarOwner(companyId);
    const mensaje = armarMensajeCredenciales(companyId, companyNombre, owner);
    const url = `https://wa.me/?text=${encodeURIComponent(mensaje)}`;
    window.open(url, '_blank');
  } catch (err) {
    console.error(err);
    mostrarToast('❌ No se pudo generar el mensaje');
  }
}

// ========== COPIAR CREDENCIALES ==========
async function copiarCredenciales(companyId, companyNombre) {
  try {
    const owner = await buscarOwner(companyId);
    const mensaje = armarMensajeCredenciales(companyId, companyNombre, owner);
    await navigator.clipboard.writeText(mensaje);
    mostrarToast('📋 Credenciales copiadas al portapapeles');
  } catch (err) {
    console.error(err);
    mostrarToast('❌ No se pudo copiar');
  }
}

// ========== ACTIVAR / DESACTIVAR ==========
async function toggleEmpresa(companyId, activoActual) {
  try {
    await updateDoc(doc(db, 'companies', companyId), { activo: !activoActual });
    mostrarToast(activoActual ? '⛔ Empresa desactivada' : '✅ Empresa activada');
    cargarEmpresas();
  } catch (err) {
    console.error(err);
    mostrarToast('❌ No se pudo cambiar el estado');
  }
}

// ========== ELIMINAR EMPRESA COMPLETA (con todos sus datos) ==========
async function eliminarEmpresa(companyId, companyNombre) {
  const confirmacion = prompt(
    `⚠️ Esto borra TODO lo de "${companyNombre}" (usuarios, viajes, alertas, precios) de forma permanente.\n\n` +
    `Para confirmar, escribí el código de la empresa: ${companyId}`
  );
  if (confirmacion !== companyId) {
    if (confirmacion !== null) mostrarToast('❌ Código incorrecto, no se eliminó nada');
    return;
  }

  try {
    const subcolecciones = ['users', 'trips', 'alerts', 'saved_alerts'];
    for (const sub of subcolecciones) {
      const snap = await getDocs(collection(db, 'companies', companyId, sub));
      await Promise.all(snap.docs.map(d => deleteDoc(d.ref)));
    }
    // Documentos de configuración con ID conocido
    await deleteDoc(doc(db, 'companies', companyId, 'config', 'prices')).catch(() => {});
    await deleteDoc(doc(db, 'companies', companyId, 'config', 'appStatus')).catch(() => {});

    // Por último, el documento de la empresa
    await deleteDoc(doc(db, 'companies', companyId));

    mostrarToast('🗑 Empresa eliminada completamente');
    cargarEmpresas();
  } catch (err) {
    console.error(err);
    mostrarToast(`❌ Error al eliminar: ${err.message}`);
  }
}

// ========== LISTAR EMPRESAS ==========
async function cargarEmpresas() {
  const tbody = document.getElementById('tabla-empresas');
  tbody.innerHTML = `<tr><td colspan="5" class="vacio">Cargando...</td></tr>`;

  try {
    const snap = await getDocs(collection(db, 'companies'));

    const empresas = await Promise.all(snap.docs.map(async d => {
      const data = d.data();
      const owner = await buscarOwner(d.id);
      return { id: d.id, ...data, owner };
    }));

    empresasCache = empresas;
    renderizarTabla(empresas);

  } catch (err) {
    console.error('Error al cargar empresas:', err);
    tbody.innerHTML = `<tr><td colspan="5" class="vacio">❌ Error al cargar empresas</td></tr>`;
  }
}

function renderizarTabla(empresas) {
  const tbody = document.getElementById('tabla-empresas');
  tbody.innerHTML = '';

  if (empresas.length === 0) {
    tbody.innerHTML = `<tr><td colspan="5" class="vacio">No hay empresas que coincidan</td></tr>`;
    return;
  }

  empresas.forEach(emp => {
    const activo = emp.activo !== false;
    const nombreOwner = emp.owner ? `${emp.owner.nombre} ${emp.owner.apellido}` : '—';

    const fila = document.createElement('tr');
    fila.innerHTML = `
      <td class="empresa-codigo">${emp.id}</td>
      <td>${emp.nombre || ''}</td>
      <td>${nombreOwner}</td>
      <td><span class="badge ${activo ? 'badge-on' : 'badge-off'}">${activo ? 'Activa' : 'Desactivada'}</span></td>
      <td>
        <div class="fila-acciones">
          <button class="btn btn-sm btn-success" data-accion="compartir" title="Compartir por WhatsApp">📲</button>
          <button class="btn btn-sm btn-info" data-accion="copiar" title="Copiar credenciales">📋</button>
          <button class="btn btn-sm ${activo ? 'btn-secondary' : 'btn-success'}" data-accion="toggle" title="${activo ? 'Desactivar' : 'Activar'}">
            ${activo ? '⏸' : '▶'}
          </button>
          <button class="btn btn-sm btn-danger" data-accion="eliminar" title="Eliminar empresa">🗑</button>
        </div>
      </td>
    `;

    fila.querySelector('[data-accion="compartir"]').addEventListener('click', () => compartirEmpresa(emp.id, emp.nombre));
    fila.querySelector('[data-accion="copiar"]').addEventListener('click', () => copiarCredenciales(emp.id, emp.nombre));
    fila.querySelector('[data-accion="toggle"]').addEventListener('click', () => toggleEmpresa(emp.id, activo));
    fila.querySelector('[data-accion="eliminar"]').addEventListener('click', () => eliminarEmpresa(emp.id, emp.nombre));

    tbody.appendChild(fila);
  });
}

// ========== BUSCADOR ==========
document.getElementById('buscador-empresas').addEventListener('input', (e) => {
  const texto = e.target.value.trim().toLowerCase();
  const filtradas = empresasCache.filter(emp =>
    emp.id.toLowerCase().includes(texto) ||
    (emp.nombre || '').toLowerCase().includes(texto)
  );
  renderizarTabla(filtradas);
});