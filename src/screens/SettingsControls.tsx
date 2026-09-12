import type { GameSettings, GraphicsQuality } from '../settings/store'

export function SettingsControls({
  settings,
  onChange,
}: {
  settings: GameSettings
  onChange: (next: GameSettings) => void
}) {
  return (
    <div className="flex w-72 flex-col gap-4 text-left">
      <label className="flex flex-col gap-1 text-sm text-slate-300">
        Master volume: {Math.round(settings.volume * 100)}%
        <input
          type="range"
          min={0}
          max={100}
          value={Math.round(settings.volume * 100)}
          onChange={(e) => onChange({ ...settings, volume: Number(e.target.value) / 100 })}
          className="accent-emerald-500"
        />
      </label>
      <label className="flex items-center justify-between text-sm text-slate-300">
        Muted
        <input
          type="checkbox"
          checked={settings.muted}
          onChange={(e) => onChange({ ...settings, muted: e.target.checked })}
          className="h-4 w-4 accent-emerald-500"
        />
      </label>
      <label className="flex items-center justify-between text-sm text-slate-300">
        Graphics quality
        <select
          value={settings.quality}
          onChange={(e) => onChange({ ...settings, quality: e.target.value as GraphicsQuality })}
          className="rounded border border-slate-700 bg-slate-900 px-2 py-1 text-slate-200"
        >
          <option value="low">Low</option>
          <option value="medium">Medium</option>
          <option value="high">High</option>
        </select>
      </label>
      <p className="text-xs text-slate-500">
        Low caps pixel ratio at 1× and disables shadows; high allows up to 2× with 1024px shadow
        maps.
      </p>
    </div>
  )
}
