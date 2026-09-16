/**
 * Génère une clé d'organisateur solide et l'écrit dans le .env de la racine.
 *
 *   npm run admin-key
 *
 * La clé s'affiche une fois : garde-la dans ton gestionnaire de mots de passe.
 * Elle n'est jamais versionnée (.env est ignoré par Git).
 */
import { randomBytes } from 'node:crypto';
import { copyFileSync, existsSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const envPath = join(root, '.env');

// Alphabet sans caractères ambigus (0/O, 1/l/I) : une clé se relit et se dicte.
const ALPHABET = 'abcdefghijkmnopqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const LENGTH = 40;

function generate() {
  return Array.from(randomBytes(LENGTH))
    .map((byte) => ALPHABET[byte % ALPHABET.length])
    .join('');
}

if (!existsSync(envPath)) {
  copyFileSync(join(root, '.env.example'), envPath);
  console.log('.env créé à partir de .env.example');
}

const key = generate();
const current = readFileSync(envPath, 'utf8');
const next = /^ADMIN_KEY=.*$/m.test(current)
  ? current.replace(/^ADMIN_KEY=.*$/m, `ADMIN_KEY=${key}`)
  : `${current.trimEnd()}\nADMIN_KEY=${key}\n`;
writeFileSync(envPath, next);

console.log('\nNouvelle clé d’organisateur, écrite dans .env :\n');
console.log(`  ${key}\n`);
console.log('Redémarre le serveur, puis colle-la dans « Espace organisateur ».');
console.log('Les sessions admin ouvertes avec l’ancienne clé sont invalides.\n');
