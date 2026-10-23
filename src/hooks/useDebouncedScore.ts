import { useEffect, useMemo, useRef, useState } from "react";
import {
  buildScorePayload,
  scorePreview,
  type ContentDraft,
  type ScoreCheck,
} from "../lib/api";

export type ScoreState = {
  score: number | null;
  checks: ScoreCheck[];
  /** A request is in flight (or one is queued behind the debounce). */
  loading: boolean;
  error: string | null;
  /** Nothing worth scoring has been typed yet. */
  idle: boolean;
};

const IDLE: ScoreState = {
  score: null,
  checks: [],
  loading: false,
  error: null,
  idle: true,
};

/**
 * Scores a draft as it changes, without saving.
 *
 * Three things this has to get right:
 *  - Wait for a pause in typing. One of the checks queries the database for
 *    focus-keyword uniqueness, so a request per keystroke would hammer it.
 *  - Only react to fields the score actually depends on. Editing the category
 *    or short description can't change the score, so it shouldn't re-request.
 *  - Discard stale replies. On a slow connection an older request can land
 *    after a newer one and overwrite a fresh score with an out-of-date one.
 */
export function useDebouncedScore(draft: ContentDraft, delay = 800): ScoreState {
  const [state, setState] = useState<ScoreState>(IDLE);

  // Only the fields the scorer reads — this is what we watch for changes.
  const key = useMemo(() => JSON.stringify(buildScorePayload(draft)), [draft]);

  // Latest draft, read at fire time so the effect doesn't need `draft` as a dep.
  const draftRef = useRef(draft);
  draftRef.current = draft;

  // Monotonic id: a reply is only applied if it belongs to the newest request.
  const latestRequest = useRef(0);

  const worthScoring =
    draft.content.trim().length > 0 || draft.title.trim().length > 0;

  useEffect(() => {
    if (!worthScoring) {
      latestRequest.current++; // invalidate anything in flight
      setState(IDLE);
      return;
    }

    setState((s) => ({ ...s, loading: true }));

    const controller = new AbortController();
    const timer = setTimeout(() => {
      const id = ++latestRequest.current;

      scorePreview(draftRef.current, controller.signal)
        .then((res) => {
          if (id !== latestRequest.current) return; // superseded
          setState({
            score: res.score,
            checks: res.checks,
            loading: false,
            error: null,
            idle: false,
          });
        })
        .catch((e: unknown) => {
          if (controller.signal.aborted) return; // we cancelled it on purpose
          if (id !== latestRequest.current) return;
          setState((s) => ({
            ...s,
            loading: false,
            error:
              e instanceof Error ? e.message : "Couldn't reach the scorer.",
          }));
        });
    }, delay);

    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [key, delay, worthScoring]);

  return state;
}
