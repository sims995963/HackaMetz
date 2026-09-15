import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { JSONFilePreset } from 'lowdb/node';
import type { Low } from 'lowdb';
import type { Entity, Repository } from './Repository';

interface Collection<T> {
  items: T[];
}

/**
 * Repository JSON : un fichier par collection (`<dataDir>/<name>.json`).
 * lowdb garde la collection en mémoire et écrit le fichier de façon atomique
 * (fichier temporaire puis renommage), les écritures étant sérialisées.
 */
export class JsonRepository<T extends Entity> implements Repository<T> {
  private db: Promise<Low<Collection<T>>> | undefined;

  constructor(
    private readonly dataDir: string,
    private readonly name: string,
  ) {}

  private open(): Promise<Low<Collection<T>>> {
    if (!this.db) {
      mkdirSync(this.dataDir, { recursive: true });
      this.db = JSONFilePreset<Collection<T>>(join(this.dataDir, `${this.name}.json`), {
        items: [],
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
