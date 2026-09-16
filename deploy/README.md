# Mettre HackaMetz en ligne

Objectif : l'app tourne en permanence sur une machine allumée chez toi, accessible depuis Internet,
sans que ton PC de travail soit allumé. Compter **15 minutes**.

Le principe : la machine héberge le serveur (port 3001), un **tunnel** lui donne une adresse
publique en HTTPS. Aucun port à ouvrir sur la box, aucun nom de domaine à acheter.

```
participants  ──HTTPS──▶  tunnel (Cloudflare / Tailscale)  ──▶  machine allumée : HackaMetz :3001
                                                                  server/data      (base JSON)
                                                                  server/storage   (projets déposés)
                                                                  server/backups   (copies horodatées)
```

---

## 1. Installer le serveur sur la machine

Il faut **Node.js 22** (https://nodejs.org, version LTS) et le dépôt du projet.

### Windows (PC ou mini-PC laissé allumé)

Dans un PowerShell **administrateur**, à la racine du projet :

```powershell
powershell -ExecutionPolicy Bypass -File deploy\install-windows.ps1
```

Le script installe les dépendances, construit l'app, génère une clé d'organisateur si besoin, puis
crée deux tâches planifiées qui tournent **en tant que SYSTEM, dès le démarrage, session fermée** :

| Tâche                  | Rôle                                               |
| ---------------------- | -------------------------------------------------- |
| `HackaMetz`            | le serveur ; relancé automatiquement s'il s'arrête |
| `HackaMetz-Sauvegarde` | `npm run backup` toutes les deux heures            |

Pense à désactiver la mise en veille : **Paramètres → Système → Alimentation → Veille : jamais**.

### Linux (Raspberry Pi, vieux PC, NAS)

```bash
sudo bash deploy/install-linux.sh
```

Deux unités systemd (`hackametz.service`, `hackametz-backup.timer`) sont installées et activées.
Journal : `journalctl -u hackametz -f`.

### Docker (alternative Linux)

```bash
ADMIN_KEY=<ta-clé> docker compose up -d --build
```

Les données vivent dans deux volumes nommés, l'image reste jetable. _(Non testé sur cette machine :
Docker n'y est pas installé — si tu pars sur cette option, vérifie le premier démarrage.)_

**Vérifier dans tous les cas :** `curl http://localhost:3001/api/health` doit répondre `{"status":"ok"…}`.

---

## 2. Donner une adresse publique

### Option A — Cloudflare Tunnel, sans compte (le plus rapide)

```powershell
powershell -ExecutionPolicy Bypass -File deploy\tunnel-windows.ps1
```

```bash
cloudflared tunnel --url http://localhost:3001     # Linux / macOS
```

Une adresse `https://xxxx-yyyy.trycloudflare.com` s'affiche (le script Windows l'écrit aussi dans
`deploy/url-publique.txt` et en imprime le QR code).

⚠️ **Cette adresse change à chaque relance du tunnel.** Laisse la fenêtre ouverte pendant tout
l'événement. Si le tunnel tombe, relance-le et rediffuse la nouvelle adresse (le mode écran affiche
un QR code, pratique pour la reprojeter).

**Taille des dépôts** : Cloudflare limite le corps d'une requête à 100 Mo sur ses offres gratuites.
Garde la taille maximale de dépôt sous ~90 Mo dans le formulaire du hackathon (ou passe par
Tailscale Funnel, qui n'a pas cette limite).

### Option B — Tailscale Funnel, adresse stable (recommandé si tu recommences)

Compte gratuit, pas de domaine à acheter, l'adresse ne change plus :

```bash
tailscale up                 # une fois, connecte la machine à ton compte
tailscale funnel 3001        # publie le port sur https://<machine>.<ton-tailnet>.ts.net
tailscale funnel status      # rappelle l'adresse
```

Sur Windows, installe Tailscale puis lance les mêmes commandes dans PowerShell. L'adresse survit aux
redémarrages : c'est celle à imprimer sur les affiches.

### Option C — Tunnel nommé Cloudflare (le jour où tu as un nom de domaine)

`cloudflared tunnel create hackametz`, puis une route DNS vers `hackathon.tondomaine.fr`. C'est la
solution définitive, mais elle suppose un domaine géré par Cloudflare.

---

## 3. Préparer l'édition

1. Ouvre l'adresse publique, puis `/admin`.
2. Colle ta **clé d'organisateur** (celle du `.env` de la machine — `npm run admin-key` en génère une
   nouvelle si tu l'as perdue ; les sessions admin ouvertes avec l'ancienne deviennent invalides).
3. **Nouveau hackathon** : titre, thème, horaires (début / deadline de dépôt / fin), lieu, taille
   d'équipe, critères pondérés, prix. Enregistre — il est créé en **brouillon**, invisible.
4. Quand tout est bon : **Publier** (les inscriptions ouvrent), puis **Lancer** à l'heure du kickoff
   (les dépôts ouvrent). Le planificateur fait aussi ces bascules tout seul aux dates prévues.
5. Partage l'adresse + le QR code. Les participants entrent avec un pseudo, sans mot de passe.

Pour repartir d'une base vierge avant l'événement (efface **tout**, y compris les projets déposés) :

```bash
npm run reset
```

---

## 4. Sauvegardes

Automatiques toutes les deux heures (tâche Windows ou timer systemd). À la main :

```bash
npm run backup                 # copie horodatée dans server/backups/
npm run backup -- --every 30   # boucle toutes les 30 min, à lancer pendant l'événement
npm run backup -- --to D:/cle  # vers une clé USB ou un disque externe
```

**Restaurer** : arrêter le serveur, remplacer `server/data` et `server/storage` par les dossiers de
la sauvegarde choisie, relancer.

Le dashboard affiche l'espace disque restant et l'âge de la dernière sauvegarde ; au-delà de six
heures, il le signale. **Fais une vraie restauration à blanc une fois avant le jour J.**

---

## 5. Pendant l'événement

| Besoin                     | Où                                                                  |
| -------------------------- | ------------------------------------------------------------------- |
| Écran à projeter           | menu ⋯ du hackathon → **Mode écran**, ou `/hackathons/<slug>/ecran` |
| QR code à montrer          | menu ⋯ → **QR code**, ou `npm run qr -- <adresse publique>`         |
| Annonce à tous             | onglet **Annonces** (arrive en direct chez les participants)        |
| Questions des participants | onglet **Questions** ; le dashboard signale celles sans réponse     |
| Suivi                      | dashboard : activité en direct, santé du serveur, journal           |
| Exports                    | dashboard → **Exporter** (participants, projets, classement)        |

---

## 6. Si ça coince

| Symptôme                               | Piste                                                                                                     |
| -------------------------------------- | --------------------------------------------------------------------------------------------------------- |
| Rien sur `localhost:3001`              | Windows : `Get-ScheduledTask HackaMetz` puis `Start-ScheduledTask` — Linux : `systemctl status hackametz` |
| « ADMIN_KEY est une valeur d'exemple » | `npm run admin-key`, puis relancer le service                                                             |
| Le tunnel a coupé                      | relancer la commande ; l'adresse change (option A), rediffuser le QR code                                 |
| Dépôt refusé « secrets détectés »      | mode strict activé pour cette édition : le participant retire la clé et redépose                          |
| Dépôt trop gros                        | augmenter la taille max dans le formulaire du hackathon (≤ 90 Mo derrière Cloudflare)                     |
| Disque plein                           | `npm run backup -- --keep 3` puis supprimer les vieilles sauvegardes                                      |
| Un pseudo bloqué sur un autre appareil | dashboard → **Pseudos** → _Libérer_ (politique `device-bound`)                                            |

---

## 7. Ce qui protège l'app une fois publique

- Clé d'organisateur obligatoire, longue, jamais versionnée ; le serveur refuse de démarrer sur une
  valeur d'exemple et freine les mauvaises tentatives (20 par 10 minutes).
- Limites de débit sur les inscriptions, dépôts, votes et questions.
- Dépôts filtrés à l'extraction : zip slip, liens symboliques, `.env`, `node_modules`, taille et
  nombre de fichiers, scan de secrets.
- Journal de toutes les actions d'organisateur (dashboard).
- Validation des fichiers JSON à la lecture : un fichier abîmé est mis en quarantaine, le serveur
  continue de tourner.
