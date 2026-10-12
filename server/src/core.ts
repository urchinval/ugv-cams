import type { Layout, Model } from '@ugv/shared';
import { reconcileLayout } from '@ugv/shared';
import type { AppConfig } from './config.ts';
import { ffmpegCommandToken } from './mtx/ffmpeg.ts';
import { renderMediamtxConfig } from './mtx/render.ts';
import type { MediaMtxSupervisor } from './mtx/supervisor.ts';
import type { ModelStore } from './store/models.ts';
import type { SettingsStore } from './store/settings.ts';
import { createLogger } from './util/log.ts';

const log = createLogger('core');

/**
 * Glue between stores and MediaMTX: whenever the active model (or its content) changes,
 * the yml is re-rendered. Routes call this instead of touching the stores' side effects.
 */
export class Core {
  readonly ffmpegFound: boolean;
  private readonly ffmpegToken: string;

  constructor(
    private readonly cfg: AppConfig,
    readonly models: ModelStore,
    readonly settings: SettingsStore,
    readonly mtx: MediaMtxSupervisor,
  ) {
    const ff = ffmpegCommandToken(cfg.ffmpegBin);
    this.ffmpegToken = ff.token;
    this.ffmpegFound = ff.found;
    if (!ff.found) log.warn(`ffmpeg not bundled (${cfg.ffmpegBin}); transcoded cameras will use "ffmpeg" from PATH`);
  }

  async activeModel(): Promise<Model | null> {
    const id = this.settings.activeModelId;
    if (!id) return null;
    try {
      return await this.models.get(id);
    } catch (err) {
      log.warn(`Active model ${id} is unavailable (${(err as Error).message}), clearing selection`);
      await this.settings.setActiveModelId(null);
      return null;
    }
  }

  /** Re-render mediamtx.yml for whatever is active now. */
  async applyActive(): Promise<Model | null> {
    const model = await this.activeModel();
    const yml = renderMediamtxConfig(model, { ...this.cfg.mtx, ffmpeg: this.ffmpegToken });
    await this.mtx.writeConfig(yml);
    log.info(model ? `MediaMTX config -> "${model.name}" (${model.cameras.length} cameras)` : 'MediaMTX config -> no model');
    return model;
  }

  async selectModel(id: string | null): Promise<Model | null> {
    if (id) await this.models.get(id); // throws NotFoundError
    await this.settings.setActiveModelId(id);
    return this.applyActive();
  }

  async updateModel(id: string, input: unknown): Promise<Model> {
    const model = await this.models.update(id, input);
    if (this.settings.activeModelId === id) await this.applyActive();
    return model;
  }

  async deleteModel(id: string): Promise<void> {
    await this.models.remove(id);
    await this.settings.setLayout(id, null);
    if (this.settings.activeModelId === id) {
      await this.settings.setActiveModelId(null);
      await this.applyActive();
    }
  }

  async getLayout(modelId: string): Promise<Layout> {
    const model = await this.models.get(modelId);
    return reconcileLayout(this.settings.getLayout(modelId), model.cameras.map((c) => c.id));
  }

  async setLayout(modelId: string, layout: Layout | null): Promise<Layout> {
    const model = await this.models.get(modelId);
    const ids = model.cameras.map((c) => c.id);
    if (layout) {
      const unknown = layout.filter((it) => !ids.includes(it.i));
      if (unknown.length) {
        throw Object.assign(new Error(`Unknown camera in layout: ${unknown.map((u) => u.i).join(', ')}`), {
          statusCode: 400,
        });
      }
    }
    await this.settings.setLayout(modelId, layout);
    return reconcileLayout(layout ?? undefined, ids);
  }
}
