# Proximity alert policy

God's Eye View already exposes several live sources whose objects can be near a point of interest. This contribution extracts the alert semantics from those source adapters so future notifications do not each invent their own threshold handling.

## Contract

`src/data/proximityPolicy.js` is a pure ES module. It has no Cesium, DOM, network, or source-specific imports.

A policy is defined by `enterRadiusM` and `exitRadiusM`. Enter is inclusive at or below the enter radius; exit is inclusive at or above the exit radius. `exitRadiusM` must be greater than or equal to `enterRadiusM`.

The evaluator returns `ENTER` once on an outside/uninitialized → inside transition, `INSIDE` while inside, `EXIT` once on an inside → outside transition, `OUTSIDE` while outside, and `UNKNOWN` for invalid/unavailable observations or invalid policies.

## Missing data is not an alert

An invalid observation never fabricates an `ENTER` or `EXIT`. In the multi-target helper, `UNKNOWN` also leaves the target's last known state in place. A temporary feed outage therefore cannot silently create an exit, and recovery cannot fabricate a new enter event.

## Multi-target state

`updateProximityState(states, targetId, distanceM, policy)` returns a new `Map` rather than mutating the caller's map. Target IDs are trimmed strings; blank IDs are rejected.

`removeProximityTarget(states, targetId)` returns a new ledger with the target removed, allowing source adapters to release state when an object disappears permanently.

## Intended integration

An awareness/contact layer can keep a map keyed by `source:targetId`, feed fresh distance observations through `updateProximityState()`, and act only on `ENTER` / `EXIT`. Presentation stays outside this module so a future HUD, toast, voice event, or log can consume the same policy without duplicating threshold logic.