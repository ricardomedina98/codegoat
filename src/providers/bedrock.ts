import { createHmac, createHash } from "node:crypto";
import type { ChatRequest, ChatMessage, LLMProvider } from "./types.js";

/**
 * AWS Bedrock provider using native fetch + AWS Signature V4.
 * No SDK dependency — uses env vars for credentials.
 *
 * Env vars:
 *   AWS_ACCESS_KEY_ID — AWS access key
 *   AWS_SECRET_ACCESS_KEY — AWS secret key
 *   AWS_SESSION_TOKEN — optional session token (for assumed roles)
 *   AWS_REGION — AWS region (default: us-east-1)
 *   CODEGOAT_MODEL — Bedrock model ID (default: anthropic.claude-3-haiku-20240307-v1:0)
 */

const DEFAULT_MODEL = "anthropic.claude-3-haiku-20240307-v1:0";
const DEFAULT_REGION = "us-east-1";

export class BedrockProvider implements LLMProvider {
  readonly name = "bedrock";
  private readonly accessKey: string;
  private readonly secretKey: string;
  private readonly sessionToken?: string;
  private readonly region: string;
  private readonly defaultModel: string;

  constructor(model?: string) {
    const accessKey = process.env.AWS_ACCESS_KEY_ID;
    const secretKey = process.env.AWS_SECRET_ACCESS_KEY;
    if (!accessKey || !secretKey) {
      throw new Error(
        "AWS_ACCESS_KEY_ID and AWS_SECRET_ACCESS_KEY must be set for the bedrock provider."
      );
    }
    this.accessKey = accessKey;
    this.secretKey = secretKey;
    this.sessionToken = process.env.AWS_SESSION_TOKEN;
    this.region = process.env.AWS_REGION ?? DEFAULT_REGION;
    this.defaultModel = model ?? process.env.CODEGOAT_MODEL ?? DEFAULT_MODEL;
  }

  async *chat(request: ChatRequest): AsyncIterable<string> {
    const modelId = request.model ?? this.defaultModel;
    const isAnthropic = modelId.startsWith("anthropic.");

    // Build Bedrock-compatible request body
    const body = isAnthropic
      ? this.buildAnthropicBody(request)
      : this.buildGenericBody(request);

    const host = `bedrock-runtime.${this.region}.amazonaws.com`;
    const path = `/model/${modelId}/invoke-with-response-stream`;
    const url = `https://${host}${path}`;

    const bodyStr = JSON.stringify(body);
    const headers = this.signRequest("POST", host, path, bodyStr);

    let response: Response;
    try {
      response = await fetch(url, {
        method: "POST",
        headers: { ...headers, "Content-Type": "application/json" },
        body: bodyStr,
      });
    } catch (err) {
      throw new Error(`Network error connecting to AWS Bedrock: ${err instanceof Error ? err.message : String(err)}`);
    }

    if (!response.ok) {
      const text = await response.text().catch(() => "unknown error");
      throw new Error(`AWS Bedrock API error (${response.status}): ${text}`);
    }

    if (!response.body) {
      throw new Error("Bedrock response has no body");
    }

    yield* this.parseEventStream(response.body, isAnthropic);
  }

  private buildAnthropicBody(request: ChatRequest): object {
    const systemMsg = request.messages.find(m => m.role === "system");
    const messages = request.messages
      .filter(m => m.role !== "system")
      .map(m => ({ role: m.role, content: m.content }));

    return {
      anthropic_version: "bedrock-2023-05-31",
      max_tokens: request.maxTokens ?? 4096,
      ...(systemMsg ? { system: systemMsg.content } : {}),
      messages,
    };
  }

  private buildGenericBody(request: ChatRequest): object {
    return {
      messages: request.messages.map(m => ({ role: m.role, content: m.content })),
      max_tokens: request.maxTokens ?? 4096,
    };
  }

  private async *parseEventStream(
    body: ReadableStream<Uint8Array>,
    isAnthropic: boolean
  ): AsyncIterable<string> {
    const decoder = new TextDecoder();
    let buffer = "";

    for await (const chunk of body) {
      buffer += decoder.decode(chunk, { stream: true });

      // Bedrock event stream uses newline-delimited JSON events
      // Each event has :event-type header and JSON payload
      const lines = buffer.split("\n");
      buffer = lines.pop() ?? "";

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed) continue;

        try {
          const event = JSON.parse(trimmed);

          if (isAnthropic) {
            // Anthropic Messages format via Bedrock
            if (event.type === "content_block_delta" && event.delta?.text) {
              yield event.delta.text;
            }
          } else {
            // Generic: try common patterns
            const text = event.outputText ?? event.completion ?? event.delta?.text ?? event.choices?.[0]?.delta?.content;
            if (text) yield text;
          }
        } catch {
          // Bedrock may send binary framing — try to extract JSON payload
          const jsonMatch = trimmed.match(/\{[^]*\}/);
          if (jsonMatch) {
            try {
              const event = JSON.parse(jsonMatch[0]);
              const text = event.delta?.text ?? event.outputText ?? event.completion;
              if (text) yield text;
            } catch { /* skip */ }
          }
        }
      }
    }
  }

  // ── AWS Signature V4 ─────────────────────────────────────────────────

  private signRequest(method: string, host: string, path: string, body: string): Record<string, string> {
    const now = new Date();
    const dateStamp = now.toISOString().replace(/[:-]|\.\d{3}/g, "").slice(0, 8);
    const amzDate = now.toISOString().replace(/[:-]|\.\d{3}/g, "").slice(0, 15) + "Z";
    const service = "bedrock";
    const credentialScope = `${dateStamp}/${this.region}/${service}/aws4_request`;

    const payloadHash = sha256(body);

    const headers: Record<string, string> = {
      host,
      "x-amz-date": amzDate,
      "x-amz-content-sha256": payloadHash,
    };
    if (this.sessionToken) {
      headers["x-amz-security-token"] = this.sessionToken;
    }

    const signedHeaderKeys = Object.keys(headers).sort();
    const signedHeaders = signedHeaderKeys.join(";");
    const canonicalHeaders = signedHeaderKeys.map(k => `${k}:${headers[k]}\n`).join("");

    const canonicalRequest = [
      method,
      path,
      "", // query string
      canonicalHeaders,
      signedHeaders,
      payloadHash,
    ].join("\n");

    const stringToSign = [
      "AWS4-HMAC-SHA256",
      amzDate,
      credentialScope,
      sha256(canonicalRequest),
    ].join("\n");

    const signingKey = getSignatureKey(this.secretKey, dateStamp, this.region, service);
    const signature = hmacHex(signingKey, stringToSign);

    const authHeader = `AWS4-HMAC-SHA256 Credential=${this.accessKey}/${credentialScope}, SignedHeaders=${signedHeaders}, Signature=${signature}`;

    return {
      ...headers,
      Authorization: authHeader,
    };
  }
}

// ── Crypto helpers ─────────────────────────────────────────────────────

function sha256(data: string): string {
  return createHash("sha256").update(data).digest("hex");
}

function hmac(key: Buffer | string, data: string): Buffer {
  return createHmac("sha256", key).update(data).digest();
}

function hmacHex(key: Buffer | string, data: string): string {
  return createHmac("sha256", key).update(data).digest("hex");
}

function getSignatureKey(secretKey: string, dateStamp: string, region: string, service: string): Buffer {
  const kDate = hmac(`AWS4${secretKey}`, dateStamp);
  const kRegion = hmac(kDate, region);
  const kService = hmac(kRegion, service);
  return hmac(kService, "aws4_request");
}
