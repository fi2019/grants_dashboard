import { fetchDetails, fetchGrantsGov } from "./grants-gov";
import type { SourceConnector } from "./types";

export const CONNECTORS: SourceConnector[] = [
  { id: "grants.gov", label: "Grants.gov", fetch: fetchGrantsGov, details: fetchDetails },
];

export function connectorFor(id: string): SourceConnector | undefined {
  return CONNECTORS.find((c) => c.id === id);
}
