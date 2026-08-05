import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyDoTzIKOpLCVjZUDAGdBJU_XnZzVjdIp1g",
  authDomain: "trasladosops.firebaseapp.com",
  projectId: "trasladosops",
  storageBucket: "trasladosops.firebasestorage.app",
  messagingSenderId: "485600011297",
  appId: "1:485600011297:web:89bd98db4d60c9f680af60"
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);