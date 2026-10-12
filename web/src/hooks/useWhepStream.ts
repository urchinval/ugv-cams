import { useEffect, useRef, useState } from 'react';
import { WhepReader, type WhepState } from '../lib/whep.ts';

export interface WhepStatus {
  state: WhepState;
  detail?: string;
}

const HANDOVER_TIMEOUT_MS = 10_000;

/**
 * Plays a WHEP URL. When the URL changes (stream switch, reconnect) the previous reader keeps
 * showing its picture until the new one actually plays, so switching sub -> main does not
 * flash black. The old reader is dropped as soon as the new one is up, or after 10 s.
 */
export function useWhepStream(url: string | null) {
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [status, setStatus] = useState<WhepStatus>({ state: 'connecting' });
  const prev = useRef<{ reader: WhepReader; timer: number } | null>(null);

  const dropPrev = () => {
    if (!prev.current) return;
    window.clearTimeout(prev.current.timer);
    prev.current.reader.close();
    prev.current = null;
  };

  useEffect(() => {
    if (!url) return;
    let current = true;
    let candidate: MediaStream | null = null;

    const reader = new WhepReader(url, {
      onTrack: (s) => {
        candidate = s;
      },
      onState: (state, detail) => {
        if (!current) return;
        if (state === 'playing') {
          if (candidate) setStream(candidate);
          dropPrev();
        }
        setStatus({ state, detail });
      },
    });

    return () => {
      current = false;
      dropPrev();
      const timer = window.setTimeout(() => {
        if (prev.current?.reader === reader) dropPrev();
      }, HANDOVER_TIMEOUT_MS);
      prev.current = { reader, timer };
    };
  }, [url]);

  // unmount: nothing left to hand over to
  useEffect(() => () => dropPrev(), []);

  return { stream, status };
}
