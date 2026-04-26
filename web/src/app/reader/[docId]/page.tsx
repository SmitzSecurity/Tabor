import { AppShell } from "@/components/AppShell";
import { FocusOverlay } from "@/components/FocusOverlay";
import { ReadClient } from "./ReadClient";

type PageProps = { params: { docId: string } };

export default function ReaderPage({ params }: PageProps) {
  return (
    <AppShell>
      <FocusOverlay />
      <ReadClient docId={params.docId} />
    </AppShell>
  );
}
