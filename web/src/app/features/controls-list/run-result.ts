import { LastRun } from '../../core/api/api.types';

/** What the list says of a control's last run: on its row, and aloud when a run from the list ends. */
export type RunResult = 'never' | 'violations' | 'none' | 'stopped' | 'running';

/** The colours a status has, the same wherever it is shown: red, green and amber. Grey is the lack of one. */
export type StatusTone = 'violations' | 'clean' | 'stopped';

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

/** The colour of a result; a control that never ran, or whose run is on its way, has none. */
export function toneOf(result: RunResult): StatusTone | null {
  switch (result) {
    case 'violations':
      return 'violations';
    case 'none':
      return 'clean';
    case 'stopped':
      return 'stopped';
    default:
      return null;
  }
}
