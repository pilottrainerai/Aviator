import { GroqProvider } from "./groq";
import type { LLMProvider } from "./types";

export type { LLMMessage, LLMProvider, LLMRequest, LLMResponse } from "./types";

let cachedProvider: LLMProvider | null = null;

export function getLLM(): LLMProvider {
  if (cachedProvider) return cachedProvider;

  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) {
    throw new Error(
      "GROQ_API_KEY is not set. Configure it in .env.local before calling the LLM.",
    );
  }

  cachedProvider = new GroqProvider({
    apiKey,
    model: process.env.GROQ_MODEL,
  });
  return cachedProvider;
}

export const isLLMConfigured = () => Boolean(process.env.GROQ_API_KEY);
