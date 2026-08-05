import { auth, db } from './firebase-config.js';
import { signOut, createUserWithEmailAndPassword } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
import { doc, setDoc, collection, addDoc, getDocs } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

// ---------------- CERRAR SESIÓN ----------------
document.getElementById('btnSalir').addEventListener('click', async () => {
  await signOut(auth);
  window.location.href = '../index.html';
});

// ---------------- CREAR ADMINISTRADOR (AUTOMÁTICO) ----------------
document.getElementById('btnCrearAdmin').addEventListener('click', async () => {
  const nombre = document.getElementById('adminNombre').value.trim();
  const correo = document.getElementById('adminCorreo').value.trim();
  const clave = document.getElementById('adminClave').value;
  const msg = document.getElementById('msgAdmin');

  if(!nombre || !correo || clave.length < 6) {
    msg.textContent = "❌ Completa todos los datos (contraseña min 6 caracteres)";
    msg.style.color = "#dc2626";
    return;
  }

  try {
    // 1. Crea la cuenta de acceso
    const credenciales = await createUserWithEmailAndPassword(auth, correo, clave);
    // 2. Guarda sus datos y rol AUTOMÁTICAMENTE
    await setDoc(doc(db, 'users', credenciales.user.uid), {
      nombre: nombre,
      apellido: '',
      email: correo,
      role: 'manager',
      blocked: false
    });

    msg.textContent = "✅ Administrador CREADO y listo para entrar. No debes hacer nada más.";
    msg.style.color = "#16a34a";
    // Limpia campos
    document.getElementById('adminNombre').value = '';
    document.getElementById('adminCorreo').value = '';
    document.getElementById('adminClave').value = '';

  } catch (err) {
    msg.textContent = "❌ Error: " + err.message;
    msg.style.color = "#dc2626";
  }
});

// ---------------- AGREGAR CHOFERES ----------------
document.getElementById('btnAgregarChofer').addEventListener('click', async () => {
  const nombre = document.getElementById('choferNombre').value.trim();
  const tel = document.getElementById('choferTel').value.trim();
  const msg = document.getElementById('msgChofer');

  try {
    await addDoc(collection(db, 'drivers'), {
      nombre: nombre,
      telefono: tel,
      activo: true
    });
    msg.textContent = "✅ Chofer guardado";
    msg.style.color = "#16a34a";
    document.getElementById('choferNombre').value = '';
    document.getElementById('choferTel').value = '';
    cargarChoferes(); // Actualiza la lista
  } catch (err) {
    msg.textContent = "❌ Error: " + err.message;
    msg.style.color = "#dc2626";
  }
});

// ---------------- CARGAR LISTA DE CHOFERES ----------------
async function cargarChoferes() {
  const tabla = document.querySelector('#listaChoferes tbody');
  tabla.innerHTML = '';
  const snap = await getDocs(collection(db, 'drivers'));
  snap.forEach(doc => {
    const d = doc.data();
    tabla.innerHTML += `<tr><td>${d.nombre}</td><td>${d.telefono}</td><td>${d.activo ? 'Activo' : 'Inactivo'}</td></tr>`;
  });
}

// Carga la lista al abrir la página
window.onload = cargarChoferes;// ---------------- ACTUALIZAR CONTADORES ----------------
async function actualizarContadores() {
  const choferes = await getDocs(collection(db, 'drivers'));
  document.getElementById('cantChoferes').textContent = choferes.size;
  // Aquí luego agregaremos viajes y alertas cuando creemos esas colecciones
}

// Carga todo al abrir la página
window.onload = () => {
  cargarChoferes();
  actualizarContadores();
};