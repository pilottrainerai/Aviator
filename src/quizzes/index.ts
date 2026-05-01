import type { Quiz } from "./types";
import { founderQuiz } from "./founder";

export const ALL_QUIZZES: Quiz[] = [founderQuiz];

export function getQuiz(slug: string): Quiz | undefined {
  return ALL_QUIZZES.find((q) => q.slug === slug);
}

export type { Quiz, QuizQuestion, QuizSection, QuizOption } from "./types";
