"use client"

interface CompassProps {
  className?: string
}

export function Compass({ className = "" }: CompassProps) {
  return (
    <div className={`bg-white/95 backdrop-blur-sm p-2 rounded-lg shadow-lg border border-gray-200 ${className}`}>
      <svg width="40" height="40" viewBox="0 0 40 40" className="text-gray-600">
        {/* Compass circle */}
        <circle cx="20" cy="20" r="18" fill="none" stroke="currentColor" strokeWidth="1.5" />

        {/* North arrow (red) */}
        <polygon points="20,4 16,20 20,16 24,20" fill="#dc2626" />

        {/* South arrow (gray) */}
        <polygon points="20,36 16,20 20,24 24,20" fill="currentColor" opacity="0.5" />

        {/* East-West line */}
        <line x1="4" y1="20" x2="36" y2="20" stroke="currentColor" strokeWidth="1" opacity="0.3" />

        {/* Cardinal direction labels */}
        <text x="20" y="11" textAnchor="middle" fontSize="8" fontWeight="bold" fill="#dc2626">N</text>
        <text x="20" y="34" textAnchor="middle" fontSize="6" fill="currentColor" opacity="0.5">S</text>
        <text x="34" y="22" textAnchor="middle" fontSize="6" fill="currentColor" opacity="0.5">E</text>
        <text x="6" y="22" textAnchor="middle" fontSize="6" fill="currentColor" opacity="0.5">W</text>
      </svg>
    </div>
  )
}
