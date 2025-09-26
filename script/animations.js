/* ============================================================
   animations.js — petites animations du site
   NOTE: fichier "front" pour gérer header/tabs/scrollspy/thème
   (rien de critique, juste du confort UX)
   ============================================================ */

/* ------------------------------------------------------------
   Thème (dark / light / sepia)
   Petit toggle qui stocke le choix dans localStorage
   ------------------------------------------------------------ */
export function setupThemeToggle() {
    // Liste des thèmes dispo (simple tableau)
    const themes = ["dark", "light", "sepia"];
    const root = document.documentElement;
    const btn = document.getElementById("themeToggle");
    const LS_KEY = "sf-theme";

    // Au chargement, on relit le thème précédent si dispo
    const saved = localStorage.getItem(LS_KEY);
    if (saved && themes.includes(saved)) root.setAttribute("data-theme", saved);

    // Au clic : passer au thème suivant (cycle)
    btn?.addEventListener("click", () => {
        const current = root.getAttribute("data-theme") || "dark";
        const next = themes[(themes.indexOf(current) + 1) % themes.length];
        root.setAttribute("data-theme", next);
        localStorage.setItem(LS_KEY, next);
    });
}

/* ------------------------------------------------------------
   Header "shrink" au scroll
   (juste un effet visuel pour gagner de la place)
   ------------------------------------------------------------ */
export function setupHeaderShrink() {
    const header = document.getElementById("header");
    let ticking = false;

    // On évite de recalculer trop souvent grâce à rAF
    window.addEventListener("scroll", () => {
        if (!ticking) {
            window.requestAnimationFrame(() => {
                header?.classList.toggle("shrink", window.scrollY > 10);
                ticking = false;
            });
            ticking = true;
        }
    }, {passive: true});
}

/* ------------------------------------------------------------
   Onglets (tabs) + barre indicatrice
   NOTE: simple sélecteur, aria-selected mis à jour
   ------------------------------------------------------------ */
export function setupTabsIndicator() {
    const tablist = document.querySelector('.tabs [role="tablist"]');
    if (!tablist) return;

    const tabs = Array.from(tablist.querySelectorAll('[role="tab"]'));
    const indicator = tablist.querySelector('.indicator');
    const panels = Array.from(tablist.parentElement.querySelectorAll('[role="tabpanel"]'));

    // Sélectionner un onglet par index
    function selectTab(idx) {
        tabs.forEach((t, i) => t.setAttribute('aria-selected', i === idx ? 'true' : 'false'));
        panels.forEach((p, i) => p.hidden = i !== idx);

        // Déplacer/Redimensionner la barre sous l’onglet actif
        const tab = tabs[idx];
        const r = tab.getBoundingClientRect();
        const rList = tablist.getBoundingClientRect();
        indicator.style.width = r.width + 'px';
        indicator.style.translate = (r.left - rList.left) + 'px 0';
    }

    // Clic: activer l’onglet correspondant
    tabs.forEach((t, i) => t.addEventListener('click', () => selectTab(i)));

    // Recalcule si on redimensionne la fenêtre (pour réaligner l’indicateur)
    window.addEventListener('resize', () => {
        const active = tabs.findIndex(t => t.getAttribute('aria-selected') === 'true');
        if (active > -1) selectTab(active);
    });

    // Par défaut, prendre le premier onglet
    selectTab(0);
}

/* ------------------------------------------------------------
   Scroll-Spy sur la nav principale
   (active le lien de la section la + visible)
   ------------------------------------------------------------ */
export function setupScrollSpyNav() {
    const nav = document.getElementById('mainNav');
    if (!nav) return;

    const links = Array.from(nav.querySelectorAll('a[href^="#"]'));
    const map = new Map();

    // Associer chaque lien à sa section (via l’id)
    links.forEach(a => {
        const id = a.getAttribute('href')?.slice(1);
        const sec = id ? document.getElementById(id) : null;
        if (sec) map.set(sec, a);
    });

    // Petite fonction utilitaire pour la classe active
    function setActive(a) {
        links.forEach(x => {
            x.classList.remove('is-active');
            x.removeAttribute('aria-current');
        });
        a?.classList.add('is-active');
        a?.setAttribute('aria-current', 'page');
    }

    // Observer la visibilité des sections et choisir la “meilleure”
    const obs = new IntersectionObserver((entries) => {
        // On prend celle qui a le ratio d’intersection le plus grand
        const best = entries
            .filter(e => e.isIntersecting)
            .sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
        if (best) setActive(map.get(best.target));
    }, {rootMargin: "-40% 0px -50% 0px", threshold: [0.25, 0.6, 0.9]});

    map.forEach((_, sec) => obs.observe(sec));

    // Au clic, on force aussi l’état “actif”
    links.forEach(a => a.addEventListener('click', () => setActive(a)));
}