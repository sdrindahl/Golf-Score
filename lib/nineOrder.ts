type CourseLike = {
  id: string;
  name?: string;
};

const FRONT_RE = /\bfront\b/i;
const BACK_RE = /\bback\b/i;

function isFrontNine(name?: string): boolean {
  return FRONT_RE.test(name || '');
}

function isBackNine(name?: string): boolean {
  return BACK_RE.test(name || '');
}

export function orderNinesForDisplay<T extends CourseLike>(nines: T[]): T[] {
  if (!Array.isArray(nines) || nines.length < 2) return nines;

  const hasFront = nines.some((n) => isFrontNine(n.name));
  const hasBack = nines.some((n) => isBackNine(n.name));

  // Only normalize order when the selection includes both Front and Back.
  // Otherwise (West/North/East, etc.), preserve the user's selection order.
  if (!hasFront || !hasBack) return nines;

  const front = nines.filter((n) => isFrontNine(n.name));
  const middle = nines.filter((n) => !isFrontNine(n.name) && !isBackNine(n.name));
  const back = nines.filter((n) => isBackNine(n.name));

  return [...front, ...middle, ...back];
}

export function orderCourseIdsForDisplay(
  courseIds: string[],
  allCourses: Array<{ id: string; name?: string }>
): string[] {
  if (!Array.isArray(courseIds) || courseIds.length < 2) return courseIds;

  const resolved = courseIds
    .map((id) => allCourses.find((c) => c.id === id))
    .filter(Boolean) as CourseLike[];

  const orderedResolved = orderNinesForDisplay(resolved);
  const orderedResolvedIds = orderedResolved.map((c) => c.id);
  const unresolvedIds = courseIds.filter((id) => !orderedResolvedIds.includes(id));

  return [...orderedResolvedIds, ...unresolvedIds];
}