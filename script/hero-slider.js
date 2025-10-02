// hero-slider.js — version robuste (avec fallbacks + logs)
import { TMDB, TMDB_CONFIG, tmdbFetch } from './api.js';

// Utilitaire pour créer un slide
function slideHTML(imgUrl, title=""){
    return `<li class="slide" style="--hero-image: url('${imgUrl}')" aria-label="${title}"></li>`;
}

export function createHeroFromItems(items){
    const slidesUl = document.getElementById('heroSlides');
    const dotsOl   = document.getElementById('heroDots');
    if (!slidesUl || !dotsOl) { console.warn('[HERO] DOM manquant'); return; }
    if (!items?.length)       { console.warn('[HERO] Aucun item'); return; }

    slidesUl.innerHTML = '';
    dotsOl.innerHTML = '';

    const slides = items.map((it, i)=>{
        const img = TMDB.img(it.backdrop_path || it.poster_path, TMDB_CONFIG.IMAGE_SIZES.BACKDROP.L);
        slidesUl.insertAdjacentHTML('beforeend', slideHTML(img, it.title || it.name || ''));
        const dot = document.createElement('button');
        dot.type = 'button';
        dot.setAttribute('aria-label', `Aller à la diapositive ${i+1}`);
        dot.setAttribute('role','tab');
        dotsOl.appendChild(dot);
        return { data: it, dot };
    });

    let idx = 0, timer = null;
    const allSlideEls = Array.from(slidesUl.children);
    const hero = document.getElementById('hero');

    function updateText(cur){
        const title = cur.title || cur.name;
        const overview = cur.overview || '';
        const h1 = document.getElementById('heroTitle');
        const p  = document.getElementById('heroDesc');
        const playBtn = document.getElementById('heroPlayBtn');
        const infoBtn = document.getElementById('heroInfoBtn');
        if (h1) h1.textContent = title || h1.textContent;
        if (p)  p.textContent  = overview.length > 220 ? overview.slice(0,217) + "…" : overview;

        const media = cur.title ? 'movie' : 'tv';
        // (re)brancher proprement
        playBtn?.replaceWith(playBtn.cloneNode(true));
        infoBtn?.replaceWith(infoBtn.cloneNode(true));
        const play2 = document.getElementById('heroPlayBtn');
        const info2 = document.getElementById('heroInfoBtn');

        play2?.addEventListener('click', (e)=> { e.preventDefault(); console.log('Lecture:', media, cur.id); });
        info2?.addEventListener('click', (e)=> {
            e.preventDefault();
            document.dispatchEvent(new CustomEvent('hero:openDetails', { detail: { media, id: cur.id }}));
        });
    }

    function show(i){
        if (!allSlideEls.length) return;
        idx = (i + slides.length) % slides.length;
        allSlideEls.forEach((el, j)=> el.classList.toggle('is-active', j===idx));
        slides.forEach((s, j)=> j===idx ? s.dot.setAttribute('aria-current','true') : s.dot.removeAttribute('aria-current'));
        updateText(slides[idx].data);
    }

    function next(){ show(idx+1); }
    function prev(){ show(idx-1); }

    function start(interval=3000){
        stop();
        timer = setInterval(next, interval);
    }
    function stop(){
        if (timer) clearInterval(timer);
        timer = null;
    }

    // Dots / flèches / hover
    slides.forEach((s, i)=> s.dot.addEventListener('click', ()=> { show(i); start(); }));
    document.querySelector('.hero-nav.next')?.addEventListener('click', ()=> { next(); start(); });
    document.querySelector('.hero-nav.prev')?.addEventListener('click', ()=> { prev(); start(); });
    hero?.addEventListener('mouseenter', stop);
    hero?.addEventListener('mouseleave', ()=> start());

    // Premier rendu
    show(0);

    // Respecte reduce-motion, mais garde une rotation lente (access safe)
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduce) {
        // Pas d’animation CSS (normal), mais on peut quand même tourner toutes les 8s
        console.info('[HERO] Reduce motion actif → rotation lente sans transition');
        start(8000);
    } else {
        start(4000);
    }

    console.info('[HERO] Slides:', allSlideEls.length, '— dots:', dotsOl.children.length);
}

// Build avec fallbacks (now_playing → trending → local)
export async function buildHeroFromTMDB(){
    try {
        const now = await tmdbFetch(TMDB.apiUrl('/movie/now_playing', { page: 1, language: 'fr-FR' }));
        let items = (now.results || []).slice(0, 6);

        if (!items.length) {
            console.warn('[HERO] now_playing vide, on tente trending');
            const trending = await tmdbFetch(TMDB.apiUrl('/trending/all/day', { page: 1, language: 'fr-FR' }));
            items = (trending.results || []).slice(0, 6);
        }

        if (!items.length) {
            console.warn('[HERO] trending vide, fallback local');
            items = [
                { id: 1, title:'Démo 1', backdrop_path:'/t/p/w1280/8YFL5QQVPy3AgrEQxNYVSgiPEbe.jpg', overview:'Slide démo.' },
                { id: 2, title:'Démo 2', backdrop_path:'/t/p/w1280/somePath2.jpg', overview:'Slide démo 2.' },
                { id: 3, title:'Démo 3', backdrop_path:'/t/p/w1280/somePath3.jpg', overview:'Slide démo 3.' },
            ];
        }

        createHeroFromItems(items);
    } catch (err) {
        console.error('Hero TMDB error', err);
        // Dernier recours
        const items = [
            { id: 1, title:'Démo 1', backdrop_path:'/t/p/w1280/8YFL5QQVPy3AgrEQxNYVSgiPEbe.jpg', overview:'Slide démo.' },
            { id: 2, title:'Démo 2', backdrop_path:'/t/p/w1280/somePath2.jpg', overview:'Slide démo 2.' },
            { id: 3, title:'Démo 3', backdrop_path:'/t/p/w1280/somePath3.jpg', overview:'Slide démo 3.' },
        ];
        createHeroFromItems(items);
    }
}