// Cliente de OSRM (Open Source Routing Machine): convierte dos coordenadas en
// la distancia real por calles entre ellas, no la línea recta.
//
// Es un puerto directo del cliente del backend (Backend/src/infra/geo/osrm.client.ts).
// No depende de base de datos ni de nada del servidor: es solo `fetch`, así que
// corre igual en el navegador.
//
// OSRM es software que se hospeda uno mismo (no es un servicio de paga): hay que
// levantar el servidor con el mapa de la región cargado. Si no está disponible,
// route() avisa con un error y el llamador decide si usa el respaldo en línea
// recta (ver distance.js).

const REQUEST_TIMEOUT_MS = 5000;

/**
 * @param {string} baseUrl  URL del servidor OSRM, ej. "http://localhost:5000"
 */
export function createOsrmClient(baseUrl) {
  return {
    /**
     * @param {{lat: number, lon: number}} from
     * @param {{lat: number, lon: number}} to
     * @returns {Promise<{meters: number, durationSeconds: number} | null>}
     *          null cuando OSRM responde pero no encuentra ruta entre los puntos.
     */
    route: async (from, to) => {
      // OJO: OSRM espera lon,lat (en ese orden), no lat,lon.
      const coordinates = `${from.lon},${from.lat};${to.lon},${to.lat}`;
      const url = new URL(`/route/v1/driving/${coordinates}`, baseUrl);
      url.searchParams.set('overview', 'false');

      // Sin timeout, un OSRM caído deja la generación colgada: con miles de
      // alumnos son miles de peticiones que nunca resuelven.
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

      let response;
      try {
        response = await fetch(url, { signal: controller.signal });
      } catch (cause) {
        throw new Error('OSRM no está disponible', { cause });
      } finally {
        clearTimeout(timeout);
      }

      if (!response.ok) {
        throw new Error(`OSRM respondió con estatus ${response.status}`);
      }

      const body = await response.json();
      if (body.code !== 'Ok') return null;

      const route = body.routes?.[0];
      if (route === undefined) return null;

      return { meters: route.distance, durationSeconds: route.duration };
    },
  };
}
