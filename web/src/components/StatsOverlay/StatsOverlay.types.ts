import type { WhepStats } from '../../lib/whep.ts';

export interface StatsOverlayProps {
  /** MediaMTX path, e.g. "front_sub" */
  path: string;
  /** null until the first sample of the current session */
  stats: WhepStats | null;
}
