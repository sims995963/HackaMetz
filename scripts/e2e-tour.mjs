/**
 * Parcours de l'app en Chromium headless : captures d'écran dans scripts/shots/ et
 * relevé des erreurs console / JS / HTTP. Outil de vérification, pas un test bloquant.
 *
 *   npm run build
 *   npm i -D --no-save playwright && npx playwright install chromium
 *   node scripts/e2e-tour.mjs
 */
import { spawn } from 'node:child_process';
import { mkdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const here = dirname(fileURLToPath(import.meta.url));

const PORT = 3994;
const BASE = `http://localhost:${PORT}`;
// La clé vient du .env de la racine : elle n'est plus écrite en dur nulle part.
const ADMIN_KEY =
  process.env.ADMIN_KEY ??
  (/^ADMIN_KEY=(.*)$/m.exec(readFileSync(join(here, '..', '.env'), 'utf8'))?.[1] ?? '').trim();
const OUT = join(here, 'shots') + '/';
mkdirSync(OUT, { recursive: true });

const server = spawn('node', ['dist/server.js'], {
  cwd: join(here, '..', 'server'),
  // Politique « free » pour pouvoir entrer avec un pseudo du seed (alice) sans clé d'appareil.
  env: { ...process.env, PORT: String(PORT), PSEUDO_POLICY: 'free' },
  stdio: 'ignore',
});

async function waitForServer() {
  for (let i = 0; i < 40; i++) {
    try {
      const r = await fetch(`${BASE}/api/health`);
      if (r.ok) return;
    } catch {
      // serveur pas encore prêt
    }
    await new Promise((r) => setTimeout(r, 300));
  }
  throw new Error('serveur injoignable');
}

const problems = [];
let browser;
const wide = { width: 1360, height: 900 };
const phone = { width: 400, height: 860 };

async function shot(page, name, { full = true } = {}) {
  await page.waitForTimeout(400);
  await page.screenshot({ path: `${OUT}${name}.png`, fullPage: full });
  console.log('shot', name);
}

async function main() {
  await waitForServer();
  browser = await chromium.launch();
  const context = await browser.newContext({ viewport: wide, locale: 'fr-FR' });
  const page = await context.newPage();
  page.on('console', (msg) => {
    if (msg.type() === 'error' || msg.type() === 'warning')
      problems.push(`[console.${msg.type()}] ${page.url()} :: ${msg.text()}`);
  });
  page.on('pageerror', (err) => problems.push(`[pageerror] ${page.url()} :: ${err.message}`));
  page.on('response', (res) => {
    if (res.status() >= 400 && !res.url().includes('/api/me'))
      problems.push(`[http ${res.status()}] ${res.url()}`);
  });

  await page.goto(`${BASE}/`);
  await page.waitForSelector('h1');
  await shot(page, '01-landing');

  // Palette de commandes : ⌘K / Ctrl+K puis recherche globale.
  await page.keyboard.press('Control+k');
  await page.waitForTimeout(300);
  await page.getByPlaceholder('Chercher une édition').fill('metro');
  await page.waitForTimeout(800);
  await shot(page, '01b-palette', { full: false });
  await page.keyboard.press('Escape');
  await page.waitForTimeout(300);

  await page.goto(`${BASE}/hackathons`);
  await page.waitForSelector('h1');
  await shot(page, '02-hackathons');

  await page.goto(`${BASE}/hackathons/ville-durable`);
  await page.waitForSelector('h1');
  await shot(page, '03-hackathon-about');

  // Entrer avec un pseudo (nouveau) via le bouton de la sidebar
  await page
    .getByRole('button', { name: /Entrer avec un pseudo/ })
    .first()
    .click();
  await page.getByPlaceholder('ex. simon_dev').fill(`e2e_${Date.now().toString(36).slice(-6)}`);
  await page.getByRole('dialog').getByRole('button', { name: /^Entrer$/ }).click();
  await page.waitForTimeout(600);
  await shot(page, '04-after-enter', { full: false });

  // Rejoindre
  await page
    .getByRole('button', { name: /Rejoindre/ })
    .first()
    .click();
  await page.getByRole('checkbox').first().check();
  await page.getByRole('button', { name: /Je participe/ }).click();
  await page.waitForTimeout(800);
  await page.getByRole('tab', { name: /Participants/ }).click();
  await page.waitForTimeout(600);
  await shot(page, '05-participants-teams');

  await page.getByRole('tab', { name: /Annonces/ }).click();
  await page.waitForTimeout(500);
  await shot(page, '06-announcements');

  await page.getByRole('tab', { name: /Questions/ }).click();
  await page.waitForTimeout(500);
  await page.getByLabel('Ta question').fill('Peut-on venir avec son propre matériel réseau ?');
  await page.getByRole('button', { name: /Envoyer/ }).click();
  await page.waitForTimeout(800);
  await shot(page, '06b-questions');

  await page.getByRole('tab', { name: /Projets/ }).click();
  await page.waitForTimeout(500);
  await shot(page, '07-projects');

  await page
    .getByRole('link', { name: /Métro léger/ })
    .first()
    .click();
  await page.waitForSelector('h1');
  await page.waitForTimeout(1200);
  await shot(page, '08-project');
  await page.getByRole('button', { name: /notebook.py/ }).click();
  await page.waitForTimeout(800);
  await shot(page, '09-project-code');

  await page.goto(`${BASE}/hackathons/ville-durable/submit`);
  await page.waitForSelector('h1');
  await shot(page, '10-submit');

  await page.goto(`${BASE}/me`);
  await page.waitForSelector('h1');
  await shot(page, '11-profile');

  // Alice a un palmarès (podium 001, coup de cœur, équipe) : profil, certificat, retours.
  await page.evaluate(() => localStorage.clear());
  await page.goto(`${BASE}/`);
  await page
    .getByRole('button', { name: /Entrer avec un pseudo/ })
    .first()
    .click();
  await page.getByPlaceholder('ex. simon_dev').fill('alice');
  await page.getByRole('dialog').getByRole('button', { name: /^Entrer$/ }).click();
  await page.waitForTimeout(600);
  await page.goto(`${BASE}/me`);
  await page.waitForSelector('h1');
  await page.waitForTimeout(600);
  await shot(page, '11b-profile-alice');
  await page.goto(`${BASE}/me/certificat/ia-pour-l-education`);
  await page.waitForSelector('h1');
  await page.waitForTimeout(600);
  await shot(page, '11c-certificate');
  await page.goto(`${BASE}/hackathons/ia-pour-l-education`);
  await page.waitForSelector('h1');
  await page.waitForTimeout(800);
  await shot(page, '11d-feedback');

  await page.goto(`${BASE}/kb`);
  await page.waitForSelector('h1');
  await page.waitForTimeout(800);
  await shot(page, '12-kb');

  await page.goto(`${BASE}/hackathons/ia-pour-l-education/results`);
  await page.waitForSelector('h1');
  await page.waitForTimeout(800);
  await shot(page, '13-results');

  // Admin
  await page.goto(`${BASE}/admin`);
  await page.getByPlaceholder('ADMIN_KEY').fill(ADMIN_KEY);
  await page.getByRole('button', { name: /Déverrouiller/ }).click();
  await page.waitForTimeout(1200);
  await shot(page, '14-admin-dashboard');

  await page.goto(`${BASE}/admin/hackathons/ville-durable/edit`);
  await page.waitForSelector('h1');
  await page.waitForTimeout(800);
  await shot(page, '15-admin-form');

  await page.goto(`${BASE}/admin/hackathons/new?from=ville-durable`);
  await page.waitForSelector('h1');
  await page.waitForTimeout(500);
  await shot(page, '15b-duplicate');

  await page.goto(`${BASE}/hackathons/ville-durable/ecran`);
  await page.waitForSelector('h1');
  await page.waitForTimeout(900);
  await shot(page, '15c-ecran', { full: false });

  await page.goto(`${BASE}/jury/ville-durable`);
  await page.waitForSelector('h1');
  await page.waitForTimeout(800);
  await shot(page, '16-jury');

  // Dark + mobile
  await page.emulateMedia({ colorScheme: 'dark' });
  await page.goto(`${BASE}/`);
  if (await page.getByRole('button', { name: /Thème sombre/ }).count()) {
    await page.getByRole('button', { name: /Thème sombre/ }).click();
  }
  await page.waitForTimeout(400);
  await shot(page, '17-landing-dark');
  await page.goto(`${BASE}/hackathons/ville-durable`);
  await page.waitForSelector('h1');
  await shot(page, '18-hackathon-dark');

  await page.setViewportSize(phone);
  await page.goto(`${BASE}/`);
  await page.waitForSelector('h1');
  await shot(page, '19-landing-mobile');
  await page.getByRole('button', { name: /Ouvrir le menu/ }).click();
  await page.waitForTimeout(400);
  await shot(page, '20-mobile-menu', { full: false });
  await page.keyboard.press('Escape');
  await page.goto(`${BASE}/hackathons/ville-durable`);
  await page.waitForSelector('h1');
  await shot(page, '21-hackathon-mobile');

  await browser.close();
  console.log('\n--- problèmes ---');
  const unique = [...new Set(problems)];
  if (unique.length === 0) console.log('aucun');
  for (const p of unique) console.log(p);
}

main()
  .catch((err) => {
    console.error('ÉCHEC', err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await browser?.close().catch(() => undefined);
    server.kill();
  });
