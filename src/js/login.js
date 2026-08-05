import { auth, db } from './firebase-config.js';
import { signInWithEmailAndPassword } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
import { doc, getDoc } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

const btnIngresar = document.getElementById('btnIngresar');
const mensajeError = document.getElementById('mensajeError');

btnIngresar.addEventListener('click', async () => {
  const email = document.getElementById('email').value.trim();
  const pass = document.getElementById('password').value;
  mensajeError.textContent = '';

  try {
    // 1. Iniciar sesión
    const credenciales = await signInWithEmailAndPassword(auth, email, pass);
    const uid = credenciales.user.uid;

    // 2. Obtener datos del usuario
    const refUsuario = doc(db, 'users', uid);
    const snapUsuario = await getDoc(refUsuario);

    if (!snapUsuario.exists()) throw new Error('Usuario no registrado');
    const datos = snapUsuario.data();

    // 3. Redirigir según rol
    if (datos.role === 'owner') {
      window.location.href = 'pages/dashboard-owner.html';
    } else if (datos.role === 'manager') {
      alert('Panel de gerente en construcción');
    } else if (datos.role === 'driver') {
      alert('Panel de chofer en construcción');
    } else {
      throw new Error('Rol no reconocido');
    }

  } catch (error) {
    console.error(error);
    mensajeError.textContent = 'Error: ' + error.message;
  }
});