"use client"

import { useState, useCallback, useRef } from "react"
import type { EditorAction, Lot, Point } from "../types"
import * as api from "@/lib/api/client-v2"

interface LotSelectorProps {
  lot: Lot | null
  blueprintId: string | null
  dispatch: React.Dispatch<EditorAction>
  showOverlay: boolean
  onToggleOverlay: (show: boolean) => void
}

interface AddressResult {
  placeId: string
  displayName: string
  lat: number
  lng: number
}

export function LotSelector({
  lot,
  blueprintId,
  dispatch,
  showOverlay,
  onToggleOverlay,
}: LotSelectorProps) {
  const [isOpen, setIsOpen] = useState(true)
  const [searchQuery, setSearchQuery] = useState("")
  const [addressResults, setAddressResults] = useState<AddressResult[]>([])
  const [showResults, setShowResults] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isDrawingBoundary, setIsDrawingBoundary] = useState(false)
  const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null)

  // Debounced address search
  const handleSearchChange = useCallback(async (value: string) => {
    setSearchQuery(value)

    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current)
    }

    if (value.length >= 3) {
      searchTimeoutRef.current = setTimeout(async () => {
        try {
          setLoading(true)
          setError(null)
          const response = await api.searchAddress(value)
          if (response.data?.results) {
            setAddressResults(response.data.results)
            setShowResults(true)
          }
        } catch (err) {
          setError("Failed to search addresses")
        } finally {
          setLoading(false)
        }
      }, 300)
    } else {
      setAddressResults([])
      setShowResults(false)
    }
  }, [])

  // Convert geo coordinates to feet relative to center
  const geoToFeet = useCallback((
    vertices: Array<{ lat: number; lng: number }>,
    centerLat: number,
    centerLng: number
  ): Point[] => {
    const FEET_PER_DEGREE_LAT = 364000
    const FEET_PER_DEGREE_LNG = 364000 * Math.cos((centerLat * Math.PI) / 180)

    return vertices.map((vertex) => ({
      x: (vertex.lng - centerLng) * FEET_PER_DEGREE_LNG,
      y: -(vertex.lat - centerLat) * FEET_PER_DEGREE_LAT, // Negative because canvas Y is down
    }))
  }, [])

  // Handle address selection
  const handleSelectAddress = useCallback(
    async (address: AddressResult) => {
      if (!blueprintId) return

      setSearchQuery(address.displayName.split(",")[0])
      setShowResults(false)
      setAddressResults([])

      try {
        setLoading(true)
        setError(null)

        // Fetch parcel data
        const parcelResponse = await api.getParcelData(address.lat, address.lng)

        if (parcelResponse.data?.parcel) {
          const parcel = parcelResponse.data.parcel

          // Convert geo coordinates to feet
          const boundaryFeet = geoToFeet(
            parcel.boundaryVertices,
            address.lat,
            address.lng
          )

          // Create lot with converted boundary
          const lotResponse = await api.createLot({
            blueprintId,
            address: parcel.situsAddress || address.displayName,
            geoLat: address.lat,
            geoLng: address.lng,
            boundary: boundaryFeet,
            setbacks: {
              front: 0,
              back: 4,
              left: 4,
              right: 4,
            },
            source: "gis",
          })

          if (lotResponse.data) {
            dispatch({ type: "SET_LOT", lot: lotResponse.data })
            onToggleOverlay(true)
          }
        } else {
          setError("No parcel data found for this address")
        }
      } catch (err) {
        setError("Failed to fetch parcel data")
        console.error(err)
      } finally {
        setLoading(false)
      }
    },
    [blueprintId, dispatch, onToggleOverlay, geoToFeet]
  )

  // Update setbacks
  const handleUpdateSetbacks = useCallback(
    async (field: "front" | "back" | "left" | "right", value: number) => {
      if (!lot) return

      const newSetbacks = {
        ...lot.setbacks,
        [field]: value,
      }

      try {
        const response = await api.updateLot(lot.id, { setbacks: newSetbacks })
        if (response.data) {
          dispatch({ type: "SET_LOT", lot: response.data })
        }
      } catch (err) {
        setError("Failed to update setbacks")
      }
    },
    [lot, dispatch]
  )

  // Remove lot
  const handleRemoveLot = useCallback(async () => {
    if (!lot) return

    try {
      await api.deleteLot(lot.id)
      dispatch({ type: "SET_LOT", lot: null })
      onToggleOverlay(false)
    } catch (err) {
      setError("Failed to remove lot")
    }
  }, [lot, dispatch, onToggleOverlay])

  // Start drawing manual boundary
  const handleStartDrawing = useCallback(() => {
    setIsDrawingBoundary(true)
    // TODO: Integrate with canvas for manual boundary drawing
  }, [])

  // Create manual lot with boundary
  const handleCreateManualLot = useCallback(
    async (boundary: Point[]) => {
      if (!blueprintId || boundary.length < 3) return

      try {
        setLoading(true)
        const response = await api.createLot({
          blueprintId,
          boundary,
          setbacks: {
            front: 0,
            back: 4,
            left: 4,
            right: 4,
          },
          source: "manual",
        })

        if (response.data) {
          dispatch({ type: "SET_LOT", lot: response.data })
          onToggleOverlay(true)
        }
      } catch (err) {
        setError("Failed to create lot")
      } finally {
        setLoading(false)
        setIsDrawingBoundary(false)
      }
    },
    [blueprintId, dispatch, onToggleOverlay]
  )

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h4 className="font-medium text-sm text-gray-700">Lot Overlay</h4>
        {lot && (
          <label className="flex items-center gap-2 text-xs">
            <input
              type="checkbox"
              checked={showOverlay}
              onChange={(e) => onToggleOverlay(e.target.checked)}
              className="w-4 h-4"
            />
            Show
          </label>
        )}
      </div>

      {/* Address Search */}
      <div className="space-y-2">
        <label className="text-xs text-gray-500">Property Address</label>
        <div className="relative">
          <input
            type="text"
            placeholder="Search address..."
            value={searchQuery}
            onChange={(e) => handleSearchChange(e.target.value)}
            onFocus={() => addressResults.length > 0 && setShowResults(true)}
            onBlur={() => setTimeout(() => setShowResults(false), 200)}
            className="w-full px-3 py-2 text-sm border rounded-lg pr-8"
          />
          {loading && (
            <div className="absolute right-2 top-1/2 -translate-y-1/2">
              <svg className="w-4 h-4 animate-spin text-gray-400" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
            </div>
          )}

          {/* Search Results */}
          {showResults && addressResults.length > 0 && (
            <div className="absolute z-50 w-full mt-1 bg-white border rounded-lg shadow-lg max-h-48 overflow-y-auto">
              {addressResults.map((result) => (
                <button
                  key={result.placeId}
                  type="button"
                  onClick={() => handleSelectAddress(result)}
                  className="w-full px-3 py-2 text-left text-xs hover:bg-gray-50 border-b last:border-b-0"
                >
                  {result.displayName}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Error Message */}
      {error && (
        <div className="p-2 bg-red-50 border border-red-200 rounded-lg text-xs text-red-600">
          {error}
        </div>
      )}

      {/* Lot Info */}
      {lot && (
        <>
          <div className="p-2 bg-gray-100 rounded-lg space-y-1 text-xs">
            {lot.address && (
              <div className="flex justify-between">
                <span className="text-gray-500">Address:</span>
                <span className="font-medium truncate max-w-[140px]">{lot.address}</span>
              </div>
            )}
            <div className="flex justify-between">
              <span className="text-gray-500">Source:</span>
              <span className="font-medium capitalize">{lot.source}</span>
            </div>
          </div>

          {/* Setbacks */}
          <div className="space-y-2">
            <label className="text-xs text-gray-500">Setbacks (feet)</label>
            <div className="grid grid-cols-2 gap-2">
              {(["front", "back", "left", "right"] as const).map((field) => (
                <div key={field} className="space-y-1">
                  <span className="text-[10px] text-gray-500 capitalize">{field}</span>
                  <input
                    type="number"
                    min={0}
                    max={50}
                    value={lot.setbacks[field]}
                    onChange={(e) => handleUpdateSetbacks(field, parseFloat(e.target.value) || 0)}
                    className="w-full px-2 py-1 text-xs border rounded"
                  />
                </div>
              ))}
            </div>
          </div>

          {/* Remove Lot */}
          <button
            onClick={handleRemoveLot}
            className="w-full px-3 py-1.5 text-xs text-red-600 border border-red-200 rounded-lg hover:bg-red-50"
          >
            Remove Lot
          </button>
        </>
      )}

      {/* Manual Drawing */}
      {!lot && !isDrawingBoundary && (
        <div className="border-t pt-3 space-y-2">
          <p className="text-xs text-gray-500">
            Or draw a manual lot boundary:
          </p>
          <button
            onClick={handleStartDrawing}
            className="w-full px-3 py-1.5 text-xs text-primary border border-primary rounded-lg hover:bg-primary/5"
          >
            Draw Lot Boundary
          </button>
        </div>
      )}

      {isDrawingBoundary && (
        <div className="p-2 bg-blue-50 border border-blue-200 rounded-lg text-xs text-blue-700">
          Click on the canvas to draw lot boundary points. Double-click to finish.
        </div>
      )}

      {/* Help */}
      {!lot && (
        <div className="text-xs text-gray-400 mt-2">
          Enter a property address to overlay lot boundaries on your floor plan.
        </div>
      )}
    </div>
  )
}
