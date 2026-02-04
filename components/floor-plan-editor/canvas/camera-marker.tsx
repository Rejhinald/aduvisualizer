"use client";

import React, { useRef } from "react";
import { Group, Circle, Line, Wedge, Text } from "react-konva";
import type Konva from "konva";
import type { CameraPlacement } from "@/lib/api/client";

interface CameraMarkerProps {
  camera: CameraPlacement;
  selected: boolean;
  onSelect: () => void;
  onDragEnd: (position: { x: number; y: number }) => void;
  onRotate: (rotation: number) => void;
}

export function CameraMarker({
  camera,
  selected,
  onSelect,
  onDragEnd,
  onRotate,
}: CameraMarkerProps) {
  const groupRef = useRef<Konva.Group>(null);

  // Camera body size
  const cameraSize = 20;

  // FOV cone length (visual representation)
  const fovLength = 100;

  // FOV colors
  const fovColors: Record<number, string> = {
    30: "rgba(59, 130, 246, 0.2)", // Blue for narrow
    60: "rgba(34, 197, 94, 0.2)",  // Green for normal
    90: "rgba(249, 115, 22, 0.2)", // Orange for wide
  };

  const handleDragEnd = (e: Konva.KonvaEventObject<DragEvent>) => {
    const node = e.target;
    onDragEnd({
      x: node.x(),
      y: node.y(),
    });
  };

  const handleRotateStart = (e: Konva.KonvaEventObject<MouseEvent>) => {
    e.cancelBubble = true;
  };

  const handleRotateDrag = (e: Konva.KonvaEventObject<DragEvent>) => {
    const stage = e.target.getStage();
    if (!stage || !groupRef.current) return;

    const pointerPos = stage.getPointerPosition();
    if (!pointerPos) return;

    const groupPos = groupRef.current.absolutePosition();
    const dx = pointerPos.x - groupPos.x;
    const dy = pointerPos.y - groupPos.y;
    const angle = Math.atan2(dy, dx) * (180 / Math.PI);

    // Normalize to 0-360
    const normalizedAngle = ((angle % 360) + 360) % 360;
    onRotate(Math.round(normalizedAngle));
  };

  return (
    <Group
      ref={groupRef}
      x={camera.position.x}
      y={camera.position.y}
      draggable
      onDragEnd={handleDragEnd}
      onClick={onSelect}
      onTap={onSelect}
    >
      {/* FOV Cone */}
      <Wedge
        rotation={camera.rotation - camera.fov / 2}
        radius={fovLength}
        angle={camera.fov}
        fill={fovColors[camera.fov] || fovColors[60]}
        stroke={selected ? "#3b82f6" : "#64748b"}
        strokeWidth={selected ? 2 : 1}
        dash={[5, 5]}
      />

      {/* Center line (view direction) */}
      <Line
        points={[0, 0, fovLength, 0]}
        stroke={selected ? "#3b82f6" : "#64748b"}
        strokeWidth={2}
        rotation={camera.rotation}
      />

      {/* Camera body (circle) */}
      <Circle
        radius={cameraSize / 2}
        fill={selected ? "#3b82f6" : "#1e293b"}
        stroke={selected ? "#60a5fa" : "#475569"}
        strokeWidth={2}
        shadowColor="black"
        shadowBlur={selected ? 10 : 5}
        shadowOpacity={0.3}
      />

      {/* Camera icon (simple lens representation) */}
      <Circle
        radius={cameraSize / 4}
        fill={selected ? "#60a5fa" : "#64748b"}
      />

      {/* Rotation handle (only when selected) */}
      {selected && (
        <Circle
          x={fovLength * 0.8 * Math.cos((camera.rotation * Math.PI) / 180)}
          y={fovLength * 0.8 * Math.sin((camera.rotation * Math.PI) / 180)}
          radius={8}
          fill="#3b82f6"
          stroke="white"
          strokeWidth={2}
          draggable
          onMouseDown={handleRotateStart}
          onDragMove={handleRotateDrag}
          onDragEnd={(e) => e.cancelBubble = true}
          cursor="grab"
        />
      )}

      {/* Height label */}
      {selected && (
        <Text
          text={`${camera.height}'`}
          x={-15}
          y={cameraSize / 2 + 5}
          fontSize={10}
          fill="#64748b"
          fontStyle="bold"
        />
      )}
    </Group>
  );
}
