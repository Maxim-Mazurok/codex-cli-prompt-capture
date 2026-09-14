import fs from "node:fs/promises";
import http from "node:http";
import path from "node:path";

const host = process.env.CODEX_CAPTURE_HOST || "127.0.0.1";
const port = Number(process.env.CODEX_CAPTURE_PORT || 8998);
const outputDirectory = path.resolve(process.env.CODEX_CAPTURE_DIR || "captures");
const maxBodyBytes = Number(process.env.CODEX_CAPTURE_MAX_BODY_BYTES || 10 * 1024 * 1024);
let requestSequence = 0;

function redact(value, key = "") {
  if (/authorization|api[-_]?key|token|secret|password|cookie/i.test(key)) return "[REDACTED]";
  if (Array.isArray(value)) return value.map((item) => redact(item));
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.entries(value).map(([name, item]) => [name, redact(item, name)]));
  }
  return value;
}

function extractSystemPrompt(body) {
  const sections = [];
  if (typeof body.instructions === "string" && body.instructions.trim()) {
    sections.push(body.instructions.trim());
  }

  for (const item of Array.isArray(body.input) ? body.input : []) {
    if (!item || !["system", "developer"].includes(item.role)) continue;
    const content = Array.isArray(item.content) ? item.content : [item.content];
    const text = content
      .map((part) => typeof part === "string" ? part : part?.text)
      .filter((part) => typeof part === "string" && part.trim())
      .join("\n");
    if (text) sections.push(text);
  }

  return sections.join("\n\n");
}

function sendJson(response, statusCode, payload) {
  response.writeHead(statusCode, { "content-type": "application/json; charset=utf-8" });
  response.end(JSON.stringify(payload));
}

function sendCapturedResponse(response, model) {
  const createdAt = Math.floor(Date.now() / 1000);
  const responseId = `resp_capture_${createdAt}`;
  const payload = {
    type: "response.completed",
    response: {
      id: responseId,
      object: "response",
      created_at: createdAt,
      status: "completed",
      model: model || "codex-capture",
      output: [{
        id: `msg_capture_${createdAt}`,
        type: "message",
        status: "completed",
        role: "assistant",
        content: [{ type: "output_text", text: "Request captured locally.", annotations: [] }],
      }],
      usage: { input_tokens: 0, input_tokens_details: { cached_tokens: 0 }, output_tokens: 0, output_tokens_details: { reasoning_tokens: 0 }, total_tokens: 0 },
    },
  };

  response.writeHead(200, {
    "content-type": "text/event-stream; charset=utf-8",
    "cache-control": "no-cache",
    connection: "close",
  });
  response.end(`event: response.completed\ndata: ${JSON.stringify(payload)}\n\n`);
}

const server = http.createServer((request, response) => {
  if (request.method === "GET" && request.url === "/health") {
    sendJson(response, 200, { ok: true });
    return;
  }
  if (request.method !== "POST" || !request.url?.replace(/\?.*$/, "").endsWith("/responses")) {
    sendJson(response, 404, { error: "Capture server only accepts POST /v1/responses" });
    return;
  }

  const chunks = [];
  let bytes = 0;
  request.on("data", (chunk) => {
    bytes += chunk.length;
    if (bytes > maxBodyBytes) request.destroy(new Error(`Request exceeds ${maxBodyBytes} bytes`));
    else chunks.push(chunk);
  });
  request.on("error", (error) => {
    if (!response.headersSent) sendJson(response, 413, { error: error.message });
  });
  request.on("end", async () => {
    const id = ++requestSequence;
    try {
      const body = JSON.parse(Buffer.concat(chunks).toString("utf8"));
      const capturedAt = new Date().toISOString();
      const capture = redact({
        capturedAt,
        request: { method: request.method, url: request.url, headers: request.headers },
        body,
      });
      const prompt = extractSystemPrompt(body);

      await fs.mkdir(outputDirectory, { recursive: true });
      await Promise.all([
        fs.writeFile(path.join(outputDirectory, "latest-request.json"), `${JSON.stringify(capture, null, 2)}\n`),
        fs.writeFile(path.join(outputDirectory, "latest-system-prompt.md"), prompt ? `${prompt}\n` : ""),
      ]);
      console.log(`[${capturedAt}] captured request #${id}: ${bytes} bytes, ${prompt.length} prompt characters`);
      sendCapturedResponse(response, body.model);
    } catch (error) {
      sendJson(response, 400, { error: error.message });
    }
  });
});

server.listen(port, host, () => {
  console.log(`Codex capture server listening on http://${host}:${port}/v1`);
  console.log(`Captures will be written to ${outputDirectory}`);
});