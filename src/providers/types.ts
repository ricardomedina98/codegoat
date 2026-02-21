export interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface ChatRequest {
  messages: ChatMessage[];
  model?: string;
  maxTokens?: number;
  stream?: boolean;
}

export interface LLMProvider {
  name: string;
  chat(request: ChatRequest): AsyncIterable<string>;
}
