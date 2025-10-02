/* ============================================================
   main.js — logique principale (améliorée)
   ============================================================ */

import { TMDB, TMDB_CONFIG, tmdbFetch } from './api.js';
import {
    setupThemeToggle,
    setupHeaderShrink,
    setupTabsIndicator,
    setupScrollSpyNav,
    setupMobileHeader
} from './animations.js';
import { buildHeroFromTMDB } from './hero-slider.js';

/* ------------------------------------------------------------
   Recherche (formulaire avec mini-debounce)
   ------------------------------------------------------------ */
const searchForm = document.getElementById('searchForm');
const searchInput = document.getElementById('searchInput');

let searchTimer;
searchForm?.addEventListener('submit', (e) => {
    e.preventDefault();
    const q = searchInput.value.trim();
    if (q.length < 2) {
        searchInput.setCustomValidity("Au moins 2 caractères.");
        searchInput.reportValidity();
        return;
    }
    searchInput.setCustomValidity("");

    clearTimeout(searchTimer);
    searchTimer = setTimeout(async () => {
        try {
            await renderSearchRow(q);
        } catch (err) {
            console.error(err);
        }
    }, 250);
});

/* ------------------------------------------------------------
   Helpers d’UI (cartes, templating)
   ------------------------------------------------------------ */
function cardHTML(item) {
    const title = item.title || item.name || "Sans titre";
    const year = (item.release_date || item.first_air_date || "").slice(0, 4);
    const posterPath = item.poster_path;
    const img = TMDB.img(posterPath, TMDB_CONFIG.IMAGE_SIZES.POSTER.M);
    const srcset = TMDB.imgSrcSetPoster(posterPath);
    const sizes = "(max-width: 600px) 45vw, (max-width: 1200px) 22vw, 200px";
    const media = item.media_type || (item.title ? 'movie' : 'tv');
    const id = item.id;

    return `
    <article class="card" data-id="${id}" data-media="${media}" title="${title.replace(/"/g, '&quot;')}" tabindex="0" role="button" aria-label="Ouvrir la fiche : ${title}">
      <div class="poster">
        ${img ? `<img src="${img}" ${srcset ? `srcset="${srcset}" sizes="${sizes}"` : ''} alt="Affiche – ${title}" loading="lazy">` : ""}
      </div>
      <div class="meta">
        <div class="title">${title}</div>
        <div class="sub">${year || "—"}</div>
      </div>
    </article>`;
}

function htmx(strings, ...vals) {
    return strings.map((s, i) => s + (vals[i] ?? '')).join('');
}

/* ------------------------------------------------------------
   Sections non-genres
   ------------------------------------------------------------ */
function renderToGrid(gridId, items) {
    const grid = document.getElementById(gridId);
    if (!grid) return;
    grid.innerHTML = items.map(cardHTML).join("");
}

async function loadNonGenreSections() {
    try {
        // Séries populaires
        const tvPopular = await tmdbFetch(TMDB.apiUrl("/tv/popular", { page: 1 }));
        if (tvPopular.results) renderToGrid("grid-series", tvPopular.results.slice(0, 12));

        // Nouveautés films
        const upcoming = await tmdbFetch(TMDB.apiUrl("/movie/upcoming", { page: 1 }));
        if (upcoming.results) renderToGrid("grid-upcoming", upcoming.results.slice(0, 12));
    } catch (err) {
        console.error("TMDB load error", err);
    }
}

/* ------------------------------------------------------------
   Carrousels par genre (films)
   ------------------------------------------------------------ */
const GENRES_WANTED = [
    "Action", "Aventure", "Comédie", "Drame", "Science-Fiction", "Animation", "Horreur", "Romance", "Thriller"
];

async function getMovieGenres() {
    const list = await tmdbFetch(TMDB.apiUrl("/genre/movie/list", { language: "fr-FR" }));
    return list.genres || [];
}

function rowSkeleton(id, label) {
    return htmx`
    <section class="row" id="row-${id}" aria-roledescription="carrousel" aria-label="${label}">
      <div class="row-head">
        <h3>${label}</h3>
      </div>
      <div class="row-track" id="track-${id}" aria-busy="true" tabindex="0" role="group" aria-label="Piste ${label}">
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

    const stepBy = () => Math.round(track.clientWidth * 0.9);

    leftBtn.addEventListener('click', () => track.scrollBy({ left: -stepBy(), behavior: 'smooth' }));
    rightBtn.addEventListener('click', () => track.scrollBy({ left: stepBy(), behavior: 'smooth' }));

    // Clavier (quand la piste a le focus)
    track.addEventListener('keydown', (e) => {
        if (e.key === 'ArrowLeft') { e.preventDefault(); track.scrollBy({ left: -stepBy(), behavior: 'smooth' }); }
        if (e.key === 'ArrowRight'){ e.preventDefault(); track.scrollBy({ left: stepBy(), behavior: 'smooth' }); }
    });

    track.addEventListener('scroll', updateButtons, { passive: true });
    window.addEventListener('resize', updateButtons);
}

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

async function buildGenreRows() {
    const mount = document.getElementById('genres-rows');
    if (!mount) return;

    const all = await getMovieGenres();
    const picked = GENRES_WANTED.map(name => all.find(g => g.name === name)).filter(Boolean);
    mount.innerHTML = picked.map(g => rowSkeleton(`genre-${g.id}`, g.name)).join('');

    for (const g of picked) await populateGenreRow(g);
}

/* ------------------------------------------------------------
   Recherche → rangée éphémère
   ------------------------------------------------------------ */
async function renderSearchRow(q) {
    const mount = document.getElementById('genres-rows');
    if (!mount) return;

    const rowId = 'search-row';

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
        const res = await tmdbFetch(TMDB.apiUrl('/search/multi', { query: q, page: 1, language: 'fr-FR' }));
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
   Fiche détail (overlay)
   ------------------------------------------------------------ */
const overlay = document.getElementById('detailOverlay');
const elPoster = document.getElementById('detailPoster');
const elTitle = document.getElementById('detailTitle');
const elMeta = document.getElementById('detailMeta');
const elOverview = document.getElementById('detailOverview');
const elExtra = document.getElementById('detailExtra');
const elTrailer = document.getElementById('detailTrailer');

function openOverlay() {
    overlay.hidden = false;
    overlay.querySelector('.detail-close')?.focus();
    document.body.style.overflow = 'hidden';
}
function closeOverlay() {
    overlay.hidden = true;
    document.body.style.overflow = '';
}
overlay?.addEventListener('click', (e) => {
    if (e.target && (e.target.hasAttribute('data-close'))) closeOverlay();
});
document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && !overlay.hidden) closeOverlay();
});

function formatMinutes(min) {
    if (!min) return null;
    const h = Math.floor(min / 60), m = min % 60;
    return h ? `${h} h ${m} min` : `${m} min`;
}

async function fetchDetails(media, id) {
    const endpoint = media === 'tv' ? `/tv/${id}` : `/movie/${id}`;
    const data = await tmdbFetch(TMDB.apiUrl(endpoint, { append_to_response: 'credits,videos', language: 'fr-FR' }));
    return { media, data };
}

function openDetails({ media, data }) {
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

    // Trailer (YouTube)
    elTrailer.innerHTML = '';
    const yt = data.videos?.results?.find(v => v.site === 'YouTube' && v.type === 'Trailer' && v.key);
    if (yt?.key) {
        elTrailer.innerHTML = `<iframe title="Bande-annonce" src="https://www.youtube.com/embed/${yt.key}" allowfullscreen loading="lazy"></iframe>`;
    }

    openOverlay();
}

/* ------------------------------------------------------------
   Délégué de clic (cartes) + évènement du HERO
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

// Évènement déclenché par le HERO (hero-slider.js)
document.addEventListener('hero:openDetails', async (e) => {
    const { media, id } = e.detail || {};
    if (!media || !id) return;

    try {
        const payload = await fetchDetails(media, id);
        openDetails(payload);
    } catch (err) {
        console.error('Erreur ouverture fiche (hero)', err);
    }
});

/* ------------------------------------------------------------
   Boot
   ------------------------------------------------------------ */
document.addEventListener("DOMContentLoaded", async () => {
    setupThemeToggle();
    setupHeaderShrink();
    setupTabsIndicator();
    setupScrollSpyNav();
    setupMobileHeader();

    await loadNonGenreSections();
    await buildGenreRows();
    await buildHeroFromTMDB();
});