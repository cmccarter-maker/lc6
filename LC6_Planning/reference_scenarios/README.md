# LC6 Reference Scenarios

Literature-anchored test scenarios for physics validation. These scenarios serve as fixed-point ground truth against which physics changes are validated via §7 hand-compute gates per memory #30.

## Purpose

Traditional test assertions calibrate against engine output ("Breck scenario produces MR=2.7 therefore assert MR=2.7"). This approach cements existing bugs into regression tests. When upstream physics is wrong, tests lock the wrongness into place.

Reference scenarios flip the calibration source: assertions are anchored to **literature / published physics / first-principles derivation**, not engine output. Expected MR ranges come from physiology literature (Havenith, Fukazawa, Rossi, ASHRAE) plus hand-computed energy balances.

When the engine produces values outside the reference envelope, that's the signal — either a new bug, or the reference itself needs review.

## Format

Each reference scenario lives as a markdown file named `S-NNN_short_descriptor.md`:

- S-NNN: sequential ID (S-001, S-002, etc.)
- short_descriptor: 2-4 word slug (e.g., `breck_ski`, `mist_trail`, `e7_fishing`)

Each scenario file contains:
1. **Inputs** — temperature, RH, wind, activity, duration, ensemble composition (CLO, im, fabric composition)
2. **Physics regime** — cold-dry, warm-humid, extreme-humidity, etc.
3. **Derived expectations** — hand-computed or literature-cited values for:
   - Sweat rate (Gagge model)
   - Evaporative capacity (E_max)
   - Expected total fluid loss
   - Expected distribution across layers
   - Expected MR range (with confidence bounds)
4. **Citations** — specific literature backing each expected value
5. **Validation notes** — when this scenario was computed, by whom, against what spec/commit

## Active scenarios

Per PHY-SHELL-GATE v1 DRAFT §6:

- [S-001] Breck ski (cold-dry hardshell) — status: skeleton
- [S-002] Mist Trail to Vernal Fall (warm-humid hardshell) — status: skeleton
- [S-003] E7 fishing (extreme humid-stationary) — status: skeleton
- [S-004] Puffy-as-shell (classification regression) — status: skeleton

## Lifecycle

1. **Skeleton** — inputs and expected regime identified, expected values TBD
2. **Literature-anchored** — expected values derived from published sources with citations
3. **Hand-computed** — explicit math trace from inputs to expected outputs
4. **Validated** — current engine run matches expected envelope (at time of validation)
5. **Flagged** — engine output deviates from envelope; investigation required

## Usage in specs

Specs that propose physics changes must reference scenarios that:
- Have at least `literature-anchored` status before ratification
- Be hand-computed before implementation §7 gate clearance
- Be validated post-implementation as regression protection

## Related tracker items

- `S22-SHELL-CAPACITY-MODEL` — reference scenarios S-001 through S-004
- `S22-CASCADE-ASYMMETRIC` — will add S-005 for base-overflow behavior
- `S22-MICROCLIMATE-VP` — will add S-006 for microclimate VP feedback
