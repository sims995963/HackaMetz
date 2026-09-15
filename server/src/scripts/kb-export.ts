/**
 * Régénère les README et manifests de la base de connaissance (STORAGE_PATH),
 * et crée un commit Git avec `--commit`.
 *
 *   npm run kb:export            # README + manifests
 *   npm run kb:export -- --commit
 */
import { env, paths } from '../config/env';
import { createContext } from '../context';

const ctx = createContext({
  dataDir: paths.dataDir,
  storageDir: paths.storageDir,
  adminKey: env.ADMIN_KEY,
  pseudoPolicy: env.PSEUDO_POLICY,
});

ctx.services.kb
  .export({ commit: process.argv.includes('--commit') })
  .then((result) => {
    console.log(
      `${result.hackathons} hackathons, ${result.projects} projets, ${result.readmes} README régénérés dans ${paths.storageDir}`,
    );
    if (result.committed) console.log(`Commit : ${result.commitMessage}`);
    else if (result.gitError) console.log(`Git : ${result.gitError}`);
    else console.log('Pas de commit demandé (ajoute --commit).');
  })
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
