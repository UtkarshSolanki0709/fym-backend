/**
 * Run: npx tsx src/utils/mediaCrypto.selfcheck.ts
 */
import assert from "node:assert/strict";
import { encryptMedia, decryptMedia, isEncryptedBlob, signMediaPath, verifyMediaSignature } from "./mediaCrypto.js";

const plain = Buffer.from("hello-fym-photo-bytes");
const enc = encryptMedia(plain);
assert.ok(isEncryptedBlob(enc));
assert.notDeepEqual(enc, plain);
const dec = decryptMedia(enc);
assert.deepEqual(dec, plain);

const key = "profiles/user/photo.jpeg";
const { exp, sig } = signMediaPath(key, 60);
assert.ok(verifyMediaSignature(key, exp, sig));
assert.ok(!verifyMediaSignature(key, exp, "bad"));
assert.ok(!verifyMediaSignature(key, Math.floor(Date.now() / 1000) - 10, sig));

console.log("mediaCrypto.selfcheck OK");
