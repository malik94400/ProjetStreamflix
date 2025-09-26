# 🎬 StreamFlix — Projet Scolaire (HTML / CSS / JS)

Projet réalisé dans le cadre d’un **travail scolaire** visant à reproduire et moderniser l’interface d’une plateforme de streaming (type Netflix).  
L’objectif était de pratiquer **HTML5 sémantique**, **CSS moderne (variables, flex, grid, responsive)**, et **JavaScript ES6+** avec intégration d’API.

---

## 📑 Objectifs pédagogiques

- **HTML5** : respecter les bonnes pratiques (balises sémantiques, accessibilité ARIA, attributs alt).
- **CSS3** :
    - utilisation de **Flexbox** et **Grid**,
    - design **responsive mobile-first**,
    - variables CSS et thèmes multiples.
- **JavaScript ES6+** :
    - modularisation (`import / export`),
    - flèches, template literals, optional chaining,
    - interactions dynamiques (carrousels, recherche, overlay).
- **API REST** : intégration de [TMDB](https://www.themoviedb.org/) pour afficher films et séries (populaires, nouveautés, par genre).

---

## 🎨 Thèmes disponibles

L’interface propose **3 thèmes** personnalisables via un bouton toggle :

- **Dark** : fond sombre type Netflix (rouge/bleu).
- **Light** : fond clair “papier” pour une meilleure lisibilité.
- **Sepia** : ambiance sombre/violette avec accents néon.

---

## 🖥️ Fonctionnalités

- **Hero dynamique** : un film populaire mis en avant (image + description).
- **Carrousels par genre** : navigation horizontale avec flèches et inertie.
- **Recherche** : résultats instantanés affichés en rangée éphémère.
- **Overlay fiche** : détails d’un film/série (affiche, résumé, genres, durée, casting).
- **Multi-thème** : dark / light / sepia avec persistance locale (`localStorage`).
- **Navigation adaptative** : header sticky qui se réduit au scroll, scrollspy pour activer les liens.
- **Skeleton loading** : animations shimmer pendant le chargement API.

---

## 📱 Responsive

- **Mobile-first** : conception d’abord pensée pour petits écrans.
- **Breakpoints** : ajustements à 600px, 900px, et 1200px.
- **Typographie fluide** grâce à `clamp()`.

---

## ⚠️ Notes importantes

- Ce projet est **réalisé à des fins pédagogiques**.
- L’API TMDB nécessite une clé publique incluse en clair (⚠️ non adapté pour une mise en prod réelle).
- Certains effets (comme `color-mix()`) peuvent ne pas être supportés sur tous les navigateurs anciens.

---

## 🙋‍♂️ Auteur

Projet réalisé par **Malik** dans le cadre d’un module de développement web.