import { suggestCameraId, type Model, type ModelInput, type StreamKind } from '@ugv/shared';
import type { Draft, DraftCamera, FieldErrors } from './ModelEditor.types.ts';

export const STREAM_TITLE: Record<StreamKind, string> = {
  sub: 'Sub (обовʼязковий)',
  main: 'Main',
  third: 'Third',
};

export const STREAM_PLACEHOLDER: Record<StreamKind, string> = {
  sub: "обов'язковий стрім",
  main: 'необовʼязково',
  third: 'необовʼязково',
};

/** Base for generated ids until the camera gets a label. */
const DEFAULT_CAMERA_ID = 'cam';

let keySeq = 0;
const newKey = () => `c${++keySeq}`;

export function emptyCamera(taken: string[]): DraftCamera {
  return {
    key: newKey(),
    id: suggestCameraId(DEFAULT_CAMERA_ID, taken),
    idTouched: false,
    label: '',
    streams: { sub: '', main: '', third: '' },
    transcode: false,
  };
}

export function toDraft(m: Model | null): Draft {
  if (!m) return { name: '', cameras: [emptyCamera([])] };
  return {
    name: m.name,
    cameras: m.cameras.map((c) => ({
      key: newKey(),
      id: c.id,
      idTouched: true,
      label: c.label,
      streams: {
        sub: c.streams.sub,
        main: c.streams.main ?? '',
        third: c.streams.third ?? '',
      },
      transcode: c.transcode,
    })),
  };
}

export function toInput(d: Draft): ModelInput {
  return {
    name: d.name,
    cameras: d.cameras.map((c) => ({
      id: c.id,
      label: c.label,
      streams: {
        sub: c.streams.sub,
        main: c.streams.main,
        third: c.streams.third,
      },
      transcode: c.transcode,
    })),
  };
}

/**
 * Applies a field change; keeps the id in sync with the label until the user
 * edits the id by hand.
 */
export function patchCamera(
  cameras: DraftCamera[],
  key: string,
  patch: Partial<DraftCamera>,
): DraftCamera[] {
  return cameras.map((c) => {
    if (c.key !== key) return c;
    const next = { ...c, ...patch };
    if (patch.label !== undefined && !c.idTouched) {
      next.id = suggestCameraId(
        patch.label || DEFAULT_CAMERA_ID,
        cameras.filter((o) => o.key !== key).map((o) => o.id),
      );
    }
    return next;
  });
}

export function moveCamera(cameras: DraftCamera[], index: number, delta: -1 | 1): DraftCamera[] {
  const j = index + delta;
  if (j < 0 || j >= cameras.length) return cameras;
  const next = [...cameras];
  [next[index], next[j]] = [next[j]!, next[index]!];
  return next;
}

export const issuesToErrors = (issues: { path: PropertyKey[]; message: string }[]): FieldErrors =>
  Object.fromEntries(issues.map((i) => [i.path.map(String).join('.'), i.message]));
