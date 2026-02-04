# ADU Visualizer v2 - Architecture Design

**Date:** 2026-02-05
**Status:** Approved
**Branch:** v2

## Overview

Complete rewrite of ADU Visualizer using blueprint-js architecture patterns. Core principle: store coordinates in feet, use corner/wall graph model, direct 2D-to-3D mapping.

## Key Decisions

| Decision | Choice |
|----------|--------|
| Unit system | Feet-inches (decimal feet internally, display as 12' 6") |
| Data model | Corner/Wall graph, rooms auto-detect from enclosed loops |
| 2D → 3D mapping | Direct: `(x, y)` feet → `(x, 0, y)` Three.js |
| Canvas scale | Fixed 20px/foot, viewport handles zoom/pan |
| UX approach | Keep current ease of use, blueprint-js logic underneath |
| Storage | Corners + walls in DB, rooms computed on load |
| Interaction | Hybrid: drag rectangles for quick rooms + corner mode for complex shapes |
| Tech stack | Keep: Next.js, Konva, Three.js, Bun, Hono, Drizzle, PostgreSQL |
| Reset approach | v2 branches, main preserved as backup |

## Core Features (MVP)

- [x] Wall drawing (rectangle drag + corner click)
- [x] Auto room detection from wall loops
- [x] Doors/windows placement on walls
- [x] Furniture placement
- [x] Save/load blueprints
- [x] 3D top-down view
- [x] PDF export
- [x] Version history/snapshots
- [x] Lot overlay (GIS + manual boundary)
- [x] Action logging

## Phase 2 Features

- [ ] Finishes/vibes selection
- [ ] AI-generated renders (Pollinations)

---

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                     ADU Visualizer v2                        │
├─────────────────────────────────────────────────────────────┤
│  FRONTEND (Next.js)                                         │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐         │
│  │ Floor Plan  │  │   3D View   │  │  Lot Overlay │         │
│  │   Editor    │  │  (Three.js) │  │  (Satellite) │         │
│  │  (Konva)    │  │             │  │              │         │
│  └──────┬──────┘  └──────┬──────┘  └──────┬──────┘         │
│         │                │                │                  │
│         └────────────────┼────────────────┘                  │
│                          ▼                                   │
│              ┌───────────────────────┐                       │
│              │   Blueprint Engine    │  ← Core logic         │
│              │  (Corners, Walls,     │    (feet-based)       │
│              │   Rooms, Graph)       │                       │
│              └───────────┬───────────┘                       │
├──────────────────────────┼──────────────────────────────────┤
│  BACKEND (Bun + Hono)    ▼                                  │
│              ┌───────────────────────┐                       │
│              │      REST API         │                       │
│              └───────────┬───────────┘                       │
│                          ▼                                   │
│              ┌───────────────────────┐                       │
│              │     PostgreSQL        │                       │
│              └───────────────────────┘                       │
└─────────────────────────────────────────────────────────────┘
```

---

## Database Schema

### Core Tables

```sql
-- Projects
CREATE TABLE projects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Blueprints
CREATE TABLE blueprints (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  version INT DEFAULT 1,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Corners (source of truth)
CREATE TABLE corners (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  blueprint_id UUID REFERENCES blueprints(id) ON DELETE CASCADE,
  x DECIMAL(10,4) NOT NULL,  -- feet
  y DECIMAL(10,4) NOT NULL,  -- feet
  elevation DECIMAL(10,4) DEFAULT 0
);

-- Walls (connect corners)
CREATE TABLE walls (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  blueprint_id UUID REFERENCES blueprints(id) ON DELETE CASCADE,
  start_corner_id UUID REFERENCES corners(id) ON DELETE CASCADE,
  end_corner_id UUID REFERENCES corners(id) ON DELETE CASCADE,
  thickness DECIMAL(10,4) DEFAULT 0.5,  -- feet (6 inches)
  height DECIMAL(10,4) DEFAULT 9        -- feet
);

-- Doors (on walls)
CREATE TABLE doors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  wall_id UUID REFERENCES walls(id) ON DELETE CASCADE,
  position DECIMAL(5,4) NOT NULL,  -- 0-1 along wall
  width DECIMAL(10,4) NOT NULL,    -- feet
  height DECIMAL(10,4) DEFAULT 6.67, -- feet (6'8")
  type VARCHAR(50) DEFAULT 'single'
);

-- Windows (on walls)
CREATE TABLE windows (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  wall_id UUID REFERENCES walls(id) ON DELETE CASCADE,
  position DECIMAL(5,4) NOT NULL,  -- 0-1 along wall
  width DECIMAL(10,4) NOT NULL,
  height DECIMAL(10,4) NOT NULL,
  sill_height DECIMAL(10,4) DEFAULT 3,  -- feet
  type VARCHAR(50) DEFAULT 'standard'
);

-- Furniture (free placement)
CREATE TABLE furniture (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  blueprint_id UUID REFERENCES blueprints(id) ON DELETE CASCADE,
  x DECIMAL(10,4) NOT NULL,
  y DECIMAL(10,4) NOT NULL,
  rotation DECIMAL(10,4) DEFAULT 0,  -- degrees
  width DECIMAL(10,4) NOT NULL,
  depth DECIMAL(10,4) NOT NULL,
  type VARCHAR(50) NOT NULL
);

-- Lots (property boundary)
CREATE TABLE lots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  blueprint_id UUID REFERENCES blueprints(id) ON DELETE CASCADE,
  address VARCHAR(255),
  city VARCHAR(100),
  state VARCHAR(50),
  zip VARCHAR(20),
  boundary JSONB,  -- array of {x, y} in feet
  geo_lat DECIMAL(10,7),
  geo_lng DECIMAL(10,7),
  setbacks JSONB DEFAULT '{"front": 0, "back": 4, "left": 4, "right": 4}'
);

-- Snapshots (version history)
CREATE TABLE snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  blueprint_id UUID REFERENCES blueprints(id) ON DELETE CASCADE,
  data JSONB NOT NULL,
  description VARCHAR(255),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Action Logs (audit trail)
CREATE TABLE action_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  blueprint_id UUID REFERENCES blueprints(id) ON DELETE CASCADE,
  action_type VARCHAR(50) NOT NULL,
  entity_type VARCHAR(50) NOT NULL,
  entity_id UUID,
  before_state JSONB,
  after_state JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Exports (generated files)
CREATE TABLE exports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  blueprint_id UUID REFERENCES blueprints(id) ON DELETE CASCADE,
  type VARCHAR(50) NOT NULL,  -- pdf, png, etc.
  file_path VARCHAR(500),
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

---

## Blueprint Engine

### File Structure

```
lib/blueprint-engine/
├── types.ts          // Core types
├── Blueprint.ts      // Main class
├── Corner.ts         // Corner entity
├── Wall.ts           // Wall entity
├── Room.ts           // Computed room
├── RoomDetector.ts   // Find enclosed rooms
├── Dimensioning.ts   // Feet ↔ display conversion
├── Geometry.ts       // Math utilities
└── index.ts          // Exports
```

### Core Types

```typescript
interface Point {
  x: number  // feet
  y: number  // feet
}

interface Corner extends Point {
  id: string
  elevation: number
  walls: Wall[]  // connected walls
}

interface Wall {
  id: string
  startCorner: Corner
  endCorner: Corner
  thickness: number  // feet
  height: number     // feet
  doors: Door[]
  windows: Window[]
}

interface Room {
  id: string
  corners: Corner[]  // ordered CCW
  walls: Wall[]
  area: number       // sq ft
  center: Point
  name: string
  type: RoomType
}

interface Door {
  id: string
  wall: Wall
  position: number   // 0-1 along wall
  width: number
  height: number
  type: DoorType
}

interface Window {
  id: string
  wall: Wall
  position: number
  width: number
  height: number
  sillHeight: number
  type: WindowType
}

interface Furniture {
  id: string
  position: Point
  rotation: number
  width: number
  depth: number
  type: FurnitureType
}
```

### Blueprint Class

```typescript
class Blueprint extends EventEmitter {
  corners: Map<string, Corner>
  walls: Map<string, Wall>
  doors: Map<string, Door>
  windows: Map<string, Window>
  furniture: Map<string, Furniture>
  rooms: Room[]  // computed

  // Corner operations
  addCorner(x: number, y: number): Corner
  moveCorner(id: string, x: number, y: number): void
  deleteCorner(id: string): void
  mergeCorners(id1: string, id2: string): Corner

  // Wall operations
  addWall(startId: string, endId: string): Wall
  deleteWall(id: string): void
  splitWall(id: string, point: Point): Corner

  // Door/Window operations
  addDoor(wallId: string, position: number, type: DoorType): Door
  addWindow(wallId: string, position: number, type: WindowType): Window

  // Furniture operations
  addFurniture(x: number, y: number, type: FurnitureType): Furniture
  moveFurniture(id: string, x: number, y: number): void
  rotateFurniture(id: string, angle: number): void

  // Room detection (called after wall changes)
  detectRooms(): Room[]

  // Serialization
  toJSON(): BlueprintData
  static fromJSON(data: BlueprintData): Blueprint
}
```

---

## 2D Editor

### File Structure

```
components/floor-plan-editor/
├── FloorPlanEditor.tsx     // Main component
├── EditorCanvas.tsx        // Konva Stage
├── modes/
│   ├── SelectMode.ts       // Select, move, delete
│   ├── WallMode.ts         // Click to draw walls
│   ├── RectangleMode.ts    // Drag for rectangles
│   ├── DoorMode.ts         // Place doors
│   ├── WindowMode.ts       // Place windows
│   └── FurnitureMode.ts    // Place furniture
├── layers/
│   ├── GridLayer.tsx
│   ├── RoomLayer.tsx
│   ├── WallLayer.tsx
│   ├── CornerLayer.tsx
│   ├── DoorLayer.tsx
│   ├── WindowLayer.tsx
│   └── FurnitureLayer.tsx
└── hooks/
    ├── useBlueprint.ts
    ├── useViewport.ts
    └── useSnapping.ts
```

### Coordinate Conversion

```typescript
const SCALE = 20  // pixels per foot

// Canvas pixels → feet
function pixelsToFeet(px: number): number {
  return px / SCALE
}

// Feet → canvas pixels
function feetToPixels(ft: number): number {
  return ft * SCALE
}

// Mouse event → feet (accounting for viewport)
function canvasToFeet(e: KonvaEventObject, viewport: Viewport): Point {
  const stage = e.target.getStage()
  const pos = stage.getPointerPosition()
  return {
    x: (pos.x - viewport.offsetX) / viewport.zoom / SCALE,
    y: (pos.y - viewport.offsetY) / viewport.zoom / SCALE
  }
}
```

---

## 3D View

### File Structure

```
components/floor-plan-3d/
├── FloorPlan3DViewer.tsx
├── Scene.tsx
├── Camera.tsx
├── geometry/
│   ├── WallMesh.tsx
│   ├── FloorMesh.tsx
│   ├── DoorMesh.tsx
│   ├── WindowMesh.tsx
│   └── FurnitureMesh.tsx
└── controls/
    ├── TopDownControls.tsx
    └── FirstPersonControls.tsx
```

### Direct Coordinate Mapping

```typescript
// 2D feet → 3D Three.js (NO CONVERSION)
function toThreeJS(point: Point, height = 0): THREE.Vector3 {
  return new THREE.Vector3(point.x, height, point.y)
}

// Wall mesh creation
function createWallMesh(wall: Wall): THREE.Mesh {
  const start = toThreeJS(wall.startCorner)
  const end = toThreeJS(wall.endCorner)

  const length = start.distanceTo(end)
  const midpoint = start.clone().add(end).multiplyScalar(0.5)
  const angle = Math.atan2(end.z - start.z, end.x - start.x)

  const geometry = new THREE.BoxGeometry(length, wall.height, wall.thickness)
  const mesh = new THREE.Mesh(geometry, material)

  mesh.position.set(midpoint.x, wall.height / 2, midpoint.z)
  mesh.rotation.y = -angle

  return mesh
}
```

---

## API Endpoints

```
POST   /api/v1/projects                    Create project
GET    /api/v1/projects/:id                Get project
DELETE /api/v1/projects/:id                Delete project

POST   /api/v1/blueprints                  Create blueprint
GET    /api/v1/blueprints/:id              Get full blueprint
PUT    /api/v1/blueprints/:id              Save blueprint
DELETE /api/v1/blueprints/:id              Delete blueprint

PATCH  /api/v1/blueprints/:id/corners      Batch update corners
PATCH  /api/v1/blueprints/:id/walls        Batch update walls
PATCH  /api/v1/blueprints/:id/doors        Batch update doors
PATCH  /api/v1/blueprints/:id/windows      Batch update windows
PATCH  /api/v1/blueprints/:id/furniture    Batch update furniture

POST   /api/v1/blueprints/:id/snapshots    Create snapshot
GET    /api/v1/blueprints/:id/snapshots    List snapshots
POST   /api/v1/blueprints/:id/restore/:snapshotId  Restore

POST   /api/v1/blueprints/:id/export/pdf   Generate PDF
GET    /api/v1/exports/:id                 Download export

POST   /api/v1/lots                        Create/update lot
GET    /api/v1/lots/search-address         Geocode
GET    /api/v1/lots/parcel                 Fetch GIS data

GET    /api/v1/blueprints/:id/actions      Get action log
```

---

## Implementation Order

1. **Backend schema** - Set up fresh DB tables
2. **Blueprint Engine** - Core logic in TypeScript
3. **2D Editor** - Wall drawing, room detection
4. **Doors/Windows** - Place on walls
5. **Furniture** - Drag and drop
6. **3D View** - Top-down rendering
7. **Save/Load** - API integration
8. **PDF Export** - Generate floor plan PDF
9. **Snapshots** - Version history
10. **Lot Overlay** - Port existing + manual mode
11. **Action Logging** - Audit trail

---

## References

- blueprint-js: `C:\Users\Admin\Documents\Work Repo\reference-aduvisualizer\blueprint-js`
- blueprint3d: `C:\Users\Admin\Documents\Work Repo\reference-aduvisualizer\blueprint3d`
