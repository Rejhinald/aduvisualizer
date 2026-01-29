import { useState, useCallback, useRef, useEffect } from "react";
import type { Room, Door, Window, Point } from "@/lib/types";
import type { Furniture } from "../types";
import { MAX_HISTORY } from "../constants";

interface HistoryState {
  rooms: Room[];
  doors: Door[];
  windows: Window[];
  furniture: Furniture[];
  aduBoundary: Point[];
}

interface UseHistoryOptions {
  rooms: Room[];
  doors: Door[];
  windows: Window[];
  furniture: Furniture[];
  aduBoundary: Point[];
  onRestore: (state: HistoryState) => void;
}

export function useHistory({
  rooms,
  doors,
  windows,
  furniture,
  aduBoundary,
  onRestore,
}: UseHistoryOptions) {
  const [history, setHistory] = useState<HistoryState[]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const isUndoingOrRedoing = useRef(false);
  const hasInitializedHistory = useRef(false);

  // Deep clone state
  const cloneState = useCallback((state: HistoryState): HistoryState => ({
    rooms: JSON.parse(JSON.stringify(state.rooms)),
    doors: JSON.parse(JSON.stringify(state.doors)),
    windows: JSON.parse(JSON.stringify(state.windows)),
    furniture: JSON.parse(JSON.stringify(state.furniture)),
    aduBoundary: JSON.parse(JSON.stringify(state.aduBoundary)),
  }), []);

  // Get current state
  const getCurrentState = useCallback((): HistoryState => ({
    rooms,
    doors,
    windows,
    furniture,
    aduBoundary,
  }), [rooms, doors, windows, furniture, aduBoundary]);

  // Save current state to history
  const saveToHistory = useCallback(() => {
    if (isUndoingOrRedoing.current) return;

    const newState = cloneState(getCurrentState());

    // Remove any history after current index (when user makes a new change after undo)
    const newHistory = history.slice(0, historyIndex + 1);
    newHistory.push(newState);

    // Limit history to MAX_HISTORY states
    if (newHistory.length > MAX_HISTORY) {
      newHistory.shift();
      setHistory(newHistory);
      setHistoryIndex(newHistory.length - 1);
    } else {
      setHistory(newHistory);
      setHistoryIndex(newHistory.length - 1);
    }
  }, [getCurrentState, cloneState, history, historyIndex]);

  // Undo
  const undo = useCallback(() => {
    if (historyIndex > 0) {
      isUndoingOrRedoing.current = true;
      const previousState = cloneState(history[historyIndex - 1]);
      onRestore(previousState);
      setHistoryIndex(historyIndex - 1);
      setTimeout(() => {
        isUndoingOrRedoing.current = false;
      }, 100);
    }
  }, [historyIndex, history, cloneState, onRestore]);

  // Redo
  const redo = useCallback(() => {
    if (historyIndex < history.length - 1) {
      isUndoingOrRedoing.current = true;
      const nextState = cloneState(history[historyIndex + 1]);
      onRestore(nextState);
      setHistoryIndex(historyIndex + 1);
      setTimeout(() => {
        isUndoingOrRedoing.current = false;
      }, 100);
    }
  }, [historyIndex, history, cloneState, onRestore]);

  // Initialize history with first state on mount
  useEffect(() => {
    if (!hasInitializedHistory.current && history.length === 0) {
      hasInitializedHistory.current = true;
      const initialState = cloneState(getCurrentState());
      setHistory([initialState]);
      setHistoryIndex(0);
    }
  }, [getCurrentState, cloneState, history.length]);

  // Save to history when state changes (debounced)
  useEffect(() => {
    if (!hasInitializedHistory.current || isUndoingOrRedoing.current) return;

    const timeoutId = setTimeout(() => {
      saveToHistory();
    }, 300);

    return () => clearTimeout(timeoutId);
  }, [rooms, doors, windows, furniture, aduBoundary, saveToHistory]);

  return {
    undo,
    redo,
    canUndo: historyIndex > 0,
    canRedo: historyIndex < history.length - 1,
    historyLength: history.length,
    currentIndex: historyIndex,
    isUndoingOrRedoing: isUndoingOrRedoing.current,
  };
}
