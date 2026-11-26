import { infraiRequest } from "./infrai-http.ts";

const faqRecords = [
  { id: "appointment-change", values: [0, 0], metadata: { question: "How do I change an appointment?", answer: "Use the appointment link or contact the clinic." } }
];

export async function seedFaqCollection(vectors: number[][]): Promise<unknown> {
  await infraiRequest("/v1/vector/collection/create", "POST", { collection: "healthtech-faq", dimension: 1536, metric: "cosine", metadata: { domain: "patient-faq" } });
  return infraiRequest("/v1/vector/upsert", "POST", { collection: "healthtech-faq", vectors: faqRecords.map((record, index) => ({ ...record, values: vectors[index] })) });
}
