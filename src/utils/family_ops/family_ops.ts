/**
 * Family operations for mobject lists.
 * Python: manim.utils.family_ops
 */

import type { IMobject, IVMobject } from "../../core/types.js";

/**
 * Returns true if a mobject has geometry (points).
 * Checks for `hasPoints()` method first (Mobject class),
 * falls back to checking the `points` property (IVMobject).
 */
function mobjectHasPoints(mob: IMobject): boolean {
  const mobUnknown = mob as unknown as { hasPoints?: () => boolean };
  if (typeof mobUnknown.hasPoints === "function") {
    return mobUnknown.hasPoints();
  }
  if ("points" in mob) {
    const pts = (mob as IVMobject).points;
    return pts !== null && pts !== undefined && pts.shape[0] > 0;
  }
  return false;
}

/**
 * Returns a flat list of the given mobjects and all of their
 * family members (submobjects, recursively).
 *
 * @param mobjectList        The mobjects to expand.
 * @param onlyThoseWithPoints  If true, exclude members that carry no geometry.
 *
 * Python: manim.utils.family_ops.extract_mobject_family_members
 */
export function extractMobjectFamilyMembers(
  mobjectList: IMobject[],
  onlyThoseWithPoints = false,
): IMobject[] {
  const result: IMobject[] = [];
  for (const mob of mobjectList) {
    for (const member of mob.getFamily()) {
      result.push(member);
    }
  }

  if (onlyThoseWithPoints) {
    return result.filter(mobjectHasPoints);
  }
  return result;
}

/**
 * Removes anything in `toRemove` from `mobjectList`, but in the event that one of
 * the items to be removed is a member of the family of an item in mobjectList,
 * the other family members are added back into the list.
 *
 * This is useful in cases where a scene contains a group, e.g. Group(m1, m2, m3),
 * but one of its submobjects is removed, e.g. scene.remove(m1), it's useful
 * for the list of mobjectList to be edited to contain other submobjects, but not m1.
 *
 * Python: manim.utils.family_ops.restructure_list_to_exclude_certain_family_members
 */
export function restructureListToExcludeCertainFamilyMembers(
  mobjectList: IMobject[],
  toRemove: IMobject[],
): IMobject[] {
  const newList: IMobject[] = [];
  const toRemoveExpanded = extractMobjectFamilyMembers(toRemove);

  function addSafeMobjectsFromList(
    listToExamine: IMobject[],
    setToRemove: Set<IMobject>,
  ): void {
    for (const mob of listToExamine) {
      if (setToRemove.has(mob)) {
        continue;
      }
      const family = mob.getFamily();
      const intersect = new Set(family.filter((m) => setToRemove.has(m)));
      if (intersect.size > 0) {
        addSafeMobjectsFromList(mob.submobjects, intersect);
      } else {
        newList.push(mob);
      }
    }
  }

  addSafeMobjectsFromList(mobjectList, new Set(toRemoveExpanded));
  return newList;
}
