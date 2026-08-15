import assert from "node:assert/strict";
import test from "node:test";
import { prepareOrderUpdate, type CourseOrder, type MessageWriter } from "../src/order_update.js";

test("waits for course access before asking AI to write a customer update", async () => {
  let calls = 0;
  const writer: MessageWriter = {
    async write() {
      calls += 1;
      return "unused";
    }
  };

  const result = await prepareOrderUpdate({
    orderId: "order-7",
    courseTitle: "Geometry Lab",
    customerName: "Sam",
    paymentStatus: "paid",
    fulfillmentStatus: "pending"
  }, writer);

  assert.deepEqual(result, { status: "waiting_for_access", orderId: "order-7" });
  assert.equal(calls, 0);
});

test("writes a receipt update with a stable order key when checkout is complete", async () => {
  let observedKey = "";
  const writer: MessageWriter = {
    async write(_order: CourseOrder, idempotencyKey: string) {
      observedKey = idempotencyKey;
      return "Mina, your Practical Algebra access and receipt EDU-1042 are ready.";
    }
  };

  const result = await prepareOrderUpdate({
    orderId: "order-course-1042",
    courseTitle: "Practical Algebra",
    customerName: "Mina",
    paymentStatus: "paid",
    fulfillmentStatus: "access_granted",
    receiptNumber: "EDU-1042"
  }, writer);

  assert.equal(result.status, "ready");
  assert.equal(observedKey, "course-order-update:order-course-1042");
});
