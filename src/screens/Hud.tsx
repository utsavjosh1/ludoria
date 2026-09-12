import type { HudSnapshot } from '../engine/runtime/Game'

export function Hud({ snapshot }: { snapshot: HudSnapshot | null }) {
  if (!snapshot) return null
  return (
    <div className="pointer-events-none absolute inset-0 z-20 flex flex-col justify-between p-4">
      <div className="mx-auto w-full max-w-md rounded-lg border border-slate-700 bg-black/60 px-4 py-3 text-left backdrop-blur">
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-sm font-bold text-emerald-300">{snapshot.objectiveTitle}</h2>
          <span className="text-xs text-slate-400" data-testid="objective-progress">
            {snapshot.objectiveIndex}/{snapshot.objectiveTotal}
          </span>
        </div>
        <p className="mt-1 text-xs text-slate-300">{snapshot.objectiveDesc}</p>
        {snapshot.checkpoint && (
          <p className="mt-1 text-[11px] text-slate-500">Checkpoint: {snapshot.checkpoint}</p>
        )}
      </div>
      <div className="flex flex-col items-center gap-2">
        {snapshot.prompt && (
          <div
            data-testid="interact-prompt"
            className="rounded-full border border-emerald-500/60 bg-black/70 px-4 py-2 text-sm font-semibold text-emerald-300"
          >
            {snapshot.prompt}
          </div>
        )}
        {snapshot.missionComplete && (
          <div
            data-testid="mission-complete"
            className="rounded-lg border border-emerald-400 bg-emerald-950/90 px-5 py-2 text-sm font-bold text-emerald-200"
          >
            Mission complete — progress saved on this device.
          </div>
        )}
      </div>
    </div>
  )
}
