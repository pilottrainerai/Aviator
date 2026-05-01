import { notFound } from "next/navigation";
import { getScenario } from "@/scenarios";
import { ScenarioRunner } from "./runner";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const scenario = getScenario(slug);
  if (!scenario) return { title: "Scenario — Crosscheck" };
  return {
    title: `${scenario.meta.title} — Crosscheck`,
  };
}

export default async function TrainPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const scenario = getScenario(slug);
  if (!scenario) notFound();
  return <ScenarioRunner scenario={scenario} />;
}
