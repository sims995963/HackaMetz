#!/usr/bin/env bash
# Installe HackaMetz comme service permanent sur une machine Linux (Raspberry Pi, vieux PC, NAS).
#
#   sudo bash deploy/install-linux.sh
#
# Le projet doit être dans /opt/hackametz (sinon, adapte les deux unités systemd de ce dossier).
set -euo pipefail

root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
user="${SUDO_USER:-$USER}"

echo "==> Node"
command -v node >/dev/null || { echo "Node.js manquant : https://nodejs.org"; exit 1; }
node --version

echo "==> Clé d'organisateur"
if [ ! -f "$root/.env" ] || ! grep -qE '^ADMIN_KEY=.{24,}$' "$root/.env"; then
  (cd "$root" && node scripts/admin-key.mjs)
else
  echo "    déjà en place (non affichée)"
fi
chmod 600 "$root/.env"

echo "==> Journal dans un fichier"
grep -q '^LOG_FILE=' "$root/.env" || echo 'LOG_FILE=server/logs/hackametz.log' >> "$root/.env"

echo "==> Dépendances et build"
cd "$root"
npm ci
NODE_ENV=production npm run build

echo "==> Services systemd"
sed "s#/opt/hackametz#$root#g; s#User=hackametz#User=$user#" deploy/hackametz.service \
  | sudo tee /etc/systemd/system/hackametz.service > /dev/null
sed "s#/opt/hackametz#$root#g; s#User=hackametz#User=$user#" deploy/hackametz-backup.service \
  | sudo tee /etc/systemd/system/hackametz-backup.service > /dev/null
sudo cp deploy/hackametz-backup.timer /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable --now hackametz hackametz-backup.timer

sleep 3
echo "==> Contrôle complet"
npm run doctor || true

cat <<'NEXT'

Prochaine étape : exposer le serveur sur Internet.
  cloudflared tunnel --url http://localhost:3001      (aucune inscription, adresse aléatoire)
  tailscale funnel 3001                                (adresse stable, compte gratuit)

Journal du serveur :  journalctl -u hackametz -f
NEXT
