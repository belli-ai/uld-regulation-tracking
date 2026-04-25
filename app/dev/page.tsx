import {
  MissionHero,
  MissionShell,
  MissionTopBar,
} from "@/components/mission-control";

export default function DevPage() {
  return (
    <MissionShell>
      <MissionTopBar eyebrow="Demo operations" title="Dev console" />
      <main className="grid w-full gap-5 px-4 py-5 sm:px-6">
        <MissionHero
          eyebrow="Demo operations"
          title="Dev console"
          description="Use /dev/control for scenario playback and manual event injection."
        />
      </main>
    </MissionShell>
  );
}
