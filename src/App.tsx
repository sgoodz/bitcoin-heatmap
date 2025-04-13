import React, { useState, useEffect, useMemo, useCallback } from "react";
import { MapContainer, TileLayer, useMap, useMapEvents } from "react-leaflet";
import L from "leaflet";
import { HeatmapLayer } from "react-leaflet-heatmap-layer-v3";
import "leaflet.markercluster"; // Import marker cluster JS
// Import CSS for Leaflet, MarkerCluster
import "leaflet/dist/leaflet.css";
import "leaflet.markercluster/dist/MarkerCluster.css";
import "leaflet.markercluster/dist/MarkerCluster.Default.css";
// Optional: leaflet.heat CSS (usually handled by the library)
// import 'leaflet.heat/dist/leaflet-heat.js';

// --- Constants ---
const BITNODES_API_URL = "https://bitnodes.io/api/v1/snapshots/latest/";
const AGGREGATION_PRECISION = 1; // Coarser aggregation for heatmap visibility (adjust)
const ZOOM_THRESHOLD = 9; // Zoom level to switch between heatmap and markers (adjust)
const MAX_NODES_FOR_MARKERS = 10000; // Limit nodes passed to marker layer for performance

// --- Interfaces ---
interface BitnodeRawData {
  /* ... same as before ... */ protocolVersion: number;
  userAgent: string;
  connectedSince: number;
  services: string;
  height: number;
  hostname: string;
  city: string | null;
  countryCode: string | null;
  latitude: number;
  longitude: number;
  timezone: string | null;
  asn: string | null;
  organization: string | null;
}

// For individual markers with details
interface ProcessedNode {
  lat: number;
  lon: number;
  // Include details needed for tooltips
  userAgent?: string;
  country?: string | null;
  protocolVersion?: number;
  organization?: string | null;
}

type HeatmapPoint = [lat: number, lon: number, intensity: number];

// --- Custom Hook for Data Fetching & Processing ---
const useBitnodesData = () => {
  const [heatmapPoints, setHeatmapPoints] = useState<HeatmapPoint[]>([]);
  const [individualNodes, setIndividualNodes] = useState<ProcessedNode[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [maxIntensity, setMaxIntensity] = useState<number>(50); // Default max intensity

  // Mock data generation moved inside hook if needed, or keep memoized outside
  const mockHeatmapPoints: HeatmapPoint[] = useMemo(
    () => [
      /* ... same as before ... */ [40.7, -74.0, 25],
      [51.5, -0.1, 18],
      [35.7, 139.7, 12],
      [-33.9, 151.2, 9],
    ],
    []
  );
  const mockIndividualNodes: ProcessedNode[] = useMemo(
    () => [
      /* ... mock individual nodes ... */
      { lat: 40.7128, lon: -74.006, userAgent: "/Mock:1.0/", country: "US" },
      { lat: 51.5074, lon: -0.1278, userAgent: "/Mock:1.0/", country: "GB" },
    ],
    []
  );

  useEffect(() => {
    const fetchAndProcessNodes = async () => {
      setLoading(true);
      setError(null);
      console.log("Fetching Bitnodes data...");

      try {
        const response = await fetch(BITNODES_API_URL);
        if (!response.ok)
          throw new Error(
            `API Error: ${response.status} ${response.statusText}`
          );
        const data = await response.json();
        console.log("Raw API response received.");

        if (!data?.nodes) throw new Error("Invalid API response structure.");

        const nodes = Object.entries(data.nodes);
        console.log(`Processing ${nodes.length} raw node entries...`);

        // --- Process for Individual Markers ---
        const processedNodes: ProcessedNode[] = [];
        nodes.forEach(([_, nodeData]: [string, any[]]) => {
          if (
            Array.isArray(nodeData) &&
            nodeData.length > 12 &&
            typeof nodeData[8] === "number" &&
            typeof nodeData[9] === "number" &&
            !isNaN(nodeData[8]) &&
            !isNaN(nodeData[9])
          ) {
            processedNodes.push({
              lat: nodeData[8],
              lon: nodeData[9],
              userAgent: nodeData[1] as string,
              country: nodeData[7] as string | null,
              protocolVersion: nodeData[0] as number,
              organization: nodeData[12] as string | null,
            });
          }
        });
        // Limit nodes for marker performance if necessary
        setIndividualNodes(processedNodes.slice(0, MAX_NODES_FOR_MARKERS));
        console.log(
          `Prepared ${Math.min(
            processedNodes.length,
            MAX_NODES_FOR_MARKERS
          )} nodes for markers.`
        );

        // --- Aggregate for Heatmap ---
        const aggregationMap = new Map<
          string,
          { lat: number; lon: number; count: number }
        >();
        let currentMaxIntensity = 0;
        processedNodes.forEach((node) => {
          // Aggregate from already processed nodes
          const key = `${node.lat.toFixed(
            AGGREGATION_PRECISION
          )},${node.lon.toFixed(AGGREGATION_PRECISION)}`;
          const existing = aggregationMap.get(key);
          if (existing) {
            existing.count += 1;
            if (existing.count > currentMaxIntensity)
              currentMaxIntensity = existing.count;
          } else {
            const newLat = parseFloat(node.lat.toFixed(AGGREGATION_PRECISION));
            const newLon = parseFloat(node.lon.toFixed(AGGREGATION_PRECISION));
            aggregationMap.set(key, { lat: newLat, lon: newLon, count: 1 });
            if (1 > currentMaxIntensity) currentMaxIntensity = 1; // Handle first node
          }
        });

        const aggregatedPoints: HeatmapPoint[] = Array.from(
          aggregationMap.values()
        ).map((agg) => [agg.lat, agg.lon, agg.count]);

        console.log(
          `Aggregated into ${aggregatedPoints.length} heatmap points.`
        );
        // Adjust max intensity dynamically (e.g., 95th percentile or capped max)
        // Simple approach: use the actual max, or a fraction of it if it's too high
        const calculatedMax = Math.max(1, Math.ceil(currentMaxIntensity * 0.8)); // Cap at 80% of true max? Adjust.
        setMaxIntensity(calculatedMax);
        console.log(
          `Calculated Max Intensity for heatmap: ${calculatedMax} (True max was ${currentMaxIntensity})`
        );

        if (aggregatedPoints.length > 0) {
          setHeatmapPoints(aggregatedPoints);
        } else {
          setHeatmapPoints(mockHeatmapPoints); // Use mock data if processing yields nothing
        }
        if (processedNodes.length === 0) {
          setIndividualNodes(mockIndividualNodes);
        }
      } catch (err) {
        console.error("Failed to fetch or process Bitnodes data:", err);
        setError(
          err instanceof Error ? err.message : "An unknown error occurred"
        );
        setHeatmapPoints(mockHeatmapPoints); // Use mock data on error
        setIndividualNodes(mockIndividualNodes);
        setMaxIntensity(50); // Reset max intensity on error
      } finally {
        setLoading(false);
      }
    };

    fetchAndProcessNodes();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Removed mock data from dependency array if they are stable

  return { heatmapPoints, individualNodes, loading, error, maxIntensity };
};

// --- Component for Individual Node Markers (using MarkerCluster) ---
const NodeMarkersLayer = ({ nodes }: { nodes: ProcessedNode[] }) => {
  const map = useMap();

  useEffect(() => {
    if (!nodes || nodes.length === 0) return;

    console.log(`Rendering marker clusters for ${nodes.length} nodes.`);
    const clusterGroup = L.markerClusterGroup({
      maxClusterRadius: 60, // Adjust cluster radius
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
          // Using default leaflet cluster styles - customize HTML/CSS as needed
          html: `<div><span>${count}</span></div>`,
          className: className,
          iconSize: [size, size],
        });
      },
      // Disable spiderfy if you prefer markers to just appear on zoom
      spiderfyOnMaxZoom: true,
      showCoverageOnHover: false, // Optional: visual feedback on hover
    });

    nodes.forEach((node) => {
      // Simple circle marker - customize as needed
      const marker = L.circleMarker([node.lat, node.lon], {
        radius: 5, // Small radius for individual nodes
        color: "#00f9ff", // Outline color
        weight: 2,
        fillColor: "#ff0099", // Fill color
        fillOpacity: 0.7,
      });

      // Tooltip with node details
      let tooltipContent = `<b>Node</b><br/>Lat: ${node.lat.toFixed(
        4
      )}, Lon: ${node.lon.toFixed(4)}`;
      if (node.country) tooltipContent += `<br/>Country: ${node.country}`;
      if (node.userAgent)
        tooltipContent += `<br/>Agent: ${node.userAgent.substring(0, 30)}${
          node.userAgent.length > 30 ? "..." : ""
        }`;
      if (node.organization) tooltipContent += `<br/>Org: ${node.organization}`;

      marker.bindTooltip(tooltipContent, { direction: "top", offset: [0, -5] });
      clusterGroup.addLayer(marker);
    });

    map.addLayer(clusterGroup);
    console.log("Marker clusters added.");

    return () => {
      console.log("Removing marker clusters.");
      map.removeLayer(clusterGroup);
    };
  }, [nodes, map]); // Re-run if nodes or map instance change

  return null; // This component only adds/removes the layer imperatively
};

// --- Component to Update Zoom State ---
const ZoomHandler = ({ setZoom }: { setZoom: (zoom: number) => void }) => {
  const map = useMapEvents({
    zoomend: () => {
      setZoom(map.getZoom());
    },
  });
  // Set initial zoom
  useEffect(() => {
    setZoom(map.getZoom());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map]); // Run once when map is ready

  return null;
};

// --- Main App Component ---
const App = () => {
  const { heatmapPoints, individualNodes, loading, error, maxIntensity } =
    useBitnodesData();
  const [metric, setMetric] = useState("nodes"); // Keep for potential future use
  const initialZoom = 3;
  const [currentZoom, setCurrentZoom] = useState<number>(initialZoom);

  // Map config - Memoize to prevent unnecessary re-renders
  const mapCenter: L.LatLngTuple = useMemo(() => [20, 0], []);
  const mapBounds: L.LatLngBoundsLiteral = useMemo(
    () => [
      [-85, -180],
      [85, 180],
    ],
    []
  );

  // Callback for setting zoom state
  const handleZoomUpdate = useCallback((zoom: number) => {
    setCurrentZoom(zoom);
  }, []);

  // Determine which layer to show
  const showHeatmap = !loading && currentZoom < ZOOM_THRESHOLD;
  const showMarkers = !loading && currentZoom >= ZOOM_THRESHOLD;

  return (
    <div className="h-screen bg-black text-[#00f9ff] flex flex-col">
      {/* Header */}
      <header className="p-4 flex justify-between items-center bg-black border-b border-[#00f9ff] z-10 relative">
        <h1 className="text-xl md:text-2xl font-bold text-[#00f9ff]">
          Bitcoin Node Map
        </h1>
        <div className="text-sm md:text-base">
          Zoom: {currentZoom} ( Mode:{" "}
          {showHeatmap ? "Heatmap" : showMarkers ? "Markers" : "Loading..."} )
        </div>
        {/* Optional: Dropdown for future features
         <select ...> ... </select>
        */}
      </header>

      {/* Status Messages */}
      {loading && (
        <div className="text-center p-4 bg-black">Loading Node Data...</div>
      )}
      {error && (
        <div className="text-center p-4 bg-red-800 text-white">
          Error: {error}
        </div>
      )}

      {/* Map Container */}
      <div className="flex-1 relative">
        <MapContainer
          center={mapCenter}
          zoom={initialZoom}
          minZoom={2}
          maxBounds={mapBounds}
          maxBoundsViscosity={1.0}
          className="h-full w-full"
          style={{ background: "#000" }}
        >
          <TileLayer
            url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
            attribution='© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> © <a href="https://carto.com/attributions">CARTO</a>'
            noWrap={true}
          />

          {/* Handler to update zoom state */}
          <ZoomHandler setZoom={handleZoomUpdate} />

          {/* --- Conditional Layers --- */}

          {/* Heatmap Layer (visible when zoomed out) */}
          {showHeatmap && heatmapPoints.length > 0 && (
            <HeatmapLayer
              points={heatmapPoints}
              longitudeExtractor={(p: HeatmapPoint) => p[1]}
              latitudeExtractor={(p: HeatmapPoint) => p[0]}
              intensityExtractor={(p: HeatmapPoint) => p[2]}
              // --- Tune these parameters for zoomed-out visibility ---
              radius={35} // Increased radius
              blur={25} // Increased blur
              max={maxIntensity} // Use dynamically calculated max intensity
              minOpacity={0.1} // Ensure faint visibility even for low counts
              gradient={{
                // Example Gradient (adjust!)
                0.1: "#00f9ff",
                0.3: "#4a5fff",
                0.6: "#8a2be2",
                0.8: "#ff0099",
                1.0: "#ffffff",
              }}
            />
          )}

          {/* Marker Layer (visible when zoomed in) */}
          {showMarkers && individualNodes.length > 0 && (
            <NodeMarkersLayer nodes={individualNodes} />
          )}
        </MapContainer>
      </div>
    </div>
  );
};

export default App;
