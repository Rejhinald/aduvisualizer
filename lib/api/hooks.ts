"use client"

import { useState, useCallback, useEffect } from "react"
import * as api from "./client"
import type {
  Project,
  Blueprint,
  SaveBlueprintData,
  SaveBlueprintResponse,
  GenerateVisualizationData,
  GenerateVisualizationResponse,
  Lot,
  LotData,
  AddressResult,
  ParcelData,
  Finishes,
  FinishesOptions,
  RoomFinish,
  CameraPlacement,
  RenderRecord,
  VibeOption,
  TierOption,
  TemplateOption,
} from "./client"

/**
 * Hook for managing the current project
 */
export function useProject() {
  const [project, setProject] = useState<Project | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const createProject = useCallback(async (name: string, description?: string) => {
    setLoading(true)
    setError(null)
    try {
      const response = await api.createProject({ name, description })
      setProject(response.data)
      return response.data
    } catch (e) {
      setError((e as Error).message)
      throw e
    } finally {
      setLoading(false)
    }
  }, [])

  const loadProject = useCallback(async (id: string) => {
    setLoading(true)
    setError(null)
    try {
      const response = await api.getProject(id)
      setProject(response.data)
      return response.data
    } catch (e) {
      setError((e as Error).message)
      throw e
    } finally {
      setLoading(false)
    }
  }, [])

  const setGeoLocation = useCallback(
    async (data: Parameters<typeof api.setProjectGeoLocation>[1]) => {
      if (!project) throw new Error("No project loaded")
      setLoading(true)
      setError(null)
      try {
        await api.setProjectGeoLocation(project.id, data)
        // Reload project to get updated data
        const response = await api.getProject(project.id)
        setProject(response.data)
        return response.data
      } catch (e) {
        setError((e as Error).message)
        throw e
      } finally {
        setLoading(false)
      }
    },
    [project]
  )

  return {
    project,
    loading,
    error,
    createProject,
    loadProject,
    setGeoLocation,
  }
}

/**
 * Hook for saving and loading blueprints
 */
export function useBlueprint() {
  const [blueprint, setBlueprint] = useState<Blueprint | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [lastSave, setLastSave] = useState<SaveBlueprintResponse | null>(null)

  const saveBlueprint = useCallback(async (data: SaveBlueprintData) => {
    setLoading(true)
    setError(null)
    try {
      const response = await api.saveBlueprint(data)
      setBlueprint(response.data.blueprint)
      setLastSave(response.data)
      return response.data
    } catch (e) {
      setError((e as Error).message)
      throw e
    } finally {
      setLoading(false)
    }
  }, [])

  const loadBlueprint = useCallback(async (id: string) => {
    setLoading(true)
    setError(null)
    try {
      const response = await api.getBlueprint(id)
      setBlueprint(response.data.blueprint)
      return response.data
    } catch (e) {
      setError((e as Error).message)
      throw e
    } finally {
      setLoading(false)
    }
  }, [])

  const loadBlueprintWithGeo = useCallback(async (id: string) => {
    setLoading(true)
    setError(null)
    try {
      const response = await api.getBlueprintWithGeo(id)
      setBlueprint(response.data.blueprint)
      return response.data
    } catch (e) {
      setError((e as Error).message)
      throw e
    } finally {
      setLoading(false)
    }
  }, [])

  return {
    blueprint,
    loading,
    error,
    lastSave,
    saveBlueprint,
    loadBlueprint,
    loadBlueprintWithGeo,
  }
}

/**
 * Hook for generating visualizations
 */
export function useVisualization() {
  const [visualization, setVisualization] = useState<GenerateVisualizationResponse | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const generateVisualization = useCallback(async (data: GenerateVisualizationData) => {
    setLoading(true)
    setError(null)
    try {
      const response = await api.generateVisualization(data)
      setVisualization(response.data)
      return response.data
    } catch (e) {
      setError((e as Error).message)
      throw e
    } finally {
      setLoading(false)
    }
  }, [])

  return {
    visualization,
    loading,
    error,
    generateVisualization,
  }
}

/**
 * Hook for managing lot data and parcel lookup
 */
export function useLot(blueprintId?: string) {
  const [lot, setLot] = useState<Lot | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [addressResults, setAddressResults] = useState<AddressResult[]>([])
  const [parcelData, setParcelData] = useState<ParcelData | null>(null)

  /**
   * Search for addresses using Nominatim geocoding
   */
  const searchAddresses = useCallback(async (query: string) => {
    if (query.length < 3) {
      setAddressResults([])
      return []
    }
    setLoading(true)
    setError(null)
    try {
      const response = await api.searchAddress(query)
      setAddressResults(response.data.results)
      return response.data.results
    } catch (e) {
      setError((e as Error).message)
      return []
    } finally {
      setLoading(false)
    }
  }, [])

  /**
   * Get parcel data from Orange County GIS
   */
  const fetchParcelData = useCallback(async (lat: number, lng: number) => {
    setLoading(true)
    setError(null)
    try {
      const response = await api.getParcelData(lat, lng)
      setParcelData(response.data.parcel)
      return response.data.parcel
    } catch (e) {
      setError((e as Error).message)
      setParcelData(null)
      return null
    } finally {
      setLoading(false)
    }
  }, [])

  /**
   * Load lot for current blueprint
   */
  const loadLot = useCallback(async (bpId?: string) => {
    const id = bpId || blueprintId
    if (!id) {
      setError("No blueprint ID provided")
      return null
    }
    setLoading(true)
    setError(null)
    try {
      const response = await api.getLot(id)
      setLot(response.data.lot)
      return response.data.lot
    } catch (e) {
      setError((e as Error).message)
      return null
    } finally {
      setLoading(false)
    }
  }, [blueprintId])

  /**
   * Create or save lot for blueprint
   */
  const saveLot = useCallback(async (data: Omit<LotData, "blueprintId">) => {
    if (!blueprintId) {
      setError("No blueprint ID provided")
      throw new Error("No blueprint ID provided")
    }
    setLoading(true)
    setError(null)
    try {
      if (lot) {
        // Update existing lot
        const response = await api.updateLot(lot.id, data)
        setLot(response.data.lot)
        return response.data.lot
      } else {
        // Create new lot
        const response = await api.createLot({ ...data, blueprintId })
        setLot(response.data.lot)
        return response.data.lot
      }
    } catch (e) {
      setError((e as Error).message)
      throw e
    } finally {
      setLoading(false)
    }
  }, [blueprintId, lot])

  /**
   * Update ADU position on lot (optimistic update for immediate UI feedback)
   */
  const updateAduPosition = useCallback(async (
    offsetX: number,
    offsetY: number,
    rotation?: number
  ) => {
    if (!lot) {
      setError("No lot loaded")
      throw new Error("No lot loaded")
    }

    // Optimistically update local state immediately for smooth UI
    setLot(prev => prev ? {
      ...prev,
      aduOffsetX: offsetX,
      aduOffsetY: offsetY,
      ...(rotation !== undefined && { aduRotation: rotation }),
    } : null)

    // Don't set loading - let the UI update immediately
    setError(null)
    try {
      const response = await api.updateLot(lot.id, {
        aduOffsetX: offsetX,
        aduOffsetY: offsetY,
        ...(rotation !== undefined && { aduRotation: rotation }),
      })
      // Sync with server response (in case of any corrections)
      setLot(response.data.lot)
      return response.data.lot
    } catch (e) {
      // Revert on error
      setLot(lot)
      setError((e as Error).message)
      throw e
    }
  }, [lot])

  /**
   * Update setbacks
   */
  const updateSetbacks = useCallback(async (setbacks: {
    front?: number
    back?: number
    left?: number
    right?: number
  }) => {
    if (!lot) {
      setError("No lot loaded")
      throw new Error("No lot loaded")
    }
    setLoading(true)
    setError(null)
    try {
      const response = await api.updateLot(lot.id, {
        ...(setbacks.front !== undefined && { setbackFrontFeet: setbacks.front }),
        ...(setbacks.back !== undefined && { setbackBackFeet: setbacks.back }),
        ...(setbacks.left !== undefined && { setbackLeftFeet: setbacks.left }),
        ...(setbacks.right !== undefined && { setbackRightFeet: setbacks.right }),
      })
      setLot(response.data.lot)
      return response.data.lot
    } catch (e) {
      setError((e as Error).message)
      throw e
    } finally {
      setLoading(false)
    }
  }, [lot])

  /**
   * Update lot dimensions (simple width/depth, clears custom boundary)
   */
  const updateLotDimensions = useCallback(async (width: number, depth: number) => {
    if (!lot) {
      setError("No lot loaded")
      throw new Error("No lot loaded")
    }
    setLoading(true)
    setError(null)
    try {
      const response = await api.updateLot(lot.id, {
        lotWidthFeet: width,
        lotDepthFeet: depth,
        lotAreaSqFt: width * depth,
        // Clear boundary vertices when manually setting dimensions
        boundaryVertices: undefined,
      })
      setLot(response.data.lot)
      return response.data.lot
    } catch (e) {
      setError((e as Error).message)
      throw e
    } finally {
      setLoading(false)
    }
  }, [lot])

  /**
   * Update lot with custom drawn boundary (polygon vertices in feet relative to canvas center)
   * Converts feet coordinates to geo coordinates and saves both vertices and dimensions
   */
  const updateLotCustomBoundary = useCallback(async (boundaryFeet: Array<{ x: number; y: number }>) => {
    if (!lot) {
      setError("No lot loaded")
      throw new Error("No lot loaded")
    }
    if (boundaryFeet.length < 3) {
      setError("Boundary must have at least 3 vertices")
      throw new Error("Boundary must have at least 3 vertices")
    }

    // Calculate dimensions from boundary
    const xCoords = boundaryFeet.map(p => p.x)
    const yCoords = boundaryFeet.map(p => p.y)
    const minX = Math.min(...xCoords)
    const maxX = Math.max(...xCoords)
    const minY = Math.min(...yCoords)
    const maxY = Math.max(...yCoords)
    const width = Math.abs(maxX - minX)
    const depth = Math.abs(maxY - minY)

    // Calculate polygon area using shoelace formula
    let area = 0
    for (let i = 0; i < boundaryFeet.length; i++) {
      const j = (i + 1) % boundaryFeet.length
      area += boundaryFeet[i].x * boundaryFeet[j].y
      area -= boundaryFeet[j].x * boundaryFeet[i].y
    }
    area = Math.abs(area) / 2

    // Convert feet to geo coordinates
    // Feet-per-degree conversions
    const feetPerDegreeLat = 364000
    const feetPerDegreeLng = 364000 * Math.cos((lot.geoLat * Math.PI) / 180)

    // Convert feet (relative to canvas center) to geo (lat/lng)
    // Note: canvas Y increases downward, but latitude increases northward
    const boundaryVertices: Array<{ lat: number; lng: number }> = boundaryFeet.map(p => ({
      lat: lot.geoLat - (p.y / feetPerDegreeLat),  // Negate Y because canvas Y is inverted
      lng: lot.geoLng + (p.x / feetPerDegreeLng),
    }))

    // Optimistic update for immediate UI feedback
    setLot(prev => prev ? {
      ...prev,
      boundaryVertices,
      lotWidthFeet: width,
      lotDepthFeet: depth,
      lotAreaSqFt: area,
      dataSource: "manual",
    } : null)

    setLoading(true)
    setError(null)
    try {
      const response = await api.updateLot(lot.id, {
        boundaryVertices,
        lotWidthFeet: width,
        lotDepthFeet: depth,
        lotAreaSqFt: area,
        dataSource: "manual",
      })
      setLot(response.data.lot)
      return response.data.lot
    } catch (e) {
      // Revert on error
      setLot(lot)
      setError((e as Error).message)
      throw e
    } finally {
      setLoading(false)
    }
  }, [lot])

  /**
   * Delete lot
   */
  const removeLot = useCallback(async () => {
    if (!lot) {
      setError("No lot loaded")
      throw new Error("No lot loaded")
    }
    setLoading(true)
    setError(null)
    try {
      await api.deleteLot(lot.id)
      setLot(null)
      setParcelData(null)
    } catch (e) {
      setError((e as Error).message)
      throw e
    } finally {
      setLoading(false)
    }
  }, [lot])

  /**
   * Clear address search results
   */
  const clearAddressResults = useCallback(() => {
    setAddressResults([])
  }, [])

  return {
    lot,
    loading,
    error,
    addressResults,
    parcelData,
    searchAddresses,
    fetchParcelData,
    loadLot,
    saveLot,
    updateAduPosition,
    updateSetbacks,
    updateLotDimensions,
    updateLotCustomBoundary,
    removeLot,
    clearAddressResults,
  }
}

/**
 * Hook for managing finishes and 3D renders
 */
export function useFinishes(blueprintId?: string) {
  const [finishes, setFinishes] = useState<Finishes | null>(null)
  const [options, setOptions] = useState<FinishesOptions | null>(null)
  const [renderStatus, setRenderStatus] = useState<{ available: boolean; provider: string } | null>(null)
  const [loading, setLoading] = useState(false)
  const [rendering, setRendering] = useState(false)
  const [error, setError] = useState<string | null>(null)

  /**
   * Load finishes options (vibes, templates, lifestyles, tiers)
   */
  const loadOptions = useCallback(async () => {
    try {
      const response = await api.getFinishesOptions()
      setOptions(response.data)
      return response.data
    } catch (e) {
      console.error("Failed to load finishes options:", e)
      return null
    }
  }, [])

  /**
   * Check render service status
   */
  const checkRenderStatus = useCallback(async () => {
    try {
      const response = await api.getRenderStatus()
      setRenderStatus(response.data)
      return response.data
    } catch (e) {
      setRenderStatus({ available: false, provider: "unknown" })
      return { available: false, provider: "unknown" }
    }
  }, [])

  /**
   * Load finishes for blueprint
   */
  const loadFinishes = useCallback(async (bpId?: string) => {
    const id = bpId || blueprintId
    if (!id) {
      setError("No blueprint ID provided")
      return null
    }
    setLoading(true)
    setError(null)
    try {
      const response = await api.getFinishes(id)
      setFinishes(response.data.finish)
      return response.data.finish
    } catch (e) {
      setError((e as Error).message)
      return null
    } finally {
      setLoading(false)
    }
  }, [blueprintId])

  /**
   * Create finishes for blueprint
   */
  const createFinishes = useCallback(async (data?: {
    globalTemplate?: TemplateOption
    globalTier?: TierOption
    roomFinishes?: RoomFinish[]
  }) => {
    if (!blueprintId) {
      setError("No blueprint ID provided")
      throw new Error("No blueprint ID provided")
    }
    setLoading(true)
    setError(null)
    try {
      const response = await api.createFinishes({
        blueprintId,
        ...data,
      })
      setFinishes(response.data.finish)
      return response.data.finish
    } catch (e) {
      setError((e as Error).message)
      throw e
    } finally {
      setLoading(false)
    }
  }, [blueprintId])

  /**
   * Update finishes
   */
  const updateFinishes = useCallback(async (data: {
    globalTemplate?: TemplateOption | null
    globalTier?: TierOption
    roomFinishes?: RoomFinish[]
  }) => {
    if (!finishes) {
      setError("No finishes loaded")
      throw new Error("No finishes loaded")
    }
    setLoading(true)
    setError(null)
    try {
      const response = await api.updateFinishes(finishes.id, data)
      setFinishes(response.data.finish)
      return response.data.finish
    } catch (e) {
      setError((e as Error).message)
      throw e
    } finally {
      setLoading(false)
    }
  }, [finishes])

  /**
   * Update a single room's finish (optimistic update)
   */
  const updateRoomFinish = useCallback(async (roomFinish: RoomFinish) => {
    if (!finishes) {
      setError("No finishes loaded")
      throw new Error("No finishes loaded")
    }

    // Optimistic update
    const existingIndex = finishes.roomFinishes.findIndex(rf => rf.roomId === roomFinish.roomId)
    const updatedRoomFinishes = [...finishes.roomFinishes]
    if (existingIndex >= 0) {
      updatedRoomFinishes[existingIndex] = roomFinish
    } else {
      updatedRoomFinishes.push(roomFinish)
    }
    setFinishes(prev => prev ? { ...prev, roomFinishes: updatedRoomFinishes } : null)

    setError(null)
    try {
      const response = await api.updateRoomFinish(finishes.id, roomFinish)
      setFinishes(response.data.finish)
      return response.data.finish
    } catch (e) {
      // Revert on error
      setFinishes(finishes)
      setError((e as Error).message)
      throw e
    }
  }, [finishes])

  /**
   * Update camera placement
   */
  const updateCamera = useCallback(async (camera: CameraPlacement | null) => {
    if (!finishes) {
      setError("No finishes loaded")
      throw new Error("No finishes loaded")
    }

    // Optimistic update
    setFinishes(prev => prev ? { ...prev, cameraPlacement: camera || undefined } : null)

    setError(null)
    try {
      const response = await api.updateCamera(finishes.id, camera)
      setFinishes(response.data.finish)
      return response.data.finish
    } catch (e) {
      // Revert on error
      setFinishes(finishes)
      setError((e as Error).message)
      throw e
    }
  }, [finishes])

  /**
   * Apply template preset
   */
  const applyTemplate = useCallback(async (
    template: TemplateOption,
    overwriteExisting: boolean = false
  ) => {
    if (!finishes) {
      setError("No finishes loaded")
      throw new Error("No finishes loaded")
    }
    setLoading(true)
    setError(null)
    try {
      const response = await api.applyTemplate(finishes.id, { template, overwriteExisting })
      setFinishes(response.data.finish)
      return { finish: response.data.finish, appliedTo: response.data.appliedTo }
    } catch (e) {
      setError((e as Error).message)
      throw e
    } finally {
      setLoading(false)
    }
  }, [finishes])

  /**
   * Generate a render
   */
  const generateRender = useCallback(async (
    type: "topdown" | "firstperson",
    quality: "preview" | "final" = "preview"
  ) => {
    if (!blueprintId) {
      setError("No blueprint ID provided")
      throw new Error("No blueprint ID provided")
    }
    setRendering(true)
    setError(null)
    try {
      const response = await api.generateRender({ blueprintId, type, quality })
      // Reload finishes to get updated render URLs
      await loadFinishes()
      return response.data
    } catch (e) {
      setError((e as Error).message)
      throw e
    } finally {
      setRendering(false)
    }
  }, [blueprintId, loadFinishes])

  /**
   * Get render history
   */
  const getRenderHistory = useCallback(async (): Promise<RenderRecord[]> => {
    if (!blueprintId) {
      return []
    }
    try {
      const response = await api.getRenderHistory(blueprintId)
      return response.data.history
    } catch (e) {
      console.error("Failed to get render history:", e)
      return []
    }
  }, [blueprintId])

  /**
   * Ensure finishes exist (create if needed)
   */
  const ensureFinishes = useCallback(async () => {
    if (!blueprintId) {
      throw new Error("No blueprint ID provided")
    }
    if (finishes) return finishes

    // Try to load existing
    const existing = await loadFinishes()
    if (existing) return existing

    // Create new
    return createFinishes()
  }, [blueprintId, finishes, loadFinishes, createFinishes])

  // Auto-load options on mount
  useEffect(() => {
    loadOptions()
    checkRenderStatus()
  }, [loadOptions, checkRenderStatus])

  return {
    finishes,
    options,
    renderStatus,
    loading,
    rendering,
    error,
    loadOptions,
    checkRenderStatus,
    loadFinishes,
    createFinishes,
    updateFinishes,
    updateRoomFinish,
    updateCamera,
    applyTemplate,
    generateRender,
    getRenderHistory,
    ensureFinishes,
  }
}
