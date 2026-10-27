# Bounded audio presentation polish

Only `src/audio.mjs` changes production behavior. This is an internal work-budget improvement, not new controls or a new sound pack. Hissrum geometry, tank rules, bot hearing, damage, fire rates, shot timing, volume settings and the existing MP3/OGG assets remain unchanged.

## What changed

1. **Listener updates:** the current listener position and a nine-value cache are reused. Identical coordinates and orientation no longer enqueue the same Web Audio parameter automation each frame. Changed coordinates/rotation are still submitted immediately, with no smoothing threshold or added latency. Spectator/driver identity is refreshed even when the pose is unchanged. Reset or a replacement native listener forces a complete resynchronization. The legacy `setPosition`/`setOrientation` path is preserved.
2. **One obstruction check per layered sound:** a shot has noise, a tone and a metallic layer. All three are scheduled synchronously from the same observed event, so they share that event's position/occlusion calculation. The short-lived scope is removed in `finally`. Every next event rechecks the real world, even at the same coordinates; moving obstacles are not memoized across frames. Gains, filters, panning, rates, envelopes, sample selection and scheduling formulas are unchanged below saturation.
3. **Actual 96-voice ceiling:** the existing limit was checked only before an event, so an event beginning with 95 active sources could allocate three more. Sample, tone and noise layers now check before allocating any source/filter/panner/noise buffer. Excess layers are suppressed only at saturation; playing voices are not interrupted. This ceiling concerns the transient effect pool; the separate existing room-ambient system is unchanged.

## Measured work counts

The deterministic unit fixture verifies:

- Initial nine listener writes, then **zero additional writes for 600 identical updates** (the old implementation scheduled another 5,400).
- **One obstacle query instead of three** for a normal three-layer remote AR-47 shot, with the same gains, low-pass frequencies, panning coordinates and scheduled start times.
- At saturation, 100 additional shot recipes allocate **zero new source nodes, filter/panner nodes or synthetic noise buffers**. A naturally ended source frees a slot for a new one-shot source.
- Identity/context changes, legacy listeners, fresh obstruction state, ignored events, nested/failed dispatch, mute, pause/reset, disposal, delayed reload cancellation and clock rewind retain their behavior.

These are operation counts, not a physical-phone FPS, latency, acoustic-quality or battery-life benchmark.

## Verification

`node --test games/hissrum-strike/tests/audio-work.test.mjs` runs ten focused tests. The native Web Audio Chromium runner decodes all 15 real local game samples, exercises actual AudioParams, PannerNodes, BufferSourceNodes and OscillatorNodes, and checks voice saturation/ending, reset and resume. Its obstruction probe is a fixture; the separate unchanged full real-GLB desktop/mobile smoke covers the integrated room, sound controls, vehicle, flight, firearms and existing gameplay.

The local environment blocks HTTP browser navigation, so native-browser verification is performed by GitHub Actions rather than asserted from local Node fixtures. Merge requires green checks on the exact PR head. No tests are disabled or loosened.

Web Audio reference: https://www.w3.org/TR/webaudio/#AudioListener and https://www.w3.org/TR/webaudio/#dom-audioparam-setvalueattime . No external code or assets are copied by this update.
