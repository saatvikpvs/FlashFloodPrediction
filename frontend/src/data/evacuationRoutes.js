/**
 * Evacuation shelter registry for Wayanad villages.
 *
 * Only origin (village lat/lon comes from the API) and destination
 * shelter are stored here. Actual road-following route geometry is
 * fetched live from OpenRouteService, which avoids any villages that
 * are currently at High or Severe risk.
 */

export const EVACUATION_ROUTES = [
  {
    villageId: "chooralmala",
    shelter: {
      name: "Vythiri Govt. UP School (Relief Camp)",
      lat: 11.5833,
      lon: 76.0833,
    },
    fallbackWaypoints: [
      [11.5022, 76.1548],
      [11.5350, 76.1380],
      [11.5580, 76.1320],
      [11.5720, 76.1050],
      [11.5833, 76.0833],
    ],
    notes: "Follow Meppadi Road (SH 29) north-west. Avoid river crossings.",
  },
  {
    villageId: "mundakkai",
    shelter: {
      name: "Vythiri Govt. UP School (Relief Camp)",
      lat: 11.5833,
      lon: 76.0833,
    },
    fallbackWaypoints: [
      [11.4859, 76.1559],
      [11.5022, 76.1548],
      [11.5580, 76.1320],
      [11.5833, 76.0833],
    ],
    notes: "Join Chooralmala road then take SH 29 north-west to Vythiri.",
  },
  {
    villageId: "meppadi",
    shelter: {
      name: "Vythiri Govt. UP School (Relief Camp)",
      lat: 11.5833,
      lon: 76.0833,
    },
    fallbackWaypoints: [
      [11.5579, 76.1320],
      [11.5720, 76.1050],
      [11.5833, 76.0833],
    ],
    notes: "Take SH 29 west. Do not use the Chooralmala road.",
  },
  {
    villageId: "vythiri",
    shelter: {
      name: "Kalpetta District Collectorate",
      lat: 11.6085,
      lon: 76.0837,
    },
    fallbackWaypoints: [
      [11.5833, 76.0833],
      [11.6085, 76.0837],
    ],
    notes: "Drive north on NH 212 to Kalpetta.",
  },
  {
    villageId: "kalpetta",
    shelter: {
      name: "Mananthavady Taluk Hospital",
      lat: 11.8035,
      lon: 76.0064,
    },
    fallbackWaypoints: [
      [11.6085, 76.0837],
      [11.7200, 76.0300],
      [11.8035, 76.0064],
    ],
    notes: "Move north on NH 212 to Mananthavady.",
  },
  {
    villageId: "mananthavady",
    shelter: {
      name: "Kalpetta District Collectorate",
      lat: 11.6085,
      lon: 76.0837,
    },
    fallbackWaypoints: [
      [11.8035, 76.0064],
      [11.7000, 76.0400],
      [11.6085, 76.0837],
    ],
    notes: "Head south on NH 212 to Kalpetta.",
  },
  {
    villageId: "sulthan_bathery",
    shelter: {
      name: "Kalpetta District Collectorate",
      lat: 11.6085,
      lon: 76.0837,
    },
    fallbackWaypoints: [
      [11.6667, 76.2833],
      [11.7167, 76.1667],
      [11.6085, 76.0837],
    ],
    notes: "Take SH 15 west via Pulpally junction to Kalpetta.",
  },
  {
    villageId: "pulpally",
    shelter: {
      name: "Kalpetta District Collectorate",
      lat: 11.6085,
      lon: 76.0837,
    },
    fallbackWaypoints: [
      [11.7167, 76.1667],
      [11.6500, 76.1050],
      [11.6085, 76.0837],
    ],
    notes: "Head west on SH 15 to Kalpetta.",
  },
];

export const EVACUATION_BY_VILLAGE = Object.fromEntries(
  EVACUATION_ROUTES.map((r) => [r.villageId, r])
);
