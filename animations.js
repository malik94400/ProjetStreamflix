// animations.js
export function setupThemeToggle() {
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
}

export function setupHeaderShrink() {
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
}

export function setupTabsIndicator() {
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
}