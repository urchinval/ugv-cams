import type { RtspTransport } from '@ugv/shared';
import type { WhepStats } from '../../lib/whep.ts';

export interface StatsOverlayProps {
  /** MediaMTX path, e.g. "front_sub" */
  path: string;
  /** how MediaMTX pulls the camera (set per camera in the model) */
  transport: RtspTransport;
  /** null until the first sample of the current session */
  stats: WhepStats | null;
}
