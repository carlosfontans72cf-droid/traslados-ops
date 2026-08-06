// /js/auth.js
import { auth, db } from './firebase-config.js';
import { signInWithEmailAndPassword } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
import { doc, getDoc } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

// Elementos del formulario (coinciden con IDs en tu HTML)
const btnIngresar = document.getElementById('btnIngresar');
const mensajeError = document.getElementById('mensajeError');

btnIngresar.addEventListener('click', async () => {
  // Leer y limpiar valores
  const email = document.getElementById('email').value.trim();
  const password = document.getElementById('password').value.trim();

  // Limpiar aviso anterior
  mensajeError.textContent = '';

  try {
    // 📌 Validar que no falten datos
    if (!email || !password) {
      throw new Error('Completa correo y contraseña');
    }

    // 📌 Iniciar sesión con correo y contraseña
    const credenciales = await signInWithEmailAndPassword(auth, email, password);
    const uidUsuario = credenciales.user.uid;

    // 📌 Cargar datos completos desde base de datos
    const referenciaUsuario = doc(db, 'users', uidUsuario);
    const documentoUsuario = await getDoc(referenciaUsuario);

    if (!documentoUsuario.exists()) {
      throw new Error('Usuario no encontrado en registros');
    }

    const datosUsuario = documentoUsuario.data();

    // 📌 Guardar datos en sesión para usar en paneles
    sessionStorage.setItem('userRole', datosUsuario.role);
    sessionStorage.setItem('userId', uidUsuario);
    sessionStorage.setItem('fullName', `${datosUsuario.nombre} ${datosUsuario.apellido}`);

    // 📌 REDIRECCIÓN SEGÚN PERFIL (rutas correctas definitivas)
    if (datosUsuario.role === 'owner') {
      window.location.href = '/pages/dashboard-owner.html';
    } else if (datosUsuario.role === 'manager') {
      window.location.href = '/pages/dashboard-manager.html';
    } else if (datosUsuario.role === 'driver') {
      window.location.href = '/pages/dashboard-driver.html';
    } else {
      throw new Error('Perfil de usuario no reconocido');
    }

  } catch (error) {
    // 📌 Mostrar error claro, guardar registro en consola
    console.error('🔴 Fallo ingreso:', error);
    mensajeError.textContent = `⚠️ ${error.message}`;
  }
});