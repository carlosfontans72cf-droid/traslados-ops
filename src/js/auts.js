import { auth, db } from './firebase-config.js';
import {
  signInWithEmailAndPassword, signOut, onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
import {
  doc, getDoc, getDocs, collection, query, where, setDoc, serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";
import { showAlert } from './utils.js';

const loginBtn = document.getElementById('btn-login');
const errorDiv = document.getElementById('login-error');
const roleSelect = document.getElementById('role');

function updateFields() {
  const role = roleSelect.value;
  document.getElementById('field-nombre').style.display = role === 'driver' ? 'none' : 'block';
  document.getElementById('field-apellido').style.display = role === 'driver' ? 'none' : 'block';
  document.getElementById('field-email').style.display = (role === 'owner' || role === 'manager') ? 'block' : 'none';
  document.getElementById('field-password').style.display = 'block';
}
roleSelect.addEventListener('change', updateFields);
updateFields();

// Verificar si la app está bloqueada
async function checkAppBlocked() {
  const configDoc = await getDoc(doc(db, 'config', 'appStatus'));
  return configDoc.exists() && configDoc.data().blocked === true;
}

loginBtn.addEventListener('click', async () => {
  const role = roleSelect.value;
  const nombre = document.getElementById('nombre').value.trim();
  const apellido = document.getElementById('apellido').value.trim();
  const password = document.getElementById('password').value;
  const email = document.getElementById('email').value.trim();

  errorDiv.textContent = '';
  loginBtn.disabled = true;
  loginBtn.textContent = '⏳ Entrando...';

  try {
    // Verificar bloqueo global
    const blocked = await checkAppBlocked();
    if (blocked && role !== 'owner') {
      errorDiv.textContent = '🔒 La app está bloqueada por el dueño.';
      loginBtn.disabled = false;
      loginBtn.textContent = '🔑 Iniciar Sesión';
      return;
    }

    if (role === 'driver') {
      // LOGIN CHOFER: nombre + apellido + password (buscar en drivers)
      if (!nombre || !apellido || !password) {
        errorDiv.textContent = 'Completa todos los campos.';
        throw new Error('campos vacios');
      }
      const driversRef = collection(db, 'drivers');
      const q = query(driversRef, where('nombre', '==', nombre), where('apellido', '==', apellido));
      const snap = await getDocs(q);
      
      if (snap.empty) { errorDiv.textContent = 'Chofer no registrado.'; throw new Error('no driver'); }
      
      const driverDoc = snap.docs[0];
      const data = driverDoc.data();
      
      if (!data.activo) { errorDiv.textContent = 'Chofer inactivo. Contacta al dueño.'; throw new Error('inactive'); }
      if (data.password !== password) { errorDiv.textContent = 'Contraseña incorrecta.'; throw new Error('wrong pass'); }

      sessionStorage.setItem('userRole', 'driver');
      sessionStorage.setItem('driverId', driverDoc.id);
      sessionStorage.setItem('driverName', `${nombre} ${apellido}`);
      window.location.href = '/src/pages/dashboard-driver.html';

    } else {
      // LOGIN DUEÑO/GERENTE: Firebase Auth (email/password)
      if (!email || !password) { errorDiv.textContent = 'Completa email y contraseña.'; throw new Error('empty'); }
      
      const userCred = await signInWithEmailAndPassword(auth, email, password);
      const userDoc = await getDoc(doc(db, 'users', userCred.user.uid));
      
      if (!userDoc.exists()) { errorDiv.textContent = 'Usuario no existe en BD.'; await signOut(auth); throw new Error('no user doc'); }
      
      const uData = userDoc.data();
      if (uData.role !== role) { errorDiv.textContent = 'Rol incorrecto para este usuario.'; await signOut(auth); throw new Error('role mismatch'); }
      if (uData.blocked) { errorDiv.textContent = 'Usuario bloqueado.'; await signOut(auth); throw new Error('blocked'); }

      sessionStorage.setItem('userRole', uData.role);
      sessionStorage.setItem('userId', userCred.user.uid);
      sessionStorage.setItem('userName', uData.nombre);
      
      window.location.href = uData.role === 'owner' 
        ? '/src/pages/dashboard-owner.html' 
        : '/src/pages/dashboard-manager.html';
    }
  } catch (e) {
    console.error(e);
  } finally {
    loginBtn.disabled = false;
    loginBtn.textContent = '🔑 Iniciar Sesión';
  }
});