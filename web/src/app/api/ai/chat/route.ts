import { NextResponse } from "next/server";
import { ollamaChat } from "@/lib/ollama";
import { systemPromptForReader, mockTutorReply } from "@/lib/ai-prompts";
import type { LearnerProfile, UserReflection } from "@/lib/types";

type Body = {
  message: string;
  pageSlice: string;
  bookTitle: string;
  currentPage: number;
  maxPage: number;
  useOllama: boolean;
  ollamaBaseUrl: string;
  ollamaModel: string;
  targetLanguage: string;
  profile: LearnerProfile;
  reflection: UserReflection | null;
};

function parseCardsFromContent(content: string): { text: string; cards: { front: string; back: string; tags: string[] }[] } {
  const idx = content.indexOf("JSON_CARDS:");
  if (idx === -1) return { text: content, cards: [] };
  const text = content.slice(0, idx).trim();
  const rest = content.slice(idx + "JSON_CARDS:".length).trim();
  try {
    const arr = JSON.parse(rest) as { front: string; back: string; tags?: string[] }[];
    return {
      text: text || content,
      cards: (Array.isArray(arr) ? arr : []).map((c) => ({
        front: c.front,
        back: c.back,
        tags: c.tags ?? ["tabor"],
      })),
    };
  } catch {
    return { text: content, cards: [] };
  }
}

export async function POST(req: Request) {
  const body = (await req.json()) as Body;
  const system = systemPromptForReader({
    bookTitle: body.bookTitle,
    currentPage: body.currentPage,
    maxPage: body.maxPage,
    pageSlice: body.pageSlice,
    profile: body.profile,
    recentReflection: body.reflection,
    targetLanguage: body.targetLanguage,
  });
  const user = `Reader question: ${body.message}\n\nPage excerpt (for grounding only):\n${body.pageSlice}`;

  let raw: string;
  if (body.useOllama) {
    try {
      raw = await ollamaChat({
        baseUrl: body.ollamaBaseUrl,
        model: body.ollamaModel,
        messages: [
          { role: "system", content: system },
          { role: "user", content: user },
        ],
      });
    } catch (e) {
      const err = e instanceof Error ? e.message : "Ollama request failed";
      return NextResponse.json(
        { error: err, content: mockTutorReply(body.message, body.pageSlice) },
        { status: 200 }
      );
    }
  } else {
    raw = mockTutorReply(body.message, body.pageSlice);
  }

  const { text, cards } = parseCardsFromContent(raw);
  return NextResponse.json({ content: text, raw, cards });
}
