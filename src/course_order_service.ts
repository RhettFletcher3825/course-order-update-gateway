import { createServer } from "node:http";
import { GatewayMessageWriter, prepareOrderUpdate } from "./order_update.js";

const port = Number(process.env.PORT || 3000);
const writer = new GatewayMessageWriter();

createServer((request, response) => {
  if (request.method !== "POST" || request.url !== "/order-updates") {
    response.writeHead(404).end();
    return;
  }

  const chunks: Buffer[] = [];
  request.on("data", (chunk: Buffer) => chunks.push(chunk));
  request.on("end", async () => {
    try {
      const body: unknown = JSON.parse(Buffer.concat(chunks).toString("utf8"));
      const result = await prepareOrderUpdate(body, writer);
      response.writeHead(200, { "content-type": "application/json" });
      response.end(JSON.stringify(result));
    } catch (error) {
      const message = error instanceof Error ? error.message : "Invalid request";
      response.writeHead(400, { "content-type": "application/json" });
      response.end(JSON.stringify({ error: message }));
    }
  });
}).listen(port, () => console.log(`Course order service listening on http://localhost:${port}`));
