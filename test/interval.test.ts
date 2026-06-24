import {
  Interval, NEGINF, POSINF,
  closed, open, closedOpen, openClosed,
  singleton, empty, all,
  greaterThan, atLeast, lessThan, atMost,
} from "../src/index.js";

// ── Factory methods ────────────────────────────────────────────────────────────

describe("factory methods", () => {
  it("closed(1, 5) contains endpoints", () => {
    const i = closed(1, 5);
    expect(i.contains(1)).toBe(true);
    expect(i.contains(3)).toBe(true);
    expect(i.contains(5)).toBe(true);
    expect(i.contains(0)).toBe(false);
    expect(i.contains(6)).toBe(false);
  });

  it("open(1, 5) excludes endpoints", () => {
    const i = open(1, 5);
    expect(i.contains(1)).toBe(false);
    expect(i.contains(3)).toBe(true);
    expect(i.contains(5)).toBe(false);
  });

  it("closedOpen(1, 5) includes lower, excludes upper", () => {
    const i = closedOpen(1, 5);
    expect(i.contains(1)).toBe(true);
    expect(i.contains(4.999)).toBe(true);
    expect(i.contains(5)).toBe(false);
  });

  it("openClosed(1, 5) excludes lower, includes upper", () => {
    const i = openClosed(1, 5);
    expect(i.contains(1)).toBe(false);
    expect(i.contains(3)).toBe(true);
    expect(i.contains(5)).toBe(true);
  });

  it("singleton(3) contains only 3", () => {
    const i = singleton(3);
    expect(i.contains(3)).toBe(true);
    expect(i.contains(2.999)).toBe(false);
    expect(i.contains(3.001)).toBe(false);
    expect(i.isAtomic()).toBe(true);
  });

  it("empty() is empty", () => {
    expect(empty().isEmpty()).toBe(true);
    expect(empty().contains(0)).toBe(false);
  });

  it("all() contains everything", () => {
    const i = all<number>();
    expect(i.contains(-1e100)).toBe(true);
    expect(i.contains(0)).toBe(true);
    expect(i.contains(1e100)).toBe(true);
    expect(i.isEmpty()).toBe(false);
  });

  it("greaterThan(5) is (5, +∞)", () => {
    const i = greaterThan(5);
    expect(i.contains(5)).toBe(false);
    expect(i.contains(5.001)).toBe(true);
    expect(i.contains(1e9)).toBe(true);
  });

  it("atLeast(5) is [5, +∞)", () => {
    const i = atLeast(5);
    expect(i.contains(5)).toBe(true);
    expect(i.contains(4.999)).toBe(false);
  });

  it("lessThan(5) is (-∞, 5)", () => {
    const i = lessThan(5);
    expect(i.contains(5)).toBe(false);
    expect(i.contains(4.999)).toBe(true);
    expect(i.contains(-1e9)).toBe(true);
  });

  it("atMost(5) is (-∞, 5]", () => {
    const i = atMost(5);
    expect(i.contains(5)).toBe(true);
    expect(i.contains(5.001)).toBe(false);
  });

  it("empty interval from reversed bounds", () => {
    const i = closed(5, 1); // lo > hi → empty
    expect(i.isEmpty()).toBe(true);
  });

  it("empty interval from open point", () => {
    const i = open(3, 3); // (3, 3) = ∅
    expect(i.isEmpty()).toBe(true);
  });
});

// ── Set operations ─────────────────────────────────────────────────────────────

describe("union", () => {
  it("[1,3] ∪ [5,7] = [1,3] | [5,7]", () => {
    const u = closed(1, 3).union(closed(5, 7));
    expect(u.isAtomic()).toBe(false);
    expect(u.contains(2)).toBe(true);
    expect(u.contains(4)).toBe(false);
    expect(u.contains(6)).toBe(true);
    expect(u.size).toBe(2);
  });

  it("[1,3] ∪ [2,5] = [1,5] (merges overlapping)", () => {
    const u = closed(1, 3).union(closed(2, 5));
    expect(u.isAtomic()).toBe(true);
    expect(u.contains(1)).toBe(true);
    expect(u.contains(5)).toBe(true);
    expect(u.size).toBe(1);
  });

  it("[1,3] ∪ [3,5] = [1,5] (merges adjacent closed)", () => {
    const u = closed(1, 3).union(closed(3, 5));
    expect(u.isAtomic()).toBe(true);
    expect(u.contains(3)).toBe(true);
    expect(u.lower).toBe(1);
    expect(u.upper).toBe(5);
  });

  it("[1,3) ∪ (3,5] stays disjoint (open gap at 3)", () => {
    const u = closedOpen(1, 3).union(openClosed(3, 5));
    // Gap at exactly 3
    expect(u.contains(3)).toBe(false);
    expect(u.contains(1)).toBe(true);
    expect(u.contains(5)).toBe(true);
    expect(u.size).toBe(2);
  });

  it("[1,3) ∪ [3,5] merges (closed boundary at 3)", () => {
    const u = closedOpen(1, 3).union(closed(3, 5));
    expect(u.isAtomic()).toBe(true);
    expect(u.contains(3)).toBe(true);
  });

  it("X ∪ ∅ = X", () => {
    const x = closed(1, 5);
    expect(x.union(empty<number>()).equals(x)).toBe(true);
  });

  it("X ∪ all = all", () => {
    expect(closed(1, 5).union(all<number>()).equals(all<number>())).toBe(true);
  });
});

describe("intersection", () => {
  it("[1,5] ∩ [3,8] = [3,5]", () => {
    const r = closed(1, 5).intersection(closed(3, 8));
    expect(r.contains(3)).toBe(true);
    expect(r.contains(5)).toBe(true);
    expect(r.contains(2)).toBe(false);
    expect(r.contains(6)).toBe(false);
  });

  it("[1,3] ∩ [5,7] = ∅", () => {
    expect(closed(1, 3).intersection(closed(5, 7)).isEmpty()).toBe(true);
  });

  it("(1,5) ∩ [3,5) = [3,5)", () => {
    const r = open(1, 5).intersection(closedOpen(3, 5));
    expect(r.contains(3)).toBe(true);
    expect(r.contains(4.999)).toBe(true);
    expect(r.contains(5)).toBe(false);
  });

  it("X ∩ ∅ = ∅", () => {
    expect(closed(1, 5).intersection(empty<number>()).isEmpty()).toBe(true);
  });

  it("X ∩ all = X", () => {
    const x = closed(1, 5);
    expect(x.intersection(all<number>()).equals(x)).toBe(true);
  });

  it("intersection distributes over union", () => {
    // A ∩ (B ∪ C) = (A ∩ B) ∪ (A ∩ C)
    const A = closed(0, 10);
    const B = closed(2, 5);
    const C = closed(7, 12);
    const lhs = A.intersection(B.union(C));
    const rhs = A.intersection(B).union(A.intersection(C));
    expect(lhs.equals(rhs)).toBe(true);
  });
});

describe("complement", () => {
  it("complement of [1,5] is (-∞,1) | (5,+∞)", () => {
    const c = closed(1, 5).complement();
    expect(c.contains(0)).toBe(true);
    expect(c.contains(1)).toBe(false);
    expect(c.contains(3)).toBe(false);
    expect(c.contains(5)).toBe(false);
    expect(c.contains(6)).toBe(true);
    expect(c.size).toBe(2);
  });

  it("complement of (1,5) is (-∞,1] | [5,+∞)", () => {
    const c = open(1, 5).complement();
    expect(c.contains(1)).toBe(true);
    expect(c.contains(1.001)).toBe(false);
    expect(c.contains(5)).toBe(true);
  });

  it("complement of ∅ = all", () => {
    expect(empty<number>().complement().equals(all<number>())).toBe(true);
  });

  it("complement of all = ∅", () => {
    expect(all<number>().complement().isEmpty()).toBe(true);
  });

  it("double complement = identity", () => {
    const x = closed(1, 3).union(closed(5, 7));
    expect(x.complement().complement().equals(x)).toBe(true);
  });

  it("X ∪ ~X = all", () => {
    const x = closed(2, 8);
    expect(x.union(x.complement()).equals(all<number>())).toBe(true);
  });

  it("X ∩ ~X = ∅", () => {
    const x = closed(2, 8);
    expect(x.intersection(x.complement()).isEmpty()).toBe(true);
  });
});

describe("difference", () => {
  it("[1,10] - [3,7] = [1,3) | (7,10]", () => {
    const d = closed(1, 10).difference(closed(3, 7));
    expect(d.contains(2)).toBe(true);
    expect(d.contains(3)).toBe(false);
    expect(d.contains(5)).toBe(false);
    expect(d.contains(7)).toBe(false);
    expect(d.contains(8)).toBe(true);
    expect(d.size).toBe(2);
  });

  it("X - ∅ = X", () => {
    const x = closed(1, 5);
    expect(x.difference(empty<number>()).equals(x)).toBe(true);
  });

  it("X - X = ∅", () => {
    const x = closed(1, 5);
    expect(x.difference(x).isEmpty()).toBe(true);
  });

  it("∅ - X = ∅", () => {
    expect(empty<number>().difference(closed(1, 5)).isEmpty()).toBe(true);
  });
});

describe("symmetricDifference", () => {
  it("[1,5] △ [3,7] = [1,3) | (5,7]", () => {
    const s = closed(1, 5).symmetricDifference(closed(3, 7));
    expect(s.contains(2)).toBe(true);
    expect(s.contains(3)).toBe(false);
    expect(s.contains(4)).toBe(false);
    expect(s.contains(5)).toBe(false);
    expect(s.contains(6)).toBe(true);
  });

  it("X △ X = ∅", () => {
    const x = closed(1, 5);
    expect(x.symmetricDifference(x).isEmpty()).toBe(true);
  });

  it("X △ ∅ = X", () => {
    const x = closed(1, 5);
    expect(x.symmetricDifference(empty<number>()).equals(x)).toBe(true);
  });

  it("symmetric (A △ B = B △ A)", () => {
    const A = closed(1, 5);
    const B = closed(3, 8);
    expect(A.symmetricDifference(B).equals(B.symmetricDifference(A))).toBe(true);
  });
});

// ── Queries ───────────────────────────────────────────────────────────────────

describe("encloses", () => {
  it("[1,10] encloses [3,7]", () => {
    expect(closed(1, 10).encloses(closed(3, 7))).toBe(true);
  });

  it("[1,5] does not enclose [3,7]", () => {
    expect(closed(1, 5).encloses(closed(3, 7))).toBe(false);
  });

  it("X encloses ∅", () => {
    expect(closed(1, 5).encloses(empty<number>())).toBe(true);
  });

  it("X encloses X", () => {
    const x = closed(1, 5);
    expect(x.encloses(x)).toBe(true);
  });
});

describe("overlaps", () => {
  it("[1,3] overlaps [2,5]", () => {
    expect(closed(1, 3).overlaps(closed(2, 5))).toBe(true);
  });

  it("[1,3] does not overlap [5,7]", () => {
    expect(closed(1, 3).overlaps(closed(5, 7))).toBe(false);
  });

  it("[1,3] overlaps [3,5] (at boundary)", () => {
    expect(closed(1, 3).overlaps(closed(3, 5))).toBe(true);
  });

  it("[1,3) does not overlap [3,5]", () => {
    expect(closedOpen(1, 3).overlaps(closed(3, 5))).toBe(false);
  });
});

describe("equals", () => {
  it("same interval", () => {
    expect(closed(1, 5).equals(closed(1, 5))).toBe(true);
  });

  it("different bounds", () => {
    expect(closed(1, 5).equals(closed(1, 6))).toBe(false);
  });

  it("different inclusivity", () => {
    expect(closed(1, 5).equals(open(1, 5))).toBe(false);
  });

  it("empty equals empty", () => {
    expect(empty<number>().equals(empty<number>())).toBe(true);
  });

  it("union result equals", () => {
    const a = closed(1, 3).union(closed(5, 7));
    const b = closed(5, 7).union(closed(1, 3));
    expect(a.equals(b)).toBe(true);
  });
});

// ── Accessors ─────────────────────────────────────────────────────────────────

describe("accessors", () => {
  it("lower/upper for atomic interval", () => {
    const i = closed(2, 8);
    expect(i.lower).toBe(2);
    expect(i.upper).toBe(8);
    expect(i.lowerInc).toBe(true);
    expect(i.upperInc).toBe(true);
  });

  it("lower/upper for open interval", () => {
    const i = open(2, 8);
    expect(i.lower).toBe(2);
    expect(i.upper).toBe(8);
    expect(i.lowerInc).toBe(false);
    expect(i.upperInc).toBe(false);
  });

  it("lower = NEGINF for unbounded", () => {
    const i = atMost(5);
    expect(i.lower).toBe(NEGINF);
    expect(i.upper).toBe(5);
  });

  it("upper = POSINF for unbounded", () => {
    const i = atLeast(5);
    expect(i.lower).toBe(5);
    expect(i.upper).toBe(POSINF);
  });

  it("size counts atomic pieces", () => {
    expect(empty<number>().size).toBe(0);
    expect(closed(1, 5).size).toBe(1);
    expect(closed(1, 3).union(closed(5, 7)).size).toBe(2);
  });
});

// ── toString ──────────────────────────────────────────────────────────────────

describe("toString", () => {
  it("empty → ∅", () => {
    expect(empty<number>().toString()).toBe("∅");
  });

  it("closed(1, 5) → [1, 5]", () => {
    expect(closed(1, 5).toString()).toBe("[1, 5]");
  });

  it("open(1, 5) → (1, 5)", () => {
    expect(open(1, 5).toString()).toBe("(1, 5)");
  });

  it("all → (-∞, +∞)", () => {
    expect(all<number>().toString()).toBe("(-∞, +∞)");
  });

  it("union → joined with |", () => {
    const s = closed(1, 3).union(closed(5, 7)).toString();
    expect(s).toBe("[1, 3] | [5, 7]");
  });
});

// ── Iteration ─────────────────────────────────────────────────────────────────

describe("atoms iteration", () => {
  it("empty interval yields nothing", () => {
    const result = [...empty<number>().atoms() as unknown as Iterable<Interval<number>>];
    expect(result).toHaveLength(0);
  });

  it("atomic interval yields one atom", () => {
    const result = [...closed(1, 5).atoms() as unknown as Iterable<Interval<number>>];
    expect(result).toHaveLength(1);
    expect(result[0].contains(3)).toBe(true);
  });

  it("union yields two atoms", () => {
    const u = closed(1, 3).union(closed(5, 7));
    const result = [...u.atoms() as unknown as Iterable<Interval<number>>];
    expect(result).toHaveLength(2);
    expect(result[0].contains(2)).toBe(true);
    expect(result[1].contains(6)).toBe(true);
  });

  it("Symbol.iterator works with for...of", () => {
    const u = closed(1, 3).union(closed(5, 7));
    const collected: Interval<number>[] = [];
    for (const atom of u) {
      collected.push(atom);
    }
    expect(collected).toHaveLength(2);
  });
});

// ── Generic types ─────────────────────────────────────────────────────────────

describe("generic types", () => {
  it("works with strings", () => {
    const i = closed("apple", "mango");
    expect(i.contains("banana")).toBe(true);
    expect(i.contains("zebra")).toBe(false);
    expect(i.contains("apple")).toBe(true);
  });

  it("works with Dates via custom comparator", () => {
    const cmp = (a: Date, b: Date) => a.getTime() - b.getTime();
    const jan = new Date("2024-01-01");
    const mar = new Date("2024-03-01");
    const may = new Date("2024-05-01");
    const dec = new Date("2024-12-01");

    const q1 = Interval.closed(jan, mar, cmp);
    const q4 = Interval.closed(may, dec, cmp);
    const u = q1.union(q4);

    expect(u.contains(new Date("2024-02-01"))).toBe(true);
    expect(u.contains(new Date("2024-04-01"))).toBe(false);
    expect(u.contains(new Date("2024-07-01"))).toBe(true);
  });

  it("custom integer comparator", () => {
    const cmp = (a: bigint, b: bigint) => (a < b ? -1 : a > b ? 1 : 0);
    const i = Interval.closed<bigint>(1n, 10n, cmp);
    expect(i.contains(5n)).toBe(true);
    expect(i.contains(11n)).toBe(false);
  });
});

// ── Algebraic laws ────────────────────────────────────────────────────────────

describe("algebraic laws", () => {
  const A = closed(1, 4);
  const B = closed(3, 7);
  const C = closed(6, 10);

  it("commutativity of union: A ∪ B = B ∪ A", () => {
    expect(A.union(B).equals(B.union(A))).toBe(true);
  });

  it("commutativity of intersection: A ∩ B = B ∩ A", () => {
    expect(A.intersection(B).equals(B.intersection(A))).toBe(true);
  });

  it("associativity of union: (A ∪ B) ∪ C = A ∪ (B ∪ C)", () => {
    expect(A.union(B).union(C).equals(A.union(B.union(C)))).toBe(true);
  });

  it("associativity of intersection: (A ∩ B) ∩ C = A ∩ (B ∩ C)", () => {
    expect(A.intersection(B).intersection(C).equals(A.intersection(B.intersection(C)))).toBe(true);
  });

  it("De Morgan: ~(A ∪ B) = ~A ∩ ~B", () => {
    const lhs = A.union(B).complement();
    const rhs = A.complement().intersection(B.complement());
    expect(lhs.equals(rhs)).toBe(true);
  });

  it("De Morgan: ~(A ∩ B) = ~A ∪ ~B", () => {
    const lhs = A.intersection(B).complement();
    const rhs = A.complement().union(B.complement());
    expect(lhs.equals(rhs)).toBe(true);
  });

  it("idempotence: A ∪ A = A", () => {
    expect(A.union(A).equals(A)).toBe(true);
  });

  it("idempotence: A ∩ A = A", () => {
    expect(A.intersection(A).equals(A)).toBe(true);
  });
});
