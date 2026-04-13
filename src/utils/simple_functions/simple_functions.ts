/**
 * A collection of simple functions.
 * Converted from: utils/simple_functions.py
 */

/**
 * Searches for a value in a range by repeatedly dividing the range in half.
 *
 * Performs numerical binary search to determine the input to `fn`, between
 * the bounds given, that outputs `target` to within `tolerance` (default 1e-4).
 * Returns `null` if no input can be found within the bounds.
 */
export function binarySearch(
  fn: (x: number) => number,
  target: number,
  lowerBound: number,
  upperBound: number,
  tolerance: number = 1e-4,
): number | null {
  let lh = lowerBound;
  let rh = upperBound;
  let mh: number = (lh + rh) / 2;

  while (Math.abs(rh - lh) > tolerance) {
    mh = (lh + rh) / 2;
    const lx = fn(lh);
    const mx = fn(mh);
    const rx = fn(rh);

    if (lx === target) return lh;
    if (rx === target) return rh;

    if (lx <= target && target <= rx) {
      if (mx > target) {
        rh = mh;
      } else {
        lh = mh;
      }
    } else if (lx > target && target > rx) {
      [lh, rh] = [rh, lh];
    } else {
      return null;
    }
  }

  return mh;
}

// Cache for binomial coefficients
const _chooseCache = new Map<string, number>();

/**
 * The binomial coefficient n choose k.
 *
 * Describes the number of possible choices of k elements from a set of
 * n elements. Results are memoized.
 */
export function choose(n: number, k: number): number {
  if (k < 0 || k > n) return 0;
  if (k === 0 || k === n) return 1;

  const key = `${n},${k}`;
  const cached = _chooseCache.get(key);
  if (cached !== undefined) return cached;

  // Use the symmetric property for efficiency
  const kk = k > n - k ? n - k : k;
  let result = 1;
  for (let i = 0; i < kk; i++) {
    result = (result * (n - i)) / (i + 1);
  }
  result = Math.round(result);

  _chooseCache.set(key, result);
  return result;
}

/**
 * Clips `a` to the interval [`minA`, `maxA`].
 *
 * Returns `a` if it is between `minA` and `maxA`.
 * Otherwise returns whichever of `minA` and `maxA` is closest.
 * Accepts any comparable values (numbers, strings, etc.).
 */
export function clip<T>(a: T, minA: T, maxA: T): T {
  if (a < minA) return minA;
  if (a > maxA) return maxA;
  return a;
}

/**
 * Returns the output of the logistic (sigmoid) function: 1 / (1 + e^(-x)).
 */
export function sigmoid(x: number): number {
  return 1.0 / (1 + Math.exp(-x));
}
