import type { IMobject, IVMobject } from "../../core/types.js";

/**
 * Returns true if a mobject has at least one point (i.e. is an IVMobject
 * with a non-empty points array). Mirrors Manim's
 * `Mobject.family_members_with_points` predicate.
 */
function hasPoints(mob: IMobject): boolean {
  if (!("points" in mob)) return false;
  const pts = (mob as IVMobject).points;
  return pts !== null && pts !== undefined && pts.shape[0] > 0;
}

/**
 * Remove duplicate object references from `list`, preserving order and
 * keeping the *last* occurrence of each element — matching the behaviour of
 * Python Manim's `remove_list_redundancies`.
 */
function removeListRedundancies<T>(list: T[]): T[] {
  const seen = new Set<T>();
  const result: T[] = [];
  for (let i = list.length - 1; i >= 0; i--) {
    const item = list[i];
    if (!seen.has(item)) {
      seen.add(item);
      result.unshift(item);
    }
  }
  return result;
}

/**
 * Returns a flat, deduplicated list of the given mobjects and all of their
 * family members (submobjects, recursively).
 *
 * @param mobjects         The mobjects to expand.
 * @param useZIndex        If true, sort the result by `zIndex`.
 * @param onlyThoseWithPoints  If true, exclude members that carry no geometry.
 *
 * Python: `manim.utils.family.extract_mobject_family_members`
 */
export function extractMobjectFamilyMembers(
  mobjects: Iterable<IMobject>,
  useZIndex = false,
  onlyThoseWithPoints = false,
): IMobject[] {
  const members: IMobject[] = [];

  for (const mob of mobjects) {
    const family = mob.getFamily();
    for (const m of family) {
      members.push(m);
    }
  }

  const filtered = onlyThoseWithPoints ? members.filter(hasPoints) : members;
  const unique = removeListRedundancies(filtered);

  if (useZIndex) {
    return unique.sort((a, b) => a.zIndex - b.zIndex);
  }
  return unique;
}
