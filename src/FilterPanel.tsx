import React from "react";

interface FilterPanelProps {
  analytics: {
    totalNodes: number;
    uniqueCountries: number;
    topUserAgents?: { agent: string; count: number }[];
    topOrganizations?: { org: string; count: number }[];
    protocolVersions?: { version: number; count: number }[];
    averageUptime?: number;
    decentralizationScore?: number;
  };
  filters: {
    countries?: string[];
    protocolVersions?: number[];
    userAgents?: string[];
    organizations?: string[];
  };
  setFilters: React.Dispatch<
    React.SetStateAction<{
      countries?: string[];
      protocolVersions?: number[];
      userAgents?: string[];
      organizations?: string[];
    }>
  >;
}

const FilterPanel: React.FC<FilterPanelProps> = ({
  analytics,
  filters,
  setFilters,
}) => {
  return (
    <div className="absolute top-4 right-4 bg-black bg-opacity-90 p-4 rounded-lg border border-[#00f9ff] z-[1001] max-w-xs">
      <h3 className="text-lg font-bold mb-2">Filters</h3>
      <div className="space-y-2">{/* Add filter controls here */}</div>
    </div>
  );
};

export default FilterPanel;
