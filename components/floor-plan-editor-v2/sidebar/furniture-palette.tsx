"use client"

import React, { useState } from "react"
import type { EditorAction, FurnitureType } from "../types"
import { FURNITURE_DIMENSIONS, FURNITURE_CATEGORIES, COLORS } from "../constants"

interface FurniturePaletteProps {
  dispatch: React.Dispatch<EditorAction>
  selectedType: FurnitureType | null
}

export function FurniturePalette({ dispatch, selectedType }: FurniturePaletteProps) {
  const [activeCategory, setActiveCategory] = useState<string>("bedroom")

  const handleSelectFurniture = (type: FurnitureType) => {
    dispatch({ type: "SET_MODE", mode: "furniture" })
    dispatch({ type: "SET_PLACEMENT_TYPE", placementType: type })
  }

  // Get furniture items for current category
  const categoryItems = Object.entries(FURNITURE_DIMENSIONS)
    .filter(([_, config]) => config.category === activeCategory)
    .map(([type, config]) => ({ type: type as FurnitureType, ...config }))

  return (
    <div className="space-y-3">
      <h4 className="font-medium text-sm text-gray-700">Furniture</h4>

      {/* Category tabs */}
      <div className="flex gap-1 flex-wrap">
        {FURNITURE_CATEGORIES.map((cat) => (
          <button
            key={cat.id}
            onClick={() => setActiveCategory(cat.id)}
            className={`
              px-2 py-1 rounded text-xs transition-colors
              ${activeCategory === cat.id
                ? "bg-primary text-white"
                : "bg-gray-100 hover:bg-gray-200 text-gray-700"
              }
            `}
          >
            {cat.icon} {cat.label}
          </button>
        ))}
      </div>

      {/* Furniture items */}
      <div className="grid grid-cols-1 gap-2 max-h-64 overflow-y-auto">
        {categoryItems.map((item) => (
          <button
            key={item.type}
            onClick={() => handleSelectFurniture(item.type)}
            className={`
              p-2 rounded-lg border text-left transition-all flex items-center gap-3
              ${selectedType === item.type
                ? "border-primary bg-primary/10 ring-1 ring-primary"
                : "border-gray-200 hover:border-gray-300 hover:bg-gray-50"
              }
            `}
          >
            {/* Furniture icon */}
            <div
              className="w-10 h-10 rounded flex items-center justify-center flex-shrink-0"
              style={{ backgroundColor: COLORS.FURNITURE_FILL }}
            >
              <FurnitureIcon type={item.type} />
            </div>
            <div className="min-w-0">
              <div className="text-xs font-medium truncate">{item.name}</div>
              <div className="text-[10px] text-gray-500">
                {item.width}' × {item.depth}'
              </div>
            </div>
          </button>
        ))}
      </div>

      <div className="text-xs text-gray-500 mt-2">
        Click on the floor to place furniture
      </div>
    </div>
  )
}

function FurnitureIcon({ type }: { type: string }) {
  // Simple furniture icons
  const iconMap: Record<string, React.ReactElement> = {
    // Bedroom
    bed_queen: (
      <svg className="w-6 h-6 text-white" viewBox="0 0 24 24" fill="currentColor">
        <rect x="2" y="8" width="20" height="12" rx="2" />
        <rect x="4" y="4" width="16" height="6" rx="1" />
      </svg>
    ),
    bed_king: (
      <svg className="w-6 h-6 text-white" viewBox="0 0 24 24" fill="currentColor">
        <rect x="1" y="8" width="22" height="12" rx="2" />
        <rect x="3" y="4" width="18" height="6" rx="1" />
      </svg>
    ),
    bed_twin: (
      <svg className="w-6 h-6 text-white" viewBox="0 0 24 24" fill="currentColor">
        <rect x="4" y="8" width="16" height="12" rx="2" />
        <rect x="6" y="4" width="12" height="6" rx="1" />
      </svg>
    ),
    dresser: (
      <svg className="w-6 h-6 text-white" viewBox="0 0 24 24" fill="currentColor">
        <rect x="2" y="4" width="20" height="16" rx="1" />
        <line x1="2" y1="10" x2="22" y2="10" stroke="rgba(0,0,0,0.2)" strokeWidth="1" />
        <line x1="2" y1="16" x2="22" y2="16" stroke="rgba(0,0,0,0.2)" strokeWidth="1" />
      </svg>
    ),
    nightstand: (
      <svg className="w-6 h-6 text-white" viewBox="0 0 24 24" fill="currentColor">
        <rect x="4" y="4" width="16" height="16" rx="1" />
        <line x1="4" y1="12" x2="20" y2="12" stroke="rgba(0,0,0,0.2)" strokeWidth="1" />
      </svg>
    ),

    // Bathroom
    toilet: (
      <svg className="w-6 h-6 text-white" viewBox="0 0 24 24" fill="currentColor">
        <ellipse cx="12" cy="14" rx="6" ry="5" />
        <rect x="6" y="4" width="12" height="8" rx="2" />
      </svg>
    ),
    sink: (
      <svg className="w-6 h-6 text-white" viewBox="0 0 24 24" fill="currentColor">
        <ellipse cx="12" cy="12" rx="8" ry="6" />
        <circle cx="12" cy="12" r="2" fill="rgba(0,0,0,0.2)" />
      </svg>
    ),
    bathtub: (
      <svg className="w-6 h-6 text-white" viewBox="0 0 24 24" fill="currentColor">
        <rect x="2" y="6" width="20" height="12" rx="4" />
      </svg>
    ),
    shower: (
      <svg className="w-6 h-6 text-white" viewBox="0 0 24 24" fill="currentColor">
        <rect x="4" y="4" width="16" height="16" rx="1" />
        <circle cx="12" cy="8" r="2" fill="rgba(0,0,0,0.2)" />
      </svg>
    ),

    // Kitchen
    refrigerator: (
      <svg className="w-6 h-6 text-white" viewBox="0 0 24 24" fill="currentColor">
        <rect x="4" y="2" width="16" height="20" rx="1" />
        <line x1="4" y1="9" x2="20" y2="9" stroke="rgba(0,0,0,0.2)" strokeWidth="1" />
      </svg>
    ),
    stove: (
      <svg className="w-6 h-6 text-white" viewBox="0 0 24 24" fill="currentColor">
        <rect x="2" y="4" width="20" height="16" rx="1" />
        <circle cx="8" cy="10" r="2" fill="rgba(0,0,0,0.2)" />
        <circle cx="16" cy="10" r="2" fill="rgba(0,0,0,0.2)" />
        <circle cx="8" cy="16" r="2" fill="rgba(0,0,0,0.2)" />
        <circle cx="16" cy="16" r="2" fill="rgba(0,0,0,0.2)" />
      </svg>
    ),
    dishwasher: (
      <svg className="w-6 h-6 text-white" viewBox="0 0 24 24" fill="currentColor">
        <rect x="4" y="4" width="16" height="16" rx="1" />
        <rect x="6" y="6" width="12" height="4" rx="1" fill="rgba(0,0,0,0.2)" />
      </svg>
    ),
    kitchen_sink: (
      <svg className="w-6 h-6 text-white" viewBox="0 0 24 24" fill="currentColor">
        <rect x="2" y="6" width="20" height="12" rx="2" />
        <rect x="4" y="8" width="7" height="8" rx="1" fill="rgba(0,0,0,0.2)" />
        <rect x="13" y="8" width="7" height="8" rx="1" fill="rgba(0,0,0,0.2)" />
      </svg>
    ),

    // Living
    sofa_3seat: (
      <svg className="w-6 h-6 text-white" viewBox="0 0 24 24" fill="currentColor">
        <rect x="2" y="8" width="20" height="10" rx="2" />
        <rect x="2" y="6" width="4" height="12" rx="1" />
        <rect x="18" y="6" width="4" height="12" rx="1" />
      </svg>
    ),
    sofa_2seat: (
      <svg className="w-6 h-6 text-white" viewBox="0 0 24 24" fill="currentColor">
        <rect x="4" y="8" width="16" height="10" rx="2" />
        <rect x="4" y="6" width="4" height="12" rx="1" />
        <rect x="16" y="6" width="4" height="12" rx="1" />
      </svg>
    ),
    armchair: (
      <svg className="w-6 h-6 text-white" viewBox="0 0 24 24" fill="currentColor">
        <rect x="6" y="8" width="12" height="10" rx="2" />
        <rect x="4" y="6" width="4" height="12" rx="1" />
        <rect x="16" y="6" width="4" height="12" rx="1" />
      </svg>
    ),
    coffee_table: (
      <svg className="w-6 h-6 text-white" viewBox="0 0 24 24" fill="currentColor">
        <rect x="4" y="8" width="16" height="8" rx="1" />
      </svg>
    ),
    dining_table: (
      <svg className="w-6 h-6 text-white" viewBox="0 0 24 24" fill="currentColor">
        <rect x="2" y="8" width="20" height="8" rx="1" />
      </svg>
    ),
    dining_chair: (
      <svg className="w-6 h-6 text-white" viewBox="0 0 24 24" fill="currentColor">
        <rect x="6" y="10" width="12" height="10" rx="1" />
        <rect x="6" y="2" width="12" height="8" rx="1" />
      </svg>
    ),

    // Office
    desk: (
      <svg className="w-6 h-6 text-white" viewBox="0 0 24 24" fill="currentColor">
        <rect x="2" y="6" width="20" height="4" rx="1" />
        <rect x="4" y="10" width="4" height="8" rx="1" />
        <rect x="16" y="10" width="4" height="8" rx="1" />
      </svg>
    ),
    office_chair: (
      <svg className="w-6 h-6 text-white" viewBox="0 0 24 24" fill="currentColor">
        <ellipse cx="12" cy="14" rx="6" ry="4" />
        <rect x="8" y="4" width="8" height="8" rx="1" />
        <rect x="10" y="18" width="4" height="4" />
      </svg>
    ),
    bookshelf: (
      <svg className="w-6 h-6 text-white" viewBox="0 0 24 24" fill="currentColor">
        <rect x="4" y="2" width="16" height="20" rx="1" />
        <line x1="4" y1="8" x2="20" y2="8" stroke="rgba(0,0,0,0.2)" strokeWidth="1" />
        <line x1="4" y1="14" x2="20" y2="14" stroke="rgba(0,0,0,0.2)" strokeWidth="1" />
      </svg>
    ),
  }

  return iconMap[type] || (
    <svg className="w-6 h-6 text-white" viewBox="0 0 24 24" fill="currentColor">
      <rect x="4" y="4" width="16" height="16" rx="2" />
    </svg>
  )
}
