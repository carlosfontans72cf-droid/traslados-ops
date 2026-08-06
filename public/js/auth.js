// /js/auth.js
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

  // Limpiar mensajes anteriores
  errorDiv.textContent = '';
  btnLogin.disabled = true;
  btnLogin.textContent = '⏳ Entrando...';

  try {
    // 📌 Validar que no falten datos
    if (!nombre || !apellido || !password) {
      errorDiv.textContent = '⚠️ Completa todos los campos obligatorios.';
      throw new Error('Faltan datos por completar');
    }

    // 📌 Buscar en colección "users" por nombre y apellido
    const usersRef = collection(db, 'users');
    const consulta = query(
      usersRef,
      where('nombre', '==', nombre),
      where('apellido', '==', apellido)
    );
    const resultado = await getDocs(consulta);

    if (resultado.empty) {
      errorDiv.textContent = '❌ Usuario no registrado. Verifica tus datos.';
      throw new Error('Sin coincidencia nombre+apellido');
    }

    // 📌 Dentro de coincidencias, comprobar contraseña y estado activo
    let datosUsuario = null;
    let idUsuario = null;

    for (const registro of resultado.docs) {
      const datos = registro.data();
      if (datos.password === password) {
        if (!datos.activo) {
          errorDiv.textContent = '⛔ Tu cuenta está desactivada. Consulta con el administrador.';
          throw new Error('Usuario inactivo');
        }
        // Guardamos datos solo si contraseña correcta Y activo
        datosUsuario = datos;
        idUsuario = registro.id;
        break;
      }
    }

    if (!datosUsuario) {
      errorDiv.textContent = '❌ Contraseña incorrecta. Intenta nuevamente.';
      throw new Error('Contraseña no coincide');
    }

    // 📌 Guardar datos en sesión para usarlos en paneles
    sessionStorage.setItem('userRole', datosUsuario.role);
    sessionStorage.setItem('userId', idUsuario);
    sessionStorage.setItem('fullName', `${datosUsuario.nombre} ${datosUsuario.apellido}`);
    sessionStorage.setItem('userNombre', datosUsuario.nombre);
    sessionStorage.setItem('userApellido', datosUsuario.apellido);

    // 📌 REDIRECCIÓN CORRECTA → SIN /src/ , EXACTA
    let destino = '/pages/dashboard-driver.html';
    if (datosUsuario.role === 'owner') {
      destino = '/pages/dashboard-owner.html';
    } else if (datosUsuario.role === 'manager') {
      destino = '/pages/dashboard-manager.html';
    }

    console.log('✅ Ingreso válido, redirigiendo a:', destino);
    window.location.href = destino;

  } catch (error) {
    console.error('🔴 Error inicio sesión:', error);
    // Mensaje ya se muestra arriba, no repetimos
  } finally {
    // Volver a habilitar botón siempre, falle o no
    btnLogin.disabled = false;
    btnLogin.textContent = '🔑 Iniciar Sesión';
  }
});