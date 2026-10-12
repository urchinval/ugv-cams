import { useEffect, useMemo, useState } from 'react';
import { MAX_CAMERAS, ModelInputSchema, type StreamKind } from '@ugv/shared';
import { api, ApiRequestError } from '../../api/client.ts';
import { Dialog } from '../Dialog/Dialog.tsx';
import { CameraCard } from './CameraCard.tsx';
import { emptyCamera, issuesToErrors, moveCamera, patchCamera, toDraft, toInput } from './draft.ts';
import type { Draft, DraftCamera, FieldErrors, ModelEditorProps } from './ModelEditor.types.ts';

/** Create / edit / delete / export a model. Validates locally first, then on the server. */
export function ModelEditor(p: ModelEditorProps) {
  const [draft, setDraft] = useState<Draft>(() => toDraft(p.model));
  const [errors, setErrors] = useState<FieldErrors>({});
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

  const takenIds = useMemo(() => draft.cameras.map((c) => c.id), [draft.cameras]);

  const setCameras = (fn: (cams: DraftCamera[]) => DraftCamera[]) =>
    setDraft((d) => ({ ...d, cameras: fn(d.cameras) }));

  const updateCamera = (key: string, patch: Partial<DraftCamera>) =>
    setCameras((cams) => patchCamera(cams, key, patch));

  const setStream = (key: string, kind: StreamKind, value: string) =>
    setCameras((cams) =>
      cams.map((c) => (c.key === key ? { ...c, streams: { ...c.streams, [kind]: value } } : c)),
    );

  const save = async () => {
    setFormError(null);
    const input = toInput(draft);
    const local = ModelInputSchema.safeParse(input);
    if (!local.success) {
      setErrors(issuesToErrors(local.error.issues));
      setFormError('Виправте позначені поля');
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

  return (
    <Dialog
      open={p.open}
      wide
      title={p.model ? 'Редагування моделі' : 'Нова модель'}
      onClose={p.onClose}
      footer={
        <>
          {p.model && (
            <>
              <button
                type="button"
                className={`btn ${confirmDelete ? 'btn-danger' : 'btn-ghost'}`}
                onClick={remove}
              >
                {confirmDelete ? 'Так, видалити модель' : 'Видалити модель'}
              </button>
              <a className="btn btn-ghost" href={api.exportUrl(p.model.id)} download>
                Експортувати у файл
              </a>
            </>
          )}
          <span className="spacer" />
          <button type="button" className="btn btn-ghost" onClick={p.onClose}>
            Скасувати
          </button>
          <button type="button" className="btn btn-accent" disabled={saving} onClick={save}>
            {saving ? 'Збереження…' : 'Зберегти'}
          </button>
        </>
      }
    >
      <div className="editor">
        <label className="field">
          <span className="field-label">Назва моделі</span>
          <input
            className={errors.name ? 'has-error' : undefined}
            value={draft.name}
            autoFocus
            onChange={(e) => setDraft((d) => ({ ...d, name: e.target.value }))}
          />
          {errors.name && <span className="field-error">{errors.name}</span>}
        </label>

        {errors.cameras && <p className="form-error">{errors.cameras}</p>}

        <ol className="cam-list">
          {draft.cameras.map((c, idx) => (
            <CameraCard
              key={c.key}
              camera={c}
              index={idx}
              count={draft.cameras.length}
              errors={errors}
              rtspPort={p.rtspPort}
              onChange={(patch) => updateCamera(c.key, patch)}
              onStreamChange={(kind, value) => setStream(c.key, kind, value)}
              onMove={(delta) => setCameras((cams) => moveCamera(cams, idx, delta))}
              onRemove={() => setCameras((cams) => cams.filter((o) => o.key !== c.key))}
            />
          ))}
        </ol>

        <button
          type="button"
          className="btn btn-ghost"
          disabled={draft.cameras.length >= MAX_CAMERAS}
          onClick={() => setCameras((cams) => [...cams, emptyCamera(takenIds)])}
        >
          Додати камеру
        </button>

        {formError && <p className="form-error">{formError}</p>}
      </div>
    </Dialog>
  );
}
