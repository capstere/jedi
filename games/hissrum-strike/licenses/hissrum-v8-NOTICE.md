# Combat readability v8 — provenance

This Hissrum Strike update adapts presentation ideas from the readable MIT
source snapshot of **Riposte: Frontline 5.6.0**, already vendored in the owner's
`capstere/cartridge-strike` repository under `frontline/source/`.
It is not the official game and imports no Riposte branding, music, animations,
voice samples, textures or protected HIT_SAMPLE audio.

Inspected source references:

- `src/09m-marqueurs.js`, Git blob `8d7ee9c637fcf1f1a254bef981bcb91a87b01959`:
  pooled allied-only name/chevron markers, distance fade, occlusion sampling,
  and hiding markers when scoped, dead or not playing.
- `src/09-game.js`, Git blob `035a0ba8062c792e46455e53c82a361c9fe4a8d2`:
  confirmed body/head/lethal hit feedback, shot-origin damage indication,
  timed combos and match/assist statistics.
- `src/08-player.js`, Git blob `60857584ff4a2d3f664c70d09fa54c852a5b07d0`:
  keyboard-accessible scoreboard, damage direction state and weapon HUD.

The MIT notice is retained in `riposte-MIT.txt`; asset exclusions are documented
in `riposte-NOTICE.md`. The v8 code is a new, small ES-module adaptation for
Hissrum's `Game` events and original GLB scene, not a drop-in copy of Riposte's
monolithic renderer or a network/progression implementation.

Existing `combat-flow.mjs` is the sole authority for hit, damage, assists,
combos and match points. The new presentation never grants credits, changes
weapon damage, adjusts aim, tracks enemy positions behind walls, or alters
bot decisions. Damage arrows retain the hit event's source-position snapshot;
only friendly actors have name markers. Match points are not shop currency.
