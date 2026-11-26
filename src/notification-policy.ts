export type OperationalNotification = "answer_shown" | "human_review";

export function notificationFor(score: number): OperationalNotification {
  return score >= 0.78 ? "answer_shown" : "human_review";
}
