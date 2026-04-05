'use client';

import { api } from '@/lib/api/redalert';

const DB_NAME = 'redmap-city-cache';
const DB_VERSION = 1;
const STORE_NAME = 'cities';
const META_STORE = 'meta';
const META_KEY = 'info';
const CACHE_VERSION = 'v1';

function openDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = (e) => {
      const db = e.target.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains(META_STORE)) {
        db.createObjectStore(META_STORE);
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function txGet(db, store, key) {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(store, 'readonly');
    const req = tx.objectStore(store).get(key);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function txPutAll(db, store, items) {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(store, 'readwrite');
    const os = tx.objectStore(store);
    for (const item of items) os.put(item);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

function txPut(db, store, key, value) {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(store, 'readwrite');
    const req = tx.objectStore(store).put(value, key);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

function txGetAll(db, store) {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(store, 'readonly');
    const req = tx.objectStore(store).getAll();
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function fetchCitiesFromAPI() {
  const json = await api
    .get('data/cities', {
      searchParams: { limit: '100000', include: 'polygons' },
      timeout: 60000,
    })
    .json();
  return Array.isArray(json) ? json : (json.data ?? []);
}

export async function getCityPolygonMap(forceRefresh = false) {
  const db = await openDB();

  if (!forceRefresh) {
    const meta = await txGet(db, META_STORE, META_KEY);
    if (meta?.cacheVersion === CACHE_VERSION && meta?.fetchedAt) {
      const cities = await txGetAll(db, STORE_NAME);
      if (cities.length > 0) {
        return buildMap(cities);
      }
    }
  }

  const cities = await fetchCitiesFromAPI();
  if (cities.length === 0) return new Map();

  const normalized = cities.map((c) => ({
    ...c,
    id: c.id ?? c.cityId ?? c.name,
  }));

  await txPutAll(db, STORE_NAME, normalized);
  await txPut(db, META_STORE, META_KEY, {
    cacheVersion: CACHE_VERSION,
    fetchedAt: Date.now(),
    count: normalized.length,
  });

  return buildMap(normalized);
}

function buildMap(cities) {
  const map = new Map();
  for (const c of cities) {
    if (c.id != null) map.set(String(c.id), c);
    if (c.name) map.set(c.name, c);
  }
  return map;
}
