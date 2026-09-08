/**
 * OpenRouteService (ORS) routing helper.
 *
 * Uses the free ORS Directions v2 API to compute real road-following
 * evacuation routes that avoid flooded / landslide-risk areas.
 *
 * Docs: https://openrouteservice.org/dev/#/api-docs/v2/directions/{profile}/geojson/post
 */

const ORS_BASE = "https://api.openrouteservice.org/v2";
const ORS_KEY = import.meta.env.VITE_ORS_API_KEY || "";

/**
 * Build a circular GeoJSON polygon to use as an avoid-area.
 * ORS expects GeoJSON lon,lat order.
 *
 * @param {number} lat
 * @param {number} lon
 * @param {number} radiusM  - radius in metres (default 800 m)
 * @param {number} sides    - polygon approximation sides
 */
function circlePolygon(lat, lon, radiusM = 800, sides = 16) {
  const earthR = 6371000;
  const coords = [];
  for (let i = 0; i <= sides; i++) {
    const angle = (2 * Math.PI * i) / sides;
    const dLat = (radiusM / earthR) * (180 / Math.PI);
    const dLon = (radiusM / (earthR * Math.cos((lat * Math.PI) / 180))) * (180 / Math.PI);
    coords.push([lon + dLon * Math.cos(angle), lat + dLat * Math.sin(angle)]);
  }
  return { type: "Polygon", coordinates: [coords] };
}

/**
 * Fetch a driving route from ORS, avoiding the supplied avoid-villages.
 *
 * @param {[number,number]} origin   [lat, lon] of the evacuating village
 * @param {[number,number]} dest     [lat, lon] of the shelter
 * @param {Array}           avoidVillages  array of {lat, lon} to circle-avoid
 * @returns {Promise<{ coords: [number,number][], blocked: boolean }>}
 *   coords = [[lat,lon], …] ready for Leaflet Polyline
 *   blocked = true if ORS could not route avoiding all hazards
 */
export async function fetchOrsRoute(origin, dest, avoidVillages = []) {
  if (!ORS_KEY) {
    return { coords: null, blocked: false, error: "no_key" };
  }

  // ORS uses [lon, lat] order
  const body = {
    coordinates: [
      [origin[1], origin[0]],
      [dest[1], dest[0]],
    ],
    instructions: false,
    geometry_simplify: false,
  };

  if (avoidVillages.length > 0) {
    body.options = {
      avoid_polygons: {
        type: "MultiPolygon",
        coordinates: avoidVillages.map((v) => circlePolygon(v.lat, v.lon).coordinates),
      },
    };
  }

  try {
    const res = await fetch(`${ORS_BASE}/directions/driving-car/geojson`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: ORS_KEY,
      },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      // 2010 = route not found / cannot avoid all polygons
      const json = await res.json().catch(() => ({}));
      const code = json?.error?.code;
      return { coords: null, blocked: code === 2010 || res.status === 400, error: res.status };
    }

    const json = await res.json();
    const feature = json.features?.[0];
    if (!feature) return { coords: null, blocked: false, error: "empty" };

    // Convert ORS [lon,lat] → Leaflet [lat,lon]
    const coords = feature.geometry.coordinates.map(([lon, lat]) => [lat, lon]);
    return { coords, blocked: false, error: null };
  } catch (e) {
    return { coords: null, blocked: false, error: "network" };
  }
}
