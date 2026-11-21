// Ending a study session (issue #178). Answers are sent in the background while you study, so the last
// ones can still be on their way when the session ends; and the last answer can end the session twice
// (a second click on Continue, a timer running out). Finishing in this order keeps Home true afterwards:
// every answer saved → the session recorded once → Home's data reloaded, all before the summary shows.

export type FinishSteps<R, S> = {
  /** Resolves when every answer sent so far is saved. */
  saved: () => Promise<unknown>;
  /** Records the session (session.finish). */
  finish: (result: R) => Promise<S>;
  /** Reloads what Home shows (state.get). */
  reload: () => Promise<unknown>;
};

/**
 * A function that finishes a session at most once per session id. It resolves to the server's result
 * (null if recording failed: the summary still shows), or to null when that session was already finished.
 */
export function sessionFinisher<R extends { sessionId: string }, S>(steps: FinishSteps<R, S>) {
  const finished = new Set<string>();
  return async (result: R): Promise<{ server: S | null } | null> => {
    if (finished.has(result.sessionId)) return null;
    finished.add(result.sessionId);
    await steps.saved();
    const server = await steps.finish(result).catch(() => null);
    await steps.reload();
    return { server };
  };
}
