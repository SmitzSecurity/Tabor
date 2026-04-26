import { AppShell } from "@/components/AppShell";
import { FocusOverlay } from "@/components/FocusOverlay";
import { HomeClient } from "@/components/HomeClient";

export default function Home() {
  return (
    <AppShell>
      <FocusOverlay />
      <div className="min-h-dvh">
        <HomeClient />
      </div>
    </AppShell>
  );
}
