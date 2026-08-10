export type GeoPoint = {
  lat: number;
  lon: number;
};

export type RouteResult = {
  meters: number;
  durationSeconds: number;
};

export type OsrmClient = {
  route: (from: GeoPoint, to: GeoPoint) => Promise<RouteResult | null>;
};

type OsrmResponse = {
  code: string;
  routes?: { distance: number; duration: number }[];
};

const REQUEST_TIMEOUT_MS = 5000;

export const createOsrmClient = (baseUrl: string): OsrmClient => ({
  route: async (from, to) => {
    const coordinates = `${from.lon},${from.lat};${to.lon},${to.lat}`;
    const url = new URL(`/route/v1/driving/${coordinates}`, baseUrl);
    url.searchParams.set('overview', 'false');

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

    let response: Response;
    try {
      response = await fetch(url, { signal: controller.signal });
    } catch (cause) {
      throw new Error('OSRM is unreachable', { cause });
    } finally {
      clearTimeout(timeout);
    }

    if (!response.ok) {
      throw new Error(`OSRM responded with status ${response.status}`);
    }

    const body = (await response.json()) as OsrmResponse;
    if (body.code !== 'Ok') {
      return null;
    }

    const route = body.routes?.[0];
    if (route === undefined) {
      return null;
    }

    return { meters: route.distance, durationSeconds: route.duration };
  },
});
