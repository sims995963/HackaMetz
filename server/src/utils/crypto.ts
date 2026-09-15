import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';

/** Token d'appareil : 32 octets aléatoires, encodés pour tenir dans un header. */
export const newDeviceToken = () => randomBytes(32).toString('base64url');

/** On ne stocke que l'empreinte des tokens, jamais le token lui-même. */
export const hashToken = (token: string) => createHash('sha256').update(token).digest('hex');

/** Comparaison en temps constant (clé admin). */
export function safeEqual(a: string, b: string): boolean {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) return false;
  return timingSafeEqual(bufA, bufB);
}
