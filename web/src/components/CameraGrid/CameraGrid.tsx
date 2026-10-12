import { useEffect, useMemo } from 'react';
import { GridLayout, verticalCompactor, type Layout as RglLayout } from 'react-grid-layout';
import { absoluteStrategy } from 'react-grid-layout/core';
import { DEFAULT_STREAM, GRID_COLS, GRID_ROWS, type Layout } from '@ugv/shared';
import { useElementSize } from '../../hooks/useElementSize.ts';
import { CameraTile } from '../CameraTile/CameraTile.tsx';
import type { CameraGridProps } from './CameraGrid.types.ts';

const GAP = 6;

const toLayout = (l: RglLayout): Layout => l.map(({ i, x, y, w, h }) => ({ i, x, y, w, h }));

/**
 * Fixed GRID_COLS x GRID_ROWS grid stretched over the viewport: row height is derived
 * from the container height so tiles always fill the screen without scrolling.
 * absoluteStrategy (top/left instead of transform) lets a maximized tile use position:fixed.
 */
export function CameraGrid(p: CameraGridProps) {
  const { ref, width, height } = useElementSize<HTMLDivElement>();
  const rowHeight = Math.max(8, (height - GAP * (GRID_ROWS + 1)) / GRID_ROWS);

  const biggest = useMemo(
    () =>
      p.layout.reduce<Layout[number] | null>((a, b) => (!a || b.w * b.h > a.w * a.h ? b : a), null)
        ?.i,
    [p.layout],
  );

  useEffect(() => {
    if (!p.maximized) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') p.onToggleMax(p.maximized!);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [p.maximized, p.onToggleMax]);

  return (
    <div
      ref={ref}
      className={`grid-host${p.editing ? ' is-editing' : ''}${p.maximized ? ' has-max' : ''}`}
    >
      {width > 0 && height > 0 && (
        <GridLayout
          width={width}
          layout={p.layout}
          gridConfig={{
            cols: GRID_COLS,
            rowHeight,
            margin: [GAP, GAP],
            containerPadding: [GAP, GAP],
            maxRows: GRID_ROWS,
          }}
          dragConfig={{
            enabled: p.editing && !p.maximized,
            cancel: '.tile-controls',
            threshold: 4,
          }}
          resizeConfig={{
            enabled: p.editing && !p.maximized,
            handles: ['se', 'sw', 'ne', 'nw', 'e', 'w', 's', 'n'],
          }}
          compactor={verticalCompactor}
          positionStrategy={absoluteStrategy}
          autoSize={false}
          onLayoutChange={(l) => p.onLayoutChange(toLayout(l))}
          onDragStop={(l) => p.onLayoutCommit(toLayout(l))}
          onResizeStop={(l) => p.onLayoutCommit(toLayout(l))}
        >
          {p.model.cameras.map((cam) => (
            <div key={cam.id} className="grid-cell">
              <CameraTile
                camera={cam}
                stream={p.streams[cam.id] ?? DEFAULT_STREAM}
                webrtcBase={p.webrtcBase}
                isPrimary={cam.id === biggest}
                maximized={p.maximized === cam.id}
                editing={p.editing}
                debug={p.debug}
                onStreamChange={(s) => p.onStreamChange(cam.id, s)}
                onMakePrimary={() => p.onMakePrimary(cam.id)}
                onToggleMax={() => p.onToggleMax(cam.id)}
              />
            </div>
          ))}
        </GridLayout>
      )}
    </div>
  );
}
