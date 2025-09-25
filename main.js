// main.js
import { TMDB, TMDB_CONFIG, tmdbFetch } from './api.js';
import { setupThemeToggle, setupHeaderShrink, setupTabsIndicator } from './animations.js';

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

    return `
    <article class="card" title="${title.replace(/"/g,'&quot;')}">
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
    infoBtn?.addEventListener("click", (e)=> { e.preventDefault(); console.log("Voir fiche film:", contentId); });
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

document.addEventListener("DOMContentLoaded", () => {
    setupThemeToggle();
    setupHeaderShrink();
    setupTabsIndicator();
    loadHomepage();
});