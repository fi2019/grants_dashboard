import type { Opportunity, SourceId } from "../types";

export interface FetchOptions {
  keywords: string[];
  /** Agency code prefixes to sweep for all open opportunities, e.g. ["DOE", "NSF"]. */
  agencyPrefixes: string[];
  maxPerAgencySweep: number;
}

export interface SourceResult {
  source: SourceId;
  opportunities: Opportunity[];
  errors: string[];
}

/**
 * A source connector. To add one (NSF site, ARPA-E, DOE EERE Exchange,
 * SAM.gov, foundations), implement this and register it in ./index.ts.
 */
export interface SourceConnector {
  id: SourceId;
  label: string;
  fetch(opts: FetchOptions): Promise<SourceResult>;
  /** Optional second pass to fill description / eligibility / cost share. */
  details?(nativeId: string): Promise<Partial<Opportunity>>;
}
