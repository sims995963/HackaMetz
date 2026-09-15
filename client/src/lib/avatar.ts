/** Avatar déterministe : couleur dérivée de la graine, initiales du pseudo. */
const HUES = [212, 262, 330, 14, 32, 152, 190, 96];

export function avatarColor(seed: string): string {
  let hash = 0;
  for (const char of seed) hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
  const hue = HUES[hash % HUES.length] ?? 212;
  return `hsl(${hue} 70% 45%)`;
}

export function initials(pseudo: string): string {
  const parts = pseudo.split(/[_-]+/).filter(Boolean);
  const letters = parts.length >= 2 ? parts.slice(0, 2).map((p) => p[0]) : [pseudo.slice(0, 2)];
  return letters.join('').toUpperCase();
}
