export function formatIncidentId(id: string | null | undefined): string {
  if (!id) return 'INC-N/A';
  const trimmed = id.trim();
  const spillMatch = trimmed.match(/^Spill[-_ ]?(\d+)$/i);
  if (spillMatch) {
    const num = spillMatch[1].padStart(3, '0');
    return `INC-${num}`;
  }
  return trimmed;
}
