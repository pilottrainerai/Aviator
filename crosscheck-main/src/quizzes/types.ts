/**
 * Quiz authoring types. A quiz is data: questions, options, sections.
 * Designed to be cross-quiz reusable so we can add product surveys, pilot intake
 * forms, etc., without building new components.
 */

export type QuizOption = {
  value: string;
  label: string;
  description?: string;
};

export type SingleChoiceQuestion = {
  id: string;
  type: "single";
  section: string;
  prompt: string;
  helper?: string;
  options: QuizOption[];
};

export type MultiChoiceQuestion = {
  id: string;
  type: "multi";
  section: string;
  prompt: string;
  helper?: string;
  options: QuizOption[];
};

export type OpenTextQuestion = {
  id: string;
  type: "text";
  section: string;
  prompt: string;
  helper?: string;
  placeholder?: string;
  rows?: number;
};

export type QuizQuestion =
  | SingleChoiceQuestion
  | MultiChoiceQuestion
  | OpenTextQuestion;

export type QuizSection = {
  id: string;
  title: string;
  description?: string;
};

export type Quiz = {
  slug: string;
  title: string;
  intro: string;
  estimatedMinutes: number;
  audience: string;
  sections: QuizSection[];
  questions: QuizQuestion[];
};
