export interface PopularSearchPill {
  id: string;
  label: string;
  query: string;
  location?: string;
  remote?: string;
  searchCount: number;
  avgSearches: number; // Daily average searches across 30-day moving window
  formattedAverage: string; // e.g. "140/day" or "3.5k searches"
  trend?: 'hot' | 'rising' | 'steady';
  category?: string;
  updatedAt: string;
}

export interface PopularSearchesResponse {
  pills: PopularSearchPill[];
  totalSearchesRecorded: number;
  periodDays: number;
  lastUpdated: string;
}

