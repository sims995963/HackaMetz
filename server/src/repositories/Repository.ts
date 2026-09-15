export interface Entity {
  id: string;
}

/**
 * Contrat d'accès aux données. Aucune logique métier ici : les services s'en chargent.
 * L'implémentation actuelle est JSON (lowdb) ; une implémentation SQLite respecterait ce même contrat.
 */
export interface Repository<T extends Entity> {
  all(): Promise<T[]>;
  count(): Promise<number>;
  findById(id: string): Promise<T | undefined>;
  findOne(predicate: (item: T) => boolean): Promise<T | undefined>;
  filter(predicate: (item: T) => boolean): Promise<T[]>;
  insert(item: T): Promise<T>;
  /** Applique un patch ou une fonction de transformation ; renvoie l'entité mise à jour. */
  update(id: string, change: Partial<T> | ((current: T) => T)): Promise<T>;
  remove(id: string): Promise<boolean>;
  /** Vide la collection (seed, tests). */
  clear(): Promise<void>;
}
