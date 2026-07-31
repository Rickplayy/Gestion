// Convierte un domicilio en coordenadas. Es el equivalente en el navegador de
// matchColonia() del backend (Backend/src/modules/turns/turns.repository.ts).
//
// El backend resolvía esto contra un catálogo propio en MariaDB (SIGE_CCOLONIAS,
// SIGE_CMUNICIPIOS, SIGE_CEDOS), que aquí no existe: el front no tiene base de
// datos. Se reemplaza por un geocodificador HTTP (Nominatim por defecto), pero se
// conserva lo esencial del diseño original:
//
//   1. La MISMA escala de 4 niveles de precisión, cayendo al siguiente cuando el
//      anterior no encuentra nada. `nivel` viaja junto con el punto para que
//      quien lo use sepa qué tan confiable es la distancia resultante.
//   2. Se geocodifica a nivel COLONIA, nunca calle y número. El backend tomaba
//      el centroide de la colonia (SIGE_CCOLONIAS.LATITUD/LONGITUD), así que la
//      precisión es la misma — y además evita mandar el domicilio exacto de un
//      menor de edad a un servicio de terceros.
//
// Niveles (igual que el backend):
//   1 = colonia + delegación/municipio + CP   (más preciso)
//   2 = colonia + CP
//   3 = solo CP
//   4 = solo delegación/municipio             (más burdo, último recurso)

const NOMINATIM_PUBLIC = 'https://nominatim.openstreetmap.org';

// El Nominatim público permite 1 petición por segundo. Se respeta con una cola
// en serie; si se apunta a una instancia propia (VITE_NOMINATIM_URL) se puede
// bajar este número y todo va mucho más rápido.
const DEFAULT_MIN_INTERVAL_MS = 1100;
const REQUEST_TIMEOUT_MS = 8000;

const norm = (v) => String(v || '').trim().replace(/\s+/g, ' ').toUpperCase();

/**
 * @param {object} [options]
 * @param {string} [options.baseUrl]        instancia de Nominatim
 * @param {number} [options.minIntervalMs]  espera mínima entre peticiones
 */
export function createGeocoder(options = {}) {
  const baseUrl = options.baseUrl || NOMINATIM_PUBLIC;
  const minIntervalMs = options.minIntervalMs ?? DEFAULT_MIN_INTERVAL_MS;

  // Cache por domicilio normalizado. Es lo que vuelve viable esta estrategia:
  // cientos de aspirantes comparten colonia y CP, así que una generación con
  // miles de alumnos se reduce a decenas de peticiones reales.
  const cache = new Map();

  // Un 403/429 sistemático (la instancia nos bloquea o limita) se ve idéntico a
  // "domicilio no encontrado" si solo se devuelve null: el usuario acabaría con
  // la columna Kms vacía sin saber por qué. Se llevan contadores para poder
  // distinguir un problema del servicio de un domicilio ilegible.
  let rechazos = 0;
  let fallosRed = 0;
  let ultimoEstado = null;

  // Cola en serie: encadenar promesas garantiza que nunca salgan dos peticiones
  // a la vez ni más rápido que minIntervalMs, que es justo lo que pide la
  // política de uso del Nominatim público.
  let queue = Promise.resolve();
  const enqueue = (fn) => {
    const result = queue.then(fn);
    queue = result.then(
      () => new Promise((r) => setTimeout(r, minIntervalMs)),
      () => new Promise((r) => setTimeout(r, minIntervalMs)),
    );
    return result;
  };

  const search = async (params) => {
    const url = new URL('/search', baseUrl);
    url.searchParams.set('format', 'jsonv2');
    url.searchParams.set('limit', '1');
    url.searchParams.set('countrycodes', 'mx');
    for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

    let response;
    try {
      response = await fetch(url, { signal: controller.signal });
    } catch {
      fallosRed += 1;
      return null; // sin red o timeout
    } finally {
      clearTimeout(timeout);
    }

    if (!response.ok) {
      // 403 = bloqueo por política de uso, 429 = demasiadas peticiones,
      // 5xx = la instancia está caída. Nada de eso significa "no existe".
      if (response.status === 403 || response.status === 429 || response.status >= 500) {
        rechazos += 1;
        ultimoEstado = response.status;
      }
      return null;
    }

    const body = await response.json();
    const hit = Array.isArray(body) ? body[0] : null;
    if (!hit) return null;

    const lat = Number(hit.lat);
    const lon = Number(hit.lon);
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;

    return { lat, lon };
  };

  return {
    // Para que la UI pueda decir "el geocodificador rechazó N peticiones" en vez
    // de dejar creer que ningún domicilio se pudo ubicar.
    get stats() {
      return { rechazos, fallosRed, ultimoEstado };
    },

    /**
     * @param {{colonia?: string|null, delegacion?: string|null, cp?: string|null}} domicilio
     * @returns {Promise<{point: {lat: number, lon: number}, nivel: 1|2|3|4} | null>}
     */
    locate: (domicilio) => {
      const colonia = norm(domicilio?.colonia);
      const delegacion = norm(domicilio?.delegacion);
      const cp = norm(domicilio?.cp);

      if (!colonia && !delegacion && !cp) return Promise.resolve(null);

      const key = `${colonia}|${delegacion}|${cp}`;

      // Se guarda la PROMESA, no el resultado: los alumnos se procesan en
      // paralelo, así que varios de la misma colonia consultan antes de que el
      // primero conteste. Cacheando el resultado, los N miran un cache vacío y
      // lanzan N peticiones idénticas; cacheando la promesa, comparten una sola.
      // Con el límite de 1 petición/segundo del Nominatim público, esa
      // diferencia son minutos de espera.
      let pendiente = cache.get(key);
      if (pendiente !== undefined) return pendiente;

      const intentos = [];
      if (colonia && delegacion && cp) {
        intentos.push({ nivel: 1, params: { q: `${colonia}, ${delegacion}, ${cp}, México` } });
      }
      if (colonia && cp) {
        intentos.push({ nivel: 2, params: { q: `${colonia}, ${cp}, México` } });
      }
      if (cp) {
        intentos.push({ nivel: 3, params: { postalcode: cp, country: 'México' } });
      }
      if (delegacion) {
        intentos.push({ nivel: 4, params: { q: `${delegacion}, México` } });
      }

      pendiente = (async () => {
        for (const intento of intentos) {
          const point = await enqueue(() => search(intento.params));
          if (point) return { point, nivel: intento.nivel };
        }
        // El fallo también queda cacheado: sin esto, un domicilio ilegible
        // reintentaría los 4 niveles por cada alumno que lo comparta.
        return null;
      })();

      cache.set(key, pendiente);
      return pendiente;
    },
  };
}
