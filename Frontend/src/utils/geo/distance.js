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
  const osrmUrl = options.osrmUrl || '';
  const osrm = osrmUrl ? createOsrmClient(osrmUrl) : null;
  const geocoder = createGeocoder({
    baseUrl: options.geocoderUrl,
    minIntervalMs: options.minIntervalMs,
  });

  // Si OSRM no responde, no tiene caso reintentarlo con cada uno de los miles de
  // alumnos: se marca como caído a la primera y el resto va directo a Haversine.
  let osrmDisponible = Boolean(osrm);

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

      if (osrm && osrmDisponible) {
        try {
          const route = await osrm.route(match.point, reference);
          if (route) {
            return { meters: route.meters, nivel: match.nivel, source: 'osrm' };
          }
          // OSRM contestó pero no halló ruta (punto aislado): línea recta.
        } catch {
          osrmDisponible = false;
        }
      }

      return {
        meters: haversineMeters(match.point, reference),
        nivel: match.nivel,
        source: 'haversine',
      };
    },
  };
}
