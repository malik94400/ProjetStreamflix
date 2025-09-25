import { TMDB, TMDB_CONFIG, tmdbFetch } from './api.js';
import { setupThemeToggle, setupHeaderShrink, setupTabsIndicator, setupScrollSpyNav } from './animations.js';

/* ========== Bouton Recherche ========== */
const searchForm = document.getElementById('searchForm');
const searchInput = document.getElementById('searchInput');
const gridTrending = document.getElementById('grid-trending');

const sleep = (ms)=> new Promise(r=>setTimeout(r,ms));
let searchTimer;

searchForm?.addEventListener('submit', async (e)=>{
    e.preventDefault();
    const q = searchInput.value.trim();
    if (q.length < 2) { searchInput.setCustomValidity("Au moins 2 caractères."); searchInput.reportValidity(); return; }
    searchInput.setCustomValidity("");

    clearTimeout(searchTimer);
    searchTimer = setTimeout(async ()=>{
        try{
            gridTrending.setAttribute('aria-busy','true');
            const res = await tmdbFetch(TMDB.apiUrl('/search/multi', { query: q, page:1 }));
            const items = (res.results ?? []).filter(x => ['movie','tv'].includes(x.media_type));
            renderToGrid('grid-trending', items.slice(0,12));
        } catch(err){
            console.error(err);
        } finally {
            gridTrending.removeAttribute('aria-busy');
        }
    }, 300);
});

/* ========== Rendu UI (cartes) ========== */
function cardHTML(item){
    const title = item.title || item.name || "Sans titre";
    const year  = (item.release_date || item.first_air_date || "").slice(0,4);
    const img   = TMDB.img(item.poster_path, TMDB_CONFIG.IMAGE_SIZES.POSTER.M);
    const media = item.media_type || (item.title ? 'movie' : 'tv');
    const id    = item.id;

    return `
    <article class="card" data-id="${id}" data-media="${media}" title="${title.replace(/"/g,'&quot;')}">
      <div class="poster">
        ${img ? `<img src="${img}" alt="Affiche – ${title}">` : ""}
      </div>
      <div class="meta">
        <div class="title">${title}</div>
        <div class="sub">${year || "—"}</div>
      </div>
    </article>
  `;
}

function renderToGrid(gridId, items){
    const grid = document.getElementById(gridId);
    if (!grid) return;
    grid.innerHTML = items.map(cardHTML).join("");
}

/* ========== Hero ========== */
function updateHeroFromMovie(movie){
    const hero = document.getElementById("hero");
    if (!hero) return;

    const backdrop = TMDB.img(movie.backdrop_path || movie.poster_path, TMDB_CONFIG.IMAGE_SIZES.BACKDROP.L);
    if (backdrop){
        hero.style.background = `var(--hero-overlay), url('${backdrop}') var(--hero-pos)/cover no-repeat`;
    }

    const title = hero.querySelector("h1");
    const desc  = hero.querySelector("p");
    if (title) title.textContent = movie.title || movie.name || title.textContent;
    if (desc && movie.overview) {
        desc.textContent = movie.overview.length > 220 ? movie.overview.slice(0,217) + "…" : movie.overview;
    }

    // boutons
    const playBtn = document.getElementById("heroPlayBtn");
    const infoBtn = document.getElementById("heroInfoBtn");
    const contentId = movie.id;
    playBtn?.addEventListener("click", (e)=> { e.preventDefault(); console.log("Lecture film:", contentId); });
    infoBtn?.addEventListener("click", async (e)=> {
        e.preventDefault();
        openDetails(await fetchDetails('movie', contentId));
    });
}

/* ========== Chargement de la home via TMDB ========== */
async function loadHomepage(){
    try {
        const popular = await tmdbFetch(TMDB.apiUrl("/movie/popular", { page: 1 }));
        const first   = popular.results?.[0];
        if (first) updateHeroFromMovie(first);
        if (popular.results) renderToGrid("grid-trending", popular.results.slice(0, 12));

        const tvPopular = await tmdbFetch(TMDB.apiUrl("/tv/popular", { page: 1 }));
        if (tvPopular.results) renderToGrid("grid-series", tvPopular.results.slice(0, 12));

        const upcoming = await tmdbFetch(TMDB.apiUrl("/movie/upcoming", { page: 1 }));
        if (upcoming.results) renderToGrid("grid-upcoming", upcoming.results.slice(0, 12));

        const tabPop = document.getElementById("tab-populaire");
        if (tabPop && popular.results) {
            tabPop.innerHTML = popular.results.slice(0, 12).map(cardHTML).join("");
        }
    } catch (err) {
        console.error("TMDB load error", err);
    }
}

/* ========== Panneau Détails (fiche) ========== */
const overlay = document.getElementById('detailOverlay');
const elPoster = document.getElementById('detailPoster');
const elTitle  = document.getElementById('detailTitle');
const elMeta   = document.getElementById('detailMeta');
const elOverview = document.getElementById('detailOverview');
const elExtra  = document.getElementById('detailExtra');

function openOverlay(){
    overlay.hidden = false;
    // focus sur le bouton fermer pour accessibilité
    overlay.querySelector('.detail-close')?.focus();
    document.body.style.overflow = 'hidden';
}
function closeOverlay(){
    overlay.hidden = true;
    document.body.style.overflow = '';
}
overlay?.addEventListener('click', (e)=>{
    if (e.target && (e.target.hasAttribute('data-close'))) closeOverlay();
});
document.addEventListener('keydown', (e)=>{
    if (e.key === 'Escape' && !overlay.hidden) closeOverlay();
});

function formatMinutes(min){
    if (!min) return null;
    const h = Math.floor(min/60), m = min%60;
    return h ? `${h} h ${m} min` : `${m} min`;
}

async function fetchDetails(media, id){
    const endpoint = media === 'tv' ? `/tv/${id}` : `/movie/${id}`;
    const data = await tmdbFetch(TMDB.apiUrl(endpoint, { append_to_response: 'credits', language: 'fr-FR' }));
    return { media, data };
}

function openDetails({ media, data }){
    const title = data.title || data.name;
    const year = (data.release_date || data.first_air_date || '').slice(0,4) || '—';
    const poster = TMDB.img(data.poster_path, TMDB_CONFIG.IMAGE_SIZES.POSTER.M);
    const note = data.vote_average ? `${Math.round(data.vote_average*10)/10} ★` : '—';
    const genres = (data.genres||[]).map(g=>g.name).join(' · ');
    const runtime = media==='tv' ? (data.episode_run_time?.[0] ? `${data.episode_run_time[0]} min/épisode` : null)
        : formatMinutes(data.runtime);

    if (poster){ elPoster.src = poster; elPoster.alt = `Affiche – ${title}`; } else { elPoster.removeAttribute('src'); elPoster.alt=''; }

    elTitle.textContent = title;
    elMeta.textContent = [year, genres, note].filter(Boolean).join(' • ');
    elOverview.textContent = data.overview || "Pas de résumé disponible en français.";

    elExtra.innerHTML = '';
    if (runtime) elExtra.insertAdjacentHTML('beforeend', `<span class="pill">Durée : ${runtime}</span>`);
    if (media==='tv' && data.number_of_seasons){
        elExtra.insertAdjacentHTML('beforeend', `<span class="pill">Saisons : ${data.number_of_seasons}</span>`);
    }
    const cast = (data.credits?.cast||[]).slice(0,5).map(p=>p.name).join(', ');
    if (cast) elExtra.insertAdjacentHTML('beforeend', `<span class="pill">Casting : ${cast}</span>`);

    openOverlay();
}

/* Délégué de clic : ouvrir la fiche quand on clique une carte */
document.addEventListener('click', async (e)=>{
    const card = e.target.closest?.('.card');
    if (!card) return;
    const id = card.dataset.id;
    const media = card.dataset.media || 'movie';
    try{
        const payload = await fetchDetails(media, id);
        openDetails(payload);
    } catch(err){
        console.error('Erreur ouverture fiche', err);
    }
});

document.addEventListener("DOMContentLoaded", () => {
    setupThemeToggle();
    setupHeaderShrink();
    setupTabsIndicator();
    setupScrollSpyNav();
    loadHomepage();
});