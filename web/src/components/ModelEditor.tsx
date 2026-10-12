import { useEffect, useMemo, useState } from "react";
import {
  CameraIdSchema,
  MAX_CAMERAS,
  ModelInputSchema,
  playPath,
  STREAM_KINDS,
  suggestCameraId,
  type Model,
  type ModelInput,
  type StreamKind,
} from "@ugv/shared";
import { api, ApiRequestError } from "../api/client.ts";
import { Dialog } from "./Dialog.tsx";
import { ProbeButton } from "./ProbeButton.tsx";
import { IconDown, IconTrash, IconUp } from "./icons.tsx";

interface DraftCamera {
  key: string;
  id: string;
  idTouched: boolean;
  label: string;
  streams: Record<StreamKind, string>;
  transcode: boolean;
}

interface Draft {
  name: string;
  cameras: DraftCamera[];
}

interface Props {
  open: boolean;
  /** null = new model */
  model: Model | null;
  rtspPort: number;
  onClose: () => void;
  onSaved: (m: Model) => void;
  onDeleted: (id: string) => void;
}

const STREAM_TITLE: Record<StreamKind, string> = {
  sub: "Sub (обовʼязковий)",
  main: "Main",
  third: "Third",
};
const STREAM_PLACEHOLDER: Record<StreamKind, string> = {
  sub: "Обов'язковий стрім",
  main: "необовʼязково",
  third: "необовʼязково",
};

let keySeq = 0;
const newKey = () => `c${++keySeq}`;

function emptyCamera(taken: string[]): DraftCamera {
  return {
    key: newKey(),
    id: suggestCameraId("cam", taken),
    idTouched: false,
    label: "",
    streams: { sub: "", main: "", third: "" },
    transcode: false,
  };
}

function toDraft(m: Model | null): Draft {
  if (!m) return { name: "", cameras: [emptyCamera([])] };
  return {
    name: m.name,
    cameras: m.cameras.map((c) => ({
      key: newKey(),
      id: c.id,
      idTouched: true,
      label: c.label,
      streams: {
        sub: c.streams.sub,
        main: c.streams.main ?? "",
        third: c.streams.third ?? "",
      },
      transcode: c.transcode,
    })),
  };
}

function toInput(d: Draft): ModelInput {
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

type Errors = Record<string, string>;
const issuesToErrors = (
  issues: { path: PropertyKey[]; message: string }[],
): Errors =>
  Object.fromEntries(
    issues.map((i) => [i.path.map(String).join("."), i.message]),
  );

export function ModelEditor(p: Props) {
  const [draft, setDraft] = useState<Draft>(() => toDraft(p.model));
  const [errors, setErrors] = useState<Errors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  useEffect(() => {
    if (!p.open) return;
    setDraft(toDraft(p.model));
    setErrors({});
    setFormError(null);
    setConfirmDelete(false);
  }, [p.open, p.model]);

  const takenIds = useMemo(
    () => draft.cameras.map((c) => c.id),
    [draft.cameras],
  );

  const updateCamera = (key: string, patch: Partial<DraftCamera>) =>
    setDraft((d) => ({
      ...d,
      cameras: d.cameras.map((c) => {
        if (c.key !== key) return c;
        const next = { ...c, ...patch };
        // keep id in sync with the label until the user edits the id by hand
        if (patch.label !== undefined && !c.idTouched) {
          next.id = suggestCameraId(
            patch.label || "cam",
            d.cameras.filter((o) => o.key !== key).map((o) => o.id),
          );
        }
        return next;
      }),
    }));

  const setStream = (key: string, kind: StreamKind, value: string) =>
    setDraft((d) => ({
      ...d,
      cameras: d.cameras.map((c) =>
        c.key === key ? { ...c, streams: { ...c.streams, [kind]: value } } : c,
      ),
    }));

  const move = (idx: number, delta: -1 | 1) =>
    setDraft((d) => {
      const cams = [...d.cameras];
      const j = idx + delta;
      if (j < 0 || j >= cams.length) return d;
      [cams[idx], cams[j]] = [cams[j]!, cams[idx]!];
      return { ...d, cameras: cams };
    });

  const save = async () => {
    setFormError(null);
    const input = toInput(draft);
    const local = ModelInputSchema.safeParse(input);
    if (!local.success) {
      setErrors(issuesToErrors(local.error.issues));
      setFormError("Виправте позначені поля");
      return;
    }
    setErrors({});
    setSaving(true);
    try {
      const saved = p.model
        ? await api.updateModel(p.model.id, input)
        : await api.createModel(input);
      p.onSaved(saved);
    } catch (err) {
      if (err instanceof ApiRequestError && err.issues.length)
        setErrors(issuesToErrors(err.issues));
      setFormError((err as Error).message);
    } finally {
      setSaving(false);
    }
  };

  const remove = async () => {
    if (!p.model) return;
    if (!confirmDelete) {
      setConfirmDelete(true);
      return;
    }
    try {
      await api.deleteModel(p.model.id);
      p.onDeleted(p.model.id);
    } catch (err) {
      setFormError((err as Error).message);
    }
  };

  const err = (path: string) => errors[path];

  return (
    <Dialog
      open={p.open}
      wide
      title={p.model ? "Редагування моделі" : "Нова модель"}
      onClose={p.onClose}
      footer={
        <>
          {p.model && (
            <>
              <button
                type="button"
                className={`btn ${confirmDelete ? "btn-danger" : "btn-ghost"}`}
                onClick={remove}
              >
                {confirmDelete ? "Так, видалити модель" : "Видалити модель"}
              </button>
              <a
                className="btn btn-ghost"
                href={api.exportUrl(p.model.id)}
                download
              >
                Експортувати у файл
              </a>
            </>
          )}
          <span className="spacer" />
          <button type="button" className="btn btn-ghost" onClick={p.onClose}>
            Скасувати
          </button>
          <button
            type="button"
            className="btn btn-accent"
            disabled={saving}
            onClick={save}
          >
            {saving ? "Збереження…" : "Зберегти"}
          </button>
        </>
      }
    >
      <div className="editor">
        <label className="field">
          <span className="field-label">Назва моделі</span>
          <input
            className={err("name") ? "has-error" : undefined}
            value={draft.name}
            autoFocus
            onChange={(e) => setDraft((d) => ({ ...d, name: e.target.value }))}
          />
          {err("name") && <span className="field-error">{err("name")}</span>}
        </label>

        {err("cameras") && <p className="form-error">{err("cameras")}</p>}

        <ol className="cam-list">
          {draft.cameras.map((c, idx) => (
            <li key={c.key} className="cam-card">
              <div className="cam-head">
                <span className="cam-index" aria-hidden="true">
                  {idx + 1}
                </span>
                <label className="field cam-label">
                  <span className="field-label">Назва камери</span>
                  <input
                    className={
                      err(`cameras.${idx}.label`) ? "has-error" : undefined
                    }
                    value={c.label}
                    placeholder="Камера"
                    onChange={(e) =>
                      updateCamera(c.key, { label: e.target.value })
                    }
                  />
                  {err(`cameras.${idx}.label`) && (
                    <span className="field-error">
                      {err(`cameras.${idx}.label`)}
                    </span>
                  )}
                </label>
                <label className="field cam-id">
                  <span className="field-label">ID</span>
                  <input
                    className={
                      err(`cameras.${idx}.id`) ? "has-error" : undefined
                    }
                    value={c.id}
                    spellCheck={false}
                    onChange={(e) =>
                      updateCamera(c.key, {
                        id: e.target.value.toLowerCase(),
                        idTouched: true,
                      })
                    }
                  />
                  {err(`cameras.${idx}.id`) && (
                    <span className="field-error">
                      {err(`cameras.${idx}.id`)}
                    </span>
                  )}
                </label>
                <div className="cam-order">
                  <button
                    type="button"
                    className="icon-btn"
                    title="Вище"
                    disabled={idx === 0}
                    onClick={() => move(idx, -1)}
                  >
                    <IconUp />
                  </button>
                  <button
                    type="button"
                    className="icon-btn"
                    title="Нижче"
                    disabled={idx === draft.cameras.length - 1}
                    onClick={() => move(idx, 1)}
                  >
                    <IconDown />
                  </button>
                  <button
                    type="button"
                    className="icon-btn"
                    title="Видалити камеру"
                    disabled={draft.cameras.length === 1}
                    onClick={() =>
                      setDraft((d) => ({
                        ...d,
                        cameras: d.cameras.filter((o) => o.key !== c.key),
                      }))
                    }
                  >
                    <IconTrash />
                  </button>
                </div>
              </div>

              {STREAM_KINDS.map((kind) => {
                const path = `cameras.${idx}.streams.${kind}`;
                return (
                  <div key={kind} className="field stream-field">
                    <label className="field-label" htmlFor={`${c.key}-${kind}`}>
                      {STREAM_TITLE[kind]}
                    </label>
                    <div className="stream-row">
                      <input
                        id={`${c.key}-${kind}`}
                        className={`mono${err(path) ? " has-error" : ""}`}
                        value={c.streams[kind]}
                        placeholder={STREAM_PLACEHOLDER[kind]}
                        spellCheck={false}
                        autoComplete="off"
                        onChange={(e) => setStream(c.key, kind, e.target.value)}
                      />
                      <ProbeButton
                        url={c.streams[kind]}
                        transcode={c.transcode}
                        onEnableTranscode={() =>
                          updateCamera(c.key, { transcode: true })
                        }
                      />
                    </div>
                    {err(path) && (
                      <span className="field-error">{err(path)}</span>
                    )}
                  </div>
                );
              })}

              <label className="check">
                <input
                  type="checkbox"
                  checked={c.transcode}
                  onChange={(e) =>
                    updateCamera(c.key, { transcode: e.target.checked })
                  }
                />
                <span>
                  Транскодувати в H.264 на ноуті (для камер з H.265). Потрібен
                  ffmpeg і додає 100–200 мс затримки.
                </span>
              </label>

              <QgcHint camera={c} rtspPort={p.rtspPort} />
            </li>
          ))}
        </ol>

        <button
          type="button"
          className="btn btn-ghost"
          disabled={draft.cameras.length >= MAX_CAMERAS}
          onClick={() =>
            setDraft((d) => ({
              ...d,
              cameras: [...d.cameras, emptyCamera(takenIds)],
            }))
          }
        >
          Додати камеру
        </button>

        {formError && <p className="form-error">{formError}</p>}
      </div>
    </Dialog>
  );
}

/**
 * Where QGC finds this camera: MediaMTX re-streams every configured stream locally.
 * Built from the draft, so it follows the id and URL fields while typing.
 */
function QgcHint({ camera, rtspPort }: { camera: DraftCamera; rtspPort: number }) {
  if (!CameraIdSchema.safeParse(camera.id).success) return null;
  const kinds = STREAM_KINDS.filter((k) => camera.streams[k].trim());
  if (!kinds.length) return null;
  return (
    <div className="qgc-hint">
      <span className="qgc-hint-label">У QGC:</span>
      {kinds.map((k) => (
        <code key={k}>{`rtsp://127.0.0.1:${rtspPort}/${playPath(camera.id.trim(), k)}`}</code>
      ))}
    </div>
  );
}
