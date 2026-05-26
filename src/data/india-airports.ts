/**
 * Indian airport reference data for scenario airport selection.
 * Sources: AIP India (eAIP published by AAI), Jeppesen charts.
 * Runway lengths in metres (LDA / TORA); elevations in feet (MSL).
 *
 * Runways listed longest-first per airport.
 */

export type AirportRunway = {
  /** "09/27", "14/32", etc. */
  id: string;
  /** TORA in metres (approximate — use for A320 performance reference only) */
  lengthM: number;
};

export type AirportOption = {
  icao: string;
  iata: string;
  name: string;
  city: string;
  /** Field elevation in feet MSL */
  elevFt: number;
  runways: AirportRunway[];
};

export const INDIA_AIRPORTS: AirportOption[] = [
  {
    icao: "VIDP",
    iata: "DEL",
    name: "Indira Gandhi International",
    city: "New Delhi",
    elevFt: 777,
    runways: [
      { id: "09/27", lengthM: 4430 },
      { id: "11/29", lengthM: 4430 },
      { id: "10/28", lengthM: 3810 },
    ],
  },
  {
    icao: "VABB",
    iata: "BOM",
    name: "Chhatrapati Shivaji Maharaj International",
    city: "Mumbai",
    elevFt: 39,
    runways: [
      { id: "09/27", lengthM: 3445 },
      { id: "14/32", lengthM: 2925 },
    ],
  },
  {
    icao: "VOBL",
    iata: "BLR",
    name: "Kempegowda International",
    city: "Bengaluru",
    elevFt: 3000,
    runways: [
      { id: "09/27", lengthM: 4000 },
    ],
  },
  {
    icao: "VOMM",
    iata: "MAA",
    name: "Chennai International",
    city: "Chennai",
    elevFt: 52,
    runways: [
      { id: "07/25", lengthM: 3600 },
      { id: "12/30", lengthM: 2975 },
    ],
  },
  {
    icao: "VAAH",
    iata: "AMD",
    name: "Sardar Vallabhbhai Patel International",
    city: "Ahmedabad",
    elevFt: 189,
    runways: [
      { id: "05/23", lengthM: 3505 },
    ],
  },
  {
    icao: "VILK",
    iata: "LKO",
    name: "Chaudhary Charan Singh International",
    city: "Lucknow",
    elevFt: 410,
    runways: [
      { id: "09/27", lengthM: 2744 },
      { id: "14/32", lengthM: 2286 },
    ],
  },
  {
    icao: "VANP",
    iata: "NAG",
    name: "Dr. Babasaheb Ambedkar International",
    city: "Nagpur",
    elevFt: 1033,
    runways: [
      { id: "14/32", lengthM: 3200 },
    ],
  },
  {
    icao: "VIJP",
    iata: "JAI",
    name: "Jaipur International",
    city: "Jaipur",
    elevFt: 1263,
    runways: [
      { id: "08/26", lengthM: 2744 },
    ],
  },
];
