# HackaMetz

Plateforme de gestion de hackathons : l'organisateur crée ses hackathons, les candidats entrent avec un simple pseudo et déposent leur projet, chaque dépôt est archivé dans un dossier numéroté (`001`, `002`, …) qui forme, au fil des éditions, une base de connaissance versionnée sur Git.

Le cadrage complet (périmètre, modèle de données, API, roadmap) est dans [docs/ANALYSE.md](docs/ANALYSE.md).

## Prérequis

- Node.js 20 ou plus (testé avec 22) — rien d'autre : pas d'Apache, pas de MySQL, pas de XAMPP.
- npm 10 ou plus.

## Démarrer

```bash
npm install                # installe les trois paquets (shared, server, client)
cp .env.example .env       # puis change ADMIN_KEY
npm run seed               # données de démo (4 hackathons, 5 pseudos, 3 projets)
npm run dev                # API sur http://localhost:3001, front sur http://localhost:5173
```

`npm run seed -- --reset` repart de zéro.

## Donner accès aux participants (sans nom de domaine)

La base de données et les projets déposés sont des fichiers sur le disque de la machine qui fait tourner le serveur : c'est elle qu'il faut rendre accessible.

```bash
npm run build && npm start   # une seule URL : Express sert l'API et le front sur le port 3001
```

- **Même Wi-Fi (hackathon sur place)** : le serveur affiche au démarrage l'adresse à partager, du type `http://192.168.1.20:3001`. Aucun compte, aucun internet nécessaire. Si Windows demande d'autoriser Node sur le réseau privé, accepte.
- **Participants à distance** : garde le serveur lancé et ouvre un tunnel gratuit vers lui, par exemple `cloudflared tunnel --url http://localhost:3001` (URL `https://….trycloudflare.com`, sans compte, change à chaque lancement) ou `tailscale funnel 3001` (URL stable `https://<pc>.<tailnet>.ts.net`, compte gratuit).
- **24 h/24 sans ton PC** : il faut une machine avec un disque persistant (VM Oracle Cloud Always Free, Raspberry Pi…) + un sous-domaine gratuit (DuckDNS) — les hébergeurs gratuits « sans disque » (Render, Vercel…) effaceraient `data/` et `storage/`.

## Commandes

| Commande                    | Effet                                                                                                                                                                                                   |
| --------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `npm run dev`               | Serveur Express (tsx, rechargement à chaud) + Vite, en parallèle                                                                                                                                        |
| `npm run build`             | Bundle du serveur (`server/dist`) et du front (`client/dist`)                                                                                                                                           |
| `npm start`                 | Lance le serveur compilé ; en `NODE_ENV=production` il sert aussi le front                                                                                                                              |
| `npm test`                  | Tests d'API (vitest + supertest) sur des dossiers temporaires                                                                                                                                           |
| `npm run typecheck`         | `tsc --noEmit` sur les trois paquets                                                                                                                                                                    |
| `npm run lint`              | ESLint                                                                                                                                                                                                  |
| `npm run format`            | Prettier                                                                                                                                                                                                |
| `npm run kb:export`         | Régénère README + manifests de `storage/` (`-- --commit` pour un commit)                                                                                                                                |
| `node scripts/e2e-tour.mjs` | Parcours de l'app en Chromium headless : captures dans `scripts/shots/`, erreurs console/JS/HTTP (après `npm run build` ; nécessite `npm i -D --no-save playwright && npx playwright install chromium`) |

## Architecture

Monorepo npm à trois paquets. MVC : le **modèle** est dans `server/src/models` + `repositories` + `storage`, la **vue** est le client React, les **contrôleurs** dans `server/src/controllers`, et `server/src/routes` à côté ne fait que brancher les URL.

```
shared/src/        schémas zod, types et constantes partagés front / back (source de vérité)
server/src/
  routes/          URL → middlewares → contrôleur, rien d'autre
  controllers/     valide l'entrée (zod), appelle un service, répond
  services/        logique métier (identité par pseudo, cycle de vie des hackathons…)
  models/          entités et invariants
  repositories/    accès données : interface Repository<T> + implémentation JSON (lowdb)
  storage/         système de fichiers de la base de connaissance (dossiers 001-…)
  middlewares/     session (pseudo / clé admin), gardes, rate limit, gestion d'erreurs
  config/          variables d'environnement validées, chemins
server/data/       BDD JSON, un fichier par collection (ignoré par Git)
server/storage/    base de connaissance : hackathons/001-slug/{hackathon.json, README.md, projects/}
client/src/
  pages/ router/ components/ (ui, layout, hackathon, session) api/ hooks/ store/ lib/ styles/
```

Flux d'une requête : `route → middlewares → controller → service → repository / storage → JSON`.

## API (v1)

Préfixe `/api`. Identité candidat : `Authorization: Bearer <token>` (renvoyé par `/auth/enter`). Organisateur : header `X-Admin-Key` (valeur `ADMIN_KEY` du `.env`).

| Méthode       | Route                                      | Accès    | Rôle                                                                              |
| ------------- | ------------------------------------------ | -------- | --------------------------------------------------------------------------------- |
| GET           | `/health`, `/time`, `/stats`               | public   | État, heure de référence, chiffres de la page d'accueil                           |
| GET           | `/search?q=`                               | public   | Recherche globale (éditions, projets, technos, pseudos ; brouillons en admin)     |
| POST          | `/auth/enter`                              | public   | Entrer avec un pseudo → utilisateur + token                                       |
| GET           | `/me`                                      | candidat | Profil, inscriptions, projets, résultats finaux, palmarès                         |
| GET           | `/hackathons?status=`                      | public   | Liste avec compteurs (brouillons visibles en admin seulement)                     |
| GET           | `/hackathons/:slug`                        | public   | Détail                                                                            |
| POST          | `/hackathons`                              | admin    | Créer : numéro `001…` et dossier attribués, statut brouillon                      |
| PATCH         | `/hackathons/:slug`                        | admin    | Modifier (le slug et le numéro ne changent jamais)                                |
| POST          | `/hackathons/:slug/status`                 | admin    | Transition manuelle (`STATUS_TRANSITIONS` dans `shared`)                          |
| GET           | `/hackathons/:slug/participants`           | public   | Inscrits                                                                          |
| POST / DELETE | `/hackathons/:slug/registration`           | candidat | Rejoindre (règlement accepté, code d'accès si privé) / quitter                    |
| GET           | `/hackathons/:slug/submissions`            | public   | Projets déposés                                                                   |
| POST          | `/hackathons/:slug/submissions`            | candidat | Déposer : multipart `archive` (zip) + `meta` (JSON) ; re-dépôt = nouvelle version |
| GET           | `/submissions/:id`, `/tree`, `/file?path=` | public   | Détail, arbre de fichiers, contenu d'un fichier (borné au dossier)                |
| POST          | `/submissions/:id/status`                  | admin    | Disqualifier / rétablir                                                           |
| GET           | `/admin/stats`                             | admin    | Tableau de bord : compteurs, répartition par statut, activité                     |
| GET           | `/admin/users`                             | admin    | Liste des pseudos                                                                 |
| POST          | `/admin/users/:id/release`                 | admin    | Libérer un pseudo lié à un appareil                                               |

| GET / POST / DELETE | `/hackathons/:slug/teams`, `/teams/mine`, `/teams/join` | candidat | Équipes : créer, la mienne (avec code), rejoindre par code, quitter |
| GET / POST / DELETE | `/hackathons/:slug/announcements[/:id]` | public / admin | Annonces de l'organisateur (épinglables, markdown) |
| GET | `/hackathons/:slug/events` | public | Flux SSE : annonces, inscriptions, équipes, dépôts, statuts en direct |
| GET / PUT | `/hackathons/:slug/jury` | public / admin | Jury du hackathon (liste de pseudos) |
| GET | `/hackathons/:slug/evaluations/mine` | juré | Mes notes |
| PUT | `/submissions/:id/evaluation` | juré | Noter un projet : une note par critère + commentaire |
| GET | `/hackathons/:slug/results` | public | Classement, publié quand le hackathon est terminé (provisoire pour l'admin) |
| GET | `/kb/projects?q=&tech=&hackathon=` | public | Galerie de tous les projets, filtrable |
| POST | `/admin/kb/export` | admin | Régénère README + manifests de `storage/`, commit Git optionnel |
| GET / POST | `/hackathons/:slug/questions` | public / candidat | Questions à l'organisateur (sans réponse d'abord, triées par soutien) |
| POST | `/hackathons/:slug/questions/:id/answer` | admin | Répondre (markdown) |
| PUT / DELETE | `/hackathons/:slug/questions/:id/upvote` | candidat | Soutenir / retirer son +1 |
| DELETE | `/hackathons/:slug/questions/:id` | auteur / admin | Retirer une question (l'auteur seulement tant qu'elle est sans réponse) |
| GET / PUT | `/hackathons/:slug/feedback` | public / inscrit | Synthèse des retours (commentaires pour l'admin) / déposer ou modifier son avis |
| GET | `/hackathons/:slug/exports/:kind.csv` | admin | Tableur : `participants`, `projets`, `resultats`, `retours` |

Les erreurs ont toujours la forme `{ "error": { "code", "message", "details?" } }`.

## Dépôt d'un projet

Côté navigateur, le dossier déposé est parcouru sans jamais descendre dans `node_modules`, `.git`, `dist`… puis compressé (fflate) et envoyé avec une barre de progression ; un zip est envoyé tel quel. Côté serveur, l'archive est rangée dans `projects/NN-pseudo/archives/vN.zip`, puis extraite dans `source/` en écartant les fichiers sensibles (`.env*`, clés), les liens symboliques et tout chemin qui sortirait du dossier (zip slip), avec des limites de taille décompressée et de nombre de fichiers. Un `project.json` et le `README.md` du hackathon sont régénérés à chaque dépôt.

## Équipes, annonces, temps réel

Quand un hackathon est « en équipe », un inscrit crée une équipe (code d'invitation à 6 caractères) ou en rejoint une ; le dépôt est alors celui de l'équipe (dossier `NN-nom-equipe`), n'importe quel membre peut re-déposer, et l'équipe doit atteindre la taille minimale pour déposer. Les annonces de l'organisateur, les inscriptions, les équipes, les dépôts et les changements de statut sont poussés en Server-Sent Events (`/api/hackathons/:slug/events`) : la page du hackathon se met à jour sans rechargement. Un scan de secrets (clés AWS, tokens, clés privées, mots de passe en clair) prévient le candidat sans bloquer le dépôt. Un QR code de la page du hackathon est disponible pour l'organisateur (kickoff sur place).

## Jury, résultats, export

L'organisateur désigne le jury par pseudos (formulaire du hackathon). Chaque juré note chaque projet sur les critères pondérés (`/jury/:slug`) ; le score d'un projet est la moyenne des scores normalisés sur 100 (Σ note/max × poids / Σ poids). Le classement est public dès que le hackathon est « terminé » (podium, tableau par critère, commentaires du jury, coup de cœur du public), provisoire et privé avant. Le vote du public (un vote par inscrit, jamais pour son propre projet, ouvert pendant l'édition et la délibération) s'active par hackathon. `npm run kb:export -- --commit` (ou le bouton du dashboard) régénère l'index `storage/README.md`, les README par hackathon avec classement et les `project.json`, puis crée un commit dans `storage/` — un dépôt Git distinct de celui du code.

## Propositions de hackathons

L'organisateur crée un tour de **trois propositions** (titre, thème, description, tags, couleur), l'ouvre au vote, puis le clôture : la proposition la plus votée est désignée gagnante (un seul vote par pseudo, modifiable tant que le tour est ouvert ; un seul tour ouvert à la fois). Depuis le menu « Gérer » du tour clôturé, « Créer le hackathon » ouvre le formulaire pré-rempli avec la proposition gagnante, et le hackathon créé reste lié au tour.

## Interface

Une seule grammaire visuelle sur tout le site : dégradé de marque (cobalt → violet → or), surfaces en verre, ombres douces, typographies auto-hébergées (Bricolage Grotesque / Instrument Sans / JetBrains Mono), thème clair et sombre.

- **Sur mobile**, une barre d'onglets fixe en bas met les quatre destinations principales sous le pouce (plus « Profil » ou « Entrer ») ; le menu latéral garde l'espace organisateur et le thème. Les toasts remontent au-dessus de la barre.
- **« Ma participation »** sur la page d'un hackathon : une checklist qui montre où en est le participant (pseudo → inscription → équipe → dépôt → vote) et propose la seule action qui compte à ce moment.
- **Dépôt de projet** en deux colonnes, avec un récapitulatif collant (fichiers prêts, titre, équipe, autorisation), le compte à rebours de la deadline et la progression compression/envoi.
- **Grille du jury** : curseurs aux couleurs de la marque, jauge circulaire du score pondéré en direct, progression « projets notés ».
- **Squelettes de chargement** à la forme du contenu et **états vides** illustrés avec l'action qui remplit l'écran, plutôt que des cadres pointillés.
- Animations discrètes (entrée de page, apparition en cascade des cartes) neutralisées quand le système demande `prefers-reduced-motion`.

## Recherche, duplication, exports

`Ctrl+K` (ou `⌘K`, ou simplement `/`) ouvre la **palette de commandes** : navigation clavier et recherche globale sur les éditions, les projets, les technos et les pseudos — sans accents ni casse (« ecologie » trouve « Écologie »). Les brouillons n'apparaissent qu'avec la clé d'organisateur.

Une édition peut être **dupliquée** (menu du dashboard ou de la page du hackathon → « Dupliquer ») : critères, prix, format, règlement, jury et ressources sont repris, les dates repartent de zéro (`/admin/hackathons/new?from=slug`).

Le dashboard et la page des résultats proposent des **exports CSV** (participants, projets, classement complet par critère, retours) — ouvrables directement dans Excel ou LibreOffice.

## Questions, retours, palmarès

Chaque hackathon a un onglet **Questions** : un inscrit pose une question, les autres la soutiennent d'un +1 (les plus soutenues remontent), l'organisateur répond en ligne ; tout arrive en temps réel via le flux SSE. Dès la fin des dépôts, les inscrits laissent un **retour** (note sur 5, ce qui a plu, à améliorer, « je reviendrais ») ; la synthèse est visible de tous, les commentaires anonymisés seulement par l'organisateur. Le **profil** calcule un palmarès à la volée (premiers pas, builder, esprit d'équipe, or/argent/bronze, coup de cœur, juré, vétéran, curieux) et liste les résultats finaux ; chaque édition terminée donne un **certificat** imprimable (`/me/certificat/:slug`, Ctrl+P → PDF).

## Pages

`/` accueil · `/hackathons` liste (édition à la une + éditions passées en lignes) · `/hackathons/:slug` détail (présentation + retours, participants, annonces, questions, projets) · `/hackathons/:slug/submit` dépôt · `/hackathons/:slug/projects/:id` projet (arbre, README, viewer coloré) · `/hackathons/:slug/results` podium et classement · `/jury/:slug` grille de notation · `/kb` base de connaissance · `/propositions` tours de propositions et vote · `/admin/propositions/new` et `/admin/propositions/:id/edit` formulaire de tour · `/me` profil (palmarès, résultats) · `/me/certificat/:slug` certificat imprimable · `/admin` dashboard organisateur (clé requise) · `/admin/hackathons/new` et `/admin/hackathons/:slug/edit` formulaire.

## Application installable (PWA)

Le build embarque un manifeste et un service worker : sur un téléphone, « Ajouter à l'écran d'accueil » installe HackaMetz comme une app (icône, plein écran), et la coquille reste ouvrable si le wifi tombe. L'API n'est jamais servie depuis le cache — les données restent fraîches — et `/sw.js` est renvoyé avec `Cache-Control: no-cache` pour qu'une mise à jour ne reste jamais coincée. En développement, le service worker n'est pas enregistré. Les navigateurs qui le proposent affichent un bouton « Installer l'app » en bas du menu.

## Identité par pseudo

Pas de mot de passe. Au premier passage, le serveur crée le pseudo et renvoie un token d'appareil que le navigateur conserve. Avec `PSEUDO_POLICY=device-bound` (défaut), un autre appareil ne peut pas reprendre ce pseudo tant que l'organisateur ne l'a pas libéré (`POST /api/admin/users/:id/release`). `PSEUDO_POLICY=free` désactive cette protection.

## Prochaines étapes

La roadmap de [docs/ANALYSE.md](docs/ANALYSE.md#15-roadmap) est livrée (sprints 0 à 3). Livré depuis : vote du public, propositions, questions/réponses, retours de fin, palmarès et certificats, recherche globale (palette ⌘K), duplication d'édition, exports CSV, PWA installable. Pistes suivantes : mentors / créneaux d'aide, push GitHub automatique de `storage/`, notifications par e-mail optionnelles.
