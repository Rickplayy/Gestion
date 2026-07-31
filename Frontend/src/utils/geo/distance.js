// Orquesta el cálculo de distancia domicilio → escuela:
//
//   domicilio {calle, colonia, delegacion, cp}
//        │
//        ├─ geocoder.locate()  → coordenadas + nivel de precisión (1..4)
//        │
//        └─ osrm.route()       → metros reales por calles
//                                (si OSRM no está, se cae a línea recta)
//
// Es el mismo flujo que hacía insertAlumno() en el backend
// (Backend/src/modules/turns/turns.repository.ts), pero sin base de datos.
//
// DIFERENCIA IMPORTANTE respecto al backend: allá OSRM era obligatorio y si no
// respondía, tronaba. Aquí, como el front debe funcionar sin levantar nada, hay
// respaldo por Haversine (línea recta). NO es lo mismo que la distancia real por
// calles: en ciudad suele quedar 20-40% por debajo. Por eso cada medición dice
// de dónde salió (`source`), y la UI lo muestra: sirve para ordenar por lejanía,
// pero no para reportar kilómetros exactos.

import { createOsrmClient } from './osrmClient';
import { createGeocoder } from './geocoder';

// UPIICSA. Mismo valor que traía el .env del backend (UPIICSA_LAT/UPIICSA_LON).
export const DEFAULT_REFERENCE = { lat: 19.396056, lon: -99.091901 };

// Servidor OSRM de demostración del proyecto. Permite CORS, así que el navegador
// puede pegarle directo y se obtiene la MISMA distancia real por calles que
// calculaba el backend, sin levantar nada.
//
// Es de cortesía y su política prohíbe uso intensivo: para corridas grandes o de
// producción hay que levantar OSRM propio y ponerlo en VITE_OSRM_URL. El cache de
// abajo ayuda mucho (se mide por colonia, no por alumno), pero no es permiso para
// abusar. Con VITE_OSRM_URL="" se apaga y todo se estima en línea recta.
export const DEFAULT_OSRM_URL = 'https://router.project-osrm.org';

const EARTH_RADIUS_M = 6371000;
const toRad = (deg) => (deg * Math.PI) / 180;

// Distancia en línea recta sobre la esfera. Respaldo cuando no hay OSRM.
export function haversineMeters(from, to) {
  const dLat = toRad(to.lat - from.lat);
  const dLon = toRad(to.lon - from.lon);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(from.lat)) * Math.cos(toRad(to.lat)) * Math.sin(dLon / 2) ** 2;
  return 2 * EARTH_RADIUS_M * Math.asin(Math.min(1, Math.sqrt(a)));
}

/**
 * @param {object} [options]
 * @param {string}  [options.osrmUrl]       servidor OSRM; vacío = siempre línea recta
 * @param {string}  [options.geocoderUrl]   instancia de Nominatim
 * @param {number}  [options.minIntervalMs] espera entre peticiones al geocodificador
 * @param {{lat:number,lon:number}} [options.reference] punto de referencia (la escuela)
 */
export function createDistanceService(options = {}) {
  const reference = options.reference || DEFAULT_REFERENCE;
  // ?? y no ||: pasar "" tiene que poder APAGAR el ruteo, no caer al default.
  const osrmUrl = options.osrmUrl ?? DEFAULT_OSRM_URL;
  const osrm = osrmUrl ? createOsrmClient(osrmUrl) : null;
  const geocoder = createGeocoder({
    baseUrl: options.geocoderUrl,
    minIntervalMs: options.minIntervalMs,
  });

  // Si OSRM no responde, no tiene caso reintentarlo con cada uno de los miles de
  // alumnos: se marca como caído a la primera y el resto va directo a Haversine.
  let osrmDisponible = Boolean(osrm);

  // El geocodificador ubica por COLONIA, así que todos los alumnos de una misma
  // colonia comparten punto — y por lo tanto, ruta. Sin este cache 3000 alumnos
  // serían 3000 peticiones idénticas a OSRM; con él son tantas como colonias
  // distintas haya (decenas), que es lo que vuelve viable usar el servidor
  // público. Se guarda la PROMESA, no el resultado: así varios alumnos que caen
  // en la misma colonia a la vez comparten una sola llamada en vez de lanzar N.
  const rutas = new Map();

  const medirDesde = (point) => {
    const key = `${point.lat},${point.lon}`;
    let pendiente = rutas.get(key);
    if (pendiente === undefined) {
      pendiente = (async () => {
        if (osrm && osrmDisponible) {
          try {
            const route = await osrm.route(point, reference);
            if (route) return { meters: route.meters, source: 'osrm' };
            // OSRM contestó pero no halló ruta (punto aislado): línea recta.
          } catch {
            osrmDisponible = false;
          }
        }
        return { meters: haversineMeters(point, reference), source: 'haversine' };
      })();
      rutas.set(key, pendiente);
    }
    return pendiente;
  };

  return {
    reference,
    get osrmActivo() {
      return osrmDisponible;
    },
    // Rechazos/timeouts del geocodificador, para distinguir "no se pudo ubicar
    // este domicilio" de "el servicio nos está bloqueando".
    get geocoderStats() {
      return geocoder.stats;
    },

    /**
     * @returns {Promise<{meters: number, nivel: 1|2|3|4, source: 'osrm'|'haversine'} | null>}
     *          null cuando el domicilio no se pudo ubicar.
     */
    measure: async (domicilio) => {
      const match = await geocoder.locate(domicilio);
      if (!match) return null;

      const ruta = await medirDesde(match.point);
      return { meters: ruta.meters, nivel: match.nivel, source: ruta.source };
    },
  };
}
