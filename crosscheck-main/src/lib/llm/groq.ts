import Groq from "groq-sdk";
import type { LLMProvider, LLMRequest, LLMResponse } from "./types";

const DEFAULT_MODEL = "llama-3.3-70b-versatile";

export class GroqProvider implements LLMProvider {
  readonly name = "groq";
  readonly defaultModel = DEFAULT_MODEL;
  private client: Groq;
  private model: string;

  constructor(opts: { apiKey: string; model?: string }) {
    this.client = new Groq({ apiKey: opts.apiKey });
    this.model = opts.model ?? DEFAULT_MODEL;
  }

  async complete(req: LLMRequest): Promise<LLMResponse> {
    const completion = await this.client.chat.completions.create({
      model: this.model,
      messages: req.messages,
      temperature: req.temperature ?? 0.2,
      max_tokens: req.maxTokens,
      response_format:
        req.responseFormat === "json" ? { type: "json_object" } : undefined,
    });

    const choice = completion.choices[0];
    return {
      text: choice?.message?.content ?? "",
      tokensIn: completion.usage?.prompt_tokens,
      tokensOut: completion.usage?.completion_tokens,
      raw: completion,
    };
  }
}
