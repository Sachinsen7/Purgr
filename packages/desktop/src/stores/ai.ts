import { atom } from "nanostores";

export interface AIAdvice {
  recommendation: "keep" | "delete" | "review";
  confidence: number;
  explanation: string;
  reasoningSignals: string[];
  similarPatterns: string[];
}

export interface AIPreferences {
  enabled: boolean;
  provider: "ollama" | "openai" | "anthropic";
  model: string;
  apiKey?: string;
  baseUrl?: string;
}

// AI store
export const $aiPreferences = atom<AIPreferences>({
  enabled: true,
  provider: "ollama",
  model: "llama3.2",
  baseUrl: "http://localhost:11434",
});

export const $aiStatus = atom<"idle" | "thinking" | "error">("idle");
export const $lastAIAdvice = atom<AIAdvice | null>(null);

// Actions
export function updateAIPreferences(preferences: Partial<AIPreferences>) {
  $aiPreferences.set({ ...$aiPreferences.get(), ...preferences });
}

export function setAIStatus(status: "idle" | "thinking" | "error") {
  $aiStatus.set(status);
}

export function setLastAIAdvice(advice: AIAdvice | null) {
  $lastAIAdvice.set(advice);
}