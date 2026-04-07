'use client'

export function DotBackground({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen dot-bg relative">
      {children}
    </div>
  )
}
