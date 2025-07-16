import { useState, useEffect, useMemo, useCallback } from "react";
import { MapContainer, TileLayer, useMap, useMapEvents } from "react-leaflet";
import L from "leaflet";
import { HeatmapLayer } from "react-leaflet-heatmap-layer-v3";
import "leaflet.markercluster";
import "leaflet/dist/leaflet.css";
import "leaflet.markercluster/dist/MarkerCluster.css";
import "leaflet.markercluster/dist/MarkerCluster.Default.css";
import AnalyticsDashboard from "./AnalyticsDashboard";

// --- Constants ---
const BITNODES_API_URL = "https://bitnodes.io/api/v1/snapshots/latest/";
const AGGREGATION_PRECISION = 1;
const ZOOM_THRESHOLD = 9;
const MAX_NODES_FOR_MARKERS = 10000;
const LAST_FETCH_KEY = "bitnodes_last_fetch";
const LAST_DATA_KEY = "bitnodes_last_data";

// --- Interfaces ---
interface ProcessedNode {
  lat: number;
  lon: number;
  userAgent?: string;
  country?: string | null;
  protocolVersion?: number;
  organization?: string | null;
  connectedSince?: number;
}

type HeatmapPoint = [lat: number, lon: number, intensity: number];

// --- Custom Hook for Data Fetching & Processing ---
const useBitnodesData = () => {
  const [heatmapPoints, setHeatmapPoints] = useState<HeatmapPoint[]>([]);
  const [individualNodes, setIndividualNodes] = useState<ProcessedNode[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [maxIntensity, setMaxIntensity] = useState<number>(50);
  const [analytics, setAnalytics] = useState<{
    totalNodes: number;
    uniqueCountries: number;
    topUserAgents?: { agent: string; count: number }[];
    topOrganizations?: { org: string; count: number }[];
    protocolVersions?: { version: number; count: number }[];
    averageUptime?: number;
    decentralizationScore?: number;
  }>({
    totalNodes: 0,
    uniqueCountries: 0,
  });

  const mockHeatmapPoints: HeatmapPoint[] = useMemo(
    () => [
      [40.7, -74.0, 25],
      [51.5, -0.1, 18],
      [35.7, 139.7, 12],
      [-33.9, 151.2, 9],
    ],
    []
  );
  const mockIndividualNodes: ProcessedNode[] = useMemo(
    () => [
      { lat: 40.7128, lon: -74.006, userAgent: "/Mock:1.0/", country: "US" },
      { lat: 51.5074, lon: -0.1278, userAgent: "/Mock:1.0/", country: "GB" },
    ],
    []
  );

  useEffect(() => {
    const fetchAndProcessNodes = async () => {
      setLoading(true);
      setError(null);

      const now = Date.now();
      const lastFetch = Number(localStorage.getItem(LAST_FETCH_KEY));
      const lastData = localStorage.getItem(LAST_DATA_KEY);

      // Only fetch if more than 10 minutes have passed
      if (lastFetch && lastData && now - lastFetch < 600000) {
        setAnalytics(JSON.parse(lastData));
        setLoading(false);
        return;
      }

      try {
        const response = await fetch(BITNODES_API_URL);
        if (!response.ok) throw new Error(`API Error: ${response.status}`);
        const data = await response.json();
        if (!data?.nodes) throw new Error("Invalid API response structure.");

        const nodes = Object.entries(data.nodes);
        const processedNodes: ProcessedNode[] = [];
        const countrySet = new Set<string>();
        const userAgentCounts = new Map<string, number>();
        const orgCounts = new Map<string, number>();
        const versionCounts = new Map<number, number>();
        let totalUptime = 0;
        let uptimeCount = 0;

        nodes.forEach(([_, nodeData]: [string, unknown]) => {
          if (
            Array.isArray(nodeData) &&
            nodeData.length > 12 &&
            typeof nodeData[8] === "number" &&
            typeof nodeData[9] === "number" &&
            !isNaN(nodeData[8]) &&
            !isNaN(nodeData[9])
          ) {
            const node: ProcessedNode = {
              lat: nodeData[8],
              lon: nodeData[9],
              userAgent: nodeData[1] as string,
              country: nodeData[7] as string | null,
              protocolVersion: nodeData[0] as number,
              organization: nodeData[12] as string | null,
              connectedSince: nodeData[2] as number,
            };
            processedNodes.push(node);

            if (node.country) countrySet.add(node.country);
            if (node.userAgent) {
              userAgentCounts.set(
                node.userAgent,
                (userAgentCounts.get(node.userAgent) || 0) + 1
              );
            }
            if (node.organization) {
              orgCounts.set(
                node.organization,
                (orgCounts.get(node.organization) || 0) + 1
              );
            }
            if (node.protocolVersion) {
              versionCounts.set(
                node.protocolVersion,
                (versionCounts.get(node.protocolVersion) || 0) + 1
              );
            }
            if (node.connectedSince) {
              totalUptime += Date.now() / 1000 - node.connectedSince;
              uptimeCount++;
            }
          }
        });

        // No filters applied
        setIndividualNodes(processedNodes.slice(0, MAX_NODES_FOR_MARKERS));

        // Aggregate for heatmap
        const aggregationMap = new Map<
          string,
          { lat: number; lon: number; count: number }
        >();
        let currentMaxIntensity = 0;
        processedNodes.forEach((node) => {
          const key = `${node.lat.toFixed(
            AGGREGATION_PRECISION
          )},${node.lon.toFixed(AGGREGATION_PRECISION)}`;
          const existing = aggregationMap.get(key);
          if (existing) {
            existing.count += 1;
            currentMaxIntensity = Math.max(currentMaxIntensity, existing.count);
          } else {
            aggregationMap.set(key, {
              lat: parseFloat(node.lat.toFixed(AGGREGATION_PRECISION)),
              lon: parseFloat(node.lon.toFixed(AGGREGATION_PRECISION)),
              count: 1,
            });
            currentMaxIntensity = Math.max(currentMaxIntensity, 1);
          }
        });

        const aggregatedPoints: HeatmapPoint[] = Array.from(
          aggregationMap.values()
        ).map((agg) => [agg.lat, agg.lon, agg.count]);

        const calculatedMax = Math.max(1, Math.ceil(currentMaxIntensity * 0.8));
        setMaxIntensity(calculatedMax);
        setHeatmapPoints(
          aggregatedPoints.length > 0 ? aggregatedPoints : mockHeatmapPoints
        );
        setIndividualNodes(
          processedNodes.length > 0 ? processedNodes : mockIndividualNodes
        );

        // Compute analytics
        const topAgents = Array.from(userAgentCounts.entries())
          .map(([agent, count]) => ({ agent, count }))
          .sort((a, b) => b.count - a.count)
          .slice(0, 3);
        const topOrgs = Array.from(orgCounts.entries())
          .map(([org, count]) => ({ org, count }))
          .sort((a, b) => b.count - a.count)
          .slice(0, 3);
        const protocolVersions = Array.from(versionCounts.entries())
          .map(([version, count]) => ({ version, count }))
          .sort((a, b) => b.count - a.count);

        // HHI for decentralization
        const countryCounts = new Map<string, number>();
        processedNodes.forEach((node) => {
          if (node.country) {
            countryCounts.set(
              node.country,
              (countryCounts.get(node.country) || 0) + 1
            );
          }
        });
        const totalNodes = processedNodes.length;
        const hhi = Array.from(countryCounts.values()).reduce(
          (sum, count) => sum + Math.pow(count / totalNodes, 2),
          0
        );

        const processedAnalytics = {
          totalNodes: processedNodes.length,
          uniqueCountries: countrySet.size,
          topUserAgents: topAgents,
          topOrganizations: topOrgs,
          protocolVersions,
          averageUptime:
            uptimeCount > 0 ? totalUptime / uptimeCount / 86400 : 0,
          decentralizationScore: hhi,
        };
        setAnalytics(processedAnalytics);
        localStorage.setItem(LAST_FETCH_KEY, String(Date.now()));
        localStorage.setItem(LAST_DATA_KEY, JSON.stringify(processedAnalytics));
      } catch (err) {
        console.error("Error:", err);
        setError(err instanceof Error ? err.message : "Unknown error");
        setHeatmapPoints(mockHeatmapPoints);
        setIndividualNodes(mockIndividualNodes);
        setMaxIntensity(50);
        setAnalytics({ totalNodes: 0, uniqueCountries: 0 });
      } finally {
        setLoading(false);
      }
    };

    fetchAndProcessNodes();
  }, [mockHeatmapPoints, mockIndividualNodes]);

  return {
    heatmapPoints,
    individualNodes,
    loading,
    error,
    maxIntensity,
    analytics,
  };
};

// --- Component for Individual Node Markers ---
const NodeMarkersLayer = ({ nodes }: { nodes: ProcessedNode[] }) => {
  const map = useMap();

  useEffect(() => {
    if (!nodes || nodes.length === 0) return;

    const clusterGroup = L.markerClusterGroup({
      maxClusterRadius: 60,
      iconCreateFunction: (cluster) => {
        const count = cluster.getChildCount();
        let size = 40;
        let className = "marker-cluster marker-cluster-small";
        if (count >= 10) {
          size = 50;
          className = "marker-cluster marker-cluster-medium";
        }
        if (count >= 100) {
          size = 60;
          className = "marker-cluster marker-cluster-large";
        }
        return L.divIcon({
          html: `<div><span>${count}</span></div>`,
          className,
          iconSize: [size, size],
        });
      },
      spiderfyOnMaxZoom: true,
      showCoverageOnHover: false,
    });

    nodes.forEach((node) => {
      const marker = L.circleMarker([node.lat, node.lon], {
        radius: 5,
        color: "#00f9ff",
        weight: 2,
        fillColor: "#ff0099",
        fillOpacity: 0.7,
      });

      // Enhanced tooltip with all node details
      let tooltipContent = `<b>Node Details</b><br/>`;
      tooltipContent += `Lat: ${node.lat.toFixed(4)}<br/>`;
      tooltipContent += `Lon: ${node.lon.toFixed(4)}<br/>`;
      if (node.country) tooltipContent += `Country: ${node.country}<br/>`;
      if (node.userAgent)
        tooltipContent += `Agent: ${node.userAgent.substring(0, 30)}${
          node.userAgent.length > 30 ? "..." : ""
        }<br/>`;
      if (node.organization) tooltipContent += `Org: ${node.organization}<br/>`;
      if (node.protocolVersion)
        tooltipContent += `Protocol: ${node.protocolVersion}<br/>`;
      if (node.connectedSince) {
        tooltipContent += `Uptime: ${(
          (Date.now() / 1000 - node.connectedSince) /
          86400
        ).toFixed(1)} days`;
      }

      marker.bindTooltip(tooltipContent, {
        direction: "top",
        offset: [0, -5],
        className: "node-tooltip",
      });
      clusterGroup.addLayer(marker);
    });

    map.addLayer(clusterGroup);
    return () => {
      map.removeLayer(clusterGroup);
    };
  }, [nodes, map]);

  return null;
};

// --- Component to Update Zoom State ---
const ZoomHandler = ({ setZoom }: { setZoom: (zoom: number) => void }) => {
  const map = useMapEvents({
    zoomend: () => {
      setZoom(map.getZoom());
    },
  });
  useEffect(() => {
    setZoom(map.getZoom());
  }, [map, setZoom]);

  return null;
};

// --- Main App Component ---
const App = () => {
  // Detect mobile device
  const isMobile =
    typeof window !== "undefined" &&
    window.matchMedia("(max-width: 767px)").matches;
  const {
    heatmapPoints,
    individualNodes,
    loading,
    error,
    maxIntensity,
    analytics,
  } = useBitnodesData();
  const initialZoom = isMobile ? 2 : 3;
  const minZoom = isMobile ? 2 : 3;
  const [currentZoom, setCurrentZoom] = useState<number>(initialZoom);

  const mapCenter: L.LatLngTuple = useMemo(() => [20, 0], []);
  const mapBounds: L.LatLngBoundsLiteral = useMemo(
    () => [
      [-85, -180],
      [85, 180],
    ],
    []
  );

  const handleZoomUpdate = useCallback((zoom: number) => {
    setCurrentZoom(zoom);
  }, []);

  const showHeatmap = !loading && currentZoom < ZOOM_THRESHOLD;
  const showMarkers = !loading && currentZoom >= ZOOM_THRESHOLD;

  return (
    <div className="h-screen bg-black text-[#00f9ff] flex flex-col">
      {/* Header and zoom box are always rendered, regardless of error/loading */}
      <header className="p-4 flex justify-center items-center bg-black border-b border-[#00f9ff] z-10 relative">
        <h1 className="text-xl md:text-2xl font-bold text-[#00f9ff] font-orbitron text-center w-full">
          Bitcoin Node Map
        </h1>
      </header>
      <div className="fixed top-[78px] right-[13px] z-[2000] bg-black bg-opacity-80 px-4 py-2 rounded border border-[#00f9ff] text-sm md:text-base">
        Zoom: {currentZoom}
      </div>

      {loading && (
        <div className="text-center p-4 bg-black">Loading Node Data...</div>
      )}
      {error && (
        <div className="text-center p-4 bg-red-800 text-white">
          Error: {error}
        </div>
      )}

      <div className="flex-1 relative">
        <MapContainer
          center={mapCenter}
          zoom={initialZoom}
          minZoom={minZoom}
          maxBounds={mapBounds}
          maxBoundsViscosity={1.0}
          className="h-full w-full"
          style={{ background: "#000" }}
          zoomDelta={isMobile ? 2 : 1}
        >
          <TileLayer
            url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
            attribution='© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> © <a href="https://carto.com/attributions">CARTO</a>'
            noWrap={true}
          />

          <ZoomHandler setZoom={handleZoomUpdate} />

          {showHeatmap && heatmapPoints.length > 0 && (
            <HeatmapLayer
              points={heatmapPoints}
              longitudeExtractor={(p: HeatmapPoint) => p[1]}
              latitudeExtractor={(p: HeatmapPoint) => p[0]}
              intensityExtractor={(p: HeatmapPoint) => p[2]}
              radius={35}
              blur={25}
              max={maxIntensity}
              minOpacity={0.1}
              gradient={{
                0.1: "#00f9ff",
                0.3: "#4a5fff",
                0.6: "#8a2be2",
                0.8: "#ff0099",
                1.0: "#ffffff",
              }}
            />
          )}

          {showMarkers && individualNodes.length > 0 && (
            <NodeMarkersLayer nodes={individualNodes} />
          )}

          <AnalyticsDashboard analytics={analytics} />
        </MapContainer>
      </div>
    </div>
  );
};

export default App;
