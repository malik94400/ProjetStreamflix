/* ============================================================
   main.js — logique principale de la page
   NOTE: branchements UI + appels TMDB + rendu DOM
   ============================================================ */

import {TMDB, TMDB_CONFIG, tmdbFetch} from './api.js';
import {setupThemeToggle, setupHeaderShrink, setupTabsIndicator, setupScrollSpyNav} from './animations.js';

/* ------------------------------------------------------------
   Recherche (formulaire simple avec mini-debounce)
   ------------------------------------------------------------ */
const searchForm = document.getElementById('searchForm');
const searchInput = document.getElementById('searchInput');

let searchTimer;
searchForm?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const q = searchInput.value.trim();

    // mini validation côté client (éviter les requêtes vides)
    if (q.length < 2) {
        searchInput.setCustomValidity("Au moins 2 caractères.");
        searchInput.reportValidity();
        return;
    }
    searchInput.setCustomValidity("");

    // petit debounce pour “faire étudiant propre”
    clearTimeout(searchTimer);
    searchTimer = setTimeout(async () => {
        try {
            // On crée une ligne de résultats éphémère en haut des genres
            renderSearchRow(q);
        } catch (err) {
            console.error(err);
        }
    }, 250);
});

/* ------------------------------------------------------------
   Helpers d’UI (cartes, templating naïf)
   ------------------------------------------------------------ */
function cardHTML(item) {
    // Titre + année + image + type média (movie/tv)
    const title = item.title || item.name || "Sans titre";
    const year = (item.release_date || item.first_air_date || "").slice(0, 4);
    const img = TMDB.img(item.poster_path, TMDB_CONFIG.IMAGE_SIZES.POSTER.M);
    const media = item.media_type || (item.title ? 'movie' : 'tv');
    const id = item.id;

    // gabarit de carte très simple
    return `
    <article class="card" data-id="${id}" data-media="${media}" title="${title.replace(/"/g, '&quot;')}">
      <div class="poster">
        ${img ? `<img src="${img}" alt="Affiche – ${title}" loading="lazy">` : ""}
      </div>
      <div class="meta">
        <div class="title">${title}</div>
        <div class="sub">${year || "—"}</div>
      </div>
    </article>`;
}

// petit tag-template helper (très basique)
function htmx(strings, ...vals) {
    return strings.map((s, i) => s + (vals[i] ?? '')).join('');
}

/* ------------------------------------------------------------
   HERO — maj dynamique depuis un film populaire
   ------------------------------------------------------------ */
function updateHeroFromMovie(movie) {
    const hero = document.getElementById("hero");
    if (!hero) return;

    // Image de fond (backdrop si possible)
    const backdrop = TMDB.img(movie.backdrop_path || movie.poster_path, TMDB_CONFIG.IMAGE_SIZES.BACKDROP.L);
    if (backdrop) {
        hero.style.background = `var(--hero-overlay), url('${backdrop}') var(--hero-pos)/cover no-repeat`;
    }

    // Titre + description (tronquée)
    const title = hero.querySelector("h1");
    const desc = hero.querySelector("p");
    if (title) title.textContent = movie.title || movie.name || title.textContent;
    if (desc && movie.overview) desc.textContent = movie.overview.length > 220 ? movie.overview.slice(0, 217) + "…" : movie.overview;

    // Boutons (play/info) — ici juste logs + ouverture de la fiche
    const playBtn = document.getElementById("heroPlayBtn");
    const infoBtn = document.getElementById("heroInfoBtn");
    const contentId = movie.id;

    playBtn?.addEventListener("click", (e) => {
        e.preventDefault();
        console.log("Lecture film:", contentId);
    });
    infoBtn?.addEventListener("click", async (e) => {
        e.preventDefault();
        openDetails(await fetchDetails('movie', contentId));
    });
}

/* ------------------------------------------------------------
   Sections non-genres (remplies via TMDB)
   ------------------------------------------------------------ */
function renderToGrid(gridId, items) {
    const grid = document.getElementById(gridId);
    if (!grid) return;
    grid.innerHTML = items.map(cardHTML).join("");
}

async function loadNonGenreSections() {
    try {
        // 1) Films populaires => sert aussi au HERO
        const popular = await tmdbFetch(TMDB.apiUrl("/movie/popular", {page: 1}));
        if (popular.results?.[0]) updateHeroFromMovie(popular.results[0]);

        // 2) Séries populaires
        const tvPopular = await tmdbFetch(TMDB.apiUrl("/tv/popular", {page: 1}));
        if (tvPopular.results) renderToGrid("grid-series", tvPopular.results.slice(0, 12));

        // 3) Nouveautés films
        const upcoming = await tmdbFetch(TMDB.apiUrl("/movie/upcoming", {page: 1}));
        if (upcoming.results) renderToGrid("grid-upcoming", upcoming.results.slice(0, 12));
    } catch (err) {
        console.error("TMDB load error", err);
        // TODO: on pourrait afficher un message d’erreur “friendly UI”
    }
}

/* ------------------------------------------------------------
   Carrousels par genre (films seulement)
   ------------------------------------------------------------ */
const GENRES_WANTED = [
    "Action", "Aventure", "Comédie", "Drame", "Science-Fiction", "Animation", "Horreur", "Romance", "Thriller"
];

async function getMovieGenres() {
    const list = await tmdbFetch(TMDB.apiUrl("/genre/movie/list", {language: "fr-FR"}));
    return list.genres || [];
}

// Squelette de rangée (pendant chargement)
function rowSkeleton(id, label) {
    return htmx`
      <section class="row" id="row-${id}">
        <div class="row-head">
          <h3>${label}</h3>
        </div>
        <div class="row-track" id="track-${id}" aria-busy="true">
            ${Array.from({length: 8}).map(() => `
              <article class="card">
                <div class="poster"></div>
                <div class="meta">
                    <div class="title"></div>
                    <div class="sub"></div>
                </div>
              </article>
            `).join('')}
        </div>
        <div class="row-nav" aria-hidden="true">
          <button class="arrow" data-left data-track="track-${id}" aria-label="Précédent">
            <svg viewBox="0 0 24 24" fill="currentColor"><path d="M15.41 7.41 14 6l-6 6 6 6 1.41-1.41L10.83 12z"/></svg>
          </button>
          <button class="arrow" data-right data-track="track-${id}" aria-label="Suivant">
            <svg viewBox="0 0 24 24" fill="currentColor"><path d="M8.59 16.59 10 18l6-6-6-6-1.41 1.41L13.17 12z"/></svg>
          </button>
        </div>
      </section>
    `;
}

// Flèches gauche/droite (scroll “par écran”)
function attachRowNav(track) {
    const row = track.closest('.row');
    const leftBtn = row.querySelector('[data-left]');
    const rightBtn = row.querySelector('[data-right]');

    function updateButtons() {
        const maxScroll = track.scrollWidth - track.clientWidth - 1;
        leftBtn.disabled = track.scrollLeft <= 4;
        rightBtn.disabled = track.scrollLeft >= maxScroll;
    }

    updateButtons();

    leftBtn.addEventListener('click', () => {
        const step = Math.round(track.clientWidth * 0.9);
        track.scrollBy({left: -step, behavior: 'smooth'});
    });
    rightBtn.addEventListener('click', () => {
        const step = Math.round(track.clientWidth * 0.9);
        track.scrollBy({left: step, behavior: 'smooth'});
    });

    track.addEventListener('scroll', () => updateButtons(), {passive: true});
    window.addEventListener('resize', () => updateButtons());
}

// Remplir une ligne "genre" depuis TMDB
async function populateGenreRow(genre) {
    const id = `genre-${genre.id}`;
    const track = document.getElementById(`track-${id}`);
    if (!track) return;

    try {
        const data = await tmdbFetch(TMDB.apiUrl("/discover/movie", {
            language: "fr-FR",
            sort_by: "popularity.desc",
            include_adult: "false",
            with_genres: genre.id,
            page: 1
        }));
        const items = (data.results || []).slice(0, 20).map(x => ({...x, media_type: 'movie'}));
        track.innerHTML = items.map(cardHTML).join('');
        track.removeAttribute('aria-busy');
    } catch (e) {
        console.error('Genre row error', genre, e);
        track.innerHTML = `<p style="color:var(--muted); padding:8px 24px">Impossible de charger les films pour ${genre.name}.</p>`;
        track.removeAttribute('aria-busy');
    }

    attachRowNav(track);
}

// Construire toutes les rangées (en conservant l’ordre voulu)
async function buildGenreRows() {
    const mount = document.getElementById('genres-rows');
    if (!mount) return;

    const all = await getMovieGenres();
    // On garde l’ordre GENRES_WANTED
    const picked = GENRES_WANTED
        .map(name => all.find(g => g.name === name))
        .filter(Boolean);

    // Injecter le squelette pour chaque genre
    mount.innerHTML = picked.map(g => rowSkeleton(`genre-${g.id}`, g.name)).join('');

    // Puis peupler chaque rangée (actuel = séquentiel pour rester simple)
    for (const g of picked) await populateGenreRow(g);
}

/* ------------------------------------------------------------
   Recherche → rangée éphémère en tête des genres
   ------------------------------------------------------------ */
async function renderSearchRow(q) {
    const mount = document.getElementById('genres-rows');
    if (!mount) return;

    const rowId = 'search-row';

    // Inject skeleton si absent, sinon reinitialiser
    if (!document.getElementById(`row-${rowId}`)) {
        mount.insertAdjacentHTML('afterbegin', rowSkeleton(rowId, `Résultats pour “${q}”`));
    } else {
        const head = document.querySelector(`#row-${rowId} .row-head h3`);
        if (head) head.textContent = `Résultats pour “${q}”`;
        const track = document.getElementById(`track-${rowId}`);
        if (track) {
            track.innerHTML = '';
            track.setAttribute('aria-busy', 'true');
        }
    }

    const track = document.getElementById(`track-${rowId}`);
    try {
        const res = await tmdbFetch(TMDB.apiUrl('/search/multi', {query: q, page: 1, language: 'fr-FR'}));
        const items = (res.results ?? []).filter(x => ['movie', 'tv'].includes(x.media_type)).slice(0, 20);
        track.innerHTML = items.map(cardHTML).join('');
        track.removeAttribute('aria-busy');
        attachRowNav(track);
    } catch (e) {
        track.innerHTML = `<p style="color:var(--muted); padding:8px 24px">Aucun résultat.</p>`;
        track.removeAttribute('aria-busy');
    }
}

/* ------------------------------------------------------------
   Fiche détail (overlay) — ouverture/fermeture + contenu
   ------------------------------------------------------------ */
const overlay = document.getElementById('detailOverlay');
const elPoster = document.getElementById('detailPoster');
const elTitle = document.getElementById('detailTitle');
const elMeta = document.getElementById('detailMeta');
const elOverview = document.getElementById('detailOverview');
const elExtra = document.getElementById('detailExtra');

// Ouvrir/fermer l’overlay + gestion scroll body
function openOverlay() {
    overlay.hidden = false;
    overlay.querySelector('.detail-close')?.focus();
    document.body.style.overflow = 'hidden';
}

function closeOverlay() {
    overlay.hidden = true;
    document.body.style.overflow = '';
}

// Fermer en cliquant le fond / ou via la touche Escape
overlay?.addEventListener('click', (e) => {
    if (e.target && (e.target.hasAttribute('data-close'))) closeOverlay();
});
document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && !overlay.hidden) closeOverlay();
});

// Quelques helpers d’affichage
function formatMinutes(min) {
    if (!min) return null;
    const h = Math.floor(min / 60), m = min % 60;
    return h ? `${h} h ${m} min` : `${m} min`;
}

// Récup détaillée d’un contenu (film/série)
async function fetchDetails(media, id) {
    const endpoint = media === 'tv' ? `/tv/${id}` : `/movie/${id}`;
    const data = await tmdbFetch(TMDB.apiUrl(endpoint, {append_to_response: 'credits', language: 'fr-FR'}));
    return {media, data};
}

// Injecter les infos dans l’overlay
function openDetails({media, data}) {
    const title = data.title || data.name;
    const year = (data.release_date || data.first_air_date || '').slice(0, 4) || '—';
    const poster = TMDB.img(data.poster_path, TMDB_CONFIG.IMAGE_SIZES.POSTER.M);
    const note = data.vote_average ? `${Math.round(data.vote_average * 10) / 10} ★` : '—';
    const genres = (data.genres || []).map(g => g.name).join(' · ');
    const runtime = media === 'tv'
        ? (data.episode_run_time?.[0] ? `${data.episode_run_time[0]} min/épisode` : null)
        : formatMinutes(data.runtime);

    if (poster) {
        elPoster.src = poster;
        elPoster.alt = `Affiche – ${title}`;
    } else {
        elPoster.removeAttribute('src');
        elPoster.alt = '';
    }

    elTitle.textContent = title;
    elMeta.textContent = [year, genres, note].filter(Boolean).join(' • ');
    elOverview.textContent = data.overview || "Pas de résumé disponible en français.";

    elExtra.innerHTML = '';
    if (runtime) elExtra.insertAdjacentHTML('beforeend', `<span class="pill">Durée : ${runtime}</span>`);
    if (media === 'tv' && data.number_of_seasons) {
        elExtra.insertAdjacentHTML('beforeend', `<span class="pill">Saisons : ${data.number_of_seasons}</span>`);
    }
    const cast = (data.credits?.cast || []).slice(0, 5).map(p => p.name).join(', ');
    if (cast) elExtra.insertAdjacentHTML('beforeend', `<span class="pill">Casting : ${cast}</span>`);

    openOverlay();
}

/* ------------------------------------------------------------
   Délégué de clic (cartes → ouverture de fiche)
   ------------------------------------------------------------ */
document.addEventListener('click', async (e) => {
    const card = e.target.closest?.('.card');
    if (!card) return;
    const id = card.dataset.id;
    const media = card.dataset.media || 'movie';
    try {
        const payload = await fetchDetails(media, id);
        openDetails(payload);
    } catch (err) {
        console.error('Erreur ouverture fiche', err);
    }
});

/* ------------------------------------------------------------
   Boot (DOMContentLoaded) — initialisation de tout
   ------------------------------------------------------------ */
document.addEventListener("DOMContentLoaded", async () => {
    // Petites features UI
    setupThemeToggle();
    setupHeaderShrink();
    setupTabsIndicator();
    setupScrollSpyNav();

    // Chargement des sections depuis TMDB
    await loadNonGenreSections();
    await buildGenreRows();
});