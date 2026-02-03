"use client";

import React, { useState, useEffect, useCallback } from "react";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
  DragStartEvent,
  DragOverlay,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical } from "lucide-react";
import { cn } from "@/lib/utils";

interface DraggablePanelContainerProps {
  children: React.ReactNode;
  storageKey: string;
  panelIds: string[];
  className?: string;
}

interface SortableItemProps {
  id: string;
  children: React.ReactNode;
}

function SortableItem({ id, children }: SortableItemProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    zIndex: isDragging ? 1000 : "auto",
  };

  return (
    <div ref={setNodeRef} style={style} className="relative group">
      {/* Drag handle - top right, visible on hover */}
      <div
        {...attributes}
        {...listeners}
        className={cn(
          "absolute right-1 top-1 w-6 h-6 flex items-center justify-center rounded",
          "cursor-grab active:cursor-grabbing",
          "opacity-0 group-hover:opacity-100 transition-opacity",
          "z-10 bg-background/90 hover:bg-secondary border border-border/50",
          isDragging && "opacity-100"
        )}
        title="Drag to reorder"
      >
        <GripVertical className="h-3.5 w-3.5 text-muted-foreground" />
      </div>
      {/* Panel content */}
      <div className={cn("transition-all", isDragging && "shadow-lg")}>
        {children}
      </div>
    </div>
  );
}

export function DraggablePanelContainer({
  children,
  storageKey,
  panelIds: defaultPanelIds,
  className,
}: DraggablePanelContainerProps) {
  const [panelOrder, setPanelOrder] = useState<string[]>(defaultPanelIds);
  const [isLoaded, setIsLoaded] = useState(false);
  const [activeId, setActiveId] = useState<string | null>(null);

  // Load saved order from localStorage
  useEffect(() => {
    try {
      const saved = localStorage.getItem(storageKey);
      if (saved) {
        const savedOrder = JSON.parse(saved) as string[];
        // Validate saved order contains all current panel IDs
        const validOrder = savedOrder.filter((id) => defaultPanelIds.includes(id));
        // Add any new panels that weren't in saved order
        const newPanels = defaultPanelIds.filter((id) => !savedOrder.includes(id));
        if (validOrder.length > 0) {
          setPanelOrder([...validOrder, ...newPanels]);
        }
      }
    } catch (e) {
      console.warn("Failed to load panel order:", e);
    }
    setIsLoaded(true);
  }, [storageKey, defaultPanelIds]);

  // Save order to localStorage
  const saveOrder = useCallback(
    (order: string[]) => {
      try {
        localStorage.setItem(storageKey, JSON.stringify(order));
      } catch (e) {
        console.warn("Failed to save panel order:", e);
      }
    },
    [storageKey]
  );

  // Sensors for drag detection
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8, // Minimum drag distance before activation
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  // Handle drag start
  const handleDragStart = useCallback((event: DragStartEvent) => {
    setActiveId(event.active.id as string);
  }, []);

  // Handle drag end
  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      const { active, over } = event;

      setActiveId(null);

      if (over && active.id !== over.id) {
        setPanelOrder((items) => {
          const oldIndex = items.indexOf(active.id as string);
          const newIndex = items.indexOf(over.id as string);
          const newOrder = arrayMove(items, oldIndex, newIndex);
          saveOrder(newOrder);
          return newOrder;
        });
      }
    },
    [saveOrder]
  );

  // Convert children to array and create a map by ID
  const childrenArray = React.Children.toArray(children);
  const childrenByKey: Record<string, React.ReactNode> = {};

  childrenArray.forEach((child) => {
    if (React.isValidElement(child) && child.key) {
      // Strip the ".$" prefix that React adds to keys
      const key = String(child.key).replace(/^\.\$/, "");
      childrenByKey[key] = child;
    }
  });

  // Don't render until we've loaded the saved order
  if (!isLoaded) {
    return <div className={className}>{children}</div>;
  }

  // Get active child for overlay
  const activeChild = activeId ? childrenByKey[activeId] : null;

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
      <SortableContext items={panelOrder} strategy={verticalListSortingStrategy}>
        <div className={className}>
          {panelOrder.map((id) => {
            const child = childrenByKey[id];
            if (!child) return null;
            return (
              <SortableItem key={id} id={id}>
                {child}
              </SortableItem>
            );
          })}
        </div>
      </SortableContext>

      {/* Drag overlay - shows a clean preview while dragging */}
      <DragOverlay dropAnimation={null}>
        {activeChild ? (
          <div className="opacity-90 shadow-xl rounded-lg border border-primary/30 bg-background">
            {activeChild}
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}
