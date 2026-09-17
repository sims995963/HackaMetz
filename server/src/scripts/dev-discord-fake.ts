/**
 * Démarre l'API avec un Discord simulé en mémoire, pour voir l'interface du pont sans bot :
 * carte « Discord de l'équipe », case d'archivage au dépôt, état dans le tableau de bord.
 *
 *   npx tsx src/scripts/dev-discord-fake.ts        (depuis server/, données temporaires)
 */
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createApp } from '../app';
import { env } from '../config/env';
import { createContext } from '../context';
import { DiscordBridge } from '../integrations/discord/discord.bridge';
import { startLifecycleJob } from '../jobs/lifecycle.job';
import { FakeDiscordGateway } from '../../tests/fakes/discord.gateway';

const root = mkdtempSync(join(tmpdir(), 'hackametz-discord-'));
const ctx = createContext({
  dataDir: join(root, 'data'),
  storageDir: join(root, 'storage'),
  adminKey: env.ADMIN_KEY,
  pseudoPolicy: 'free',
});

const gateway = new FakeDiscordGateway();
const bridge = new DiscordBridge(ctx.repos, ctx.storage, gateway, {
  inviteUrl: 'https://discord.gg/exemple',
  graceHours: 48,
});
await bridge.start();
ctx.hooks.attach(bridge);

const app = createApp(ctx);
startLifecycleJob(ctx);
app.listen(env.PORT, () => {
  console.log(`API avec Discord simulé sur http://localhost:${env.PORT} — données dans ${root}`);
});
