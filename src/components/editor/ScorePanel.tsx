import type { ScoreCheck } from "../../lib/api";
import { BAND_TEXT, CHECK_DOT, scoreBand } from "../../lib/score";
import type { ScoreState } from "../../hooks/useDebouncedScore";

function CheckRow({ check }: { check: ScoreCheck }) {
  return (
    <li className="flex gap-2.5 py-2">
      <span
        className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${CHECK_DOT[check.status]}`}
        aria-hidden
      />
      <div className="min-w-0">
        <p className="text-sm font-medium text-gray-800">{check.label}</p>
        {check.message && check.message !== "Good" && (
          <p className="text-xs text-gray-500">{check.message}</p>
        )}
      </div>
    </li>
  );
}

function Group({ title, checks }: { title: string; checks: ScoreCheck[] }) {
  if (checks.length === 0) return null;
  return (
    <div>
      <p className="pt-3 pb-1 text-[11px] font-semibold uppercase tracking-wide text-gray-400">
        {title} ({checks.length})
      </p>
      <ul className="divide-y divide-gray-100">
        {checks.map((c) => (
          <CheckRow key={c.id} check={c} />
        ))}
      </ul>
    </div>
  );
}

export default function ScorePanel({ score, checks, loading, error, idle }: ScoreState) {
  const failing = checks.filter((c) => c.status === "red");
  const partial = checks.filter((c) => c.status === "yellow");
  const passing = checks.filter((c) => c.status === "green");

  const band = score === null ? null : scoreBand(score);

  return (
    <div className="rounded-2xl bg-white border border-gray-200">
      <div className="p-6 text-center border-b border-gray-100">
        <p
          className={`text-5xl font-semibold tabular-nums ${
            band ? BAND_TEXT[band] : "text-gray-300"
          }`}
        >
          {score === null ? "--" : score}
          {score !== null && <span className="text-2xl text-gray-400">/100</span>}
        </p>
        <p className="mt-2 text-sm font-medium text-gray-700">Gold Mine score</p>

        <p className="mt-1 h-4 text-xs text-gray-400">
          {loading ? "Scoring…" : idle ? "Start writing to see your score" : null}
        </p>

        {error && (
          <p className="mt-2 rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700">
            {error} — your writing is safe; scoring will resume when the
            connection is back.
          </p>
        )}

        {!idle && checks.length > 0 && (
          <div className="mt-3 flex justify-center gap-4 text-xs text-gray-500">
            <span>
              <span className="font-semibold text-emerald-600">{passing.length}</span>{" "}
              passing
            </span>
            <span>
              <span className="font-semibold text-amber-600">{partial.length}</span>{" "}
              partial
            </span>
            <span>
              <span className="font-semibold text-red-600">{failing.length}</span>{" "}
              failing
            </span>
          </div>
        )}
      </div>

      <div className="max-h-[60vh] overflow-y-auto px-5 pb-5">
        {idle ? (
          <p className="py-6 text-center text-xs text-gray-500">
            The checklist appears as soon as there's something to grade. Nothing
            is saved while you type.
          </p>
        ) : (
          <>
            <Group title="Needs work" checks={failing} />
            <Group title="Partly there" checks={partial} />
            <Group title="Passing" checks={passing} />
          </>
        )}
      </div>
    </div>
  );
}
