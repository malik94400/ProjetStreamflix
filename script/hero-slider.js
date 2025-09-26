// hero-slider.js — slider Netflix-like (cross-fade) pour #hero
import { TMDB, TMDB_CONFIG, tmdbFetch } from './api.js';

// Utilitaire pour créer un slide
function slideHTML(imgUrl, title=""){
    // on met l'image en background via style inline
    return `<li class="slide" style="--hero-image: url('${imgUrl}')" aria-label="${title}"></li>`;
}

export function createHeroFromItems(items){
    const slidesUl = document.getElementById('heroSlides');
    const dotsOl   = document.getElementById('heroDots');
    if (!slidesUl || !dotsOl || !items?.length) return;

    slidesUl.innerHTML = '';
    dotsOl.innerHTML = '';

    const slides = items.map((it, i)=>{
        const img = TMDB.img(it.backdrop_path || it.poster_path, TMDB_CONFIG.IMAGE_SIZES.BACKDROP.L);
        slidesUl.insertAdjacentHTML('beforeend', slideHTML(img, it.title || it.name || ''));
        const dot = document.createElement('button');
        dot.type = 'button';
        dot.setAttribute('aria-label', `Aller à la diapositive ${i+1}`);
        dotsOl.appendChild(dot);
        return { data: it, dot };
    });

    let idx = 0, timer = null, playing = true;
    const allSlideEls = Array.from(slidesUl.children);

    function show(i){
        idx = (i + slides.length) % slides.length;
        allSlideEls.forEach((el, j)=> el.classList.toggle('is-active', j===idx));
        slides.forEach((s, j)=>{
            if (j===idx) s.dot.setAttribute('aria-current','true'); else s.dot.removeAttribute('aria-current');
        });
        // Maj du contenu textuel
        const cur = slides[idx].data;
        const title = cur.title || cur.name;
        const overview = cur.overview || '';
        const h1 = document.getElementById('heroTitle');
        const p  = document.getElementById('heroDesc');
        const playBtn = document.getElementById('heroPlayBtn');
        const infoBtn = document.getElementById('heroInfoBtn');
        if (h1) h1.textContent = title || h1.textContent;
        if (p)  p.textContent  = overview.length > 220 ? overview.slice(0,217) + "…" : overview;
        // Brancher les boutons
        const media = cur.title ? 'movie' : 'tv';
        playBtn?.addEventListener('click', (e)=> { e.preventDefault(); console.log('Lecture:', media, cur.id); }, { once:true });
        infoBtn?.addEventListener('click', async (e)=> {
            e.preventDefault();
            // Laisse ton main.js gérer openDetails si tu veux. Ici on émet un événement:
            document.dispatchEvent(new CustomEvent('hero:openDetails', { detail: { media, id: cur.id }}));
        }, { once:true });
    }

    function next(){ show(idx+1); }
    function prev(){ show(idx-1); }

    function start(){
        stop();
        timer = setInterval(next, 3000);
        playing = true;
    }
    function stop(){
        if (timer) clearInterval(timer);
        timer = null;
        playing = false;
    }

    // Dots
    slides.forEach((s, i)=> s.dot.addEventListener('click', ()=> { show(i); start(); }));

    // Flèches
    document.querySelector('.hero-nav.next')?.addEventListener('click', ()=> { next(); start(); });
    document.querySelector('.hero-nav.prev')?.addEventListener('click', ()=> { prev(); start(); });

    // Pause au survol
    const hero = document.getElementById('hero');
    hero?.addEventListener('mouseenter', stop);
    hero?.addEventListener('mouseleave', start);

    // Clavier
    document.addEventListener('keydown', (e)=>{
        if (document.activeElement?.tagName === 'INPUT' || document.activeElement?.tagName === 'TEXTAREA') return;
        if (e.key === 'ArrowRight'){ next(); start(); }
        if (e.key === 'ArrowLeft'){ prev(); start(); }
    });

    // Démarrage
    show(0);
    // Respecter prefers-reduced-motion
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    if (!mq.matches) start();
}

// Exemple: récupérer des contenus TMDB (top ou now_playing) et construire le slider
export async function buildHeroFromTMDB(){
    try{
        const popular = await tmdbFetch(TMDB.apiUrl('/movie/now_playing', { page: 1, language: 'fr-FR' }));
        const items = (popular.results || []).slice(0, 6);
        createHeroFromItems(items);
    }catch(err){
        console.error('Hero TMDB error', err);
    }
}