// /api/login.js
const { initializeApp, cert, getApps } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');
const { getAuth } = require('firebase-admin/auth');

if (!getApps().length) {
  initializeApp({
    credential: cert({
      projectId: process.env.FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey: (process.env.FIREBASE_PRIVATE_KEY || '').replace(/\\n/g, '\n'),
    }),
  });
}

const db = getFirestore();
const auth = getAuth();

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Método no permitido' });
  }

  const { companyId, nombre, apellido, password, superadmin } = req.body || {};

  try {
    // ========== LOGIN DE SUPER ADMIN (dueño de la plataforma) ==========
    if (superadmin) {
      if (!nombre || !password) {
        return res.status(400).json({ error: 'Completá usuario y contraseña' });
      }

      const snap = await db.collection('platform_admins')
        .where('nombre', '==', nombre)
        .get();

      const match = snap.docs.find(d => d.data().password === password);
      if (!match) {
        return res.status(401).json({ error: 'Credenciales de super admin incorrectas' });
      }

      const token = await auth.createCustomToken(`superadmin_${match.id}`, {
        superadmin: true,
      });

      return res.status(200).json({
        token,
        role: 'superadmin',
        userId: match.id,
        fullName: match.data().nombre,
      });
    }

    // ========== LOGIN NORMAL (usuario de una empresa) ==========
    if (!companyId || !nombre || !apellido || !password) {
      return res.status(400).json({
        error: 'Completá empresa, nombre, apellido y contraseña',
      });
    }

    const companyIdNormalizado = String(companyId).trim().toLowerCase();
    const companyRef = db.collection('companies').doc(companyIdNormalizado);
    const companySnap = await companyRef.get();

    if (!companySnap.exists) {
      return res.status(404).json({ error: 'Código de empresa no encontrado' });
    }
    if (companySnap.data().activo === false) {
      return res.status(403).json({ error: 'Esta empresa está desactivada. Contactá al soporte.' });
    }

    const usersSnap = await companyRef.collection('users')
      .where('nombre', '==', nombre)
      .where('apellido', '==', apellido)
      .get();

    if (usersSnap.empty) {
      return res.status(401).json({ error: 'Usuario no registrado en esta empresa' });
    }

    const match = usersSnap.docs.find(d => d.data().password === password);
    if (!match) {
      return res.status(401).json({ error: 'Contraseña incorrecta' });
    }

    const userData = match.data();
    if (!userData.activo) {
      return res.status(403).json({ error: 'Tu cuenta está desactivada. Consultá con tu administrador.' });
    }

    const token = await auth.createCustomToken(match.id, {
      companyId: companyIdNormalizado,
      role: userData.role,
    });

    return res.status(200).json({
      token,
      companyId: companyIdNormalizado,
      role: userData.role,
      userId: match.id,
      fullName: `${userData.nombre} ${userData.apellido}`,
    });

  } catch (err) {
    console.error('🔴 Error en /api/login:', err);
    return res.status(500).json({ error: 'Error interno del servidor. Intentá de nuevo.' });
  }
};