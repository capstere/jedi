# Combat-effects lifecycle polish

Scope: `src/effects.mjs` and the small, dependency-free `src/effect-items.mjs` helper. No new controls, map changes, assets, gameplay rules, weapon statistics, bot decisions, audio changes or grenade changes.

## Work reduced

The previous effect update copied the whole active array every frame (twice when blood was disabled), then used `indexOf` plus `splice` for each expired/collided item. A large group expiring together therefore repeatedly searched and shifted the same list.

The new pass compacts survivors in the existing array, maintaining insertion order. Each item is read once and is either kept or releases its batch transform once. Only moved survivors are written back. All-kept frames do not rewrite even the array's length. Clear/reset uses a direct release loop. The existing final batch flush is retained; this is not a claim that the entire effect renderer now performs zero work or zero allocations.

The particle collision path also copies hit components directly into the existing position vector, avoiding the old two temporary Vector3 copies per hit. Shared hit data is never modified.

## Lifecycle correctness

A repeated `recycle(oldItem)` previously released a transform before checking whether the item was still active. If that transform had been reused, the old reference could corrupt the pool. Membership is now checked first, so stale or repeated releases return false and leave the new item alone. Whole-system disposal is idempotent; shared resources are released once.

## Preserved behavior

Unchanged particle counts, per-kind capacities (384/160/120/52/64), cosmetic randomness, materials, texture generation, transparent item order, oldest-first eviction, event deduplication, gravity, swept collision distance, casing spin/settlement, camera-facing blood and attached marks. Expiry remains strictly `time > until`. Blood off clears existing blood particles and stains but leaves other effects intact. Gameplay randomness and damage are never consulted or changed.

## Regression checks

- Eight Node cases: retained object/array identity, stable ordering, adjacent removals, strict expiry, blood settings, reset, deterministic reference filtering and work counts. A full 780-item expiration must use 780 item reads and no snapshots, index scans or splice shifts. 600 all-kept passes must issue zero active-array writes.
- Focused Chromium test using the game's own Three.js import map, actual Vector3/Quaternion/Object3D/InstancedMesh and BufferAttributes. It compares every retained transform, active instance matrix, lifetime, batch count, statistics and raycast arguments with the previous movement/update loop over 62 frames in standard/reduced blood modes.
- Additional native checks: unchanged matrices do not acquire new GPU dirty flags across 600 updates, all 780 slots retire once, stale references cannot release reused slots, and all 16 shared resources dispatch disposal once.
- The existing complete original-GLB desktop/mobile gameplay smoke remains unchanged and runs after this check. No physical-phone FPS, battery or memory benchmark is implied. CI is the execution authority for this change; local runtime execution was unavailable.

Reference: `df2c1e1938ba1e1adb36c9faab7ef42326983661` of `capstere/jedi`. Three.js Vector3 in-place operations: https://threejs.org/docs/pages/Vector3.html.
