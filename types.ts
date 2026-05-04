export type ToolType = 'select' | 'hand' | 'image' | 'text' | 'rectangle' | 'circle' | 'line' | 'arrow' | 'pen' | 'point' | 'capture' | 'frame';
export type EditToolType = 'lasso' | 'brush' | 'rect' | 'wand' | 'eraser' | 'line' | 'circle' | 'pen' | 'bezier';
export type ResolutionType = '1K' | '2K' | '4K';
export type EditSubMode = 'paint' | 'text';

export type TopologyStrategy = string;

export enum ItemType {
  IMAGE = 'IMAGE',
  VIDEO = 'VIDEO',
  TEXT = 'TEXT',
  SHAPE = 'SHAPE',
  PEN = 'PEN',
  FRAME = 'FRAME',
  MODEL = 'MODEL'
}

export interface ImageFilters {
  hue: number;
  saturation: number;
  brightness: number;
  contrast: number;
  opacity: number;
}

export interface SpatialConfig {
  azimuth: number;   // 0-360
  elevation: number; // -90 to 90
  distance: number;  // zoom level
  fov: number;       // perspective
}

export interface PartCMF {
  color?: string;
  metalness?: number;
  roughness?: number;
  emissiveIntensity?: number;
  opacity?: number;
  label?: string;
}

export interface BOMEntry {
  id: string;
  name: string;
  description: string;
  material: string;
  quantity?: number;
  visible?: boolean;
}

export interface InferenceSettings {
    prompt: string;
    influence: number; // 0-1
    style: string;
    recipeId?: string;
    subjectType?: 'industrial' | 'organic' | 'character';
}

export interface GenerationSettings {
    style: string;
    ratio: string;
    imageCount: number;
    artisticLevel: number;
    resolution: ResolutionType;
    spatialConfig?: SpatialConfig;
    recipeId?: string;
    topologyStrategies?: TopologyStrategy[];
    usePro?: boolean;
}

export interface Point {
  x: number;
  y: number;
}

export interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface ViewState {
  x: number;
  y: number;
  scale: number;
}

export interface IdentifiedPoint {
  id: string;
  y: number;
  x: number;
  label: string;
  description?: string;
  modifiedDescription?: string;
  isRemoving?: boolean;
  pairingId?: string;
  pairingSourceItemId?: string;
  originalPos?: [number, number];
}

export interface Segment {
    id: string;
    label: string;
    points: [number, number][];
}

export interface CanvasItem {
  id: string;
  type: ItemType;
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: number;
  content: string;
  status: 'loading' | 'generated' | 'error' | 'empty';
  prompt?: string;
  aspectRatio?: string;
  links?: string[];
  engine?: string;
  fontSize?: number;
  fontWeight?: string;
  textColor?: string;
  locked?: boolean;
  identifiedPoints?: IdentifiedPoint[];
  spatialConfig?: SpatialConfig;
  modelUrl?: string;
  viewAngle?: 'front' | 'top' | 'side' | 'perspective';
  cameraMode?: 'perspective' | 'orthographic';
  explodeFactor?: number;
  knollingFactor?: number;
  activePartId?: string;
  partList?: string[];
  highlightedPartIds?: string[];
  hiddenPartIds?: string[];
  colorSeed?: number;
  partColorMap?: Record<string, string>;
  partCMFMap?: Record<string, PartCMF>;
  wireframeMode?: boolean;
  showExplodeTrails?: boolean;
  technicalCallouts?: boolean;
  savedViews?: SpatialConfig[];
  twinEnabled?: boolean;
  twinItemId?: string;
  worldSimPrompt?: string;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'model';
  text: string;
  image?: string;
  images?: string[];
  originalImages?: string[];
  videoUrl?: string;
  isError?: boolean;
  isJson?: boolean;
  isCollapsed?: boolean;
  context?: {
      prompt: string;
      attachments: Attachment[];
      toolType: string | null;
  };
}

export interface ChatSession {
  id: string;
  title: string;
  messages: ChatMessage[];
  createdAt: number;
  folderId?: string;
}

export interface ChatFolder {
  id: string;
  name: string;
  createdAt: number;
}

export interface Attachment {
  id: string;
  original: string;
  marked: string;
  points?: Record<string, [number, number]>;
  maskData?: string;
  sourceId?: string;
}

export interface DesignRecipe {
  id: string;
  name: string;
  instruction: string;
  exampleImages: string[];
  createdAt: number;
}

export interface Playstyle {
  id: string;
  name: string;
  description: string;
  template: string;
  category: string;
  createdAt: number;
}

export interface ProjectPackage {
  version: string;
  timestamp: number;
  items: CanvasItem[];
  view: ViewState;
  recipes?: DesignRecipe[];
  playstyles?: Playstyle[];
}

export interface ExpressionState {
  itemId: string;
  isOpen: boolean;
}