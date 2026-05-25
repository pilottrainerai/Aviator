import { FirePanelPreviewClient } from "./preview-client";

export default function FirePanelPreviewPage() {
  return (
    <main className="min-h-screen bg-[#0A0C10] flex flex-col items-center p-10 gap-10">
      <h1 className="font-mono text-xs tracking-[0.3em] text-[#4A5060] uppercase">
        Fire Panel — Preview
      </h1>
      <FirePanelPreviewClient />
    </main>
  );
}
