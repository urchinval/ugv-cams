import { useCallback, useEffect, useRef, useState } from 'react';
import { makePrimary, type Layout, type Model, type ModelSummary, type ServerInfo, type StreamKind } from '@ugv/shared';
import { api } from './api/client.ts';
import { CameraGrid } from './components/CameraGrid.tsx';
import { ModelEditor } from './components/ModelEditor.tsx';
import { ModelPicker } from './components/ModelPicker.tsx';
import { Notice } from './components/Notice.tsx';
import { Toolbar } from './components/Toolbar.tsx';

type EditorState = { open: false } | { open: true; model: Model | null };

const INIT_RETRY_MS = 3000;
const NOTICE_MS = 8000;

export function App() {
  const [info, setInfo] = useState<ServerInfo | null>(null);
  const [fatal, setFatal] = useState<string | null>(null);
  const [models, setModels] = useState<ModelSummary[]>([]);
  const [model, setModel] = useState<Model | null>(null);
  const [layout, setLayout] = useState<Layout>([]);
  /** Not persisted on purpose: every load / model switch starts on sub. */
  const [streams, setStreams] = useState<Record<string, StreamKind>>({});
  const [editing, setEditing] = useState(false);
  const [maximized, setMaximized] = useState<string | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [editor, setEditor] = useState<EditorState>({ open: false });
  const [loaded, setLoaded] = useState(false);
  /** Last failed action (save, switch model, ...), shown over the wall for a few seconds. */
  const [notice, setNotice] = useState<string | null>(null);
  const modelRef = useRef<Model | null>(null);
  modelRef.current = model;

  useEffect(() => {
    if (!notice) return;
    const t = window.setTimeout(() => setNotice(null), NOTICE_MS);
    return () => window.clearTimeout(t);
  }, [notice]);

  const report = useCallback((err: unknown) => setNotice((err as Error).message || String(err)), []);

  const refreshModels = useCallback(async () => setModels(await api.listModels()), []);

  /** Show a model: resets streams to sub, loads its saved (or generic) layout. */
  const showModel = useCallback(async (m: Model | null) => {
    setStreams({});
    setMaximized(null);
    setEditing(false);
    if (m) setLayout((await api.getLayout(m.id)).layout);
    setModel(m);
  }, []);

  // page opened before ugv-cams started (or while it restarts): keep retrying instead of hanging
  useEffect(() => {
    let cancelled = false;
    let timer: number | undefined;
    const init = async () => {
      try {
        const [i, active] = await Promise.all([api.info(), api.getActive(), refreshModels()]);
        if (cancelled) return;
        setInfo(i);
        await showModel(active.model);
        if (!active.model) setPickerOpen(true);
        setFatal(null);
        setLoaded(true);
      } catch (err) {
        if (cancelled) return;
        setFatal((err as Error).message);
        timer = window.setTimeout(() => void init(), INIT_RETRY_MS);
      }
    };
    void init();
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [refreshModels, showModel]);

  const selectModel = async (id: string) => {
    setPickerOpen(false);
    const { model: m } = await api.setActive(id);
    await showModel(m);
  };

  const commitLayout = (l: Layout) => {
    setLayout(l);
    const m = modelRef.current;
    if (m) api.saveLayout(m.id, l).catch((err: Error) => setNotice(`Розкладку не збережено: ${err.message}`));
  };

  const resetLayout = async () => {
    if (!model) return;
    setLayout((await api.saveLayout(model.id, null)).layout);
  };

  const toggleFullscreen = () => {
    if (document.fullscreenElement) void document.exitFullscreen();
    else void document.documentElement.requestFullscreen().catch(() => {});
  };

  const onSaved = async (saved: Model) => {
    setEditor({ open: false });
    await refreshModels();
    if (model?.id === saved.id) {
      // the backend already re-rendered MediaMTX; reload layout in case cameras changed
      await showModel(saved);
    } else if (!model) {
      await selectModel(saved.id);
    } else {
      setPickerOpen(true);
    }
  };

  const onDeleted = async (id: string) => {
    setEditor({ open: false });
    await refreshModels();
    if (model?.id === id) await showModel(null);
    setPickerOpen(true);
  };

  const webrtcBase = info ? `${location.protocol}//${location.hostname}:${info.webrtcPort}` : '';

  if (fatal) {
    return (
      <main className="empty">
        <h1>Немає звʼязку з програмою</h1>
        <p>{fatal}</p>
        <p className="muted">Повторюю спробу автоматично…</p>
        <button type="button" className="btn btn-accent" onClick={() => location.reload()}>
          Спробувати ще раз
        </button>
      </main>
    );
  }

  return (
    <div className="app">
      <Toolbar
        model={model}
        editing={editing}
        onPickModel={() => setPickerOpen(true)}
        onToggleEditing={() => setEditing((e) => !e)}
        onResetLayout={() => resetLayout().catch(report)}
        onFullscreen={toggleFullscreen}
      />

      {model && info ? (
        <CameraGrid
          model={model}
          layout={layout}
          streams={streams}
          webrtcBase={webrtcBase}
          editing={editing}
          maximized={maximized}
          onLayoutChange={setLayout}
          onLayoutCommit={commitLayout}
          onStreamChange={(id, s) => setStreams((prev) => ({ ...prev, [id]: s }))}
          onMakePrimary={(id) => commitLayout(makePrimary(layout, id))}
          onToggleMax={(id) => setMaximized((cur) => (cur === id ? null : id))}
        />
      ) : (
        loaded && (
          <main className="empty">
            <h1>{models.length ? 'Оберіть модель машини' : 'Створіть першу модель'}</h1>
            <p>
              {models.length
                ? 'Модель визначає, які камери показувати. Оберіть ту, що відповідає машині в роботі.'
                : 'Модель описує камери однієї машини: назви та RTSP-адреси потоків.'}
            </p>
            <button
              type="button"
              className="btn btn-accent"
              onClick={() => (models.length ? setPickerOpen(true) : setEditor({ open: true, model: null }))}
            >
              {models.length ? 'Обрати модель' : 'Нова модель'}
            </button>
          </main>
        )
      )}

      {notice && (
        <Notice key={notice} text={notice} onDismiss={() => setNotice(null)} />
      )}

      <ModelPicker
        open={pickerOpen}
        models={models}
        activeId={model?.id ?? null}
        onClose={() => setPickerOpen(false)}
        onSelect={(id) => selectModel(id).catch(report)}
        onEdit={(id) =>
          api
            .getModel(id)
            .then((m) => {
              setPickerOpen(false);
              setEditor({ open: true, model: m });
            })
            .catch(report)
        }
        onCreate={() => {
          setPickerOpen(false);
          setEditor({ open: true, model: null });
        }}
        onImported={() => refreshModels().catch(report)}
      />

      <ModelEditor
        open={editor.open}
        model={editor.open ? editor.model : null}
        rtspPort={info?.rtspPort ?? 8554}
        onClose={() => setEditor({ open: false })}
        onSaved={(m) => onSaved(m).catch(report)}
        onDeleted={(id) => onDeleted(id).catch(report)}
      />
    </div>
  );
}
