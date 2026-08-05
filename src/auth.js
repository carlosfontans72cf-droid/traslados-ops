// src/js/auth.js
import { db } from './firebase-config.js';
import {
  collection, getDocs, query, where,
  doc, getDoc, setDoc, serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

const btnLogin = document.getElementById('btn-login');
const errorDiv = document.getElementById('login-error');

btnLogin.addEventListener('click', async () => {
  const nombre = document.getElementById('nombre').value.trim();
  const apellido = document.getElementById('apellido').value.trim();
  const password = document.getElementById('password').value;

  errorDiv.textContent = '';
  btnLogin.disabled = true;
  btnLogin.textContent = '⏳ Entrando...';

  try {
    if (!nombre || !apellido || !password) {
      errorDiv.textContent = '⚠️ Completa todos los campos.';
      throw new Error('campos vacios');
    }

    // Buscar usuario por nombre + apellido + contraseña
    const usersRef = collection(db, 'users');
    const q = query(
      usersRef,
      where('nombre', '==', nombre),
      where('apellido', '==', apellido)
    );
    const snapshot = await getDocs(q);

    if (snapshot.empty) {
      errorDiv.textContent = '❌ Usuario no encontrado.';
      throw new Error('usuario no encontrado');
    }

    // Puede haber varios con mismo nombre/apellido, buscar el que coincida en password
    let userDoc = null;
    let userData = null;

    for (const d of snapshot.docs) {
      const data = d.data();
      if (data.password === password) {
        userDoc = d;
        userData = data;
        break;
      }
    }

    if (!userDoc || !userData) {
      errorDiv.textContent = '❌ Contraseña incorrecta.';
      throw new Error('contraseña incorrecta');
    }

    if (!userData.activo) {
      errorDiv.textContent = '⛔ Usuario inactivo. Contacta al dueño.';
      throw new Error('usuario inactivo');
    }

    // Guardar sesión
    sessionStorage.setItem('userRole', userData.role);       // 'owner', 'manager', 'driver'
    sessionStorage.setItem('userId', userDoc.id);             // ID de Firestore
    sessionStorage.setItem('userName', `${userData.nombre} ${userData.apellido}`);
    sessionStorage.setItem('userNombre', userData.nombre);
    sessionStorage.setItem('userApellido', userData.apellido);

    // Redirigir según rol
    let redirectPage = '/src/pages/dashboard-driver.html';
    if (userData.role === 'owner') redirectPage = '/src/pages/dashboard-owner.html';
    else if (userData.role === 'manager') redirectPage = '/src/pages/dashboard-manager.html';

    window.location.href = redirectPage;

  } catch (e) {
    console.error('Login error:', e);
    // El mensaje de error ya se muestra en errorDiv
  } finally {
    btnLogin.disabled = false;
    btnLogin.textContent = '🔑 Iniciar Sesión';
  }
});