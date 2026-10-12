import { z } from 'zod';

/**
 * Camera model ("модель") = one car's camera set, created locally on the laptop.
 * Stored as JSON in %APPDATA%\ugv-cams\models, includes credentials (plaintext, by design).
 */

export const STREAM_KINDS = ['sub', 'main', 'third'] as const;
export const StreamKindSchema = z.enum(STREAM_KINDS);
export type StreamKind = z.infer<typeof StreamKindSchema>;

/** Stream shown on page load / model switch — always sub. */
export const DEFAULT_STREAM: StreamKind = 'sub';

export const MAX_CAMERAS = 9;

const RtspUrlSchema = z
  .string()
  .trim()
  .regex(/^rtsps?:\/\/[^\s]+$/i, 'URL має починатися з rtsp:// і не містити пробілів');

/** Empty string from a form field -> null (stream not configured). */
const OptionalRtspUrlSchema = z.preprocess(
  (v) => (v === '' || v === undefined ? null : v),
  RtspUrlSchema.nullable(),
);

/** Becomes part of MediaMTX path names, so keep it URL/path safe. */
export const CameraIdSchema = z
  .string()
  .trim()
  .regex(/^[a-z0-9][a-z0-9_-]{0,31}$/, 'id: латиниця в нижньому регістрі, цифри, _ або -, до 32 символів');

export const CameraSchema = z.object({
  id: CameraIdSchema,
  label: z.string().trim().min(1, 'Назва камери обовʼязкова').max(40),
  streams: z.object({
    sub: RtspUrlSchema,
    main: OptionalRtspUrlSchema,
    third: OptionalRtspUrlSchema,
  }),
  /** H.265 (or B-frames) -> H.264 via ffmpeg on the laptop, for browser WebRTC. */
  transcode: z.boolean().default(false),
});
export type Camera = z.infer<typeof CameraSchema>;

/** What the editor sends (create / update / import). */
export const ModelInputSchema = z.object({
  name: z.string().trim().min(1, 'Назва моделі обовʼязкова').max(60),
  cameras: z
    .array(CameraSchema)
    .min(1, 'Додайте хоча б одну камеру')
    .max(MAX_CAMERAS, `Максимум ${MAX_CAMERAS} камер`)
    .superRefine((cams, ctx) => {
      const seen = new Set<string>();
      cams.forEach((c, i) => {
        if (seen.has(c.id)) {
          ctx.addIssue({ code: 'custom', path: [i, 'id'], message: `Повторюваний id камери: ${c.id}` });
        }
        seen.add(c.id);
      });
    }),
});
export type ModelInput = z.input<typeof ModelInputSchema>;

export const ModelIdSchema = z.string().regex(/^[a-z0-9-]{1,64}$/);

export const ModelSchema = ModelInputSchema.extend({
  id: ModelIdSchema,
  updatedAt: z.string(),
});
export type Model = z.infer<typeof ModelSchema>;

/** Streams that are actually configured for a camera, in canonical order. */
export function availableStreams(cam: Camera): StreamKind[] {
  return STREAM_KINDS.filter((k) => cam.streams[k] != null);
}

/** Lowercase-latin id suggestion from a label (editor helper). */
export function suggestCameraId(label: string, taken: Iterable<string> = []): string {
  const base =
    label
      .toLowerCase()
      .normalize('NFKD')
      .replace(/[^a-z0-9]+/g, '_')
      .replace(/^_+|_+$/g, '')
      .slice(0, 24) || 'cam';
  const used = new Set(taken);
  if (!used.has(base)) return base;
  for (let n = 2; ; n++) {
    const id = `${base}_${n}`;
    if (!used.has(id)) return id;
  }
}
