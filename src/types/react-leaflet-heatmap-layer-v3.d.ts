declare module "react-leaflet-heatmap-layer-v3" {
  import { Layer } from "react-leaflet";
  import { Component } from "react";

  interface HeatmapLayerProps {
    points: Array<[number, number, number]>;
    longitudeExtractor: (point: [number, number, number]) => number;
    latitudeExtractor: (point: [number, number, number]) => number;
    intensityExtractor: (point: [number, number, number]) => number;
    radius?: number;
    blur?: number;
    max?: number;
    minOpacity?: number;
    gradient?: { [key: number]: string };
  }

  export class HeatmapLayer extends Component<HeatmapLayerProps> {}
}
