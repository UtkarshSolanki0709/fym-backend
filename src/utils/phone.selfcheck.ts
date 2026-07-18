/**
 * Run: npx tsx src/utils/phone.selfcheck.ts
 */
import assert from "node:assert/strict";
import { isE164, normalizeE164 } from "./phone.js";

assert.equal(normalizeE164("+91 98765 43210"), "+919876543210");
assert.equal(normalizeE164(" 919876543210"), "+919876543210"); // + became space
assert.equal(normalizeE164("+919876543210"), "+919876543210");
assert.ok(isE164("+919876543210"));
assert.ok(!isE164("9876543210"));

console.log("phone.selfcheck OK");
