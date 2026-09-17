/**
 * Vérifie une instance déjà en ligne — la tienne, depuis n'importe quelle machine.
 *
 *   npm run smoke -- https://xxxx.trycloudflare.com
 *   npm run smoke                                     (par défaut : http://localhost:3001)
 *
 * Ne crée rien et ne modifie rien : uniquement des lectures et une requête volontairement
 * invalide, pour s'assurer que la validation répond. Sort en code 1 si un contrôle échoue.
 */
const base = (process.argv[2] ?? 'http://localhost:3001').replace(/\/$/, '');
const results = [];

const ms = (start) => `${Math.round(performance.now() - start)} ms`;

async function check(label, run) {
  const start = performance.now();
  try {
    const detail = await run();
    results.push({ ok: true, label, detail: `${detail} · ${ms(start)}` });
  } catch (error) {
    results.push({ ok: false, label, detail: error.message });
  }
}

const get = async (path, init) => {
  const response = await fetch(`${base}${path}`, { signal: AbortSignal.timeout(10_000), ...init });
  return response;
};

await check('Santé', async () => {
  const response = await get('/api/health');
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  const body = await response.json();
  if (body.status !== 'ok') throw new Error(`statut « ${body.status} »`);
  if (body.diagnostics !== null) throw new Error('les diagnostics fuient sans clé admin');
  return `version ${body.version}, en ligne depuis ${Math.round(body.uptimeSeconds / 60)} min`;
});

await check('Front', async () => {
  const response = await get('/');
  const html = await response.text();
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  if (!html.includes('<div id="root">')) throw new Error('la page ne contient pas l’app');
  if (!/assets\/index-[\w-]+\.js/.test(html)) throw new Error('le build du front n’est pas servi');
  return `${Math.round(html.length / 1024)} Ko`;
});

await check('API publique', async () => {
  const [stats, hackathons] = await Promise.all([get('/api/stats'), get('/api/hackathons')]);
  if (!stats.ok || !hackathons.ok) throw new Error(`HTTP ${stats.status}/${hackathons.status}`);
  const s = await stats.json();
  const h = await hackathons.json();
  return `${h.hackathons.length} édition(s) visible(s), ${s.participants} participant(s)`;
});

await check('Application installable', async () => {
  const [manifest, worker] = await Promise.all([get('/manifest.webmanifest'), get('/sw.js')]);
  if (!manifest.ok) throw new Error(`manifeste HTTP ${manifest.status}`);
  if (!worker.ok) throw new Error(`service worker HTTP ${worker.status}`);
  if ((worker.headers.get('cache-control') ?? '').includes('max-age=3600')) {
    throw new Error('le service worker est mis en cache : une mise à jour resterait bloquée');
  }
  return (await manifest.json()).name;
});

await check('Espace organisateur fermé', async () => {
  const response = await get('/api/admin/stats');
  if (response.status !== 403) throw new Error(`attendu 403, reçu ${response.status}`);
  return 'clé exigée';
});

await check('Validation des entrées', async () => {
  const response = await get('/api/auth/enter', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ pseudo: '!' }),
  });
  if (response.status !== 400) throw new Error(`attendu 400, reçu ${response.status}`);
  return 'pseudo invalide refusé';
});

await check('Temps réel (SSE)', async () => {
  const hackathons = await (await get('/api/hackathons')).json();
  const slug = hackathons.hackathons[0]?.slug;
  if (!slug) return 'aucune édition publiée — contrôle ignoré';
  const controller = new AbortController();
  const response = await fetch(`${base}/api/hackathons/${slug}/events`, {
    headers: { Accept: 'text/event-stream' },
    signal: controller.signal,
  });
  const type = response.headers.get('content-type') ?? '';
  controller.abort();
  if (!type.includes('text/event-stream')) throw new Error(`type « ${type} »`);
  return `flux ouvert sur ${slug}`;
});

console.log(`\nVérification de ${base}\n`);
for (const { ok, label, detail } of results) {
  console.log(`${ok ? '  ok  ' : ' KO   '} ${label.padEnd(26)} ${detail}`);
}
const failed = results.filter((r) => !r.ok).length;
console.log(`\n${results.length - failed}/${results.length} contrôles passés.\n`);
if (failed > 0) process.exitCode = 1;
