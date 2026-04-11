import ky from "ky";

const apiKey = process.env.NEXT_PUBLIC_SIREN_API_KEY ?? "";

export const api = ky.create({
  prefixUrl: "https://api.siren.co.il",
  headers: {
    ...(apiKey ? { "x-api-key": apiKey } : {}),
  },
  timeout: 15000,
});

/** Convert a yyyy-MM-dd date string to a full ISO datetime UTC string. */
function toIsoDatetime(dateStr, endOfDay = false) {
  if (!dateStr) return undefined;
  // Already a full ISO datetime — pass through
  if (dateStr.includes("T")) return dateStr;
  return endOfDay ? `${dateStr}T23:59:59Z` : `${dateStr}T00:00:00Z`;
}

function cleanParams(obj) {
  const out = {};
  for (const [k, v] of Object.entries(obj)) {
    if (v !== undefined && v !== null && v !== "") out[k] = String(v);
  }
  return out;
}

export async function getSummary(
  { startDate, endDate, origin, include, topLimit, timelineGroup } = {},
  _apiKey
) {
  return api
    .get("stats/summary", {
      searchParams: cleanParams({
        startDate: toIsoDatetime(startDate, false),
        endDate: toIsoDatetime(endDate, true),
        origin,
        include,
        topLimit,
        timelineGroup,
      }),
    })
    .json();
}

export async function getCities(
  {
    startDate,
    endDate,
    limit = 50,
    offset = 0,
    origin,
    search,
    zone,
    sort,
    order,
    include,
  } = {},
  _apiKey
) {
  return api
    .get("stats/cities", {
      searchParams: cleanParams({
        startDate: toIsoDatetime(startDate, false),
        endDate: toIsoDatetime(endDate, true),
        limit,
        offset,
        origin,
        search,
        zone,
        sort,
        order,
        include,
      }),
    })
    .json();
}

export async function getHistory(
  {
    startDate,
    endDate,
    limit = 20,
    offset = 0,
    cityId,
    cityName,
    search,
    category,
    origin,
    sort,
    order,
    include,
  } = {},
  _apiKey
) {
  return api
    .get("stats/history", {
      searchParams: cleanParams({
        startDate: toIsoDatetime(startDate, false),
        endDate: toIsoDatetime(endDate, true),
        limit,
        offset,
        cityId,
        cityName,
        search,
        category,
        origin,
        sort,
        order,
        include,
      }),
    })
    .json();
}

export async function getDistribution(
  {
    startDate,
    endDate,
    origin,
    groupBy = "category",
    category,
    limit = 50,
    offset = 0,
    sort,
    order,
  } = {},
  _apiKey
) {
  return api
    .get("stats/distribution", {
      searchParams: cleanParams({
        startDate: toIsoDatetime(startDate, false),
        endDate: toIsoDatetime(endDate, true),
        origin,
        groupBy,
        category,
        limit,
        offset,
        sort,
        order,
      }),
    })
    .json();
}