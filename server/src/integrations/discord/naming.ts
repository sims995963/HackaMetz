import { slugify } from '../../utils/slugify';

/** Discord borne les noms à 100 caractères ; un salon texte n'accepte que des minuscules, tirets et underscores. */
const MAX_NAME = 100;

export function textChannelName(base: string): string {
  const slug = slugify(base) || 'salon';
  return slug.slice(0, MAX_NAME - 10);
}

export function voiceChannelName(name: string): string {
  return `🔊 ${name}`.slice(0, MAX_NAME);
}

export function categoryName(code: string, title: string, index = 1): string {
  const suffix = index > 1 ? ` · Équipes ${index}` : '';
  return `#${code} · ${title}`.slice(0, MAX_NAME - suffix.length) + suffix;
}

export function roleName(code: string, teamSlug: string): string {
  return `${code}-${teamSlug}`.slice(0, MAX_NAME);
}
