/* ------------------------------------------------------------------ */
/*  Status → suggested percent.                                        */
/*                                                                     */
/*  The STATUS is the primary progress indicator; the percent adds     */
/*  precision. Selecting a status auto-fills its typical percent so    */
/*  providers never have to invent a number — and they can still       */
/*  adjust it when reality differs ("Finalizing — 72% complete").      */
/*  Shared by the composers (auto-fill) and the server (fills a        */
/*  missing percent with the same defaults). Isomorphic on purpose     */
/*  so tests can assert the exact mapping.                             */
/* ------------------------------------------------------------------ */

export const DEFAULT_PERCENT_BY_STATUS: Record<string, number> = {
  not_started: 0,
  preparing: 15,
  in_progress: 40,
  waiting_on_client: 50,
  revision: 60, // rework sits between waiting (50) and finalizing (80)
  finalizing: 80,
  ready_for_review: 90,
  completed: 100,
};

export function defaultPercentFor(status: string): number | null {
  return status in DEFAULT_PERCENT_BY_STATUS ? DEFAULT_PERCENT_BY_STATUS[status] : null;
}
