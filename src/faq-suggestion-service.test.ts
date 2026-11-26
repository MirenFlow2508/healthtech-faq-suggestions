import { strict as assert } from "node:assert";
import { notificationFor } from "./notification-policy.ts";

assert.equal(notificationFor(0.77), "human_review");
assert.equal(notificationFor(0.78), "answer_shown");
console.log("ambiguous appointment question -> human review");
