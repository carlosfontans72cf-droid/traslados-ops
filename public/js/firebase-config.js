// firebase-config.js
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import { getAuth, browserLocalPersistence } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

// ✅ CONFIGURACIÓN EXACTA Y COMPLETA
const firebaseConfig = {
  apiKey: "AIzaSyDoTzIKOpLCVjZUDAGdBJU_XnZzVjdIp1g",
  authDomain: "trasladosops.firebaseapp.com",
  projectId: "trasladosops",
  storageBucket: "trasladosops.firebasestorage.app",
  messagingSenderId: "485600011297",
  appId: "1:485600011297:web:89bd98db4d60c9f680af60"
};

// ✅ INICIALIZACIÓN
const app = initializeApp(firebaseConfig);

// ✅ AUTENTICACIÓN + PERSISTENCIA (RECORDAR SESIÓN)
export const auth = getAuth(app);
auth.setPersistence(browserLocalPersistence)
  .catch((error) => {
    console.warn("⚠️ Aviso persistencia:", error.message);
  });

// ✅ BASE DE DATOS FIRESTORE
export const db = getFirestore(app);