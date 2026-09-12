import type { ReactNode } from 'react'

export function Screen({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-full flex-col items-center justify-center gap-6 bg-[#0d1117] px-6 py-12 text-center">
      {children}
    </div>
  )
}

export function Title({ children }: { children: ReactNode }) {
  return (
    <h1 className="text-4xl font-black tracking-tight text-emerald-300 sm:text-5xl">{children}</h1>
  )
}

export function Subtitle({ children }: { children: ReactNode }) {
  return <p className="max-w-xl text-sm text-slate-400 sm:text-base">{children}</p>
}

export function MenuButton({
  onClick,
  primary,
  children,
  disabled,
}: {
  onClick: () => void
  primary?: boolean
  children: ReactNode
  disabled?: boolean
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={
        primary
          ? 'w-64 rounded-lg bg-emerald-500 px-6 py-3 font-bold text-emerald-950 transition hover:bg-emerald-400 disabled:opacity-40'
          : 'w-64 rounded-lg border border-slate-700 bg-slate-900 px-6 py-3 font-semibold text-slate-200 transition hover:border-slate-500 disabled:opacity-40'
      }
    >
      {children}
    </button>
  )
}
