import { redirect } from "next/navigation";

export default function TrainIndexPage() {
  // No scenario in URL — bounce to the library
  redirect("/scenarios");
}
