# ADU Visualizer - Design Philosophy & Structure

## Project Overview

ADU Visualizer is a web application that enables users to design and visualize Accessory Dwelling Units (ADUs) through a three-phase process:

1. **2D Floor Planning** - Interactive floor plan creation using react-planner
2. **Finish Selection** - Material, color, and optional feature selection
3. **3D Visualization** - AI-powered 3D rendering using Nano Banana AI

---

## Design Philosophy

### Visual Identity

The design system is built on a **modern construction-inspired aesthetic** that balances professionalism with approachability. Key principles:

- **Clarity & Purpose**: Every element serves a functional purpose
- **Progressive Disclosure**: Complex information revealed progressively
- **Visual Hierarchy**: Clear distinction between primary and secondary actions
- **Construction Theme**: Subtle nods to architecture and building without being heavy-handed
- **Responsive Excellence**: Mobile-first approach with desktop enhancements

### Color System

**Primary Palette:**
- **Primary**: `#961818` (Deep Construction Red) - Brand color, CTAs, accents
- **Background**: `#fafafa` (Light Gray) - Main background
- **Foreground**: `#0a0a0a` (Near Black) - Primary text
- **Card**: `#ffffff` (White) - Surface elements

**Secondary Palette:**
- **Secondary**: `#f4f4f5` (Light Gray) - Secondary surfaces
- **Muted**: `#f4f4f5` / `#71717a` - Disabled states, subtle elements
- **Accent**: `#961818` - Interactive element highlights
- **Destructive**: `#dc2626` - Error states, warnings

**Surface System** (for depth layering):
- `--surface`: `#ffffff` - Base surface
- `--surface-secondary`: `#f9fafb` - Elevated surface
- `--surface-tertiary`: `#f4f4f5` - Further elevated surface

**Extended Colors:**
- `--blue-*`: Primary red variants (legacy naming for compatibility)
- `--orange-*`: Accent oranges for highlights
- `--green-*`: Success states
- `--amber-*`: Warning states
- `--slate-*`: Neutral dark tones

### Typography

**Font Families:**
- **Display/Headers**: Montserrat Bold (700) - `.font-display`
  - Letter spacing: -0.03em
  - Used for: H1-H4, feature titles, CTAs

- **Body Text**: Montserrat Regular (400, 500, 600) - `.font-body`
  - Line height: 1.6
  - Used for: Paragraphs, form labels, descriptions

**Scale Guidelines:**
- H1: `3xl-7xl` (responsive, largest on desktop)
- H2: `2xl-5xl`
- Body: `sm-xl` (responsive based on screen size)
- Small text: `xs-sm`

### Shadows & Depth

Layered shadow system for depth perception:

```css
--shadow-sm: Subtle, for slight elevation
--shadow: Standard card shadow
--shadow-md: Medium depth for modals
--shadow-lg: Heavy elevation for popovers
--shadow-xl: Maximum depth for critical overlays
--shadow-2xl: Dramatic depth for hero elements
--shadow-colored: Brand-colored shadows for special accents
```

### Animations & Motion

**Philosophy**: Smooth, purposeful, never distracting

- **Easing**: `cubic-bezier(0.4, 0, 0.2, 1)` - Material design easing
- **Durations**:
  - Micro-interactions: `0.2s`
  - Standard transitions: `0.3s`
  - Page transitions: `0.5-0.6s`
  - Background elements: `2-3s` fade-in
- **Library**: Framer Motion for complex animations

**Interaction States:**
- Hover: Subtle scale (1.02) or shadow increase
- Active: Slight scale down (0.98)
- Focus: Ring with brand color opacity

### Layout System

**Container Strategy:**
- Max width: `max-w-7xl` (1280px)
- Responsive padding:
  - Mobile: `px-4` (16px)
  - Tablet: `sm:px-6` (24px)
  - Desktop: `lg:px-8` (32px)

**Spacing Scale:**
- Tight: `2-4` (8-16px)
- Standard: `6-8` (24-32px)
- Loose: `12-16` (48-64px)

**Grid Patterns:**
- Background blueprint grid: `40px × 40px` with subtle primary color
- Component grids: CSS Grid with `gap-4` to `gap-8`

---

## Component Patterns

### UI Component Library

Built on **shadcn/ui** with Radix UI primitives:

**Core Components:**
- `Button` - Multiple variants (default, outline, ghost, destructive)
- `Card` - Elevated containers with hover states
- `Dialog/Modal` - Overlay interfaces
- `Input/Textarea` - Form controls
- `Select/Slider/Switch` - Advanced form inputs
- `Tabs` - Section navigation
- `Progress` - Loading states
- `Label` - Form labels

**Custom Classes:**

```css
.surface - White background with border and shadow
.glass - Frosted glass effect with backdrop blur
.gradient-brand - Primary brand gradient
.gradient-warm - Orange accent gradient
.card-elevated - Interactive card with hover lift
.border-accent-top/left - Brand-colored accent borders
.interactive-scale - Hover/active scale animations
```

### Animated Background

Construction-themed floating elements:
- Tool SVGs: saw, hammer, screwdriver, pliers, ruler, level, shovel
- Slow infinite rotation (140-220s duration)
- Low opacity (0.15) to avoid distraction
- Staggered fade-in animations
- Radial gradient overlays with primary color

### Form Patterns

**Multi-step Forms:**
- Section-based navigation
- Progress indicators
- Field validation with Zod
- Error states with helpful messages
- Auto-save to localStorage

**Validation Strategy:**
- Client-side: Zod schemas
- Real-time feedback on blur
- Inline error messages
- Submit prevention until valid

---

## Project Structure

```
aduvisualizer/
├── app/
│   ├── layout.tsx              # Root layout with fonts, metadata, background
│   ├── page.tsx                # Landing page
│   ├── globals.css             # Global styles, design tokens
│   ├── create/
│   │   ├── layout.tsx          # Wizard layout wrapper
│   │   ├── floorplan/
│   │   │   └── page.tsx        # Step 1: Floor plan editor
│   │   ├── finishes/
│   │   │   └── page.tsx        # Step 2: Finish selection
│   │   └── visualize/
│   │       └── page.tsx        # Step 3: AI visualization
│   └── api/
│       ├── generate-3d/
│       │   └── route.ts        # Nano Banana API integration
│       └── save-floorplan/
│           └── route.ts        # Floor plan persistence
├── components/
│   ├── ui/                     # shadcn/ui primitives
│   │   ├── button.tsx
│   │   ├── card.tsx
│   │   ├── dialog.tsx
│   │   ├── input.tsx
│   │   ├── slider.tsx
│   │   └── ...
│   ├── animated-background.tsx  # Background animation component
│   ├── floor-plan-editor.tsx   # react-planner wrapper
│   ├── finish-selector.tsx     # Finish selection UI
│   ├── visualization-gallery.tsx # 3D render display
│   ├── progress-stepper.tsx    # Multi-step progress indicator
│   └── ...
├── lib/
│   ├── utils.ts                # cn() utility, helpers
│   ├── types.ts                # TypeScript type definitions
│   ├── constants.ts            # App constants, config
│   ├── api/
│   │   ├── nano-banana.ts      # AI API client
│   │   └── storage.ts          # Data persistence
│   └── validation/
│       └── schemas.ts          # Zod validation schemas
├── public/
│   ├── background-svg/         # Animated background SVGs
│   └── ...
├── components.json             # shadcn/ui configuration
├── package.json
├── tsconfig.json
├── next.config.ts
└── claude.md                   # This file
```

---

## Technical Architecture

### Stack

- **Framework**: Next.js 16 (App Router)
- **Language**: TypeScript
- **Styling**: Tailwind CSS v4
- **UI Components**: shadcn/ui (Radix UI)
- **Animations**: Framer Motion
- **Form Handling**: React Hook Form + Zod
- **2D Planning**: react-planner
- **3D Rendering**: Three.js (@react-three/fiber, @react-three/drei)
- **AI Integration**: Nano Banana AI API

### Data Flow

1. **Floor Plan Phase**:
   ```
   User draws → react-planner state → Extract room data → Save to state
   ```

2. **Finish Selection Phase**:
   ```
   User selects finishes → Form state → Validate → Combine with floor plan
   ```

3. **Visualization Phase**:
   ```
   Floor plan + finishes → Generate prompt → Call Nano Banana API → Display renders
   ```

### State Management

**Local State**:
- React `useState` for component-level state
- React Context for wizard-level state (floor plan, finishes)

**Persistent State**:
- localStorage for auto-save
- Optional backend DB for user accounts

**Form State**:
- React Hook Form for form state
- Zod for validation

---

## Best Practices

### Code Quality

1. **TypeScript First**
   - Strict mode enabled
   - Explicit types for all props
   - Avoid `any`, use `unknown` when needed
   - Use Zod for runtime validation + type inference

2. **Component Structure**
   ```tsx
   "use client"; // Only when needed (client-side features)

   import { useState } from "react";
   import { motion } from "framer-motion";
   import { Button } from "@/components/ui/button";
   import type { FloorPlan } from "@/lib/types";

   interface ComponentProps {
     data: FloorPlan;
     onSave: (plan: FloorPlan) => void;
   }

   export function Component({ data, onSave }: ComponentProps) {
     // Component logic
   }
   ```

3. **File Naming**
   - Components: `PascalCase.tsx` (e.g., `FloorPlanEditor.tsx`)
   - Utilities: `kebab-case.ts` (e.g., `floor-plan-utils.ts`)
   - Types: `types.ts` or co-located with component
   - Constants: `SCREAMING_SNAKE_CASE` in `constants.ts`

4. **Import Aliases**
   ```tsx
   "@/components" - Components directory
   "@/lib" - Lib directory
   "@/app" - App directory
   ```

### Performance

1. **Image Optimization**
   - Use Next.js `<Image>` component
   - Provide width/height
   - Use `priority` for above-fold images
   - Lazy load below-fold images

2. **Code Splitting**
   - Dynamic imports for heavy components
   ```tsx
   const FloorPlanEditor = dynamic(() => import("@/components/floor-plan-editor"), {
     loading: () => <LoadingSpinner />,
     ssr: false // If client-only
   });
   ```

3. **Memoization**
   - Use `React.memo` for expensive re-renders
   - Use `useMemo` for expensive calculations
   - Use `useCallback` for stable function references

### Accessibility

1. **Semantic HTML**: Use proper heading hierarchy, landmarks
2. **Keyboard Navigation**: All interactive elements accessible via keyboard
3. **ARIA Labels**: Descriptive labels for screen readers
4. **Focus Management**: Visible focus indicators, logical tab order
5. **Color Contrast**: WCAG AA compliance minimum

### SEO

1. **Metadata**: Comprehensive metadata in layout.tsx
2. **Structured Data**: JSON-LD for schema.org
3. **Sitemap**: Auto-generated sitemap.xml
4. **Robots.txt**: Proper indexing directives
5. **Open Graph**: Social sharing optimization

---

## Development Workflow

### Getting Started

```bash
npm install
npm run dev
```

### Coding Standards

- **Formatting**: Prettier (auto-format on save)
- **Linting**: ESLint with Next.js config
- **Type Checking**: `tsc --noEmit` before commits
- **Git Commits**: Conventional commits format

### Testing Strategy

- **Unit Tests**: Jest + React Testing Library
- **E2E Tests**: Playwright
- **Visual Regression**: Chromatic (optional)

---

## Customization Guidelines

### Adding New Colors

1. Add CSS variables to `app/globals.css`:
   ```css
   :root {
     --new-color: #hexcode;
   }
   ```

2. Add to Tailwind theme in `@theme inline` block

3. Use in components: `bg-[var(--new-color)]` or extend Tailwind config

### Adding New Components

1. Create in `/components` or `/components/ui`
2. Use TypeScript with proper prop types
3. Follow naming conventions
4. Export from component file
5. Document complex components with JSDoc comments

### Modifying Typography

1. Update font imports in `app/layout.tsx`
2. Update CSS variables in `app/globals.css`
3. Update font utility classes (`.font-display`, `.font-body`)

---

## Key Differences from Estimator

While based on the estimator design system, ADU Visualizer has unique requirements:

1. **Interactive 2D/3D Elements**: More complex canvas-based interactions
2. **Visual-First**: Emphasis on imagery and visualization vs. forms
3. **Multi-Phase Flow**: Distinct phases vs. single form flow
4. **Real-time Preview**: Live updates to visualizations
5. **Media-Rich**: More images, 3D models, and AI-generated content

---

## Lot Overlay Feature

### Purpose

Allows users to visualize their ADU floor plan overlaid on their actual property lot using satellite imagery and parcel boundary data. The overlay is at 1:1 scale so users can verify their ADU design fits within their lot and respects required setbacks.

### Architecture

#### Coordinate Systems

The lot overlay bridges three coordinate systems:

1. **Geographic (lat/lng)** - From Orange County GIS parcel data
2. **Real-world (feet)** - Lot dimensions and ADU measurements
3. **Canvas (pixels)** - Editor display using `pixelsPerFoot` ratio (22.22 px/ft)

#### Key Conversion Formula

```typescript
// Feet to canvas pixels
canvasPixels = feet * pixelsPerFoot

// Canvas pixels to feet
feet = canvasPixels / pixelsPerFoot

// Geographic to feet (from lot center)
// Uses Haversine formula - 1 degree ≈ 364,000 feet (adjusted by cos(lat) for longitude)
```

### Data Flow

1. User enters address → Nominatim geocodes to lat/lng
2. Lat/lng sent to Orange County GIS → Returns parcel boundary polygon
3. Parcel boundary converted to feet → Then to canvas pixels
4. Lot boundary rendered on canvas at 1:1 scale with ADU
5. User positions ADU within lot → Position saved to database

### Database Schema

**`lots` table** (in `aduvisualizer-core/schema/lots.ts`) stores:
- Parcel identification (APN from county)
- Address fields (address, city, state, zipCode)
- Geographic center point (geoLat, geoLng) and rotation
- Boundary vertices (lat/lng polygon from GIS)
- Lot dimensions (width, depth, area in feet)
- ADU position on lot (aduOffsetX, aduOffsetY, aduRotation)
- Setbacks (front, back, left, right in feet)

### External APIs

| API | Purpose | Rate Limits | Base URL |
|-----|---------|-------------|----------|
| Nominatim (OSM) | Address geocoding | 1 req/sec, requires User-Agent | `nominatim.openstreetmap.org/search` |
| Orange County GIS | Parcel boundary data | No strict limit | `gis.ocgov.com/arcgis/rest/services` |
| ESRI World Imagery | Satellite tile server | Free tier available | `server.arcgisonline.com` |

### Components

| Component | Location | Purpose |
|-----------|----------|---------|
| `LotSelector` | `floor-plan-editor/sidebar/lot-selector.tsx` | Address search, setback controls |
| `LotOverlay` | `floor-plan-editor/lot/lot-overlay.tsx` | Canvas boundary rendering |
| `useLot` hook | `lib/api/hooks.ts` | Lot state management |

### API Endpoints (Backend)

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/lots/search-address` | POST | Geocode address using Nominatim |
| `/lots/parcel` | GET | Fetch parcel data from Orange County GIS |
| `/lots` | POST | Create lot for a blueprint |
| `/lots/blueprint/:blueprintId` | GET | Get lot for a blueprint |
| `/lots/:lotId` | PUT | Update lot (position, setbacks) |
| `/lots/:lotId` | DELETE | Delete lot |

### LA ADU Setback Requirements

Default setbacks applied per LA ADU regulations:
- **Front**: 0 ft (varies by zone)
- **Rear**: 4 ft minimum
- **Side**: 4 ft minimum

Setbacks displayed as dashed green/red line inside lot boundary, showing "buildable area".
- Green = ADU fits within setbacks
- Red = ADU exceeds buildable area

### Integration with Floor Plan Editor

To integrate the lot overlay, add to `floor-plan-editor.tsx`:

```typescript
import { LotOverlay } from "./lot/lot-overlay";
import { LotSelector } from "./sidebar/lot-selector";
import { useLot } from "@/lib/api/hooks";

// Inside component:
const {
  lot,
  loading: lotLoading,
  error: lotError,
  addressResults,
  searchAddresses,
  fetchParcelData,
  saveLot,
  updateAduPosition,
  updateSetbacks,
  removeLot,
  clearAddressResults,
  loadLot,
} = useLot(blueprintId);

const [showLotOverlay, setShowLotOverlay] = useState(false);

// In render, add LotOverlay to canvas (behind ADU boundary):
{lot && showLotOverlay && (
  <LotOverlay
    config={canvasConfig}
    lot={lot}
    aduBoundary={aduBoundary}
    canvasCenter={aduCenter}
    visible={showLotOverlay}
  />
)}

// Add LotSelector to sidebar when placement mode allows
```

### Files Created for This Feature

**Backend (aduvisualizer-core):**
- `schema/lots.ts` - Database schema
- `types/lot.ts` - Zod validation schemas
- `api/v1/lots/_route.ts` - Router
- `api/v1/lots/create.handler.ts` - Create lot
- `api/v1/lots/get.handler.ts` - Get lot
- `api/v1/lots/update.handler.ts` - Update lot
- `api/v1/lots/delete.handler.ts` - Delete lot
- `api/v1/lots/search-address.handler.ts` - Nominatim geocoding
- `api/v1/lots/parcel.handler.ts` - Orange County GIS

**Frontend (aduvisualizer):**
- `components/floor-plan-editor/sidebar/lot-selector.tsx` - Sidebar controls
- `components/floor-plan-editor/lot/lot-overlay.tsx` - Canvas overlay
- `components/floor-plan-editor/lot/index.ts` - Exports
- `lib/api/client.ts` - Added lot API functions
- `lib/api/hooks.ts` - Added `useLot` hook

---

## Future Enhancements

- [ ] User authentication and project saving
- [ ] Template library (pre-made floor plans)
- [ ] Cost estimation integration (from estimator)
- [ ] AR/VR preview capabilities
- [ ] Collaboration features (share designs)
- [ ] Export to CAD formats
- [ ] Integration with permit services
- [x] Lot overlay with satellite imagery (foundation implemented)

---

## Resources

- **Design Inspiration**: Estimator project (`C:\Users\Admin\Documents\Work Repo\estimator`)
- **Component Library**: [shadcn/ui](https://ui.shadcn.com)
- **Animation**: [Framer Motion](https://www.framer.com/motion)
- **2D Planning**: [react-planner](https://github.com/cvdlab/react-planner)
- **3D Library**: [React Three Fiber](https://docs.pmnd.rs/react-three-fiber)

---

## Contact & Support

For questions about this design system or implementation:
- Check the estimator project for reference implementations
- Refer to component documentation in `/components`
- Review type definitions in `/lib/types.ts`

**Last Updated**: December 2025
