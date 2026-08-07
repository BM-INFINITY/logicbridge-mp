export const builderConfig = Object.freeze({
  gridSize: 24,
  gridColor: '#1e2332',
  defaultZoom: 1,
  minZoom: 0.2,
  maxZoom: 2,
  snapToGrid: true,
  snapGrid: [15, 15],
  nodeDimensions: {
    width: 180,
    height: 70,
    paletteWidth: 210,
    sidebarWidth: 390,
  },
  animations: {
    durationFast: 150,
    durationNormal: 250,
  },
  defaultEdgeOptions: {
    animated: true,
    style: { stroke: '#6c63ff', strokeWidth: 2 },
  },
});

export default builderConfig;
