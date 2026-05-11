export type BoxParams = {
  interiorWidth: number;
  interiorDepth: number;
  interiorHeight: number;
  wallThickness: number;
  floorThickness: number;
  cornerRadius: number;
};

export type BoxField = keyof BoxParams;
export type FaceName = "front" | "right" | "back" | "left";

export type BoxDimensions = {
  outerWidth: number;
  outerDepth: number;
  outerHeight: number;
};

export type Vec2 = [number, number];
export type Vec3 = [number, number, number];
export type Triangle = [Vec3, Vec3, Vec3];

export type CutoutShape = {
  contour: Vec2[];
};

export type FaceCutout = {
  enabled: boolean;
  error?: string;
  fileName?: string;
  margin: number;
  scale: number;
  shapes: CutoutShape[];
};

export type CutoutSet = Record<FaceName, FaceCutout>;

export type MeshData = {
  triangles: Triangle[];
  dimensions: BoxDimensions;
};

export type ValidationIssue = {
  face?: FaceName;
  field?: BoxField;
  message: string;
};
