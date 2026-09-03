# Proximity alert policy

This contribution adds a pure, source-agnostic proximity state machine that can be shared by God's Eye View data layers.

## Behavior

`src/data/proximityPolicy.js` converts distance observations into stable states and edge events:

- `ENTER` when a target crosses into the configured radius.
- `INSIDE` while it remains within the watch.
- `EXIT` when an in-range target reaches the exit threshold.
- `UNKNOWN` when the observation is invalid or unavailable.

The policy supports hysteresis by separating enter and exit thresholds, preventing contacts hovering around a boundary from repeatedly firing.

## Source-agnostic by design

The state machine has no Cesium, DOM, network, or UI dependency. Aircraft, vessels, satellites, fires, installations, and future user-defined sources can reuse the same semantics.

`UNKNOWN` is silent by design: an unavailable or stale feed must not be converted into a claim that a target entered or left.

## Integration path

The existing awareness/contact stack already computes nearby entities and is the natural first consumer. A layer can keep a `Map` keyed by source + target ID and call `updateProximityState()` as refreshed distances arrive.

Only `ENTER` and `EXIT` should drive notifications. Presentation can later choose a toast, HUD marker, or voice event without putting alert policy into the source adapters.
