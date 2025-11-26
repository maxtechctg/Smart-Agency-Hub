interface BusinessResult {
  name: string;
  phone?: string;
  email?: string;
  website?: string;
  address?: string;
  category?: string;
  rating?: number;
  reviews?: number;
  source: string;
}

interface SearchOptions {
  keyword: string;
  location?: string;
  page?: number;
  perPage?: number;
  previousTotal?: number;  // For monotonic accumulator
}

interface SearchResults {
  results: BusinessResult[];
  totalResults?: number;
  page: number;
  perPage: number;
  hasMore: boolean;
}

interface SerpApiLocalResponse {
  local_results?: Array<{
    title?: string;
    phone?: string;
    website?: string;
    address?: string;
    type?: string;
    rating?: number;
    reviews?: number;
    links?: { website?: string };
  }>;
  organic_results?: Array<{
    title?: string;
    link?: string;
    snippet?: string;
    displayed_link?: string;
  }>;
  search_information?: {
    total_results?: string | number;
  };
  error?: string;
}

interface SerpApiMapsResponse {
  local_results?: Array<{
    title?: string;
    name?: string;
    phone?: string;
    website?: string;
    link?: string;
    address?: string;
    type?: string;
    types?: string[];
    rating?: number;
    reviews?: number;
  }>;
  place_results?: Array<{
    title?: string;
    name?: string;
    phone?: string;
    website?: string;
    link?: string;
    address?: string;
    type?: string;
    types?: string[];
    rating?: number;
    reviews?: number;
  }>;
  search_information?: {
    total_results?: string | number;
  };
  error?: string;
}

class SerpApiService {
  private apiKey: string | undefined;

  constructor() {
    this.apiKey = process.env.SERPAPI_KEY;
  }

  isConfigured(): boolean {
    return !!this.apiKey;
  }

  // Geocode location name to GPS coordinates using Nominatim (OpenStreetMap)
  private async geocodeLocation(location: string): Promise<string | null> {
    try {
      const encodedLocation = encodeURIComponent(location);
      const url = `https://nominatim.openstreetmap.org/search?q=${encodedLocation}&format=json&limit=1`;
      
      const response = await fetch(url, {
        headers: {
          'User-Agent': 'MaxTech-SmartLeadFinder/1.0'
        }
      });
      
      if (!response.ok) {
        console.error(`Geocoding failed: ${response.status}`);
        return null;
      }

      const data = await response.json();
      
      if (data && data.length > 0) {
        const { lat, lon } = data[0];
        // Format: @latitude,longitude,zoom (zoom 14 is city-level)
        return `@${lat},${lon},14z`;
      }
      
      return null;
    } catch (error: any) {
      console.error('Geocoding error:', error.message);
      return null;
    }
  }

  async searchBusinesses(options: SearchOptions): Promise<SearchResults> {
    if (!this.apiKey) {
      throw new Error("SERPAPI_KEY not configured");
    }

    const { keyword, location, page = 1, perPage = 40, previousTotal = 0 } = options;
    const allResults: BusinessResult[] = [];
    const seenDomains = new Set<string>();
    const seenNames = new Set<string>();

    try {
      console.log(`SerpAPI: Searching for "${keyword}" ${location ? `in ${location}` : ''} (page ${page})`);

      let serpApiTotal = 0;
      
      // STRATEGY: Fixed Raw Results per Page (Option 2)
      // Each page fetches exactly 80 raw results (4 Google Maps API calls × 20 results)
      // After filtering, return all qualified businesses from those 80 raw results
      // This ensures:
      // - Predictable pagination (no overlapping/skipping)
      // - Consistent page boundaries
      // - Variable but reasonable qualified count (typically 25-45 after filtering)
      
      const RAW_RESULTS_PER_PAGE = 80; // 4 API calls × 20 results each
      const MAPS_PER_CALL = 20; // Google Maps returns exactly 20 per call
      const API_CALLS_PER_PAGE = 4; // 80 / 20 = 4 calls
      
      // Geocode location to coordinates
      let coordinates: string | null = null;
      if (location) {
        coordinates = await this.geocodeLocation(location);
        if (coordinates) {
          console.log(`Geocoded "${location}" to ${coordinates}`);
        } else {
          // Geocoding failed - return error instead of wrong results
          console.error(`Failed to geocode location: "${location}"`);
          throw new Error(`Unable to find location: "${location}". Please check the spelling or try a different location.`);
        }
      } else {
        // No location provided
        throw new Error("Location is required for business search");
      }
      
      // Calculate starting offset for this page
      // Page 1: offsets 0, 20, 40, 60
      // Page 2: offsets 80, 100, 120, 140
      // Page 3: offsets 160, 180, 200, 220
      const pageStartOffset = (page - 1) * RAW_RESULTS_PER_PAGE;
      
      let totalFetched = 0;
      let lastCallWasPartial = false;
      
      // Fetch exactly 4 API calls (or until API exhausted)
      for (let i = 0; i < API_CALLS_PER_PAGE; i++) {
        const currentOffset = pageStartOffset + (i * MAPS_PER_CALL);
        
        const { results: mapsResults, totalResults: mapsTotal } = await this.searchGoogleMapsWithMeta(
          keyword,
          coordinates,
          currentOffset,
          MAPS_PER_CALL
        );
        
        if (mapsTotal > serpApiTotal) {
          serpApiTotal = mapsTotal;
        }
        
        // Merge with deduplication
        this.mergeResults(allResults, mapsResults, seenDomains, seenNames);
        totalFetched += mapsResults.length;
        
        // Check if API is exhausted (got fewer than requested)
        if (mapsResults.length < MAPS_PER_CALL) {
          lastCallWasPartial = true;
          console.log(`API exhausted after ${i + 1} calls (${totalFetched} raw results)`);
          break; // Stop fetching - API exhausted
        }
      }

      // Apply smart business filtering
      // Since organic_results are removed, ALL results come from Google Maps/Local APIs
      // These APIs return verified business listings, not general web pages
      // Filter requirement: At least ONE verified contact method
      const filtered = allResults.filter(business => 
        business.email || business.phone || business.website || business.address
      );

      // Return ALL qualified results from this page's raw results
      // No slicing - give the user everything we found
      const pageResults = filtered;

      // Calculate total results - use SerpAPI total or estimate
      let reportedTotal: number;
      if (serpApiTotal > 0) {
        // SerpAPI provides a total - clamp against previous to prevent regression
        reportedTotal = Math.max(serpApiTotal, previousTotal);
      } else {
        // Conservative estimate based on current results
        const currentEstimate = pageStartOffset + totalFetched;
        reportedTotal = Math.max(currentEstimate, previousTotal);
      }

      // hasMore calculation:
      // 1. If API exhausted (partial results), no more data available
      // 2. If API returned full batches AND serpApiTotal is known, check if more data exists
      // 3. If API returned full batches BUT serpApiTotal unknown, assume more data exists
      let hasMore: boolean;
      if (lastCallWasPartial) {
        // API exhausted - definitely no more data
        hasMore = false;
      } else if (serpApiTotal > 0) {
        // API provided total - check if we've reached it
        hasMore = (pageStartOffset + RAW_RESULTS_PER_PAGE) < serpApiTotal;
      } else {
        // API didn't provide total but returned full batches - assume more data exists
        hasMore = true;
      }

      console.log(`SerpAPI Page ${page}: RawOffset=${pageStartOffset}, RawFetched=${totalFetched}, Unique=${allResults.length}, Qualified=${filtered.length}, Total=${reportedTotal}, hasMore=${hasMore}`);

      return {
        results: pageResults,
        totalResults: reportedTotal,
        page,
        perPage, // Keep for API compatibility
        hasMore,
      };

    } catch (error: any) {
      console.error("SerpAPI search error:", error.message);
      throw error;
    }
  }

  private async searchGoogleLocalWithMeta(
    keyword: string,
    location: string | undefined,
    start: number,
    num: number
  ): Promise<{ results: BusinessResult[]; totalResults: number }> {
    const results: BusinessResult[] = [];
    let totalResults = 0;

    try {
      const query = location ? `${keyword} ${location}` : keyword;
      const encodedQuery = encodeURIComponent(query);
      const url = `https://serpapi.com/search.json?engine=google&q=${encodedQuery}&api_key=${this.apiKey}&num=${num}&start=${start}`;
      
      console.log(`SerpAPI Google Local: Fetching ${num} results starting at ${start}`);
      
      const response = await fetch(url);
      
      if (!response.ok) {
        console.error(`Google Local search failed: ${response.status}`);
        return { results, totalResults };
      }

      const data: SerpApiLocalResponse = await response.json();

      if (data.error) {
        console.error(`Google Local API error: ${data.error}`);
        return { results, totalResults };
      }

      // Extract total results from SerpAPI metadata
      // Handle both string (e.g., "1,234") and number formats
      if (data.search_information?.total_results) {
        const totalStr = data.search_information.total_results;
        if (typeof totalStr === 'string') {
          totalResults = parseInt(totalStr.replace(/,/g, ''), 10) || 0;
        } else if (typeof totalStr === 'number') {
          totalResults = totalStr;
        }
      }

      // Process local_results (Google Maps pack)
      if (data.local_results && data.local_results.length > 0) {
        for (const result of data.local_results) {
          const website = result.website || result.links?.website;
          const email = website ? this.generatePotentialEmail(result.title || '', website) : undefined;
          
          const business: BusinessResult = {
            name: result.title || "Unknown Business",
            phone: this.normalizePhone(result.phone),
            email,
            website,
            address: result.address,
            category: result.type,
            rating: result.rating,
            reviews: result.reviews,
            source: "Google Local",
          };
          
          results.push(business);
        }
      }

      // REMOVED: organic_results processing
      // Organic results return web pages (articles, blogs, videos, directories) instead of real businesses
      // We only want verified businesses from local_results and google_maps with real contact information

      return { results, totalResults };

    } catch (error: any) {
      console.error("Google Local search error:", error.message);
      return { results, totalResults };
    }
  }

  private async searchGoogleMapsWithMeta(
    keyword: string,
    coordinates: string, // Format: @latitude,longitude,zoom
    start: number,
    num: number
  ): Promise<{ results: BusinessResult[]; totalResults: number }> {
    const results: BusinessResult[] = [];
    let totalResults = 0;

    try {
      const encodedQuery = encodeURIComponent(keyword);
      const url = `https://serpapi.com/search.json?engine=google_maps&q=${encodedQuery}&ll=${coordinates}&api_key=${this.apiKey}&type=search&start=${start}`;
      
      console.log(`SerpAPI Google Maps: Fetching results starting at ${start}`);
      
      const response = await fetch(url);
      
      if (!response.ok) {
        console.error(`Google Maps search failed: ${response.status}`);
        return { results, totalResults };
      }

      const data: SerpApiMapsResponse = await response.json();

      if (data.error) {
        console.error(`Google Maps API error: ${data.error}`);
        return { results, totalResults };
      }

      // Extract total results from SerpAPI metadata
      if (data.search_information?.total_results) {
        const totalStr = data.search_information.total_results;
        if (typeof totalStr === 'string') {
          totalResults = parseInt(totalStr.replace(/,/g, ''), 10) || 0;
        } else if (typeof totalStr === 'number') {
          totalResults = totalStr;
        }
      }

      const mapResults = data.local_results || data.place_results || [];
      
      for (const result of mapResults) {
        if (results.length >= num) break;
        
        const website = result.website || result.link;
        const name = result.title || result.name || "Unknown Business";
        const email = website ? this.generatePotentialEmail(name, website) : undefined;
        
        const business: BusinessResult = {
          name,
          phone: this.normalizePhone(result.phone),
          email,
          website,
          address: result.address,
          category: result.type || result.types?.[0],
          rating: result.rating,
          reviews: result.reviews,
          source: "Google Maps",
        };
        
        results.push(business);
      }

      return { results, totalResults };

    } catch (error: any) {
      console.error("Google Maps search error:", error.message);
      return { results, totalResults };
    }
  }

  // REMOVED: Legacy searchGoogleLocal() and searchGoogleMaps() methods
  // These contained organic_results processing which returned content pages instead of businesses

  private mergeResults(
    target: BusinessResult[],
    source: BusinessResult[],
    seenDomains: Set<string>,
    seenNames: Set<string>
  ): void {
    for (const business of source) {
      // Extract domain for deduplication
      const domain = business.website ? this.extractDomain(business.website) : null;
      const normalizedName = business.name.toLowerCase().trim();

      // Skip if duplicate domain or name
      if (domain && seenDomains.has(domain)) {
        continue;
      }
      if (seenNames.has(normalizedName)) {
        continue;
      }

      // Add to results and track
      target.push(business);
      if (domain) seenDomains.add(domain);
      seenNames.add(normalizedName);
    }
  }

  private extractDomain(url: string): string | null {
    try {
      const urlObj = new URL(url.startsWith('http') ? url : `https://${url}`);
      return urlObj.hostname.replace(/^www\./, '').toLowerCase();
    } catch {
      return null;
    }
  }

  private normalizePhone(phone: string | undefined): string | undefined {
    if (!phone) return undefined;
    // Remove common phone formatting characters
    return phone.replace(/[\s\-()]/g, '').trim() || undefined;
  }

  private generatePotentialEmail(name: string, website: string): string | undefined {
    try {
      const domain = this.extractDomain(website);
      if (!domain) return undefined;
      return `info@${domain}`;
    } catch {
      return undefined;
    }
  }

  private extractCategory(keyword: string): string {
    const words = keyword.toLowerCase().split(" ");
    const categoryWords = words.filter(w => 
      !["companies", "company", "businesses", "business", "agencies", "agency", 
       "firms", "firm", "services", "service", "near", "me", "in", "at", "the",
       "usa", "uk", "uae", "dubai", "india", "bangladesh", "canada", "australia",
       "dhaka", "chittagong", "sylhet", "khulna", "rajshahi"].includes(w)
    );
    return categoryWords.map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(" ") || "General";
  }
}

export const serpApiService = new SerpApiService();
