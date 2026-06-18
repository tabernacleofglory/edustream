const GROQ_API_URL = "https://api.groq.com/openai/v1/chat/completions";
const GROQ_MODEL = "llama-3.3-70b-versatile";

export interface ChatMessage {
  role: "user" | "assistant" | "system";
  content: string;
}

export interface GroqRequestOptions {
  temperature?: number;
  maxTokens?: number;
}

function getGroqApiKey(): string {
  const key = process.env.GROQ_API_KEY;
  if (!key) {
    throw new Error("GROQ_API_KEY environment variable is not set");
  }
  return key;
}

export async function askGroq(
  messages: ChatMessage[],
  options: GroqRequestOptions = {}
): Promise<string> {
  const { temperature = 0.7, maxTokens = 300 } = options;

  const response = await fetch(GROQ_API_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${getGroqApiKey()}`,
    },
    body: JSON.stringify({
      model: GROQ_MODEL,
      messages,
      temperature,
      max_tokens: maxTokens,
    }),
  });

  if (!response.ok) {
    const errorBody = await response.text().catch(() => "");
    throw new Error(`Groq API error (${response.status}): ${errorBody || response.statusText}`);
  }

  const data = await response.json();
  return data.choices?.[0]?.message?.content?.trim() || "";
}

export async function askGroqJson<T>(
  systemPrompt: string,
  userPrompt: string,
  options: GroqRequestOptions = {}
): Promise<T> {
  const messages: ChatMessage[] = [
    { role: "system", content: `${systemPrompt}\n\nYou MUST respond with valid JSON only, no markdown formatting, no code blocks.` },
    { role: "user", content: userPrompt },
  ];

  const raw = await askGroq(messages, { ...options, maxTokens: options.maxTokens || 2000 });
  
  // Strip any markdown code block markers
  const cleaned = raw.replace(/```json\s*/gi, "").replace(/```\s*/g, "").trim();
  
  try {
    return JSON.parse(cleaned) as T;
  } catch {
    throw new Error(`Failed to parse Groq response as JSON.\nRaw response: ${raw.substring(0, 500)}`);
  }
}
