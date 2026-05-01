export type LLMMessage = {
  role: "system" | "user" | "assistant";
  content: string;
};

export type LLMRequest = {
  messages: LLMMessage[];
  /** JSON schema or a hint that the response must be valid JSON */
  responseFormat?: "json" | "text";
  /** 0..1 — lower = more deterministic */
  temperature?: number;
  maxTokens?: number;
};

export type LLMResponse = {
  text: string;
  /** Best-effort token count, when the provider reports it */
  tokensIn?: number;
  tokensOut?: number;
  /** Provider-specific raw payload for debugging */
  raw?: unknown;
};

export interface LLMProvider {
  readonly name: string;
  readonly defaultModel: string;
  complete(req: LLMRequest): Promise<LLMResponse>;
}
