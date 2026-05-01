import { SCENARIOS } from "@/scenarios/registry";
import { ScenariosClient } from "./scenarios-client";

export const metadata = {
  title: "Scenarios — Crosscheck",
};

export default function ScenariosPage() {
  return <ScenariosClient scenarios={SCENARIOS} />;
}
