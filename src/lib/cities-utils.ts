/**
 * Utilities for working with cities data
 */

import { cities, type City } from './data/cities-data';

/**
 * Simplified city interface for UI components
 * Contains only essential fields needed for display and selection
 */
export interface SimplifiedCity {
  id: string;
  name: string;
  nameEn: string;
  region: string;
  regionEn: string;
  country: 'RU' | 'BY';
}

/**
 * Convert full City data to simplified City format
 * @param cityData - Full City object from cities-data
 * @returns Simplified City object
 */
export function cityDataToCity(cityData: City): SimplifiedCity {
  return {
    id: cityData.id,
    name: cityData.name,
    nameEn: cityData.nameEn,
    region: cityData.region,
    regionEn: cityData.regionEn,
    country: cityData.country,
  };
}

/**
 * Get cities filtered by country
 * @param country - Country code ('RU' or 'BY')
 * @returns Array of cities for the specified country
 */
export function getCitiesByCountry(country: 'RU' | 'BY'): City[] {
  return cities.filter((city) => city.country === country);
}

/**
 * Search cities by name (case-insensitive)
 * Supports searching in both Russian and English names
 * @param query - Search query string
 * @param country - Optional country filter ('RU' or 'BY')
 * @returns Array of matching cities
 */
export function searchCities(query: string, country?: 'RU' | 'BY'): City[] {
  if (!query.trim()) {
    return country ? getCitiesByCountry(country) : cities;
  }

  const lowerQuery = query.toLowerCase().trim();
  
  let filtered = cities.filter((city) => {
    const matchesName = city.name.toLowerCase().includes(lowerQuery);
    const matchesNameEn = city.nameEn.toLowerCase().includes(lowerQuery);
    const matchesRegion = city.region.toLowerCase().includes(lowerQuery);
    const matchesRegionEn = city.regionEn.toLowerCase().includes(lowerQuery);
    
    return matchesName || matchesNameEn || matchesRegion || matchesRegionEn;
  });

  if (country) {
    filtered = filtered.filter((city) => city.country === country);
  }

  return filtered;
}

/**
 * Get display name for a city
 * Returns city name with region in parentheses if needed
 * @param city - City object (full or simplified)
 * @param options - Display options
 * @returns Formatted city display name
 */
export function getCityDisplayName(
  city: City | SimplifiedCity,
  options?: {
    includeRegion?: boolean;
    language?: 'ru' | 'en';
  }
): string {
  const { includeRegion = false, language = 'ru' } = options || {};
  
  const cityName = language === 'en' ? city.nameEn : city.name;
  
  if (includeRegion) {
    const regionName = language === 'en' ? city.regionEn : city.region;
    return `${cityName}, ${regionName}`;
  }
  
  return cityName;
}

/**
 * Get city by ID
 * @param id - City ID
 * @returns City object or undefined if not found
 */
export function getCityById(id: string): City | undefined {
  return cities.find((city) => city.id === id);
}

/**
 * Get all unique regions for a country
 * @param country - Country code ('RU' or 'BY')
 * @returns Array of unique region names
 */
export function getRegionsByCountry(country: 'RU' | 'BY'): string[] {
  const countryCities = getCitiesByCountry(country);
  const regions = new Set(countryCities.map((city) => city.region));
  return Array.from(regions).sort();
}

/**
 * Get cities by region
 * @param region - Region name
 * @param country - Optional country filter
 * @returns Array of cities in the specified region
 */
export function getCitiesByRegion(
  region: string,
  country?: 'RU' | 'BY'
): City[] {
  let filtered = cities.filter(
    (city) =>
      city.region.toLowerCase() === region.toLowerCase() ||
      city.regionEn.toLowerCase() === region.toLowerCase()
  );

  if (country) {
    filtered = filtered.filter((city) => city.country === country);
  }

  return filtered;
}
