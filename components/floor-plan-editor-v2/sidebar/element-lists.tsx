"use client"

import { useState } from "react"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible"
import {
  ChevronDown,
  Home,
  DoorOpen,
  Square,
  Sofa,
  Trash2,
  MapPin,
  RotateCw,
} from "lucide-react"
import { cn } from "@/lib/utils"
import type { EditorState, EditorAction, Selection, Room, Door, Window, Furniture, RoomType, Corner, Wall } from "../types"

// Room type labels for display
const ROOM_TYPE_LABELS: Record<RoomType, string> = {
  bedroom: "Bedroom",
  bathroom: "Bathroom",
  half_bath: "Half Bath",
  kitchen: "Kitchen",
  living: "Living Room",
  dining: "Dining",
  closet: "Closet",
  laundry: "Laundry",
  storage: "Storage",
  utility: "Utility",
  entry: "Entry",
  corridor: "Corridor",
  flex: "Flex Space",
  other: "Other",
}

// Room type to color mapping
const ROOM_COLORS: Record<RoomType, string> = {
  bedroom: "#818cf8",     // indigo
  bathroom: "#38bdf8",    // sky
  half_bath: "#7dd3fc",   // lighter sky
  kitchen: "#fbbf24",     // amber
  living: "#4ade80",      // green
  dining: "#a3e635",      // lime
  closet: "#d4d4d4",      // gray
  laundry: "#f472b6",     // pink
  storage: "#9ca3af",     // gray
  utility: "#a78bfa",     // violet
  entry: "#fb923c",       // orange
  corridor: "#e5e7eb",    // light gray
  flex: "#2dd4bf",        // teal
  other: "#94a3b8",       // slate
}

function getRoomColor(type: RoomType): string {
  return ROOM_COLORS[type] || "#94a3b8"
}

// ============================================
// Corner List
// ============================================

interface CornerListProps {
  corners: Corner[]
  selection: Selection | null
  dispatch: React.Dispatch<EditorAction>
}

export function CornerList({ corners, selection, dispatch }: CornerListProps) {
  const [isOpen, setIsOpen] = useState(false)

  const handleSelect = (cornerId: string) => {
    dispatch({ type: "SELECT", selection: { type: "corner", id: cornerId } })
  }

  const handleDelete = (cornerId: string, e: React.MouseEvent) => {
    e.stopPropagation()
    dispatch({ type: "DELETE_CORNER", id: cornerId })
  }

  return (
    <Card className="shadow-sm overflow-hidden">
      <Collapsible open={isOpen} onOpenChange={setIsOpen}>
        <CollapsibleTrigger asChild>
          <div className="flex items-center justify-between p-3 cursor-pointer hover:bg-gray-50 transition-colors">
            <div className="flex items-center gap-2">
              <MapPin className="h-4 w-4 text-gray-500" />
              <span className="text-sm font-medium">
                Corners {corners.length > 0 && `(${corners.length})`}
              </span>
            </div>
            <ChevronDown
              className={cn(
                "h-4 w-4 text-gray-400 transition-transform duration-200",
                isOpen && "rotate-180"
              )}
            />
          </div>
        </CollapsibleTrigger>

        <CollapsibleContent>
          <div className="px-3 pb-3 space-y-1.5">
            {corners.length === 0 ? (
              <p className="text-xs text-gray-400 py-2">
                No corners created. Draw walls to create corners.
              </p>
            ) : (
              <div className="space-y-1 max-h-40 overflow-y-auto">
                {corners.map((corner, i) => (
                  <div
                    key={corner.id}
                    onClick={() => handleSelect(corner.id)}
                    className={cn(
                      "flex items-center gap-2 p-2 rounded-md cursor-pointer transition-colors text-sm",
                      "hover:bg-gray-50 border border-transparent",
                      selection?.id === corner.id && "bg-primary/5 border-primary/20"
                    )}
                  >
                    <div className="w-2.5 h-2.5 rounded-full bg-gray-600 flex-shrink-0" />
                    <span className="flex-1 truncate">
                      Corner {i + 1}
                    </span>
                    <span className="text-xs text-gray-400 font-mono">
                      ({corner.x.toFixed(1)}', {corner.y.toFixed(1)}')
                    </span>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={(e) => handleDelete(corner.id, e)}
                      className="h-5 w-5 p-0 text-gray-400 hover:text-red-500"
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </CollapsibleContent>
      </Collapsible>
    </Card>
  )
}

// ============================================
// Room List
// ============================================

interface RoomListProps {
  rooms: Room[]
  selection: Selection | null
  dispatch: React.Dispatch<EditorAction>
}

export function RoomList({ rooms, selection, dispatch }: RoomListProps) {
  const [isOpen, setIsOpen] = useState(true)
  const [expandedRoomId, setExpandedRoomId] = useState<string | null>(null)

  const handleSelect = (roomId: string) => {
    dispatch({ type: "SELECT", selection: { type: "wall", id: roomId } })
  }

  const handleRotate = (roomId: string, e: React.MouseEvent) => {
    e.stopPropagation()
    dispatch({ type: "ROTATE_ROOM", roomId, degrees: 90 })
  }

  const handleTypeChange = (roomId: string, newType: RoomType) => {
    dispatch({ type: "UPDATE_ROOM_TYPE", roomId, roomType: newType })
  }

  const toggleExpanded = (roomId: string, e: React.MouseEvent) => {
    e.stopPropagation()
    setExpandedRoomId(expandedRoomId === roomId ? null : roomId)
  }

  return (
    <Card className="shadow-sm overflow-hidden">
      <Collapsible open={isOpen} onOpenChange={setIsOpen}>
        <CollapsibleTrigger asChild>
          <div className="flex items-center justify-between p-3 cursor-pointer hover:bg-gray-50 transition-colors">
            <div className="flex items-center gap-2">
              <Home className="h-4 w-4 text-gray-500" />
              <span className="text-sm font-medium">
                Rooms {rooms.length > 0 && `(${rooms.length})`}
              </span>
            </div>
            <ChevronDown
              className={cn(
                "h-4 w-4 text-gray-400 transition-transform duration-200",
                isOpen && "rotate-180"
              )}
            />
          </div>
        </CollapsibleTrigger>

        <CollapsibleContent>
          <div className="px-3 pb-3 space-y-1.5">
            {rooms.length === 0 ? (
              <p className="text-xs text-gray-400 py-2">
                No rooms detected. Draw walls to create rooms.
              </p>
            ) : (
              <div className="space-y-1 max-h-60 overflow-y-auto">
                {rooms.map((room) => (
                  <div key={room.id}>
                    <div
                      onClick={() => handleSelect(room.id)}
                      className={cn(
                        "flex items-center gap-2 p-2 rounded-md cursor-pointer transition-colors text-sm",
                        "hover:bg-gray-50 border border-transparent",
                        selection?.id === room.id && "bg-primary/5 border-primary/20"
                      )}
                    >
                      <div
                        className="w-3 h-3 rounded-sm flex-shrink-0"
                        style={{ backgroundColor: getRoomColor(room.type) }}
                      />
                      <span className="flex-1 truncate">
                        {room.name || ROOM_TYPE_LABELS[room.type]}
                      </span>
                      <span className="text-xs text-gray-400">
                        {room.area.toFixed(0)} sf
                      </span>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={(e) => handleRotate(room.id, e)}
                        className="h-6 w-6 p-0 text-gray-400 hover:text-primary"
                        title="Rotate 90°"
                      >
                        <RotateCw className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={(e) => toggleExpanded(room.id, e)}
                        className="h-6 w-6 p-0 text-gray-400 hover:text-primary"
                      >
                        <ChevronDown
                          className={cn(
                            "h-3.5 w-3.5 transition-transform",
                            expandedRoomId === room.id && "rotate-180"
                          )}
                        />
                      </Button>
                    </div>
                    {/* Expanded details */}
                    {expandedRoomId === room.id && (
                      <div className="ml-5 mt-1 p-2 bg-gray-50 rounded-md space-y-2">
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-gray-500 w-12">Type:</span>
                          <Select
                            value={room.type}
                            onValueChange={(value) => handleTypeChange(room.id, value as RoomType)}
                          >
                            <SelectTrigger className="h-7 text-xs flex-1">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {Object.entries(ROOM_TYPE_LABELS).map(([type, label]) => (
                                <SelectItem key={type} value={type} className="text-xs">
                                  {label}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="flex items-center gap-2 text-xs text-gray-500">
                          <span className="w-12">Area:</span>
                          <span>{room.area.toFixed(1)} sq ft</span>
                        </div>
                        <div className="flex items-center gap-2 text-xs text-gray-500">
                          <span className="w-12">Walls:</span>
                          <span>{room.walls.length}</span>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </CollapsibleContent>
      </Collapsible>
    </Card>
  )
}

// ============================================
// Wall List
// ============================================

interface WallListProps {
  walls: Wall[]
  corners: Corner[]
  doors: Door[]
  windows: Window[]
  selection: Selection | null
  dispatch: React.Dispatch<EditorAction>
}

export function WallList({ walls, corners, doors, windows, selection, dispatch }: WallListProps) {
  const [isOpen, setIsOpen] = useState(true)

  const handleSelect = (wallId: string) => {
    dispatch({ type: "SELECT", selection: { type: "wall", id: wallId } })
  }

  const handleDelete = (wallId: string, e: React.MouseEvent) => {
    e.stopPropagation()
    dispatch({ type: "DELETE_WALL", id: wallId })
  }

  // Calculate wall length
  const getWallLength = (wall: Wall) => {
    const start = corners.find((c) => c.id === wall.startCornerId)
    const end = corners.find((c) => c.id === wall.endCornerId)
    if (!start || !end) return 0
    const dx = end.x - start.x
    const dy = end.y - start.y
    return Math.sqrt(dx * dx + dy * dy)
  }

  // Count doors/windows on wall
  const getWallOpenings = (wallId: string) => {
    const wallDoors = doors.filter((d) => d.wallId === wallId)
    const wallWindows = windows.filter((w) => w.wallId === wallId)
    return { doors: wallDoors.length, windows: wallWindows.length }
  }

  // Format length display
  const formatLength = (feet: number) => {
    const wholeFeet = Math.floor(feet)
    const inches = Math.round((feet - wholeFeet) * 12)
    if (inches === 0) return `${wholeFeet}'`
    if (wholeFeet === 0) return `${inches}"`
    return `${wholeFeet}' ${inches}"`
  }

  return (
    <Card className="shadow-sm overflow-hidden">
      <Collapsible open={isOpen} onOpenChange={setIsOpen}>
        <CollapsibleTrigger asChild>
          <div className="flex items-center justify-between p-3 cursor-pointer hover:bg-gray-50 transition-colors">
            <div className="flex items-center gap-2">
              <Square className="h-4 w-4 text-gray-500" />
              <span className="text-sm font-medium">
                Walls {walls.length > 0 && `(${walls.length})`}
              </span>
            </div>
            <ChevronDown
              className={cn(
                "h-4 w-4 text-gray-400 transition-transform duration-200",
                isOpen && "rotate-180"
              )}
            />
          </div>
        </CollapsibleTrigger>

        <CollapsibleContent>
          <div className="px-3 pb-3 space-y-1.5">
            {walls.length === 0 ? (
              <p className="text-xs text-gray-400 py-2">
                No walls created. Use Wall or Rectangle mode to draw walls.
              </p>
            ) : (
              <div className="space-y-1 max-h-40 overflow-y-auto">
                {walls.map((wall, i) => {
                  const length = getWallLength(wall)
                  const openings = getWallOpenings(wall.id)
                  return (
                    <div
                      key={wall.id}
                      onClick={() => handleSelect(wall.id)}
                      className={cn(
                        "flex items-center gap-2 p-2 rounded-md cursor-pointer transition-colors text-sm",
                        "hover:bg-gray-50 border border-transparent",
                        selection?.id === wall.id && "bg-primary/5 border-primary/20"
                      )}
                    >
                      <div className="w-4 h-0.5 bg-gray-600 flex-shrink-0" />
                      <span className="flex-1 truncate">
                        Wall {i + 1}
                      </span>
                      <span className="text-xs text-gray-400 font-mono">
                        {formatLength(length)}
                      </span>
                      {openings.doors > 0 && (
                        <Badge variant="secondary" className="text-[10px] px-1 py-0 bg-amber-100 text-amber-700">
                          {openings.doors}D
                        </Badge>
                      )}
                      {openings.windows > 0 && (
                        <Badge variant="secondary" className="text-[10px] px-1 py-0 bg-sky-100 text-sky-700">
                          {openings.windows}W
                        </Badge>
                      )}
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={(e) => handleDelete(wall.id, e)}
                        className="h-5 w-5 p-0 text-gray-400 hover:text-red-500"
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </CollapsibleContent>
      </Collapsible>
    </Card>
  )
}

// ============================================
// Door List
// ============================================

interface DoorListProps {
  doors: Door[]
  walls: Wall[]
  selection: Selection | null
  dispatch: React.Dispatch<EditorAction>
}

export function DoorList({ doors, walls, selection, dispatch }: DoorListProps) {
  const [isOpen, setIsOpen] = useState(true)

  const handleSelect = (doorId: string) => {
    dispatch({ type: "SELECT", selection: { type: "door", id: doorId } })
  }

  const handleDelete = (doorId: string, e: React.MouseEvent) => {
    e.stopPropagation()
    dispatch({ type: "DELETE_DOOR", id: doorId })
  }

  // Get wall index for display
  const getWallIndex = (wallId: string) => {
    const idx = walls.findIndex((w) => w.id === wallId)
    return idx >= 0 ? idx + 1 : "?"
  }

  const getDoorTypeLabel = (type: string) => {
    const labels: Record<string, string> = {
      single: "Single",
      double: "Double",
      sliding: "Sliding",
      french: "French",
      pocket: "Pocket",
      barn: "Barn",
      opening: "Opening",
    }
    return labels[type] || type
  }

  // Format width in feet and inches
  const formatWidth = (feet: number) => {
    const wholeFeet = Math.floor(feet)
    const inches = Math.round((feet - wholeFeet) * 12)
    if (inches === 0) return `${wholeFeet}'`
    return `${wholeFeet}' ${inches}"`
  }

  return (
    <Card className="shadow-sm overflow-hidden">
      <Collapsible open={isOpen} onOpenChange={setIsOpen}>
        <CollapsibleTrigger asChild>
          <div className="flex items-center justify-between p-3 cursor-pointer hover:bg-gray-50 transition-colors">
            <div className="flex items-center gap-2">
              <DoorOpen className="h-4 w-4 text-gray-500" />
              <span className="text-sm font-medium">
                Doors {doors.length > 0 && `(${doors.length})`}
              </span>
            </div>
            <ChevronDown
              className={cn(
                "h-4 w-4 text-gray-400 transition-transform duration-200",
                isOpen && "rotate-180"
              )}
            />
          </div>
        </CollapsibleTrigger>

        <CollapsibleContent>
          <div className="px-3 pb-3 space-y-1.5">
            {doors.length === 0 ? (
              <p className="text-xs text-gray-400 py-2">
                No doors placed. Select Door mode to add doors.
              </p>
            ) : (
              <div className="space-y-1 max-h-40 overflow-y-auto">
                {doors.map((door, i) => (
                  <div
                    key={door.id}
                    onClick={() => handleSelect(door.id)}
                    className={cn(
                      "flex items-center gap-2 p-2 rounded-md cursor-pointer transition-colors text-sm",
                      "hover:bg-gray-50 border border-transparent",
                      selection?.id === door.id && "bg-primary/5 border-primary/20"
                    )}
                  >
                    <DoorOpen className="w-3.5 h-3.5 text-amber-600 flex-shrink-0" />
                    <span className="flex-1 truncate">
                      Door {i + 1}
                    </span>
                    <Badge variant="outline" className="text-[10px] px-1 py-0 text-gray-500">
                      W{getWallIndex(door.wallId)}
                    </Badge>
                    <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                      {getDoorTypeLabel(door.type)}
                    </Badge>
                    <span className="text-xs text-gray-400 font-mono">
                      {formatWidth(door.width)}
                    </span>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={(e) => handleDelete(door.id, e)}
                      className="h-5 w-5 p-0 text-gray-400 hover:text-red-500"
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </CollapsibleContent>
      </Collapsible>
    </Card>
  )
}

// ============================================
// Window List
// ============================================

interface WindowListProps {
  windows: Window[]
  walls: Wall[]
  selection: Selection | null
  dispatch: React.Dispatch<EditorAction>
}

export function WindowList({ windows, walls, selection, dispatch }: WindowListProps) {
  const [isOpen, setIsOpen] = useState(true)

  const handleSelect = (windowId: string) => {
    dispatch({ type: "SELECT", selection: { type: "window", id: windowId } })
  }

  const handleDelete = (windowId: string, e: React.MouseEvent) => {
    e.stopPropagation()
    dispatch({ type: "DELETE_WINDOW", id: windowId })
  }

  // Get wall index for display
  const getWallIndex = (wallId: string) => {
    const idx = walls.findIndex((w) => w.id === wallId)
    return idx >= 0 ? idx + 1 : "?"
  }

  const getWindowTypeLabel = (type: string) => {
    const labels: Record<string, string> = {
      standard: "Standard",
      bay: "Bay",
      picture: "Picture",
      sliding: "Sliding",
      casement: "Casement",
      awning: "Awning",
    }
    return labels[type] || type
  }

  // Format dimensions
  const formatDimensions = (width: number, height: number) => {
    const formatFeet = (ft: number) => {
      const whole = Math.floor(ft)
      const inches = Math.round((ft - whole) * 12)
      if (inches === 0) return `${whole}'`
      return `${whole}'${inches}"`
    }
    return `${formatFeet(width)}×${formatFeet(height)}`
  }

  return (
    <Card className="shadow-sm overflow-hidden">
      <Collapsible open={isOpen} onOpenChange={setIsOpen}>
        <CollapsibleTrigger asChild>
          <div className="flex items-center justify-between p-3 cursor-pointer hover:bg-gray-50 transition-colors">
            <div className="flex items-center gap-2">
              <Square className="h-4 w-4 text-gray-500" />
              <span className="text-sm font-medium">
                Windows {windows.length > 0 && `(${windows.length})`}
              </span>
            </div>
            <ChevronDown
              className={cn(
                "h-4 w-4 text-gray-400 transition-transform duration-200",
                isOpen && "rotate-180"
              )}
            />
          </div>
        </CollapsibleTrigger>

        <CollapsibleContent>
          <div className="px-3 pb-3 space-y-1.5">
            {windows.length === 0 ? (
              <p className="text-xs text-gray-400 py-2">
                No windows placed. Select Window mode to add windows.
              </p>
            ) : (
              <div className="space-y-1 max-h-40 overflow-y-auto">
                {windows.map((window, i) => (
                  <div
                    key={window.id}
                    onClick={() => handleSelect(window.id)}
                    className={cn(
                      "flex items-center gap-2 p-2 rounded-md cursor-pointer transition-colors text-sm",
                      "hover:bg-gray-50 border border-transparent",
                      selection?.id === window.id && "bg-primary/5 border-primary/20"
                    )}
                  >
                    <Square className="w-3.5 h-3.5 text-sky-600 flex-shrink-0" />
                    <span className="flex-1 truncate">
                      Window {i + 1}
                    </span>
                    <Badge variant="outline" className="text-[10px] px-1 py-0 text-gray-500">
                      W{getWallIndex(window.wallId)}
                    </Badge>
                    <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                      {getWindowTypeLabel(window.type)}
                    </Badge>
                    <span className="text-xs text-gray-400 font-mono">
                      {formatDimensions(window.width, window.height)}
                    </span>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={(e) => handleDelete(window.id, e)}
                      className="h-5 w-5 p-0 text-gray-400 hover:text-red-500"
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </CollapsibleContent>
      </Collapsible>
    </Card>
  )
}

// ============================================
// Furniture List
// ============================================

interface FurnitureListProps {
  furniture: Furniture[]
  selection: Selection | null
  dispatch: React.Dispatch<EditorAction>
}

export function FurnitureList({ furniture, selection, dispatch }: FurnitureListProps) {
  const [isOpen, setIsOpen] = useState(true)

  const handleSelect = (furnitureId: string) => {
    dispatch({ type: "SELECT", selection: { type: "furniture", id: furnitureId } })
  }

  const handleDelete = (furnitureId: string, e: React.MouseEvent) => {
    e.stopPropagation()
    dispatch({ type: "DELETE_FURNITURE", id: furnitureId })
  }

  const handleRotate = (furnitureId: string, currentRotation: number, e: React.MouseEvent) => {
    e.stopPropagation()
    const newRotation = (currentRotation + 90) % 360
    dispatch({ type: "UPDATE_FURNITURE", id: furnitureId, rotation: newRotation })
  }

  const getFurnitureLabel = (type: string) => {
    const labels: Record<string, string> = {
      bed_king: "King Bed",
      bed_queen: "Queen Bed",
      bed_twin: "Twin Bed",
      sofa_3seat: "3-Seat Sofa",
      sofa_2seat: "2-Seat Sofa",
      armchair: "Armchair",
      dining_table: "Dining Table",
      coffee_table: "Coffee Table",
      desk: "Desk",
      office_chair: "Office Chair",
      toilet: "Toilet",
      sink: "Sink",
      shower: "Shower",
      bathtub: "Bathtub",
      stove: "Stove",
      refrigerator: "Fridge",
      dishwasher: "Dishwasher",
      washer: "Washer",
      dryer: "Dryer",
      tv_stand: "TV Stand",
      dresser: "Dresser",
      nightstand: "Nightstand",
      kitchen_sink: "Kitchen Sink",
      dining_chair: "Dining Chair",
      bookshelf: "Bookshelf",
    }
    return labels[type] || type.replace(/_/g, " ")
  }

  return (
    <Card className="shadow-sm overflow-hidden">
      <Collapsible open={isOpen} onOpenChange={setIsOpen}>
        <CollapsibleTrigger asChild>
          <div className="flex items-center justify-between p-3 cursor-pointer hover:bg-gray-50 transition-colors">
            <div className="flex items-center gap-2">
              <Sofa className="h-4 w-4 text-gray-500" />
              <span className="text-sm font-medium">
                Furniture {furniture.length > 0 && `(${furniture.length})`}
              </span>
            </div>
            <ChevronDown
              className={cn(
                "h-4 w-4 text-gray-400 transition-transform duration-200",
                isOpen && "rotate-180"
              )}
            />
          </div>
        </CollapsibleTrigger>

        <CollapsibleContent>
          <div className="px-3 pb-3 space-y-1.5">
            {furniture.length === 0 ? (
              <p className="text-xs text-gray-400 py-2">
                No furniture placed. Select Furniture mode to add items.
              </p>
            ) : (
              <div className="space-y-1 max-h-40 overflow-y-auto">
                {furniture.map((item) => (
                  <div
                    key={item.id}
                    onClick={() => handleSelect(item.id)}
                    className={cn(
                      "flex items-center gap-2 p-2 rounded-md cursor-pointer transition-colors text-sm",
                      "hover:bg-gray-50 border border-transparent",
                      selection?.id === item.id && "bg-primary/5 border-primary/20"
                    )}
                  >
                    <Sofa className="w-3.5 h-3.5 text-purple-600 flex-shrink-0" />
                    <span className="flex-1 truncate">
                      {getFurnitureLabel(item.type)}
                    </span>
                    <span className="text-xs text-gray-400">
                      {item.width}'×{item.depth}'
                    </span>
                    {item.rotation !== 0 && (
                      <Badge variant="secondary" className="text-[10px] px-1 py-0">
                        {item.rotation}°
                      </Badge>
                    )}
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={(e) => handleRotate(item.id, item.rotation, e)}
                      className="h-5 w-5 p-0 text-gray-400 hover:text-primary"
                      title="Rotate 90°"
                    >
                      <RotateCw className="h-3 w-3" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={(e) => handleDelete(item.id, e)}
                      className="h-5 w-5 p-0 text-gray-400 hover:text-red-500"
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </CollapsibleContent>
      </Collapsible>
    </Card>
  )
}

// ============================================
// Combined Element Lists (for convenience)
// ============================================

interface ElementListsProps {
  state: EditorState
  dispatch: React.Dispatch<EditorAction>
}

export function ElementLists({ state, dispatch }: ElementListsProps) {
  return (
    <div className="space-y-3">
      <SelectionBar state={state} dispatch={dispatch} />
      <RoomList
        rooms={state.rooms}
        selection={state.selection}
        dispatch={dispatch}
      />
      <WallList
        walls={state.walls}
        corners={state.corners}
        doors={state.doors}
        windows={state.windows}
        selection={state.selection}
        dispatch={dispatch}
      />
      <CornerList
        corners={state.corners}
        selection={state.selection}
        dispatch={dispatch}
      />
      <DoorList
        doors={state.doors}
        walls={state.walls}
        selection={state.selection}
        dispatch={dispatch}
      />
      <WindowList
        windows={state.windows}
        walls={state.walls}
        selection={state.selection}
        dispatch={dispatch}
      />
      <FurnitureList
        furniture={state.furniture}
        selection={state.selection}
        dispatch={dispatch}
      />
    </div>
  )
}

// ============================================
// Selection Bar (for multi-selection)
// ============================================

interface SelectionBarProps {
  state: EditorState
  dispatch: React.Dispatch<EditorAction>
}

export function SelectionBar({ state, dispatch }: SelectionBarProps) {
  const selectedCount = state.multiSelection.length

  if (selectedCount === 0) {
    return null  // Hide when no multi-selection
  }

  // Group selection by type
  const groupedSelection = state.multiSelection.reduce(
    (acc, item) => {
      acc[item.type] = (acc[item.type] || 0) + 1
      return acc
    },
    {} as Record<string, number>
  )

  const getTypeLabel = (type: string, count: number) => {
    const labels: Record<string, { singular: string; plural: string }> = {
      corner: { singular: "corner", plural: "corners" },
      wall: { singular: "wall", plural: "walls" },
      door: { singular: "door", plural: "doors" },
      window: { singular: "window", plural: "windows" },
      furniture: { singular: "item", plural: "items" },
      room: { singular: "room", plural: "rooms" },
    }
    const label = labels[type] || { singular: type, plural: `${type}s` }
    return count === 1 ? label.singular : label.plural
  }

  const handleDeleteSelected = () => {
    dispatch({ type: "DELETE_SELECTED" })
  }

  const handleClearSelection = () => {
    dispatch({ type: "CLEAR_SELECTION" })
  }

  return (
    <Card className="shadow-sm overflow-hidden bg-primary/5 border-primary/20">
      <div className="p-3">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-medium text-primary">
            {selectedCount} selected
          </span>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleClearSelection}
            className="h-6 px-2 text-xs text-gray-500 hover:text-gray-700"
          >
            Clear
          </Button>
        </div>

        <div className="flex flex-wrap gap-1 mb-3">
          {Object.entries(groupedSelection).map(([type, count]) => (
            <Badge
              key={type}
              variant="secondary"
              className="text-[10px] px-1.5 py-0"
            >
              {count} {getTypeLabel(type, count)}
            </Badge>
          ))}
        </div>

        <Button
          variant="destructive"
          size="sm"
          onClick={handleDeleteSelected}
          className="w-full h-7 text-xs"
        >
          <Trash2 className="h-3 w-3 mr-1" />
          Delete Selected
        </Button>

        <p className="text-[10px] text-gray-400 mt-2 text-center">
          Tip: Ctrl+Click to select multiple items
        </p>
      </div>
    </Card>
  )
}
