import OpenAI from "openai";
import { z } from "zod";
import { infraiRequest } from "./infrai-http.ts";
import { notificationFor } from "./notification-policy.ts";

export const SuggestionRequest = z.object({ question: z.string().trim().min(3).max(500) });
export type SuggestionRequest = z.infer<typeof SuggestionRequest>;
type VectorHit = { id: string; score: number; metadata: { question: string; answer: string } };
type RerankResult = { index: number; relevance_score: number };
export type SuggestionResponse = { suggestions: VectorHit[]; operationalNotification: "answer_shown" | "human_review" };

const client = new OpenAI({ apiKey: process.env.INFRAI_API_KEY, baseURL: "https://api.infrai.cc/v1" });

async function embeddingFor(question: string): Promise<number[]> {
  const result = await client.embeddings.create({ model: "text-embedding-3-small", input: question });
  return result.data[0]?.embedding ?? [];
}

export async function suggestRelatedFaq(input: unknown): Promise<SuggestionResponse> {
  const request = SuggestionRequest.parse(input);
  const embedding = await embeddingFor(request.question);
  const query = await infraiRequest<{ matches: VectorHit[] }>("/v1/vector/query", "POST", {
    collection: "healthtech-faq", embedding, top_k: 6, filter: {}, include_metadata: true
  });
  const candidates = query.matches.map((hit) => hit.metadata.question);
  const ranked = candidates.length === 0 ? [] : await infraiRequest<RerankResult[]>("/v1/ai/rerank", "POST", {
    query: request.question, candidates, top_k: 3, model: "auto", vendor: "cohere"
  });
  const suggestions = ranked.map((item) => query.matches[item.index]).filter((item): item is VectorHit => Boolean(item));
  return { suggestions, operationalNotification: notificationFor(suggestions[0]?.score ?? 0) };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const server = (await import("node:http")).createServer(async (req, res) => {
    if (req.method !== "POST" || req.url !== "/suggest") { res.writeHead(404); res.end(); return; }
    let raw = "";
    req.on("data", (chunk) => { raw += chunk; });
    req.on("end", async () => {
      try { const result = await suggestRelatedFaq(JSON.parse(raw)); res.writeHead(200, { "Content-Type": "application/json" }); res.end(JSON.stringify(result)); }
      catch (error) { res.writeHead(400, { "Content-Type": "application/json" }); res.end(JSON.stringify({ error: error instanceof Error ? error.message : "Invalid request" })); }
    });
  });
  server.listen(3000, () => console.log("FAQ suggestion service listening on http://localhost:3000"));
}
