# intervalkit

Algebraically closed interval arithmetic — union, intersection, complement, difference over any comparable type. Port of Python's [`portion`](https://github.com/AlexandreDecan/portion) library. Zero dependencies, MIT license.

[![npm](https://img.shields.io/npm/v/intervalkit)](https://www.npmjs.com/package/intervalkit)
[![npm downloads](https://img.shields.io/npm/dw/intervalkit)](https://www.npmjs.com/package/intervalkit)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

## Why intervalkit?

The only comparable npm package (`interval-arithmetic`) uses **Business Source License 1.1** — not open source, cannot be used freely in commercial projects. `intervalkit` is MIT licensed.

Works on numbers, strings, Dates, BigInts — anything with a comparator.

## Install

```bash
npm install intervalkit
```

## Quick start

```ts
import { closed, open, closedOpen, all, empty } from "intervalkit";

const i = closed(1, 10);     // [1, 10]
i.contains(5);               // true
i.contains(11);              // false

// Set operations — results are always Interval instances
const a = closed(1, 5);
const b = closed(3, 8);

a.union(b);                  // [1, 8]
a.intersection(b);           // [3, 5]
a.difference(b);             // [1, 3)
a.complement();              // (-∞, 1) | (5, +∞)
a.symmetricDifference(b);    // [1, 3) | (5, 8]

// Disjoint union
const u = closed(1, 3).union(closed(5, 7));  // [1, 3] | [5, 7]
u.contains(2);               // true
u.contains(4);               // false
u.size;                      // 2 — two atomic pieces
u.toString();                // "[1, 3] | [5, 7]"

for (const atom of u) {
  console.log(atom.toString()); // "[1, 3]", then "[5, 7]"
}
```

## API

### Creating intervals

| Function | Notation | Description |
|----------|----------|-------------|
| `closed(lo, hi)` | `[lo, hi]` | Closed on both ends |
| `open(lo, hi)` | `(lo, hi)` | Open on both ends |
| `closedOpen(lo, hi)` | `[lo, hi)` | Closed lower, open upper |
| `openClosed(lo, hi)` | `(lo, hi]` | Open lower, closed upper |
| `singleton(v)` | `[v, v]` | A single point |
| `empty()` | `∅` | Empty interval |
| `all()` | `(-∞, +∞)` | All values |
| `greaterThan(v)` | `(v, +∞)` | |
| `atLeast(v)` | `[v, +∞)` | |
| `lessThan(v)` | `(-∞, v)` | |
| `atMost(v)` | `(-∞, v]` | |

All constructors accept an optional `Comparator<T>` as the last argument.

### `Interval<T>` methods

#### Set operations

| Method | Description |
|--------|-------------|
| `.union(other)` | All points in this OR other |
| `.intersection(other)` | Points in both this AND other |
| `.complement()` | All points NOT in this |
| `.difference(other)` | Points in this but NOT in other |
| `.symmetricDifference(other)` | Points in exactly one of the two |

All operations return a normalized `Interval<T>` — a union of non-overlapping, non-adjacent atomic intervals sorted by lower bound.

#### Queries

| Method | Returns | Description |
|--------|---------|-------------|
| `.contains(v)` | `boolean` | Is the point `v` in this interval? |
| `.encloses(other)` | `boolean` | Is `other` a subset of this? |
| `.overlaps(other)` | `boolean` | Do they share at least one point? |
| `.equals(other)` | `boolean` | Do they contain exactly the same points? |
| `.isEmpty()` | `boolean` | Is this the empty interval? |
| `.isAtomic()` | `boolean` | Is this a single contiguous piece? |

#### Accessors

| Property | Type | Description |
|----------|------|-------------|
| `.lower` | `T \| NEGINF \| undefined` | Lower bound (undefined if empty) |
| `.upper` | `T \| POSINF \| undefined` | Upper bound (undefined if empty) |
| `.lowerInc` | `boolean` | Is the lower bound inclusive? |
| `.upperInc` | `boolean` | Is the upper bound inclusive? |
| `.size` | `number` | Number of atomic pieces |

#### Iteration

```ts
// Iterate over atomic (contiguous) pieces
for (const atom of interval) {
  console.log(atom.lower, atom.upper);
}

// Or use .atoms()
for (const atom of interval.atoms() as Iterable<Interval<number>>) {
  // each atom has isAtomic() === true
}
```

#### Output

```ts
interval.toString();
// "∅", "[1, 5]", "(2, 8)", "(-∞, 3] | [7, +∞)", etc.
```

### Using with non-number types

Pass a custom comparator to any factory function:

```ts
// Dates
const cmp = (a: Date, b: Date) => a.getTime() - b.getTime();
const q1 = Interval.closed(new Date("2024-01-01"), new Date("2024-03-31"), cmp);
const q3 = Interval.closed(new Date("2024-07-01"), new Date("2024-09-30"), cmp);
const notSummer = q1.union(q3);

// Strings (lexicographic)
const az = closed("a", "z");
az.contains("hello");  // true

// BigInt
const big = Interval.closed<bigint>(0n, 100n, (a, b) => (a < b ? -1 : a > b ? 1 : 0));
```

### Algebraic laws verified by tests

- Commutativity: `A ∪ B = B ∪ A`, `A ∩ B = B ∩ A`
- Associativity: `(A ∪ B) ∪ C = A ∪ (B ∪ C)`
- De Morgan's laws: `~(A ∪ B) = ~A ∩ ~B`, `~(A ∩ B) = ~A ∪ ~B`
- Idempotence: `A ∪ A = A`, `A ∩ A = A`
- Identity: `A ∪ ∅ = A`, `A ∩ all = A`
- Complement: `A ∪ ~A = all`, `A ∩ ~A = ∅`

### Sentinels

```ts
import { NEGINF, POSINF } from "intervalkit";
const i = atMost(5);
i.lower === NEGINF;  // true — no lower bound
```

## License

MIT
