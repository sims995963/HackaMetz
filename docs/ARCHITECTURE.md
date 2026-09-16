# Conventions internes

Ce qu'il faut savoir avant de toucher au code — le README couvre l'usage, ce fichier couvre les
règles maison. Le cadrage complet est dans [ANALYSE.md](ANALYSE.md).

## Découpage

```
shared/   schémas zod + constantes   ← la source de vérité des types, importée des deux côtés
server/   Express : routes → contrôleurs → services → repositories → storage
client/   React : pages → composants → hooks → api
```

Une règle par couche, et elles ne se chevauchent jamais :

| Couche            | A le droit de…                                              | N'a jamais le droit de…                |
| ----------------- | ----------------------------------------------------------- | -------------------------------------- |
| **routes/**       | déclarer des chemins, brancher gardes et limiteurs          | contenir de la logique                 |
| **controllers/**  | valider l'entrée (zod), appeler un service, répondre        | toucher au disque, aux fichiers JSON   |
| **services/**     | porter la logique métier, orchestrer plusieurs repositories | connaître `req`, `res`, les codes HTTP |
| **repositories/** | lire et écrire une collection                               | contenir une règle métier              |
| **storage/**      | manipuler `storage/hackathons/…`                            | connaître les repositories             |

Les erreurs métier passent par `AppError` (`server/src/utils/errors.ts`) ; le middleware
`errorHandler` les transforme en `{ error: { code, message, details? } }`. Un service ne renvoie
jamais un code HTTP à la main.

## Ajouter une fonctionnalité de bout en bout

1. **Schéma** dans `shared/src/schemas/<nom>.schema.ts`, exporté depuis `shared/src/index.ts`.
   Les types viennent de `z.infer` : aucune interface dupliquée.
2. **Repository** si c'est une nouvelle collection : une ligne dans `server/src/repositories/index.ts`
   avec son schéma (il est validé à l'ouverture du fichier).
3. **Service** dans `server/src/services/`, injecté dans `server/src/context.ts`.
4. **Contrôleur** puis **route** ; les routes qui écrivent prennent `writeRateLimit`, les dépôts
   `uploadRateLimit`, l'espace organisateur `requireAdmin`.
5. **Test** dans `server/tests/` — un fichier par domaine, un scénario réaliste plutôt que des
   cas unitaires isolés.
6. **Client** : `api/<nom>.api.ts` (avec le schéma de réponse), `hooks/use<Nom>.ts` (TanStack Query),
   puis la page ou le composant.

## Données

- Une collection = un fichier JSON dans `server/data/`, écrit de façon atomique par lowdb.
- **Ne pas utiliser `JSONFilePreset`** : il bascule sur un adaptateur en mémoire quand
  `NODE_ENV=test`, et les tests ne vérifient alors plus rien du disque. `JsonRepository` construit
  son adaptateur explicitement.
- À l'ouverture, chaque enregistrement est validé ; les invalides sont écartés et le fichier
  d'origine est copié dans `server/data/_quarantaine/`.
- Les projets déposés vivent dans `server/storage/hackathons/NNN-slug/projects/NN-auteur/`
  (`source/`, `archives/vN.zip`, `project.json`). C'est un dépôt Git distinct de celui du code.

## Sécurité

- La clé d'organisateur arrive dans `X-Admin-Key`. Elle n'est **jamais** écrite en dur : le serveur
  refuse de démarrer sur une valeur d'exemple (`npm run admin-key` en génère une).
- Toute requête d'organisateur qui modifie quelque chose est tracée (`middlewares/audit.ts`).
- Les dépôts sont filtrés à l'extraction : zip slip, liens symboliques, `.env`, `node_modules`,
  limites de taille et de nombre de fichiers, scan de secrets.

## Commandes

```bash
npm run dev            # serveur + client en parallèle
npm test               # vitest côté serveur
npm run typecheck      # tsc sur les trois paquets
npm run lint           # eslint
npm run format:check   # prettier (ce que la CI vérifie)
npm run seed -- --reset
npm run backup -- --every 30
npm run admin-key
node scripts/e2e-tour.mjs   # parcours navigateur, captures dans scripts/shots/
```

## Front

- Tokens de design dans `client/src/styles/globals.css` (`@theme inline`), jamais de couleur en dur
  hors bannières d'édition (qui utilisent `coverColor`).
- Composants génériques dans `components/ui/`, spécifiques dans `components/<domaine>/`.
- Les pages lourdes (viewer de code, formulaires admin, certificat, mode écran) sont chargées en
  `lazy()` depuis `client/src/router/index.tsx`.
- Les états vides passent par `EmptyState`, les chargements par `Skeleton` : pas de bloc gris nu.
