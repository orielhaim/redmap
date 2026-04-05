# RedAlert API

> Real-time Israeli emergency alert system. Base URL: `https://redalert.orielhaim.com`

## Real-Time Alerts (Socket.IO)

Connect via `socket.io-client` to `https://redalert.orielhaim.com` with `auth: { apiKey }`.

### Events

| Event | Payload | Description |
|-------|---------|-------------|
| `alert` | `alert[]` | Array of all alert types |
| `missiles` | `alert` | Missile/rocket alert |
| `radiologicalEvent` | `alert` | Radiological incident |
| `earthQuake` | `alert` | Earthquake |
| `tsunami` | `alert` | Tsunami warning |
| `hostileAircraftIntrusion` | `alert` | Hostile aircraft |
| `hazardousMaterials` | `alert` | Hazardous materials |
| `terroristInfiltration` | `alert` | Terrorist infiltration |
| `newsFlash` | `alert` | Pre-alert news flash |
| `endAlert` | `alert` | End of alert |

### Alert Object

```json
{ "type": "missiles", "title": "...", "cities": ["..."], "instructions": "..." }
```

---

## REST API

Base: `https://redalert.orielhaim.com/api`

### GET `/api/stats/summary`

Aggregated statistics. Core fields always returned; optional sections via `include`.

**Params:** `startDate`, `endDate` (ISO 8601), `origin` (comma-sep), `include` (comma-sep: `topCities`, `topZones`, `topOrigins`, `timeline`, `peak`), `topLimit` (1-50, default 5), `timelineGroup` (`hour`|`day`|`week`|`month`, default `day`).

**Core response:**
```json
{
  "totals": { "range": 0, "last24h": 0, "last7d": 0, "last30d": 0 },
  "uniqueCities": 0, "uniqueZones": 0, "uniqueOrigins": 0
}
```

**Optional sections (via `include`):**
- `topCities` → `topCities[]: { city, zone, count }`
- `topZones` → `topZones[]: { zone, count }`
- `topOrigins` → `topOrigins[]: { origin, count }`
- `timeline` → `timeline[]: { period, count }` (format depends on `timelineGroup`)
- `peak` → `peak: { period, count }`

---

### GET `/api/stats/cities`

Paginated city alert breakdown.

**Params:** `startDate`, `endDate`, `limit` (1-500, default 10), `offset` (default 0), `origin`, `search` (partial match), `zone` (exact), `sort` (`count`|`city`|`zone`), `order` (`asc`|`desc`), `include` (comma-sep: `translations`, `coords`, `polygons`).

**Response:**
```json
{
  "data": [{ "city": "...", "cityZone": "...", "count": 0 }],
  "pagination": { "total": 0, "limit": 0, "offset": 0, "hasMore": false }
}
```

**Optional fields (via `include`):**
- `translations` → `translations: { name: { en, ru, ar }, zone: { en, ru, ar } }`
- `coords` → `lat`, `lng`
- `polygons` → `polygons` (GeoJSON)

---

### GET `/api/stats/history`

Paginated alert history with nested cities.

**Params:** `startDate`, `endDate`, `limit` (1-100, default 20), `offset`, `cityId` (exact), `cityName` (exact, Hebrew), `search` (partial), `category`, `origin`, `sort` (`timestamp`|`type`|`origin`), `order`, `include` (`translations`, `coords`, `polygons`).

City filter priority: `cityId` > `cityName` > `search`.

**Response:**
```json
{
  "data": [{
    "id": 0, "timestamp": "ISO8601", "type": "missiles", "origin": "gaza",
    "cities": [{ "id": 0, "name": "..." }]
  }],
  "pagination": { "total": 0, "limit": 0, "offset": 0, "hasMore": false }
}
```

**Optional city fields (via `include`):** `translations` (en/ru/ar), `coords` (lat/lng), `polygons` (GeoJSON).

---

### GET `/api/stats/distribution`

Alert count breakdown by category or origin.

**Params:** `startDate`, `endDate`, `origin`, `groupBy` (`category`|`origin`, default `category`), `category` (exact), `limit` (1-100, default 50), `offset`, `sort` (`count`|`label`), `order`.

**Response:**
```json
{
  "data": [{ "label": "missiles", "count": 0 }],
  "totalAlerts": 0,
  "pagination": { "total": 0, "limit": 0, "offset": 0, "hasMore": false }
}
```