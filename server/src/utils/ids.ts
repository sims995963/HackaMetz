import { nanoid } from 'nanoid';

/** Identifiant court, sûr pour les URLs. */
export const newId = () => nanoid(12);
