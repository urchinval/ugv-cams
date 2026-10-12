import { useRef, useState } from 'react';
import { MODEL_FILE_EXT } from '@ugv/shared';
import { api, ApiRequestError } from '../../api/client.ts';
import { Dialog } from '../Dialog/Dialog.tsx';
import type { ModelPickerProps } from './ModelPicker.types.ts';

const cameraWord = (n: number) => {
  const m10 = n % 10;
  const m100 = n % 100;
  if (m10 === 1 && m100 !== 11) return 'камера';
  if (m10 >= 2 && m10 <= 4 && (m100 < 12 || m100 > 14)) return 'камери';
  return 'камер';
};

export function ModelPicker(p: ModelPickerProps) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [importError, setImportError] = useState<string | null>(null);

  const onFile = async (file: File | undefined) => {
    if (!file) return;
    setImportError(null);
    try {
      const raw = JSON.parse(await file.text());
      const model = await api.importModel(raw);
      p.onImported(model.id);
    } catch (err) {
      setImportError(
        err instanceof SyntaxError
          ? 'Файл не є моделлю камер (некоректний JSON)'
          : err instanceof ApiRequestError && err.issues.length
            ? `Файл не підходить: ${err.issues[0]!.message}`
            : (err as Error).message,
      );
    } finally {
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  return (
    <Dialog
      open={p.open}
      title="Модель НРК"
      onClose={p.onClose}
      footer={
        <>
          <button type="button" className="btn btn-ghost" onClick={() => fileRef.current?.click()}>
            Імпортувати з файлу
          </button>
          <button type="button" className="btn btn-accent" onClick={p.onCreate}>
            Нова модель
          </button>
          <input
            ref={fileRef}
            type="file"
            accept={`${MODEL_FILE_EXT},.json,application/json`}
            hidden
            onChange={(e) => void onFile(e.target.files?.[0])}
          />
        </>
      }
    >
      {importError && <p className="form-error">{importError}</p>}

      {p.models.length === 0 ? (
        <p className="muted">
          На цьому пристрої ще немає моделей. Створіть нову або імпортуйте файл.
        </p>
      ) : (
        <ul className="model-list">
          {p.models.map((m) => (
            <li key={m.id} className={m.id === p.activeId ? 'is-active' : undefined}>
              <button
                type="button"
                className="model-pick"
                aria-current={m.id === p.activeId}
                onClick={() => p.onSelect(m.id)}
              >
                <span className="model-name">{m.name}</span>
                <span className="model-meta">
                  {m.cameraCount} {cameraWord(m.cameraCount)}
                </span>
              </button>
              <button
                type="button"
                className="btn btn-ghost btn-small"
                onClick={() => p.onEdit(m.id)}
              >
                Редагувати
              </button>
            </li>
          ))}
        </ul>
      )}
    </Dialog>
  );
}
