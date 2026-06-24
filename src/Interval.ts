/** Sentinel for negative infinity (lower bound with no minimum). */
export const NEGINF: unique symbol = Symbol("-∞");
/** Sentinel for positive infinity (upper bound with no maximum). */
export const POSINF: unique symbol = Symbol("+∞");

export type NEG_INF = typeof NEGINF;
export type POS_INF = typeof POSINF;

/**
 * A comparator function: returns negative if a < b, 0 if a === b, positive if a > b.
 * The default uses `<`/`>` operators, which works for numbers, strings, Dates, BigInts.
 */
export type Comparator<T> = (a: T, b: T) => number;

function defaultCmp<T>(a: T, b: T): number {
  if (a < b) return -1;
  if (a > b) return 1;
  return 0;
}

// ──────────────────────────────────────────────────────────────────────────────
// Internal atom type: a single contiguous interval [lo, hi], (lo, hi), etc.
// lo is either T or NEGINF; hi is either T or POSINF.
// We use Bound<T> = T | NEG_INF | POS_INF for both to keep TypeScript happy —
// at runtime lo is never POSINF and hi is never NEGINF.
// ──────────────────────────────────────────────────────────────────────────────

/** Internal bound type — lo is never POSINF, hi is never NEGINF at runtime. */
type Bound<T> = T | NEG_INF | POS_INF;

interface Atom<T> {
  lo: Bound<T>;
  loInc: boolean; // closed lower bound?
  hi: Bound<T>;
  hiInc: boolean; // closed upper bound?
}

function atomEmpty<T>(a: Atom<T>, cmp: Comparator<T>): boolean {
  if (a.lo === POSINF || a.hi === NEGINF) return true;
  if (a.lo === NEGINF || a.hi === POSINF) return false;
  const c = cmp(a.lo as T, a.hi as T);
  return c > 0 || (c === 0 && !(a.loInc && a.hiInc));
}

// Compare lower bounds: [x comes before (x (closed is "to the left")
function cmpLo<T>(
  aLo: Bound<T>, aInc: boolean,
  bLo: Bound<T>, bInc: boolean,
  cmp: Comparator<T>,
): number {
  if (aLo === NEGINF && bLo === NEGINF) return 0;
  if (aLo === NEGINF) return -1;
  if (bLo === NEGINF) return 1;
  if (aLo === POSINF && bLo === POSINF) return 0;
  if (aLo === POSINF) return 1;
  if (bLo === POSINF) return -1;
  const c = cmp(aLo as T, bLo as T);
  if (c !== 0) return c;
  // Same value: closed ([) comes before open (()
  if (aInc === bInc) return 0;
  return aInc ? -1 : 1;
}

// Compare upper bounds: x) comes before x] (open is "to the left")
function cmpHi<T>(
  aHi: Bound<T>, aInc: boolean,
  bHi: Bound<T>, bInc: boolean,
  cmp: Comparator<T>,
): number {
  if (aHi === POSINF && bHi === POSINF) return 0;
  if (aHi === POSINF) return 1;
  if (bHi === POSINF) return -1;
  if (aHi === NEGINF && bHi === NEGINF) return 0;
  if (aHi === NEGINF) return -1;
  if (bHi === NEGINF) return 1;
  const c = cmp(aHi as T, bHi as T);
  if (c !== 0) return c;
  if (aInc === bInc) return 0;
  return aInc ? 1 : -1; // closed (]) is to the right of open ())
}

/** Two atoms overlap or are adjacent (share a boundary point). */
function overlapsOrAdjacent<T>(a: Atom<T>, b: Atom<T>, cmp: Comparator<T>): boolean {
  // a must start before or at b's start for the check to make sense
  // Check: a.hi >= b.lo (considering open/closed)
  if (a.hi === POSINF) return true;
  if (b.lo === NEGINF) return true;
  const c = cmp(a.hi as T, b.lo as T);
  if (c > 0) return true;
  if (c === 0) return a.hiInc || b.loInc; // at least one side closed = touching
  return false;
}

/** Merge two overlapping/adjacent atoms into one. */
function mergeAtoms<T>(a: Atom<T>, b: Atom<T>, cmp: Comparator<T>): Atom<T> {
  // lo = min of the two lower bounds
  let lo: Bound<T>, loInc: boolean;
  const loC = cmpLo(a.lo, a.loInc, b.lo, b.loInc, cmp);
  if (loC <= 0) { lo = a.lo; loInc = loC === 0 ? (a.loInc || b.loInc) : a.loInc; }
  else           { lo = b.lo; loInc = b.loInc; }

  // hi = max of the two upper bounds
  let hi: Bound<T>, hiInc: boolean;
  const hiC = cmpHi(a.hi, a.hiInc, b.hi, b.hiInc, cmp);
  if (hiC >= 0) { hi = a.hi; hiInc = hiC === 0 ? (a.hiInc || b.hiInc) : a.hiInc; }
  else           { hi = b.hi; hiInc = b.hiInc; }

  return { lo, loInc, hi, hiInc };
}

/** Normalize: sort atoms by lower bound, merge overlapping/adjacent. */
function normalize<T>(atoms: Atom<T>[], cmp: Comparator<T>): Atom<T>[] {
  const filtered = atoms.filter((a) => !atomEmpty(a, cmp));
  if (filtered.length === 0) return [];

  filtered.sort((a, b) => cmpLo(a.lo, a.loInc, b.lo, b.loInc, cmp));

  const result: Atom<T>[] = [filtered[0]];
  for (let i = 1; i < filtered.length; i++) {
    const last = result[result.length - 1];
    const cur = filtered[i];
    if (overlapsOrAdjacent(last, cur, cmp)) {
      result[result.length - 1] = mergeAtoms(last, cur, cmp);
    } else {
      result.push(cur);
    }
  }
  return result;
}

// ──────────────────────────────────────────────────────────────────────────────
// Public Interval class
// ──────────────────────────────────────────────────────────────────────────────

/**
 * An algebraically closed interval (or union of intervals) over a comparable type T.
 *
 * Represents the result of union/intersection/complement operations without losing
 * information — e.g. `[1,3].union([5,7])` gives `[1,3] | [5,7]`, not an approximation.
 *
 * Internally stores a sorted list of non-overlapping, non-adjacent atomic intervals.
 * Results of set operations are always normalized Interval instances.
 */
export class Interval<T = number> {
  private readonly _atoms: ReadonlyArray<Atom<T>>;
  private readonly _cmp: Comparator<T>;

  private constructor(atoms: Atom<T>[], cmp: Comparator<T>) {
    this._atoms = normalize(atoms, cmp);
    this._cmp = cmp;
  }

  // ── Factory methods ────────────────────────────────────────────────────────

  /** `[lo, hi]` — closed on both ends. */
  static closed<T = number>(lo: T, hi: T, cmp?: Comparator<T>): Interval<T> {
    const c = cmp ?? defaultCmp;
    return new Interval([{ lo, loInc: true, hi, hiInc: true }], c as Comparator<T>);
  }

  /** `(lo, hi)` — open on both ends. */
  static open<T = number>(lo: T, hi: T, cmp?: Comparator<T>): Interval<T> {
    const c = cmp ?? defaultCmp;
    return new Interval([{ lo, loInc: false, hi, hiInc: false }], c as Comparator<T>);
  }

  /** `[lo, hi)` — closed lower, open upper. */
  static closedOpen<T = number>(lo: T, hi: T, cmp?: Comparator<T>): Interval<T> {
    const c = cmp ?? defaultCmp;
    return new Interval([{ lo, loInc: true, hi, hiInc: false }], c as Comparator<T>);
  }

  /** `(lo, hi]` — open lower, closed upper. */
  static openClosed<T = number>(lo: T, hi: T, cmp?: Comparator<T>): Interval<T> {
    const c = cmp ?? defaultCmp;
    return new Interval([{ lo, loInc: false, hi, hiInc: true }], c as Comparator<T>);
  }

  /** `[v, v]` — a single point. */
  static singleton<T = number>(v: T, cmp?: Comparator<T>): Interval<T> {
    const c = cmp ?? defaultCmp;
    return new Interval([{ lo: v, loInc: true, hi: v, hiInc: true }], c as Comparator<T>);
  }

  /** The empty interval ∅. */
  static empty<T = number>(cmp?: Comparator<T>): Interval<T> {
    return new Interval([], cmp ?? defaultCmp as Comparator<T>);
  }

  /** The full real line `(-∞, +∞)`. */
  static all<T = number>(cmp?: Comparator<T>): Interval<T> {
    return new Interval([{ lo: NEGINF, loInc: false, hi: POSINF, hiInc: false }], cmp ?? defaultCmp as Comparator<T>);
  }

  /** `(v, +∞)` */
  static greaterThan<T = number>(v: T, cmp?: Comparator<T>): Interval<T> {
    const c = cmp ?? defaultCmp;
    return new Interval([{ lo: v, loInc: false, hi: POSINF, hiInc: false }], c as Comparator<T>);
  }

  /** `[v, +∞)` */
  static atLeast<T = number>(v: T, cmp?: Comparator<T>): Interval<T> {
    const c = cmp ?? defaultCmp;
    return new Interval([{ lo: v, loInc: true, hi: POSINF, hiInc: false }], c as Comparator<T>);
  }

  /** `(-∞, v)` */
  static lessThan<T = number>(v: T, cmp?: Comparator<T>): Interval<T> {
    const c = cmp ?? defaultCmp;
    return new Interval([{ lo: NEGINF, loInc: false, hi: v, hiInc: false }], c as Comparator<T>);
  }

  /** `(-∞, v]` */
  static atMost<T = number>(v: T, cmp?: Comparator<T>): Interval<T> {
    const c = cmp ?? defaultCmp;
    return new Interval([{ lo: NEGINF, loInc: false, hi: v, hiInc: true }], c as Comparator<T>);
  }

  // ── Set operations ─────────────────────────────────────────────────────────

  /** Union: all points in this OR other. */
  union(other: Interval<T>): Interval<T> {
    return new Interval([...this._atoms, ...other._atoms], this._cmp);
  }

  /** Intersection: only points in both this AND other. */
  intersection(other: Interval<T>): Interval<T> {
    const results: Atom<T>[] = [];
    for (const a of this._atoms) {
      for (const b of other._atoms) {
        // Clip a by b
        let lo: Bound<T>, loInc: boolean;
        const loC = cmpLo(a.lo, a.loInc, b.lo, b.loInc, this._cmp);
        if (loC >= 0) { lo = a.lo; loInc = loC === 0 ? (a.loInc && b.loInc) : a.loInc; }
        else           { lo = b.lo; loInc = b.loInc; }

        let hi: Bound<T>, hiInc: boolean;
        const hiC = cmpHi(a.hi, a.hiInc, b.hi, b.hiInc, this._cmp);
        if (hiC <= 0) { hi = a.hi; hiInc = hiC === 0 ? (a.hiInc && b.hiInc) : a.hiInc; }
        else           { hi = b.hi; hiInc = b.hiInc; }

        const atom: Atom<T> = { lo, loInc, hi, hiInc };
        if (!atomEmpty(atom, this._cmp)) results.push(atom);
      }
    }
    return new Interval(results, this._cmp);
  }

  /** Complement: all points NOT in this interval. */
  complement(): Interval<T> {
    if (this._atoms.length === 0) return Interval.all(this._cmp);

    const result: Atom<T>[] = [];
    let prev: Bound<T> = NEGINF;
    let prevInc = false;

    for (const a of this._atoms) {
      const atom: Atom<T> = {
        lo: prev,
        loInc: prevInc,
        hi: a.lo,
        hiInc: !a.loInc,
      };
      if (!atomEmpty(atom, this._cmp)) result.push(atom);
      prev = a.hi;
      prevInc = !a.hiInc;
    }

    const tail: Atom<T> = { lo: prev, loInc: prevInc, hi: POSINF, hiInc: false };
    if (!atomEmpty(tail, this._cmp)) result.push(tail);

    return new Interval(result, this._cmp);
  }

  /** Difference: points in this but NOT in other. */
  difference(other: Interval<T>): Interval<T> {
    return this.intersection(other.complement());
  }

  /** Symmetric difference: points in exactly one of this or other. */
  symmetricDifference(other: Interval<T>): Interval<T> {
    return this.union(other).difference(this.intersection(other));
  }

  // ── Queries ────────────────────────────────────────────────────────────────

  /** True if the point `v` is in this interval. */
  contains(v: T): boolean {
    for (const a of this._atoms) {
      if (a.lo !== NEGINF) {
        const c = this._cmp(v, a.lo as T);
        if (c < 0 || (c === 0 && !a.loInc)) continue;
      }
      if (a.hi !== POSINF) {
        const c = this._cmp(v, a.hi as T);
        if (c > 0 || (c === 0 && !a.hiInc)) continue;
      }
      return true;
    }
    return false;
  }

  /** True if every point in `other` is also in this interval. */
  encloses(other: Interval<T>): boolean {
    return other.difference(this).isEmpty();
  }

  /** True if this and other share at least one point. */
  overlaps(other: Interval<T>): boolean {
    return !this.intersection(other).isEmpty();
  }

  /** True if this interval is empty (∅). */
  isEmpty(): boolean {
    return this._atoms.length === 0;
  }

  /** True if this interval is a single contiguous piece (not a union of disjoint intervals). */
  isAtomic(): boolean {
    return this._atoms.length <= 1;
  }

  /** True if this and other represent the same set of points. */
  equals(other: Interval<T>): boolean {
    if (this._atoms.length !== other._atoms.length) return false;
    return this._atoms.every((a, i) => {
      const b = other._atoms[i];
      const loSame = a.lo === b.lo || (a.lo !== NEGINF && b.lo !== NEGINF && this._cmp(a.lo as T, b.lo as T) === 0);
      const hiSame = a.hi === b.hi || (a.hi !== POSINF && b.hi !== POSINF && this._cmp(a.hi as T, b.hi as T) === 0);
      return loSame && a.loInc === b.loInc && hiSame && a.hiInc === b.hiInc;
    });
  }

  // ── Accessors (for atomic intervals) ──────────────────────────────────────

  /** Lower bound value, or NEGINF if unbounded. Undefined for empty intervals. */
  get lower(): Bound<T> | undefined {
    return this._atoms[0]?.lo;
  }

  /** Upper bound value, or POSINF if unbounded. Undefined for empty intervals. */
  get upper(): Bound<T> | undefined {
    return this._atoms[this._atoms.length - 1]?.hi;
  }

  /** True if the lower bound is inclusive (closed). False for empty intervals. */
  get lowerInc(): boolean {
    return this._atoms[0]?.loInc ?? false;
  }

  /** True if the upper bound is inclusive (closed). False for empty intervals. */
  get upperInc(): boolean {
    return this._atoms[this._atoms.length - 1]?.hiInc ?? false;
  }

  // ── Iteration ──────────────────────────────────────────────────────────────

  /**
   * Iterate over the atomic (contiguous) parts of this interval.
   * A union `[1,3] | [5,7]` yields two atoms: `[1,3]` and `[5,7]`.
   */
  *atoms(): Iterable<Interval<T>> {
    for (const a of this._atoms) {
      yield new Interval([a], this._cmp);
    }
  }

  [Symbol.iterator](): Iterator<Interval<T>> {
    return (this.atoms() as unknown as Iterable<Interval<T>>)[Symbol.iterator]();
  }

  /** Number of atomic pieces. */
  get size(): number {
    return this._atoms.length;
  }

  // ── String representation ─────────────────────────────────────────────────

  toString(): string {
    if (this._atoms.length === 0) return "∅";
    return this._atoms
      .map((a) => {
        const lo = a.lo === NEGINF ? "-∞" : String(a.lo);
        const hi = a.hi === POSINF ? "+∞" : String(a.hi);
        const left = a.loInc ? "[" : "(";
        const right = a.hiInc ? "]" : ")";
        return `${left}${lo}, ${hi}${right}`;
      })
      .join(" | ");
  }
}

// ── Convenience constructors (top-level) ──────────────────────────────────────
export const closed = Interval.closed.bind(Interval);
export const open = Interval.open.bind(Interval);
export const closedOpen = Interval.closedOpen.bind(Interval);
export const openClosed = Interval.openClosed.bind(Interval);
export const singleton = Interval.singleton.bind(Interval);
export const empty = Interval.empty.bind(Interval);
export const all = Interval.all.bind(Interval);
export const greaterThan = Interval.greaterThan.bind(Interval);
export const atLeast = Interval.atLeast.bind(Interval);
export const lessThan = Interval.lessThan.bind(Interval);
export const atMost = Interval.atMost.bind(Interval);
