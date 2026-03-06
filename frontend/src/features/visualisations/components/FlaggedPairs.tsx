export interface FlaggedPairsProps {
  matrix: Record<string, Record<string, number>>;
  labels: string[];
  threshold: number;
}

export function FlaggedPairs({ matrix, labels, threshold }: FlaggedPairsProps) {
  const pairs: { a: string; b: string; score: number }[] = [];
  for (let i = 0; i < labels.length; i++) {
    for (let j = i + 1; j < labels.length; j++) {
      const score = matrix[labels[i]]?.[labels[j]] ?? 0;
      if (score >= threshold) {
        pairs.push({ a: labels[i], b: labels[j], score });
      }
    }
  }

  if (pairs.length === 0) return null;

  pairs.sort((x, y) => y.score - x.score);

  return (
    <div className="rounded-lg border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-900/20 px-3 py-2.5">
      <p className="text-2xs font-semibold text-amber-700 dark:text-amber-300 mb-2">
        Potentially redundant pairs ({pairs.length})
      </p>
      <ul className="space-y-1">
        {pairs.map(({ a, b, score }) => (
          <li key={`${a}-${b}`} className="flex items-center justify-between gap-2">
            <span className="text-2xs text-amber-800 dark:text-amber-200 truncate">
              <span className="font-medium">{a}</span>
              <span className="mx-1 text-amber-500">↔</span>
              <span className="font-medium">{b}</span>
            </span>
            <span className="text-2xs font-mono font-semibold text-amber-700 dark:text-amber-300 flex-shrink-0">
              {score.toFixed(3)}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
