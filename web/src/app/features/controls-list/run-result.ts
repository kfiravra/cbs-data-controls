import { LastRun } from '../../core/api/api.types';

/** What the list says of a control's last run: on its row, and aloud when a run from the list ends. */
export type RunResult = 'never' | 'violations' | 'none' | 'stopped' | 'running';

export function resultOf(run: LastRun | null): RunResult {
  if (!run) {
    return 'never';
  }
  if (run.status === 'running') {
    return 'running';
  }
  if (run.status !== 'succeeded') {
    return 'stopped';
  }
  return run.totalCount === 0 ? 'none' : 'violations';
}
