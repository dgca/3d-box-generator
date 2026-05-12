export type BoxParams = {
  cornerStyle: CornerStyle;
  interiorWidth: number;
  interiorDepth: number;
  interiorHeight: number;
  wallThickness: number;
  floorThickness: number;
  cornerRadius: number;
};

export type BoxField = Exclude<keyof BoxParams, "cornerStyle">;
export type CornerStyle = "sharp" | "chamfer" | "rounded";
export type FaceName = "front" | "right" | "back" | "left";
export type CutoutAssignmentMode = "faces" | "pairs";
export type CutoutFitMode = "contain" | "stretch";
export type CutoutPairName = "frontBack" | "leftRight";
export type CutoutTarget = FaceName | CutoutPairName;

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
  fitMode: CutoutFitMode;
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
