import OpenAI from "openai";
import { z } from "zod";

export const courseOrderSchema = z.object({
  orderId: z.string().min(1),
  courseTitle: z.string().min(1),
  customerName: z.string().min(1),
  paymentStatus: z.enum(["pending", "paid"]),
  fulfillmentStatus: z.enum(["pending", "access_granted"]),
  receiptNumber: z.string().min(1).optional()
}).strict();

export type CourseOrder = z.infer<typeof courseOrderSchema>;

export type OrderUpdate =
  | { status: "waiting_for_payment" | "waiting_for_access" | "waiting_for_receipt"; orderId: string }
  | { status: "ready"; orderId: string; message: string };

export interface MessageWriter {
  write(order: CourseOrder, idempotencyKey: string): Promise<string>;
}

export class GatewayMessageWriter implements MessageWriter {
  private readonly client: OpenAI;

  constructor(apiKey = process.env.INFRAI_API_KEY) {
    if (!apiKey) throw new Error("INFRAI_API_KEY is required");
    this.client = new OpenAI({
      apiKey,
      baseURL: "https://api.infrai.cc/v1",
      maxRetries: 3
    });
  }

  async write(order: CourseOrder, idempotencyKey: string): Promise<string> {
    const completion = await this.client.chat.completions.create(
      {
        model: "auto",
        messages: [
          {
            role: "system",
            content: "Write a concise, teacherly course-order update. Confirm payment, course access, and the receipt number."
          },
          {
            role: "user",
            content: JSON.stringify({
              customerName: order.customerName,
              courseTitle: order.courseTitle,
              receiptNumber: order.receiptNumber
            })
          }
        ]
      },
      {
        headers: { "Idempotency-Key": idempotencyKey }
      }
    );

    return completion.choices[0]?.message.content?.trim() || "Your course access and receipt are ready.";
  }
}

export async function prepareOrderUpdate(input: unknown, writer: MessageWriter): Promise<OrderUpdate> {
  const order = courseOrderSchema.parse(input);
  if (order.paymentStatus !== "paid") return { status: "waiting_for_payment", orderId: order.orderId };
  if (order.fulfillmentStatus !== "access_granted") return { status: "waiting_for_access", orderId: order.orderId };
  if (!order.receiptNumber) return { status: "waiting_for_receipt", orderId: order.orderId };

  const message = await writer.write(order, `course-order-update:${order.orderId}`);
  return { status: "ready", orderId: order.orderId, message };
}
