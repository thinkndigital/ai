import Anthropic from "@anthropic-ai/sdk";

// Models the UI may pick from. Anything else is rejected.
const MODELS = {
  "claude-opus-5-5": { effort: "medium", fallbacks: true },
  "claude-sonnet-5-5": { effort: "low", fallbacks: true },
  "claude-haiku-4-5": { effort: null, fallbacks: false },
};
const DEFAULT_MODEL = "claude-opus-5-5";
const MAX_MESSAGES = 60;
const MAX_CHARS = 100_000;

const SYSTEM_PROMPT = `أنت مساعد ذكي ودود اسمه "ذكاء". تجيب باللغة التي يكتب بها المستخدم، وبالعربية الفصحى المبسطة عندما يكتب بالعربية.
كن واضحًا ومفيدًا ومباشرًا. استخدم تنسيق Markdown (عناوين، قوائم، جداول، كتل كود) عندما يساعد ذلك على الفهم.`;

const client = new Anthropic(); // reads ANTHROPIC_API_KEY from the environment

const json = (status, body) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json; charset=utf-8" },
  });

function validateMessages(messages) {
  if (!Array.isArray(messages) || messages.length === 0) return false;
  if (messages.length > MAX_MESSAGES) return false;
  let total = 0;
  for (const [i, m] of messages.entries()) {
    if (!m || typeof m.content !== "string" || !m.content.trim()) return false;
    const expected = i % 2 === 0 ? "user" : "assistant";
    if (m.role !== expected) return false;
    total += m.content.length;
  }
  return total <= MAX_CHARS && messages.at(-1).role === "user";
}

export default async (req) => {
  if (req.method !== "POST") return json(405, { error: "Method not allowed" });

  let body;
  try {
    body = await req.json();
  } catch {
    return json(400, { error: "Invalid JSON" });
  }

  const model = MODELS[body.model] ? body.model : DEFAULT_MODEL;
  const cfg = MODELS[model];
  const messages = (body.messages ?? []).map(({ role, content }) => ({ role, content }));
  if (!validateMessages(messages)) return json(400, { error: "Invalid messages" });

  const params = {
    model,
    max_tokens: 64000,
    system: SYSTEM_PROMPT,
    messages,
  };
  if (cfg.effort) {
    params.thinking = { type: "adaptive" };
    params.output_config = { effort: cfg.effort };
  }

  const stream = cfg.fallbacks
    ? client.beta.messages.stream({
        ...params,
        betas: ["server-side-fallback-2026-07-01"],
        fallbacks: "default",
      })
    : client.messages.stream(params);

  const encoder = new TextEncoder();
  const send = (controller, obj) =>
    controller.enqueue(encoder.encode(JSON.stringify(obj) + "\n"));

  // Newline-delimited JSON: {"t": "..."} text chunks, then {"done": true} or {"error": "..."}.
  const readable = new ReadableStream({
    async start(controller) {
      try {
        for await (const event of stream) {
          if (event.type === "content_block_delta" && event.delta.type === "text_delta") {
            send(controller, { t: event.delta.text });
          }
        }
        const final = await stream.finalMessage();
        if (final.stop_reason === "refusal") {
          send(controller, { error: "refusal" });
        } else {
          send(controller, { done: true, stop: final.stop_reason, model: final.model });
        }
      } catch (err) {
        if (err instanceof Anthropic.APIUserAbortError) {
          // client disconnected
        } else if (err instanceof Anthropic.RateLimitError) {
          send(controller, { error: "rate_limit" });
        } else if (err instanceof Anthropic.AuthenticationError) {
          console.error("Anthropic auth error — check ANTHROPIC_API_KEY");
          send(controller, { error: "server_config" });
        } else if (err instanceof Anthropic.APIError) {
          console.error("Anthropic API error", err.status, err.message);
          send(controller, { error: "api" });
        } else {
          console.error(err);
          send(controller, { error: "unknown" });
        }
      } finally {
        controller.close();
      }
    },
    cancel() {
      stream.abort();
    },
  });

  return new Response(readable, {
    headers: {
      "content-type": "application/x-ndjson; charset=utf-8",
      "cache-control": "no-cache",
    },
  });
};

export const config = { path: "/api/chat" };
