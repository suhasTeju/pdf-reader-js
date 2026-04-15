import type { BBoxCoords } from './bbox';

export type EasingName = 'linear' | 'ease-in' | 'ease-out' | 'ease-in-out';
export type SpotlightShape = 'rect' | 'rounded' | 'ellipse';
export type UnderlineStyle = 'straight' | 'sketch' | 'double' | 'wavy';
export type ArrowCurve = 'straight' | 'curved' | 'zigzag';
export type PulseIntensity = 'subtle' | 'normal' | 'strong';
export type BoxStyle = 'solid' | 'dashed';
export type LabelPosition = 'top' | 'bottom' | 'left' | 'right';
export type GhostPosition = 'top-right' | 'top-left' | 'bottom-right' | 'bottom-left';
export type ClearTarget = 'all' | 'spotlights' | 'overlays' | string[];

export interface ActionCamera {
  type: 'camera';
  target_block?: string;
  target_bbox?: BBoxCoords;
  scale: number;
  padding: number;
  easing: EasingName;
}

export interface ActionSpotlight {
  type: 'spotlight';
  target_block: string;
  dim_opacity: number;
  feather_px: number;
  shape: SpotlightShape;
}

export interface ActionUnderline {
  type: 'underline';
  target_block: string;
  color: string;
  style: UnderlineStyle;
  draw_duration_ms: number;
}

export interface ActionHighlight {
  type: 'highlight';
  target_block: string;
  color: string;
  draw_duration_ms: number;
}

export interface ActionPulse {
  type: 'pulse';
  target_block: string;
  count: number;
  intensity: PulseIntensity;
}

export interface ActionCallout {
  type: 'callout';
  from_block: string;
  to_block: string;
  label?: string;
  curve: ArrowCurve;
}

export interface ActionGhostReference {
  type: 'ghost_reference';
  target_page: number;
  target_block: string;
  position: GhostPosition;
}

export interface ActionBox {
  type: 'box';
  target_block: string;
  color: string;
  style: BoxStyle;
}

export interface ActionLabel {
  type: 'label';
  target_block: string;
  text: string;
  position: LabelPosition;
}

export interface ActionClear {
  type: 'clear';
  targets: ClearTarget;
}

export type StoryboardAction =
  | ActionCamera
  | ActionSpotlight
  | ActionUnderline
  | ActionHighlight
  | ActionPulse
  | ActionCallout
  | ActionGhostReference
  | ActionBox
  | ActionLabel
  | ActionClear;

export interface StoryboardStep {
  at_ms: number;
  duration_ms: number;
  action: StoryboardAction;
}

export interface Storyboard {
  version: 1;
  reasoning: string;
  steps: StoryboardStep[];
}

/** Active overlay state tracked by the engine / store. */
export interface ActiveOverlay {
  id: string;
  kind: StoryboardAction['type'];
  action: StoryboardAction;
  createdAt: number;
  expiresAt: number;
}

export interface CameraState {
  scale: number;
  x: number;
  y: number;
  easing: EasingName;
}
