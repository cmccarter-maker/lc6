# LC6 — LayerCraft v6

Physics-based outdoor thermal comfort and gear recommendation platform.

## Architecture

Per `LC6_Architecture_Document_v1.1_RATIFIED.md`:

- `packages/engine` — physics engine (pure function: `evaluate(input) → EngineOutput`)
- `packages/gear-api` — gear DB query layer
- `packages/shared` — cross-package types
- `apps/web` — display app

## Setup

```bash
pnpm install
```

## Test

```bash
pnpm test            # all packages
pnpm test:engine     # engine only
```

## Build

```bash
pnpm build
```

## Specs

- `LC6_CDI_Derivation_Spec_v1.4_RATIFIED.md` — CDI clinical-stage formulation
- `LC6_Architecture_Document_v1.1_RATIFIED.md` — system architecture
- `LC6_Heat_Balance_Variables.md` — engine surface
- `LC6_Working_Agreement_v3.md` — development discipline
