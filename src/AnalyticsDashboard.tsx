import React, { useState, useEffect } from "react";

interface AnalyticsDashboardProps {
  analytics: {
    totalNodes: number;
    uniqueCountries: number;
    topUserAgents?: { agent: string; count: number }[];
    topOrganizations?: { org: string; count: number }[];
    protocolVersions?: { version: number; count: number }[];
    averageUptime?: number;
    decentralizationScore?: number;
  };
}

const AnalyticsDashboard: React.FC<AnalyticsDashboardProps> = ({
  analytics,
}) => {
  // Collapsed by default on mobile, open by default on desktop
  const [isOpen, setIsOpen] = useState(true);

  useEffect(() => {
    // If on mobile, collapse by default
    if (window.matchMedia("(max-width: 767px)").matches) {
      setIsOpen(false);
    } else {
      setIsOpen(true);
    }
  }, []);

  return (
    <div className="fixed bottom-0 left-0 w-full z-[2000] text-[#00f9ff] font-mono flex flex-col items-center md:items-end md:justify-end md:absolute md:bottom-4 md:right-4 md:w-auto">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="mb-2 px-4 py-2 bg-black border border-[#00f9ff] rounded hover:bg-[#00f9ff] hover:text-black transition w-full md:w-auto md:mr-0 md:ml-auto"
      >
        {isOpen ? "Hide Analytics" : "Show Analytics"}
      </button>

      {isOpen && (
        <div className="bg-black bg-opacity-95 p-3 rounded-t-lg border-t border-[#00f9ff] w-full shadow-[0_0_10px_#00f9ff] max-h-[60vh] overflow-y-auto md:rounded-lg md:border md:p-4 md:w-64 md:max-h-none md:overflow-visible">
          <h2 className="text-lg font-bold mb-2">Node Analytics</h2>
          <div className="space-y-2">
            <p>
              <span className="font-semibold">Total Nodes:</span>{" "}
              {analytics.totalNodes.toLocaleString()}
            </p>
            <p>
              <span className="font-semibold">Unique Countries:</span>{" "}
              {analytics.uniqueCountries}
            </p>
            {analytics.protocolVersions && (
              <p>
                <span className="font-semibold">Protocol Versions:</span>{" "}
                {analytics.protocolVersions.length} unique
              </p>
            )}
            {analytics.averageUptime !== undefined &&
              analytics.averageUptime > 0 && (
                <p>
                  <span className="font-semibold">Avg Uptime:</span>{" "}
                  {analytics.averageUptime.toFixed(1)} days
                </p>
              )}
            {analytics.decentralizationScore !== undefined && (
              <p>
                <span className="font-semibold">Decentralization (HHI):</span>{" "}
                {analytics.decentralizationScore.toFixed(4)}
              </p>
            )}
            {analytics.topUserAgents && analytics.topUserAgents.length > 0 && (
              <div>
                <p className="font-semibold">Top User Agents:</p>
                <ul className="list-disc pl-5 text-sm">
                  {analytics.topUserAgents.map((ua, index) => (
                    <li key={index}>
                      {ua.agent.substring(0, 20)}
                      {ua.agent.length > 20 ? "..." : ""}: {ua.count}
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {analytics.topOrganizations &&
              analytics.topOrganizations.length > 0 && (
                <div>
                  <p className="font-semibold">Top Organizations:</p>
                  <ul className="list-disc pl-5 text-sm">
                    {analytics.topOrganizations.map((org, index) => (
                      <li key={index}>
                        {org.org.substring(0, 20)}
                        {org.org.length > 20 ? "..." : ""}: {org.count}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
          </div>
        </div>
      )}
    </div>
  );
};

export default AnalyticsDashboard;
