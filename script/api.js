/* ============================================================
   api.js — helpers pour parler à l’API TMDB
   (clé/config centralisées, petites fonctions utilitaires)
   ============================================================ */

// ------------------------------------------------------------
// Configuration TMDB de base (clé, URLs, tailles images, etc.)
// NOTE: la clé est en clair ici pour le devoir; en prod => serveur.
// ------------------------------------------------------------
export const TMDB_CONFIG = {
    API_KEY: "e4b90327227c88daac14c0bd0c1f93cd",
    BASE_URL: "https://api.themoviedb.org/3",
    IMAGE_BASE_URL: "https://image.tmdb.org/t/p",
    IMAGE_SIZES: { POSTER: { M: "w342" }, BACKDROP: { L: "w1280" } },
    DEFAULT_PARAMS: { language: "fr-FR", region: "FR", include_adult: false }
};

// ------------------------------------------------------------
// Petit objet utilitaire pour construire les URLs et images
// ------------------------------------------------------------
export const TMDB = {
    // Construit une URL d’endpoint + query params (clé + defaults)
    apiUrl(endpoint, params = {}) {
        const url = new URL(TMDB_CONFIG.BASE_URL + endpoint);
        url.searchParams.set("api_key", TMDB_CONFIG.API_KEY);
        Object.entries(TMDB_CONFIG.DEFAULT_PARAMS).forEach(([k,v]) => url.searchParams.set(k,v));
        Object.entries(params).forEach(([k,v]) => v != null && url.searchParams.set(k,v));
        return url.toString();
    },
    // Construit l’URL d’une image si on a un chemin
    img(path, size) {
        return path ? `${TMDB_CONFIG.IMAGE_BASE_URL}/${size}${path}` : null;
    }
};

// ------------------------------------------------------------
// Wrapper fetch très simple (lève une erreur si !res.ok)
// ------------------------------------------------------------
export async function tmdbFetch(url){
    const res = await fetch(url);
    if (!res.ok) throw new Error(`TMDB error ${res.status}`);
    return res.json();
}