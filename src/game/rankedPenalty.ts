export function rankedPenaltyMinutes(leaves: number): number {
  return leaves < 3 ? 20 : Math.min(24 * 60, 60 * 2 ** Math.min(5, leaves - 3));
}
