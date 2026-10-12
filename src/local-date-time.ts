// datetime-local inputs require wall-clock time, not UTC. Use the offset at
// the selected instant so scheduled dates also survive daylight-saving changes.
export function localDateTime(timestamp: number): string {
  const value = new Date(timestamp);
  if (!Number.isFinite(value.getTime())) return "";
  return new Date(value.getTime() - value.getTimezoneOffset() * 60000)
    .toISOString()
    .slice(0, 16);
}
