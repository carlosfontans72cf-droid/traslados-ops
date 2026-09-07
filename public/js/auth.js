// /js/auth.js
import { auth } from './firebase-config.js';
import { signInWithCustomToken } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";

const btnLogin = document.getElementById('btn-login');
const errorDiv = document.getElementById('login-error');

btnLogin.addEventListener('click', async () => {
  const empresa = document.getElementById('empresa').value.trim().toLowerCase();
  const nombre = document.getElementById('nombre').value.trim();
  const apellido = document.getElementById('apellido').value.trim();
  const password = document.getElementById('password').value;

  errorDiv.textContent = '';
  btnLogin.disabled = true;
  btnLogin.textContent = '⏳ Entrando...';

  try {
    if (!empresa || !nombre || !apellido || !password) {
      errorDiv.textContent = '⚠️ Completa todos los campos, incluyendo el código de empresa.';
      return;
    }

    // 📌 Verificación de credenciales en el servidor (no en el navegador)
    const respuesta = await fetch('/api/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ companyId: empresa, nombre, apellido, password }),
    });

    const datos = await respuesta.json();

    if (!respuesta.ok) {
      errorDiv.textContent = `❌ ${datos.error || 'No se pudo iniciar sesión'}`;
      return;
    }

    // 📌 Iniciar sesión real de Firebase con el token recibido
    await signInWithCustomToken(auth, datos.token);

    // 📌 Guardar datos en sesión para usarlos en los paneles
    sessionStorage.setItem('companyId', datos.companyId);
    sessionStorage.setItem('userRole', datos.role);
    sessionStorage.setItem('userId', datos.userId);
    sessionStorage.setItem('fullName', datos.fullName);

    let destino = '/pages/dashboard-driver.html';
    if (datos.role === 'owner') {
      destino = '/pages/dashboard-owner.html';
    } else if (datos.role === 'manager') {
      destino = '/pages/dashboard-manager.html';
    }

    window.location.href = destino;

  } catch (error) {
    console.error('🔴 Error inicio sesión:', error);
    errorDiv.textContent = '⚠️ Error de conexión. Intentá de nuevo.';
  } finally {
    btnLogin.disabled = false;
    btnLogin.textContent = '🔑 Iniciar Sesión';
  }
});