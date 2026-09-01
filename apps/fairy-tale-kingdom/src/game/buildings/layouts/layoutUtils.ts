/** Stable hash so co-workers fan out inside a building room. */
function hashId(id: string): number {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) | 0;
  return Math.abs(h);
}

/** World point from building origin + relative offset. */
export function layoutPoint(
  origin: { x: number; y: number },
  offset: { x: number; y: number },
  subjectId = 'anon',
  jitter = 5
): { x: number; y: number } {
  const h = hashId(subjectId);
  const ang = ((h % 360) / 360) * Math.PI * 2;
  const dist = (h % 5) * 0.15 * jitter;
  return {
    x: origin.x + offset.x + Math.cos(ang) * dist,
    y: origin.y + offset.y + Math.sin(ang) * dist,
  };
}
