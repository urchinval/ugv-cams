import { randomBytes } from 'node:crypto';
import { mkdir, readdir, unlink } from 'node:fs/promises';
import { join } from 'node:path';
import { ModelInputSchema, ModelSchema, type Model, type ModelSummary } from '@ugv/shared';
import { readJson, writeJsonAtomic } from '../util/fs.ts';
import { createLogger } from '../util/log.ts';

const log = createLogger('models');

export class NotFoundError extends Error {}

/**
 * Camera models as one JSON file per model: <modelsDir>/<id>.json.
 * File-per-model keeps manual backup/copy simple and a corrupt file only loses one model.
 */
export class ModelStore {
  constructor(private readonly dir: string) {}

  async init(): Promise<void> {
    await mkdir(this.dir, { recursive: true });
  }

  private file(id: string): string {
    // id is validated by ModelIdSchema ([a-z0-9-]) wherever it comes from user input
    return join(this.dir, `${id}.json`);
  }

  async list(): Promise<ModelSummary[]> {
    const names = (await readdir(this.dir)).filter((f) => f.endsWith('.json'));
    const out: ModelSummary[] = [];
    for (const name of names) {
      try {
        const m = ModelSchema.parse(await readJson(join(this.dir, name)));
        out.push({ id: m.id, name: m.name, cameraCount: m.cameras.length, updatedAt: m.updatedAt });
      } catch (err) {
        log.warn(`Skipping invalid model file ${name}: ${(err as Error).message}`);
      }
    }
    return out.sort((a, b) => a.name.localeCompare(b.name, 'uk'));
  }

  async get(id: string): Promise<Model> {
    const raw = await readJson(this.file(id));
    if (raw === undefined) throw new NotFoundError(`Model ${id} not found`);
    return ModelSchema.parse(raw);
  }

  async exists(id: string): Promise<boolean> {
    return (await readJson(this.file(id))) !== undefined;
  }

  /** Validates `input` (ZodError on failure). */
  async create(input: unknown): Promise<Model> {
    const data = ModelInputSchema.parse(input);
    const model: Model = { id: await this.newId(), ...data, updatedAt: new Date().toISOString() };
    await writeJsonAtomic(this.file(model.id), model);
    log.info(`Created model "${model.name}" (${model.id})`);
    return model;
  }

  async update(id: string, input: unknown): Promise<Model> {
    if (!(await this.exists(id))) throw new NotFoundError(`Model ${id} not found`);
    const data = ModelInputSchema.parse(input);
    const model: Model = { id, ...data, updatedAt: new Date().toISOString() };
    await writeJsonAtomic(this.file(id), model);
    log.info(`Updated model "${model.name}" (${id})`);
    return model;
  }

  async remove(id: string): Promise<void> {
    try {
      await unlink(this.file(id));
      log.info(`Deleted model ${id}`);
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code === 'ENOENT') throw new NotFoundError(`Model ${id} not found`);
      throw err;
    }
  }

  /**
   * Import an exported model file. Always gets a fresh id so importing the same
   * file twice (or onto the laptop it came from) never overwrites an existing model.
   */
  async import(raw: unknown): Promise<Model> {
    const obj = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
    return this.create({ name: obj.name, cameras: obj.cameras });
  }

  private async newId(): Promise<string> {
    for (;;) {
      const id = randomBytes(5).toString('hex');
      if (!(await this.exists(id))) return id;
    }
  }
}
