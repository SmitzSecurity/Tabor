export type OllamaChatMessage = { role: "system" | "user" | "assistant"; content: string };

export type OllamaChatOptions = {
  baseUrl: string;
  model: string;
  messages: OllamaChatMessage[];
  stream?: boolean;
};

export async function ollamaChat(
  options: OllamaChatOptions
): Promise<string> {
  const url = `${options.baseUrl.replace(/\/$/, "")}/api/chat`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: options.model,
      messages: options.messages,
      stream: false,
    }),
  });
  if (!res.ok) {
    const t = await res.text();
    throw new Error(`Ollama error ${res.status}: ${t.slice(0, 200)}`);
  }
  const data = (await res.json()) as { message?: { content?: string } };
  return data.message?.content?.trim() ?? "";
}
