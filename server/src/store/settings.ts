import { z } from 'zod';
import { LayoutSchema, ModelIdSchema, type Layout } from '@ugv/shared';
import { readJson, writeJsonAtomic } from '../util/fs.ts';
import { createLogger } from '../util/log.ts';

const log = createLogger('settings');

/**
 * Local operator state. Deliberately NOT stored: selected stream per tile —
 * every page load / model switch starts on sub.
 */
const SettingsSchema = z.object({
  activeModelId: ModelIdSchema.nullable().default(null),
  layouts: z.record(z.string(), LayoutSchema).default({}),
});
type Settings = z.infer<typeof SettingsSchema>;

export class SettingsStore {
  private data: Settings = { activeModelId: null, layouts: {} };
  private writing: Promise<void> = Promise.resolve();

  constructor(private readonly file: string) {}

  async init(): Promise<void> {
    try {
      const raw = await readJson(this.file);
      if (raw !== undefined) this.data = SettingsSchema.parse(raw);
    } catch (err) {
      log.warn(`settings.json is invalid, starting with defaults: ${(err as Error).message}`);
    }
  }

  get activeModelId(): string | null {
    return this.data.activeModelId;
  }

  async setActiveModelId(id: string | null): Promise<void> {
    this.data.activeModelId = id;
    await this.save();
  }

  getLayout(modelId: string): Layout | undefined {
    return this.data.layouts[modelId];
  }

  async setLayout(modelId: string, layout: Layout | null): Promise<void> {
    if (layout) this.data.layouts[modelId] = layout;
    else delete this.data.layouts[modelId];
    await this.save();
  }

  /** Serialize writes — layout saves can arrive in quick succession while dragging. */
  private save(): Promise<void> {
    const snapshot = structuredClone(this.data);
    this.writing = this.writing
      .then(() => writeJsonAtomic(this.file, snapshot))
      .catch((err) => {
        log.error(`Failed to save settings: ${(err as Error).message}`);
      });
    return this.writing;
  }
}
