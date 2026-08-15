// api/route.js - Serverless Function para calcular rutas con Google Maps
// Esta función se ejecuta en el servidor de Vercel, sin problemas de CORS

export default async function handler(req, res) {
  // Solo permitir GET
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { type, address, origin, destination, mode } = req.query;

  const API_KEY = 'AIzaSyAF2Yqau-KETXUes3P-ST5CkIeWLvSGhBc';

  try {
    if (type === 'geocode' && address) {
      // Geocodificación: convertir dirección a coordenadas
      const query = encodeURIComponent(address);
      // Agregar Uruguay por defecto
      const fullQuery = /uruguay|argentina|brasil/i.test(address) 
        ? query 
        : `${query},%20Uruguay`;

      const url = `https://maps.googleapis.com/maps/api/geocode/json?address=${fullQuery}&key=${API_KEY}&language=es`;
      
      const response = await fetch(url);
      const data = await response.json();

      if (data.status !== 'OK') {
        return res.status(400).json({ 
          error: data.error_message || `Google Maps error: ${data.status}` 
        });
      }

      return res.status(200).json(data);

    } else if (type === 'directions' && origin && destination) {
      // Direcciones: calcular ruta entre dos puntos
      const url = `https://maps.googleapis.com/maps/api/directions/json?origin=${encodeURIComponent(origin)}&destination=${encodeURIComponent(destination)}&mode=${mode || 'driving'}&key=${API_KEY}&language=es`;

      const response = await fetch(url);
      const data = await response.json();

      if (data.status !== 'OK') {
        return res.status(400).json({ 
          error: data.error_message || `Google Maps error: ${data.status}` 
        });
      }

      return res.status(200).json(data);

    } else {
      return res.status(400).json({ error: 'Missing parameters' });
    }

  } catch (error) {
    console.error('Error en route.js:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}