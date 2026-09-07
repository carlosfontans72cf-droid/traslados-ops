// /js/superadmin.js
import { auth, db } from './firebase-config.js';
import { signInWithCustomToken } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
import {
  collection, getDocs, doc, setDoc, updateDoc, serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

const panelLogin = document.getElementById('panel-login');
const panelAdmin = document.getElementById('panel-admin');
const msg = document.getElementById('msg');
const msgCrear = document.getElementById('msg-crear');

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
    // 1) Crear la empresa
    await setDoc(doc(db, 'companies', companyId), {
      nombre: companyNombre,
      activo: true,
      createdAt: serverTimestamp(),
    });

    // 2) Crear el primer usuario (owner) dentro de esa empresa
    await setDoc(doc(db, 'companies', companyId, 'users', 'owner-inicial'), {
      nombre: ownerNombre,
      apellido: ownerApellido,
      password: ownerPassword,
      role: 'owner',
      activo: true,
      createdAt: serverTimestamp(),
    });

    msgCrear.style.color = '#86efac';
    msgCrear.textContent = `✅ Empresa "${companyNombre}" creada. Código de acceso: ${companyId}`;

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

// ========== LISTAR / ACTIVAR / DESACTIVAR EMPRESAS ==========
async function cargarEmpresas() {
  const tbody = document.getElementById('tabla-empresas');
  tbody.innerHTML = '';
  try {
    const snap = await getDocs(collection(db, 'companies'));
    snap.forEach(d => {
      const data = d.data();
      const activo = data.activo !== false;
      const fila = document.createElement('tr');
      fila.innerHTML = `
        <td>${d.id}</td>
        <td>${data.nombre || ''}</td>
        <td><span class="badge ${activo ? 'badge-on' : 'badge-off'}">${activo ? 'Activa' : 'Desactivada'}</span></td>
        <td><button class="btn btn-sm ${activo ? 'btn-danger' : ''}" data-id="${d.id}" data-activo="${activo}">
          ${activo ? 'Desactivar' : 'Activar'}
        </button></td>
      `;
      tbody.appendChild(fila);
    });

    tbody.querySelectorAll('button[data-id]').forEach(btn => {
      btn.addEventListener('click', async () => {
        const id = btn.dataset.id;
        const activoActual = btn.dataset.activo === 'true';
        await updateDoc(doc(db, 'companies', id), { activo: !activoActual });
        cargarEmpresas();
      });
    });

  } catch (err) {
    console.error('Error al cargar empresas:', err);
  }
}