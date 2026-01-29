"use client"

import { useState, useCallback } from "react"
import * as api from "./client"
import type {
  Project,
  Blueprint,
  SaveBlueprintData,
  SaveBlueprintResponse,
  GenerateVisualizationData,
  GenerateVisualizationResponse,
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
