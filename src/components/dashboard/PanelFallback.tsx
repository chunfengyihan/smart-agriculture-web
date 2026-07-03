import { RefreshCw } from 'lucide-react'

interface PanelFallbackProps {
  label: string
}

export function PanelFallback({ label }: PanelFallbackProps) {
  return (
    <article className="lazy-panel">
      <RefreshCw className="spinning" size={18} />
      {label}
    </article>
  )
}
