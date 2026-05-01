import { notFound } from "next/navigation";
import { getQuiz } from "@/quizzes";
import { QuizClient } from "./quiz-client";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const quiz = getQuiz(slug);
  if (!quiz) return { title: "Quiz — Crosscheck" };
  return { title: `${quiz.title} — Crosscheck` };
}

export default async function QuizPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const quiz = getQuiz(slug);
  if (!quiz) notFound();
  return <QuizClient quiz={quiz} />;
}
