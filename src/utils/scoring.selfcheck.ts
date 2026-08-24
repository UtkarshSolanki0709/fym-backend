/**
 * One runnable check for scoring pure fns.
 * Run: npx tsx src/utils/scoring.selfcheck.ts
 */
import assert from "node:assert/strict";
import {
  distanceKm,
  interestOverlap,
  matchScore,
  parseGeo,
  preferenceFit,
  proximityScore,
  trustNorm,
} from "./scoring.js";

assert.ok(distanceKm({ lat: 28.6, lng: 77.2 }, { lat: 28.6, lng: 77.2 }) < 0.01);
assert.ok(distanceKm({ lat: 28.6, lng: 77.2 }, { lat: 19.0, lng: 72.8 }) > 1000);

assert.equal(preferenceFit(25, 25), 1);
assert.ok(preferenceFit(25, 40) < preferenceFit(25, 27));

assert.equal(trustNorm(0.9, null), 0.9);
assert.equal(trustNorm(null, 50), 0.5);

const prox = proximityScore({ lat: 0, lng: 0 }, { lat: 0, lng: 0.1 }, 50);
assert.ok(prox.score > 0 && prox.score <= 1);

assert.ok(interestOverlap(["chai", "books"], ["books", "hiking"]) > 0);
assert.ok(interestOverlap(["chai"], ["hiking"]) === 0);

const score = matchScore({
  preference_fit: 1,
  trust_norm: 1,
  proximity: 1,
  activity_recency: 1,
  interest_overlap: 1,
  novelty: 1,
});
assert.ok(Math.abs(score - 1) < 1e-9);

const g = parseGeo({ type: "Point", coordinates: [77.2, 28.6] });
assert.deepEqual(g, { lat: 28.6, lng: 77.2 });


