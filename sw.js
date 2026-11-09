"use strict";

// Pour publier une nouvelle version de l'application : changez ce numéro (v1 → v2 → v3…).
const VERSION = "v1";
const PREFIX = "chantier-planner-";
const CACHE = PREFIX + VERSION;

// Fichiers enregistrés à l'installation (chemins relatifs au dossier du service worker).
const PRECACHE = ["./", "index.html", "manifest.json", "icon-192.png", "icon-512.png", "chantiers.json"];

self.addEventListener("install", event => {
  event.waitUntil(
    caches.open(CACHE)
      // cache: "reload" force la lecture sur le serveur, pas dans le cache HTTP du navigateur
      .then(cache => Promise.all(PRECACHE.map(u => cache.add(new Request(u, { cache: "reload" })))))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", event => {
  event.waitUntil(
    caches.keys()
      // Ne supprime que les anciens caches de cette application (le domaine github.io est partagé avec d'autres projets)
      .then(keys => Promise.all(keys.filter(k => k.startsWith(PREFIX) && k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", event => {
  const req = event.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;
  if (url.pathname.endsWith("/chantiers.json")) event.respondWith(networkFirst(req));
  else event.respondWith(cacheFirst(req));
});

// chantiers.json : réseau d'abord, dernière version enregistrée en secours (hors ligne)
async function networkFirst(req) {
  const cache = await caches.open(CACHE);
  try {
    const res = await fetch(req);
    if (res.ok) await cache.put(req.url, res.clone());
    return res; // une erreur serveur (404…) est transmise telle quelle, l'application l'affiche
  } catch (e) {
    const hit = await cache.match(req.url);
    return hit || Response.error();
  }
}

// Autres fichiers : cache d'abord, réseau en secours
async function cacheFirst(req) {
  const hit = await caches.match(req, { ignoreSearch: true });
  if (hit) return hit;
  try {
    return await fetch(req);
  } catch (e) {
    if (req.mode === "navigate") { const home = await caches.match("./"); if (home) return home; }
    return Response.error();
  }
}
