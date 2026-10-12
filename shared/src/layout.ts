import { z } from 'zod';
import { CameraIdSchema } from './model.ts';

/**
 * Grid layout (react-grid-layout compatible): GRID_COLS columns x GRID_ROWS rows,
 * the grid is stretched to fill the viewport. Saved per model in settings.json.
 */
export const GRID_COLS = 12;
export const GRID_ROWS = 12;

export const LayoutItemSchema = z.object({
  i: CameraIdSchema,
  x: z.number().int().min(0),
  y: z.number().int().min(0),
  w: z.number().int().min(1),
  h: z.number().int().min(1),
});
export type LayoutItem = z.infer<typeof LayoutItemSchema>;

export const LayoutSchema = z.array(LayoutItemSchema);
export type Layout = z.infer<typeof LayoutSchema>;

/** Generic auto layout by camera count. First camera = primary (biggest tile). */
export function defaultLayout(cameraIds: readonly string[]): Layout {
  const n = cameraIds.length;
  const C = GRID_COLS;
  const R = GRID_ROWS;
  const at = (k: number, x: number, y: number, w: number, h: number): LayoutItem => ({
    i: cameraIds[k]!,
    x,
    y,
    w,
    h,
  });

  if (n === 0) return [];
  if (n === 1) return [at(0, 0, 0, C, R)];
  if (n === 2) return [at(0, 0, 0, C / 2, R), at(1, C / 2, 0, C / 2, R)];
  if (n === 3) {
    // 1 big + 2 stacked on the right
    return [at(0, 0, 0, 8, R), at(1, 8, 0, 4, R / 2), at(2, 8, R / 2, 4, R / 2)];
  }
  // 4 -> 2x2, 5..6 -> 3x2, 7..9 -> 3x3
  const cols = n <= 4 ? 2 : 3;
  const rows = Math.ceil(n / cols);
  const w = C / cols;
  const h = Math.floor(R / rows);
  return cameraIds.map((_, k) => at(k, (k % cols) * w, Math.floor(k / cols) * h, w, h));
}

/**
 * Reconcile a saved layout with the model's current cameras:
 * drop tiles of removed cameras; if cameras were added, fall back to the default
 * layout (placing new tiles into an arbitrary saved grid is not worth the complexity).
 */
export function reconcileLayout(saved: Layout | undefined, cameraIds: readonly string[]): Layout {
  if (!saved) return defaultLayout(cameraIds);
  const ids = new Set(cameraIds);
  const kept = saved.filter((it) => ids.has(it.i));
  const keptIds = new Set(kept.map((it) => it.i));
  const missing = cameraIds.some((id) => !keptIds.has(id));
  return missing ? defaultLayout(cameraIds) : kept;
}

/** Swap positions/sizes of `cameraId` and the current biggest tile. */
export function makePrimary(layout: Layout, cameraId: string): Layout {
  const target = layout.find((it) => it.i === cameraId);
  if (!target) return layout;
  const biggest = layout.reduce((a, b) => (b.w * b.h > a.w * a.h ? b : a));
  if (biggest.i === cameraId) return layout;
  return layout.map((it) => {
    if (it.i === cameraId) return { ...biggest, i: cameraId };
    if (it.i === biggest.i) return { ...target, i: biggest.i };
    return it;
  });
}
