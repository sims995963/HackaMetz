import { copyFileSync, existsSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { Low } from 'lowdb';
import { JSONFile } from 'lowdb/node';
import type { z } from 'zod';
import { logger } from '../utils/logger';
import type { Entity, Repository } from './Repository';

interface Collection<T> {
  items: T[];
}

/**
 * Repository JSON : un fichier par collection (`<dataDir>/<name>.json`).
 * lowdb garde la collection en mémoire et écrit le fichier de façon atomique
 * (fichier temporaire puis renommage), les écritures étant sérialisées.
 *
 * À l'ouverture, chaque enregistrement est validé par son schéma zod. Un fichier
 * édité à la main ou tronqué par une coupure ne fait plus tomber le serveur :
 * l'original est mis de côté dans `_quarantaine/`, les enregistrements valides
 * continuent de vivre, et le problème est journalisé.
 */
export class JsonRepository<T extends Entity> implements Repository<T> {
  private db: Promise<Low<Collection<T>>> | undefined;

  constructor(
    private readonly dataDir: string,
    private readonly name: string,
    private readonly schema?: z.ZodType<T>,
  ) {}

  private get filePath(): string {
    return join(this.dataDir, `${this.name}.json`);
  }

  /** Copie le fichier d'origine avant toute réécriture, pour pouvoir revenir en arrière. */
  private quarantine(): void {
    try {
      if (!existsSync(this.filePath)) return;
      const dir = join(this.dataDir, '_quarantaine');
      mkdirSync(dir, { recursive: true });
      const stamp = new Date().toISOString().replace(/[:.]/g, '-');
      copyFileSync(this.filePath, join(dir, `${this.name}-${stamp}.json`));
    } catch (error) {
      logger.error({ collection: this.name, error }, 'copie de quarantaine impossible');
    }
  }

  private validate(db: Low<Collection<T>>): void {
    if (!this.schema) return;
    const items = Array.isArray(db.data?.items) ? db.data.items : [];
    const valid: T[] = [];
    const rejected: unknown[] = [];
    for (const item of items) {
      const parsed = this.schema.safeParse(item);
      if (parsed.success) valid.push(parsed.data);
      else rejected.push(item);
    }
    if (rejected.length === 0 && Array.isArray(db.data?.items)) return;

    this.quarantine();
    logger.error(
      { collection: this.name, rejected: rejected.length, kept: valid.length },
      'enregistrements invalides écartés — copie dans data/_quarantaine',
    );
    db.data = { items: valid };
  }

  private open(): Promise<Low<Collection<T>>> {
    if (!this.db) {
      mkdirSync(this.dataDir, { recursive: true });
      // Adaptateur explicite plutôt que JSONFilePreset : celui-ci bascule en mémoire
      // dès que NODE_ENV vaut « test », et les tests ne vérifieraient alors rien du disque.
      const db = new Low<Collection<T>>(new JSONFile<Collection<T>>(this.filePath), { items: [] });
      this.db = db.read().then(() => {
        this.validate(db);
        return db;
      });
    }
    return this.db;
  }

  async all(): Promise<T[]> {
    const db = await this.open();
    return [...db.data.items];
  }

  async count(): Promise<number> {
    const db = await this.open();
    return db.data.items.length;
  }

  async findById(id: string): Promise<T | undefined> {
    const db = await this.open();
    return db.data.items.find((item) => item.id === id);
  }

  async findOne(predicate: (item: T) => boolean): Promise<T | undefined> {
    const db = await this.open();
    return db.data.items.find(predicate);
  }

  async filter(predicate: (item: T) => boolean): Promise<T[]> {
    const db = await this.open();
    return db.data.items.filter(predicate);
  }

  async insert(item: T): Promise<T> {
    const db = await this.open();
    if (db.data.items.some((existing) => existing.id === item.id)) {
      throw new Error(`${this.name}: un élément avec l'id ${item.id} existe déjà`);
    }
    await db.update(({ items }) => {
      items.push(item);
    });
    return item;
  }

  async update(id: string, change: Partial<T> | ((current: T) => T)): Promise<T> {
    const db = await this.open();
    const index = db.data.items.findIndex((item) => item.id === id);
    if (index === -1) throw new Error(`${this.name}: id ${id} introuvable`);
    const current = db.data.items[index] as T;
    const next = typeof change === 'function' ? change(current) : { ...current, ...change };
    await db.update(({ items }) => {
      items[index] = next;
    });
    return next;
  }

  async remove(id: string): Promise<boolean> {
    const db = await this.open();
    const index = db.data.items.findIndex((item) => item.id === id);
    if (index === -1) return false;
    await db.update(({ items }) => {
      items.splice(index, 1);
    });
    return true;
  }

  async clear(): Promise<void> {
    const db = await this.open();
    await db.update((data) => {
      data.items = [];
    });
  }
}
