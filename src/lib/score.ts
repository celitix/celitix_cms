// Score presentation rules, shared by the list's score badges and the editor's
// score panel so the two can never disagree about what "amber" means.

export type ScoreBand = "red" | "amber" | "green";

/** Thresholds: 0–59 red, 60–84 amber, 85–100 green. */
export function scoreBand(score: number): ScoreBand {
  if (score >= 85) return "green";
  if (score >= 60) return "amber";
  return "red";
}

/** Tailwind classes per band. Written as literal strings so the scanner sees them. */
export const BAND_BADGE: Record<ScoreBand, string> = {
  red: "bg-red-50 text-red-700 ring-red-200",
  amber: "bg-amber-50 text-amber-700 ring-amber-200",
  green: "bg-emerald-50 text-emerald-700 ring-emerald-200",
};

export const BAND_TEXT: Record<ScoreBand, string> = {
  red: "text-red-600",
  amber: "text-amber-600",
  green: "text-emerald-600",
};

/** Dot colours for individual checks — the engine's own green/yellow/red. */
export const CHECK_DOT: Record<"green" | "yellow" | "red", string> = {
  green: "bg-emerald-500",
  yellow: "bg-amber-500",
  red: "bg-red-500",
};
