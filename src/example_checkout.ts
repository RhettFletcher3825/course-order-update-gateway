import { GatewayMessageWriter, prepareOrderUpdate } from "./order_update.js";

const result = await prepareOrderUpdate(
  {
    orderId: "order-course-1042",
    courseTitle: "Practical Algebra",
    customerName: "Mina",
    paymentStatus: "paid",
    fulfillmentStatus: "access_granted",
    receiptNumber: "EDU-1042"
  },
  new GatewayMessageWriter()
);

console.log(result);
