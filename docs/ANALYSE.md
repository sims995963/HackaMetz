# Analyse fonctionnelle & technique — Plateforme de hackathons

> Nom de code : **HackaMetz** (à valider). Document de cadrage : ce qu'il faut mettre dans l'app, pourquoi, et dans quel ordre. Rien n'est codé encore — ce document est la référence pour la suite.

---

## 1. Vision

Une plateforme qui accueille **tous** les hackathons de l'organisateur :

1. L'organisateur crée un hackathon (thème, dates, taille d'équipe, critères…).
2. Les candidats entrent avec un **simple pseudo** (pas de mot de passe).
3. Ils **glissent-déposent leur projet** ; le code est archivé dans un dossier numéroté (`001`, `002`, …).
4. Hackathon après hackathon, ces dossiers forment une **base de connaissance versionnée sur Git**.

## 2. Ce que le brief impose

| Contrainte                                  | Conséquence sur la conception                                                                                                           |
| ------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| Multi-hackathons                            | Le hackathon est l'entité centrale ; participants, équipes, projets, résultats lui sont rattachés                                       |
| Créé par l'organisateur avec ses paramètres | Rôle **admin** distinct + formulaire de création complet (durée, taille d'équipe, critères… tout est paramétrable par hackathon)        |
| Pseudo seul, pas de mot de passe            | Identité « faible » : protection minimale des pseudos, et accès admin protégé autrement (clé secrète)                                   |
| Drag & drop du projet                       | Upload de **dossier ou de zip**, filtrage (`node_modules`…), extraction et contrôle côté serveur                                        |
| Dossier `001`, `002`… par hackathon         | Le **disque local fait partie de la base de données** → backend Node avec accès au système de fichiers (exclut un stockage 100 % cloud) |
| Base de connaissance Git                    | Convention de dossiers stable, manifests JSON + README générés, **consentement + licence** des candidats                                |

## 3. Acteurs

| Acteur                   | Qui                          | Ce qu'il fait                                                                                      |
| ------------------------ | ---------------------------- | -------------------------------------------------------------------------------------------------- |
| **Organisateur (admin)** | Toi                          | Crée/pilote les hackathons, gère le cycle de vie, désigne le jury, exporte la base de connaissance |
| **Candidat**             | N'importe qui avec un pseudo | Rejoint un hackathon, forme une équipe, dépose (et re-dépose) son projet, consulte les résultats   |
| **Jury**                 | Pseudos désignés par l'admin | Note les projets selon les critères, laisse des commentaires                                       |
| **Visiteur**             | Sans pseudo                  | Voit la liste des hackathons, les résultats, la galerie des projets passés                         |

## 4. Parcours clés

```
ADMIN      crée le hackathon (brouillon) ──► le publie ──► suit le tableau de bord ──► ferme / délibère ──► publie les résultats ──► exporte vers Git
CANDIDAT   entre son pseudo ──► voit la liste ──► rejoint ──► (crée / rejoint une équipe) ──► dépose son projet ──► re-dépose jusqu'à la deadline ──► voit le podium
JURY       entre son pseudo ──► ouvre la grille de notation ──► note chaque projet ──► les scores s'agrègent en classement
SYSTÈME    passe les statuts automatiquement selon les dates ──► numérote les dossiers ──► extrait / vérifie les archives ──► génère README + manifests
```

## 5. Fonctionnalités par module (MoSCoW)

Légende : **M** = Must (MVP), **S** = Should, **C** = Could.

### A. Gestion des hackathons (admin)

| Fonctionnalité                                                                                       | Priorité |
| ---------------------------------------------------------------------------------------------------- | -------- |
| Créer / éditer un hackathon avec tous ses paramètres (voir §6)                                       | M        |
| Numérotation automatique `001`, `002`… + création du dossier de stockage                             | M        |
| Cycle de vie : brouillon → publié → en cours → soumissions closes → délibération → terminé → archivé | M        |
| Transitions automatiques selon les dates + forçage manuel                                            | S        |
| Tableau de bord : participants, équipes, soumissions, activité récente                               | M        |
| Gérer les participants (voir, retirer) et les soumissions (voir, disqualifier)                       | M        |
| Désigner le jury (pseudos)                                                                           | S        |
| Dupliquer un hackathon (template)                                                                    | C        |
| Export ZIP d'un hackathon complet                                                                    | M        |
| Export « base de connaissance » : manifests JSON + README générés + commit Git                       | S        |
| Statistiques globales (participants uniques, projets, technos les plus utilisées)                    | C        |

### B. Utilisateurs (pseudo seul)

| Fonctionnalité                                                                                               | Priorité |
| ------------------------------------------------------------------------------------------------------------ | -------- |
| Entrée par pseudo : créé s'il n'existe pas, sinon « bon retour »                                             | M        |
| Règles : 3–20 caractères, lettres/chiffres/`_`/`-`, unicité insensible à la casse                            | M        |
| Avatar généré automatiquement à partir du pseudo (initiales + couleur, ou DiceBear)                          | S        |
| Session par appareil (token stocké dans le navigateur, « se déconnecter » = l'effacer)                       | M        |
| Protection légère : un pseudo lié à un appareil ne peut pas être repris ailleurs sans libération par l'admin | S        |
| Profil : mes hackathons, mes projets, mon équipe                                                             | S        |
| Admin : lister, renommer, libérer, fusionner, bannir un pseudo                                               | C        |

### C. Participation

| Fonctionnalité                                                                                           | Priorité |
| -------------------------------------------------------------------------------------------------------- | -------- |
| Liste des hackathons (cartes, filtres par statut, compte à rebours)                                      | M        |
| Page hackathon : thème, règlement, planning, critères, prix, ressources, participants                    | M        |
| Rejoindre / quitter (avec acceptation du règlement)                                                      | M        |
| Code d'accès pour les hackathons privés                                                                  | S        |
| Équipes : créer, code d'invitation, rejoindre, quitter, chef d'équipe — activable et borné par hackathon | S        |
| Compte à rebours synchronisé sur l'heure serveur                                                         | M        |
| Rejoindre par QR code (hackathon sur place)                                                              | C        |

### D. Dépôt de projet (drag & drop)

| Fonctionnalité                                                                                                                       | Priorité |
| ------------------------------------------------------------------------------------------------------------------------------------ | -------- |
| Zone de dépôt : dossier **ou** zip, clic pour choisir en secours                                                                     | M        |
| Filtrage côté client avant envoi : `node_modules`, `.git`, `dist`, `build`, `.venv`, `__pycache__`, fichiers > N Mo                  | M        |
| Compression côté client (fflate) + barre de progression + récapitulatif (nb de fichiers, taille)                                     | M        |
| Formulaire : titre, pitch, technos, lien repo, lien démo, vidéo, captures                                                            | M        |
| Consentement à la publication dans la base de connaissance + licence                                                                 | M        |
| Serveur : contrôle taille / nb d'entrées / zip-slip, extraction dans `001-…/projects/<owner>/source/`, conservation du zip d'origine | M        |
| Filtrage serveur des fichiers sensibles (`.env*`, `credentials.json`, clés privées) + scan basique de secrets                        | S        |
| Analyse automatique : arbre de fichiers, langages détectés, README trouvé, empreinte SHA-256                                         | S        |
| Re-dépôt jusqu'à la deadline avec historique des versions (`v1.zip`, `v2.zip`…)                                                      | S        |
| Dépôt en retard : refusé ou accepté et marqué « late » (paramètre du hackathon)                                                      | S        |
| Visualisation : arbre de fichiers, viewer de code avec coloration, rendu du README                                                   | S        |
| Une seule soumission active par candidat / équipe et par hackathon                                                                   | M        |

### E. Évaluation & résultats

| Fonctionnalité                                                                | Priorité |
| ----------------------------------------------------------------------------- | -------- |
| Critères pondérés définis par hackathon (label, description, poids, note max) | S        |
| Grille de notation jury + commentaire, modifiable jusqu'à la publication      | S        |
| Agrégation → classement, podium, ex æquo gérés                                | S        |
| Publication des résultats (page podium, badges « vainqueur »)                 | S        |
| Vote du public / likes des participants                                       | C        |
| Retour écrit aux candidats (commentaires du jury visibles après publication)  | C        |

### F. Base de connaissance & archive

| Fonctionnalité                                                                                              | Priorité |
| ----------------------------------------------------------------------------------------------------------- | -------- |
| Convention de dossiers stable (voir §9)                                                                     | M        |
| Galerie des hackathons passés et de leurs projets                                                           | S        |
| Recherche : thème, tag, techno, pseudo, année                                                               | S        |
| Navigation dans le code des projets archivés depuis l'app                                                   | S        |
| README généré par hackathon (thème, dates, participants, podium, liste des projets) + README racine (index) | S        |
| Script `kb:export` : régénère manifests + README, commit Git dans le dépôt de la base de connaissance       | S        |
| Push automatique vers GitHub à la clôture                                                                   | C        |

### G. Communication

| Fonctionnalité                                                             | Priorité |
| -------------------------------------------------------------------------- | -------- |
| Annonces de l'organisateur sur la page du hackathon (épinglables)          | S        |
| Temps réel (SSE) : annonces, nouvelles soumissions, changements de statut  | S        |
| Planning / jalons de l'événement (kickoff, checkpoints, pitchs, résultats) | S        |
| Q&A / chat, demandes d'aide aux mentors                                    | C        |
| Sondage de feedback post-hackathon, certificats / badges de participation  | C        |

## 6. Paramètres d'un hackathon (formulaire de création)

Tout ce que l'admin doit pouvoir régler **par hackathon** — la durée et la taille d'équipe en font partie :

- **Identité** : titre, slug (auto), numéro (auto, `001`), thème, description (markdown), règlement (markdown), couleur / image de couverture, tags.
- **Format** : en ligne / sur place / hybride, lieu, lien visio, fuseau horaire.
- **Calendrier** : ouverture des inscriptions, début, **deadline de soumission**, fin, publication des résultats, jalons libres.
- **Participation** : nombre max de participants, équipes activées ?, taille min / max, visibilité (public / code d'accès), acceptation du règlement obligatoire.
- **Soumission** : formats acceptés (zip, dossier), taille max, nombre de fichiers max, re-dépôt autorisé ?, dépôt en retard toléré ?, champs requis (pitch, technos, repo, démo, vidéo), licence par défaut.
- **Évaluation** : critères pondérés, jury (pseudos), vote du public ?, prix / récompenses.
- **Ressources** : liens utiles (docs, APIs, datasets), contact / support.
- **Statut** : brouillon → publié → en cours → soumissions closes → délibération → terminé → archivé.

```mermaid
stateDiagram-v2
    [*] --> draft : création
    draft --> published : admin publie
    published --> running : date de début
    running --> submissions_closed : deadline de soumission
    submissions_closed --> judging : admin ouvre la délibération
    judging --> finished : résultats publiés
    finished --> archived : export vers Git
    published --> draft : admin dépublie
```

## 7. Modèle de données

Un identifiant unique par entité (`nanoid`), des dates ISO 8601 en UTC, des références par id.

| Entité           | Champs principaux                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| ---------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **User**         | `id`, `pseudo`, `pseudoNormalized` (unicité), `avatarSeed`, `role` (`participant` / `jury` / `admin`), `deviceTokens[]`, `createdAt`, `lastSeenAt`                                                                                                                                                                                                                                                                                                                                                                                       |
| **Hackathon**    | `id`, `number` (1), `code` (`001`), `slug`, `title`, `theme`, `description`, `rules`, `cover`, `tags[]`, `format`, `location`, `timezone`, `dates{registrationOpensAt, startsAt, submissionDeadlineAt, endsAt, resultsAt}`, `milestones[]`, `status`, `team{enabled, minSize, maxSize}`, `maxParticipants`, `visibility`, `accessCode`, `submission{formats[], maxSizeMb, maxFiles, allowResubmit, allowLate, requiredFields[], license}`, `criteria[]`, `prizes[]`, `resources[]`, `juryIds[]`, `storagePath`, `createdAt`, `updatedAt` |
| **Registration** | `id`, `hackathonId`, `userId`, `teamId?`, `acceptedRulesAt`, `joinedAt`                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| **Team**         | `id`, `hackathonId`, `name`, `slug`, `inviteCode`, `leaderId`, `memberIds[]`, `createdAt`                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| **Submission**   | `id`, `hackathonId`, `number` (rang dans le hackathon), `ownerType` (`user` / `team`), `ownerId`, `title`, `pitch`, `description`, `techStack[]`, `repoUrl?`, `demoUrl?`, `videoUrl?`, `files{sourcePath, archivePath, sizeBytes, fileCount, languages{}, hasReadme, sha256}`, `versions[]`, `status` (`draft` / `submitted` / `late` / `disqualified`), `consent{publish, license, at}`, `submittedByUserId`, `submittedAt`, `updatedAt`                                                                                                |
| **Evaluation**   | `id`, `hackathonId`, `submissionId`, `juryId`, `scores{criterionId: number}`, `comment`, `createdAt`, `updatedAt`                                                                                                                                                                                                                                                                                                                                                                                                                        |
| **Announcement** | `id`, `hackathonId`, `authorId`, `title`, `content`, `pinned`, `createdAt`                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| **AuditLog** (C) | `id`, `actorId`, `action`, `targetType`, `targetId`, `meta`, `at`                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| **Settings**     | `platformName`, `defaultLicense`, `uploadLimits`, `pseudoPolicy` (`free` / `device-bound`)                                                                                                                                                                                                                                                                                                                                                                                                                                               |

Relations : un hackathon a N registrations, N teams, N submissions, N evaluations, N announcements ; une submission appartient à un user **ou** une team ; une evaluation = (submission, jury) unique.

## 8. Base de données : JSON vs SQLite vs Firebase

| Critère                          | JSON (lowdb)                                        | SQLite (better-sqlite3 + Drizzle) | Firebase (Firestore + Storage)                 |
| -------------------------------- | --------------------------------------------------- | --------------------------------- | ---------------------------------------------- |
| Mise en place                    | 5 min, zéro serveur                                 | 30 min, schéma + migrations       | 1 h : projet GCP, clés, règles de sécurité     |
| Lisible / diffable dans Git      | ✅                                                  | ❌ binaire                        | ❌ cloud                                       |
| Requêtes / relations             | JS (`filter`, `find`) — suffisant sous ~10 k lignes | SQL, index, transactions          | Requêtes limitées, pas de jointures            |
| Concurrence                      | 1 process Node → OK, écriture atomique              | ✅ transactions                   | ✅                                             |
| Projets dans les dossiers `001…` | ✅ disque local                                     | ✅ disque local                   | ❌ Cloud Storage → synchro nécessaire pour Git |
| Temps réel                       | SSE maison (simple)                                 | SSE maison                        | ✅ natif                                       |
| Coût / lock-in                   | 0                                                   | 0                                 | Gratuit puis payant, lock-in                   |
| Cohérence avec le MVC Express    | ✅                                                  | ✅                                | ⚠️ le SDK client contourne le backend          |

**Recommandation : JSON via lowdb, un fichier par collection (`data/users.json`, `data/hackathons.json`…), derrière une interface `Repository<T>`.**

- Firebase est écarté : les fichiers doivent vivre sur le disque pour la base Git, et le SDK ferait doublon avec le backend Express.
- Le pattern Repository rend la bascule vers SQLite indolore (même interface, seule l'implémentation change) si un jour on dépasse ~10 k enregistrements ou plusieurs process.
- Écritures atomiques (écrire dans un fichier temporaire puis renommer) pour ne jamais corrompre la BDD en cas de crash.

## 9. Stockage des projets & convention de dossiers

Le dossier `storage/` **est la base de connaissance** : c'est lui (et non le code de la plateforme) qui devient un dépôt Git.

```
storage/
├── README.md                         # index généré : tableau de tous les hackathons
└── hackathons/
    ├── 001-ia-pour-l-education/
    │   ├── hackathon.json            # manifest (thème, dates, paramètres, podium)
    │   ├── README.md                 # généré : thème, participants, résultats, liste des projets
    │   └── projects/
    │       ├── 01-simon/             # rang de dépôt + pseudo ou nom d'équipe (slugifié)
    │       │   ├── project.json      # manifest (auteurs, pitch, technos, licence, versions, sha256)
    │       │   ├── source/           # code extrait, nettoyé (dernière version)
    │       │   └── archives/
    │       │       ├── v1.zip        # zip d'origine de chaque dépôt
    │       │       └── v2.zip
    │       └── 02-team-rocket/
    └── 002-ville-durable/
```

Règles :

- Numéro de hackathon sur 3 chiffres, **jamais réutilisé** (un hackathon supprimé est archivé, pas effacé).
- Chemin de `storage/` configurable (`STORAGE_PATH` dans `.env`) pour pointer vers un dépôt Git séparé.
- Fichiers exclus à l'extraction : `node_modules/`, `.git/`, `dist/`, `build/`, `.next/`, `.venv/`, `__pycache__/`, `.DS_Store`, `*.log`, **`.env*`**, `*.pem`, `*.key`, `credentials*.json`.
- Noms de fichiers sanitisés (caractères interdits sous Windows `: * ? " < > |`, chemins trop longs).
- `.gitignore` généré à la racine de `storage/` (archives volumineuses en Git LFS si besoin).

## 10. Architecture (MVC + routes)

Correspondance MVC : **Model** = `models/` + `repositories/` + `storage/`, **View** = le client React, **Controller** = `controllers/`, et `routes/` à côté qui ne fait que brancher URL → middlewares → contrôleur. Une couche `services/` porte la logique métier pour garder les contrôleurs fins.

```
hackametz/
├── package.json                  # workspaces npm : shared, server, client
├── .env.example
├── docs/                         # ce document, décisions (ADR), conventions
├── scripts/                      # seed.ts (données de démo), kb-export.ts (README + manifests + commit)
│
├── shared/                       # code partagé front / back
│   └── src/
│       ├── schemas/              # zod : user, hackathon, submission… → source de vérité des types
│       ├── types/                # types TS dérivés (z.infer)
│       └── constants/            # statuts, limites, formats, messages d'erreur
│
├── server/                       # Express — le M, le C et les routes
│   ├── src/
│   │   ├── app.ts                # crée l'app : middlewares globaux, routes, gestion d'erreurs
│   │   ├── server.ts             # écoute HTTP, lance le scheduler, arrêt propre
│   │   ├── config/               # env validé par zod, chemins, constantes
│   │   ├── routes/               # 1 fichier par ressource : URL → middlewares → controller, rien d'autre
│   │   ├── controllers/          # HTTP uniquement : valide (zod), appelle un service, répond
│   │   ├── services/             # logique métier : lifecycle, numbering, submission, scoring, export
│   │   ├── models/               # entités : types, valeurs par défaut, invariants
│   │   ├── repositories/         # accès données : interface Repository<T> + implémentation JSON (lowdb)
│   │   ├── storage/              # système de fichiers : dossiers 001, extraction zip, arbre, manifests
│   │   ├── middlewares/          # session (pseudo), requireAdmin, requireJury, upload (multer), rateLimit, errorHandler
│   │   ├── realtime/             # bus d'événements + endpoint SSE
│   │   ├── jobs/                 # scheduler : transitions de statut automatiques
│   │   └── utils/                # slugify, hash, dates, logger
│   ├── data/                     # BDD JSON, 1 fichier par collection (gitignored)
│   ├── storage/                  # base de connaissance (dépôt Git séparé, gitignored ici)
│   └── tests/                    # vitest + supertest
│
└── client/                       # React + Vite — le V
    └── src/
        ├── main.tsx, App.tsx
        ├── router/               # react-router : routes publiques, candidat, jury, admin
        ├── pages/                # 1 dossier par page : Home, Hackathon, Submit, Project, Results, Admin…
        ├── components/           # ui/ (design system), layout/, hackathon/, submission/, admin/
        ├── api/                  # client HTTP typé par ressource (fetch + schémas zod partagés)
        ├── hooks/                # useSession, useCountdown, useHackathon, useUpload…
        ├── store/                # session (pseudo, token, clé admin) — zustand
        ├── lib/                  # utilitaires : dates, formatage, zip côté client (fflate)
        └── styles/
```

Flux d'une requête : `Route → middlewares → Controller → Service → Repository (données) + Storage (fichiers) → réponse JSON`.

Règles d'or :

- Un contrôleur ne touche jamais au disque ni à la BDD directement.
- Un service ne connaît pas HTTP (pas de `req` / `res`).
- Un repository ne contient aucune logique métier.
- Toute entrée est validée par un schéma zod **partagé** avec le front.
- Toute erreur passe par le `errorHandler` (format JSON unique `{ error: { code, message, details } }`).

### Stack recommandée

| Couche            | Choix                                                                                                                                                                                      |
| ----------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Runtime / langage | Node LTS, **TypeScript** partout                                                                                                                                                           |
| Backend           | Express 5, zod, lowdb, multer, yauzl (extraction zip en streaming), nanoid, helmet, cors, express-rate-limit, pino                                                                         |
| Frontend          | React 19, Vite, react-router, TanStack Query (données serveur), zustand (session), react-dropzone, fflate, react-markdown, shiki (viewer de code), sonner (toasts), date-fns, lucide-react |
| UI                | Tailwind CSS + shadcn/ui (composants accessibles, dark mode, look moderne rapide)                                                                                                          |
| Outils            | npm workspaces, ESLint + Prettier, vitest + supertest, concurrently                                                                                                                        |
| Déploiement       | Docker Compose ; ou lancé sur le PC de l'organisateur en réseau local pour un hackathon sur place                                                                                          |

## 11. API REST (v1)

Préfixe `/api`. Auth candidat : header `Authorization: Bearer <deviceToken>`. Auth admin : header `X-Admin-Key`.

| Méthode       | Route                                   | Rôle           | Description                                    |
| ------------- | --------------------------------------- | -------------- | ---------------------------------------------- |
| POST          | `/auth/enter`                           | public         | Entrer avec un pseudo → user + deviceToken     |
| GET           | `/me`                                   | candidat       | Profil, hackathons, projets                    |
| GET           | `/time`                                 | public         | Heure serveur (synchro du compte à rebours)    |
| GET           | `/hackathons?status=`                   | public         | Liste (filtres, tri)                           |
| POST          | `/hackathons`                           | admin          | Créer (numéro + dossier créés automatiquement) |
| GET           | `/hackathons/:slug`                     | public         | Détail                                         |
| PATCH         | `/hackathons/:slug`                     | admin          | Modifier                                       |
| POST          | `/hackathons/:slug/status`              | admin          | Forcer une transition                          |
| DELETE        | `/hackathons/:slug`                     | admin          | Archiver (jamais de suppression physique)      |
| POST / DELETE | `/hackathons/:slug/registration`        | candidat       | Rejoindre / quitter                            |
| GET           | `/hackathons/:slug/participants`        | public         | Participants et équipes                        |
| POST          | `/hackathons/:slug/teams`               | candidat       | Créer une équipe                               |
| POST          | `/teams/:id/join` · `/leave`            | candidat       | Rejoindre par code / quitter                   |
| POST          | `/hackathons/:slug/submissions`         | candidat       | Déposer (multipart : zip + métadonnées)        |
| GET           | `/hackathons/:slug/submissions`         | public         | Liste des projets                              |
| GET           | `/submissions/:id`                      | public         | Détail                                         |
| PATCH         | `/submissions/:id`                      | propriétaire   | Modifier les métadonnées                       |
| POST          | `/submissions/:id/archive`              | propriétaire   | Re-déposer une nouvelle version                |
| GET           | `/submissions/:id/tree` · `/file?path=` | public         | Arbre de fichiers, contenu d'un fichier        |
| PUT           | `/submissions/:id/evaluation`           | jury           | Créer / modifier sa note                       |
| GET           | `/hackathons/:slug/leaderboard`         | public*        | Classement (*visible après publication)        |
| POST / GET    | `/hackathons/:slug/announcements`       | admin / public | Annonces                                       |
| GET           | `/hackathons/:slug/events`              | public         | Flux SSE (temps réel)                          |
| GET           | `/hackathons/:slug/export.zip`          | admin          | Export complet                                 |
| POST          | `/hackathons/:slug/kb/sync`             | admin          | Régénérer manifests + README (+ commit)        |
| GET           | `/kb/search?q=&tag=&tech=`              | public         | Recherche dans la base de connaissance         |
| GET           | `/admin/stats`                          | admin          | Statistiques globales                          |

## 12. Front React — pages

| Route                                 | Page                 | Contenu                                                                                                           |
| ------------------------------------- | -------------------- | ----------------------------------------------------------------------------------------------------------------- |
| `/`                                   | Accueil              | Hackathons en cours / à venir / passés, compte à rebours, entrée pseudo (modale)                                  |
| `/hackathons/:slug`                   | Hackathon            | Hero (thème, statut, countdown), onglets : Présentation · Participants & équipes · Projets · Annonces · Résultats |
| `/hackathons/:slug/submit`            | Dépôt                | Zone drag & drop, récapitulatif, formulaire, consentement, progression                                            |
| `/hackathons/:slug/projects/:id`      | Projet               | Pitch, auteurs, technos, README rendu, arbre de fichiers + viewer de code, versions                               |
| `/hackathons/:slug/results`           | Résultats            | Podium, classement, commentaires du jury                                                                          |
| `/jury/:slug`                         | Jury                 | Grille de notation projet par projet                                                                              |
| `/me`                                 | Profil               | Mes hackathons, mes projets, mon équipe, déconnexion                                                              |
| `/kb`                                 | Base de connaissance | Galerie, recherche, stats (technos, participants)                                                                 |
| `/admin`                              | Dashboard            | Vue d'ensemble, activité, raccourcis                                                                              |
| `/admin/hackathons/new` · `/:id/edit` | Formulaire hackathon | Multi-étapes : identité → calendrier → participation → soumission → évaluation                                    |
| `/admin/hackathons/:id`               | Pilotage             | Statut, participants, soumissions, jury, annonces, export                                                         |
| `/admin/users`                        | Utilisateurs         | Liste, libérer un pseudo, rôles                                                                                   |

Exigences UI transverses : responsive (dépôt sur laptop, consultation sur mobile), dark mode, états vides / chargement / erreur sur chaque page, toasts, badges de statut colorés, accessibilité clavier de base.

## 13. Sécurité & robustesse (avec un pseudo seul)

| Risque                         | Réponse                                                                                                                                                                                                                   |
| ------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Usurpation de pseudo           | Token d'appareil lié au pseudo ; politique `device-bound` (recommandée) : un pseudo lié ne peut pas être repris ailleurs sans libération par l'admin. Politique `free` possible pour un hackathon entre gens de confiance |
| Accès admin                    | `ADMIN_KEY` dans `.env`, saisie une fois dans `/admin`, envoyée en header ; middleware `requireAdmin` sur toutes les routes admin                                                                                         |
| Deadline contournée            | Vérifiée **côté serveur** à chaque dépôt, jamais seulement dans l'UI                                                                                                                                                      |
| Zip bomb / zip slip            | Limites : taille du zip, taille décompressée, nombre d'entrées ; chaque chemin extrait doit rester dans le dossier cible                                                                                                  |
| Secrets dans les projets       | `.env*`, clés, credentials filtrés à l'extraction + scan basique (`sk-`, `AKIA`, `-----BEGIN PRIVATE KEY`) → avertissement au candidat                                                                                    |
| Abus                           | Rate limiting sur `/auth/enter` et les uploads, `helmet`, CORS restreint                                                                                                                                                  |
| Corruption BDD                 | Écritures atomiques, sauvegarde quotidienne de `data/` + `storage/`                                                                                                                                                       |
| Litige sur un dépôt            | Journal d'audit : qui, quoi, quand, empreinte SHA-256 de chaque version                                                                                                                                                   |
| Code déposé exécuté par erreur | Le serveur ne fait **que** stocker et lire ; jamais d'exécution du code reçu                                                                                                                                              |

## 14. Points faciles à oublier

- ⏱️ Compte à rebours basé sur `/api/time`, fuseau horaire affiché explicitement sur les dates.
- 📜 **Consentement** de publication + licence (MIT par défaut) : case à cocher au dépôt, stockée avec la soumission — sans ça, pas de base de connaissance publique.
- 📦 Exclusion de `node_modules` & co **côté client avant compression** (sinon 300 Mo d'upload) et côté serveur en filet.
- 🪟 Windows : chemins > 260 caractères, caractères interdits dans les noms issus de zips Linux / Mac.
- 🔁 Re-dépôt : conserver toutes les archives, remplacer `source/`.
- 🗑️ Suppression = archivage ; un numéro n'est jamais réutilisé ; un slug ne change plus après publication.
- 👤 Normalisation des pseudos (`Simon` = `simon`), pseudos réservés (`admin`, `jury`, `system`).
- 🧪 `npm run seed` : données de démo réalistes pour développer et présenter.
- 📡 Hackathon sur place : serveur en réseau local + QR code, doit fonctionner **sans internet** (pas de CDN, pas de service externe obligatoire).
- 🕳️ Un écran vide, un chargement ou une erreur bien traités sur **chaque** page.
- 📝 Qu'est-ce qui se passe si l'admin modifie les dates après ouverture ? → le scheduler recalcule, les participants sont notifiés par annonce automatique.
- 🧭 Un candidat sans équipe alors que les équipes sont obligatoires → dépôt bloqué avec message clair.
- 💾 Le dépôt Git de `storage/` est **séparé** de celui du code de la plateforme.

## 15. Roadmap

| Sprint                      | Objectif                              | Contenu                                                                                                                                                  |
| --------------------------- | ------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **0 — Socle**               | Architecture en place, rien de métier | Monorepo, `shared` (zod), Express + errorHandler + logger, repositories JSON, React + router + design system, session pseudo, seed                       |
| **1 — MVP**                 | Un hackathon de bout en bout          | CRUD hackathon admin (tous les paramètres), liste / détail public, rejoindre, drag & drop → dossier `001`, liste des projets, arbre + README, export ZIP |
| **2 — Vivre le hackathon**  | L'événement se pilote tout seul       | Cycle de vie automatique + countdown, équipes, re-dépôt / versions, annonces + SSE, viewer de code, profil, filtrage des secrets                         |
| **3 — Juger & capitaliser** | Résultats + base de connaissance      | Jury / critères / notes, podium, galerie + recherche + stats, `kb:export` (manifests + README + commit), QR code, dark mode                              |
| **Plus tard**               | Confort                               | Vote public, Q&A / mentors, badges / certificats, sondage de feedback, push GitHub automatique, PWA                                                      |

## 16. Décisions à valider avant de coder

| #   | Décision                  | Recommandation                                                                                                      |
| --- | ------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| 1   | Langage                   | **TypeScript** partout : les schémas zod partagés donnent les types front et back, moins de bugs en plein hackathon |
| 2   | Base de données           | **JSON (lowdb)** + pattern Repository ; SQLite en plan B sans changer le reste                                      |
| 3   | Identité pseudo           | **Token d'appareil + libération par l'admin** (`device-bound`), paramétrable par plateforme                         |
| 4   | Accès admin               | **Clé secrète `ADMIN_KEY`** dans `.env`                                                                             |
| 5   | Équipes                   | **Activables par hackathon** (taille min / max), livrées au sprint 2                                                |
| 6   | Upload                    | **Zip et dossier**, compression côté client avec fflate, limites par hackathon                                      |
| 7   | UI                        | **Tailwind + shadcn/ui** (moderne, accessible, dark mode inclus)                                                    |
| 8   | Emplacement de `storage/` | **Chemin configurable**, dépôt Git séparé de la plateforme                                                          |
| 9   | Nom                       | **HackaMetz** — ou autre chose ?                                                                                    |
