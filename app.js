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

            // Recherche multi (films + séries)
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


/* ========== Thème avec persistence ========== */
(() => {
    const themes = ["dark", "light", "sepia"];
    const root = document.documentElement;
    const btn = document.getElementById("themeToggle");
    const LS_KEY = "sf-theme";
    const saved = localStorage.getItem(LS_KEY);
    if (saved && themes.includes(saved)) root.setAttribute("data-theme", saved);
    btn?.addEventListener("click", () => {
        const current = root.getAttribute("data-theme") || "dark";
        const next = themes[(themes.indexOf(current) + 1) % themes.length];
        root.setAttribute("data-theme", next);
        localStorage.setItem(LS_KEY, next);
    });
})();

/* ========== Header shrink on scroll ========== */
(() => {
    const header = document.getElementById("header");
    let ticking = false;
    window.addEventListener("scroll", () => {
        if (!ticking) {
            window.requestAnimationFrame(() => {
                header?.classList.toggle("shrink", window.scrollY > 10);
                ticking = false;
            });
            ticking = true;
        }
    }, { passive: true });
})();

/* ========== Tabs indicateur animé (UI) ========== */
(() => {
    const tablist = document.querySelector('.tabs [role="tablist"]');
    if (!tablist) return;
    const tabs = Array.from(tablist.querySelectorAll('[role="tab"]'));
    const indicator = tablist.querySelector('.indicator');
    const panels = Array.from(tablist.parentElement.querySelectorAll('[role="tabpanel"]'));

    function selectTab(idx) {
        tabs.forEach((t,i)=> t.setAttribute('aria-selected', i===idx ? 'true' : 'false'));
        panels.forEach((p,i)=> p.hidden = i!==idx);
        const tab = tabs[idx];
        const r = tab.getBoundingClientRect();
        const rList = tablist.getBoundingClientRect();
        indicator.style.width = r.width + 'px';
        indicator.style.translate = (r.left - rList.left) + 'px 0';
    }
    tabs.forEach((t,i)=> t.addEventListener('click', ()=> selectTab(i)));
    window.addEventListener('resize', ()=>{
        const active = tabs.findIndex(t=> t.getAttribute('aria-selected')==='true');
        if (active>-1) selectTab(active);
    });
    selectTab(0);
})();

/* ========== TMDB CONFIG + UTILS ========== */
const TMDB_CONFIG = {
    API_KEY: "e4b90327227c88daac14c0bd0c1f93cd",
    BASE_URL: "https://api.themoviedb.org/3",
    IMAGE_BASE_URL: "https://image.tmdb.org/t/p",
    IMAGE_SIZES: { POSTER: { M: "w342" }, BACKDROP: { L: "w1280" } },
    DEFAULT_PARAMS: { language: "fr-FR", region: "FR", include_adult: false }
};

const TMDB = {
    apiUrl(endpoint, params = {}) {
        const url = new URL(TMDB_CONFIG.BASE_URL + endpoint);
        url.searchParams.set("api_key", TMDB_CONFIG.API_KEY);
        Object.entries(TMDB_CONFIG.DEFAULT_PARAMS).forEach(([k,v]) => url.searchParams.set(k,v));
        Object.entries(params).forEach(([k,v]) => v != null && url.searchParams.set(k,v));
        return url.toString();
    },
    img(path, size) {
        return path ? `${TMDB_CONFIG.IMAGE_BASE_URL}/${size}${path}` : null;
    }
};

async function tmdbFetch(url){
    const res = await fetch(url);
    if (!res.ok) throw new Error(`TMDB error ${res.status}`);
    return res.json();
}

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

/* ========== Hero ==========
   Met à jour le visuel + texte du hero via un film TMDB */
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
        // films populaires → hero + tendances
        const popular = await tmdbFetch(TMDB.apiUrl("/movie/popular", { page: 1 }));
        const first   = popular.results?.[0];
        if (first) updateHeroFromMovie(first);
        if (popular.results) renderToGrid("grid-trending", popular.results.slice(0, 12));

        // séries populaires → section séries
        const tvPopular = await tmdbFetch(TMDB.apiUrl("/tv/popular", { page: 1 }));
        if (tvPopular.results) renderToGrid("grid-series", tvPopular.results.slice(0, 12));

        // films à venir → nouveautés
        const upcoming = await tmdbFetch(TMDB.apiUrl("/movie/upcoming", { page: 1 }));
        if (upcoming.results) renderToGrid("grid-upcoming", upcoming.results.slice(0, 12));

        // onglet "Populaire" (facultatif) → réutilise populaires
        const tabPop = document.getElementById("tab-populaire");
        if (tabPop && popular.results) {
            tabPop.innerHTML = popular.results.slice(0, 12).map(cardHTML).join("");
        }
    } catch (err) {
        console.error("TMDB load error", err);
    }
}

document.addEventListener("DOMContentLoaded", loadHomepage);