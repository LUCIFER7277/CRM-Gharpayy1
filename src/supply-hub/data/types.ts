// Types for the Gharpayy Lead Intelligence Platform.

export type Gender = "Boys" | "Girls" | "Co-live";
export type Tier = "Premium" | "Mid" | "Budget";

export interface Prices {
  min: number;
  max: number;
  single: number;
  double: number;
  triple: number;
}

export interface IQCheck {
  earned: number;
  max: number;
  ok: boolean;
}

export interface Persona {
  archetype: string;
  ageRange: string;
  salary: string;
  likelyCompanies: string;
  painPoints: string[];
  pitchAngle: string[];
  qualifyingQuestions: string[];
  doNot: string[];
  decisionMaker: string;
  conversionProbability: string;
}

export interface CallScript1 {
  goal: string;
  opening: string;
  questions: string[];
  hook: string;
  close: string;
}

export interface Objection {
  obj: string;
  resp: string;
}

export interface CallScript2 {
  goal: string;
  objections: Objection[];
}

export interface PitchScript {
  location: string;
  lifestyle: string;
  priceClose: string;
  closeQuestion: string;
}

export interface MoneyScript {
  breakdown: string[];
  payLater: string;
  depositObjection: string;
  checklist: string[];
}

export interface Scripts {
  call1: CallScript1;
  call2: CallScript2;
  pitch: PitchScript;
  money: MoneyScript;
}

export interface Contact {
  name: string;
  phone: string;
}

export interface NearbyLandmark {
  n: string;   // name
  t: string;   // type (Tech Park, College, Mall, ...)
  d: number;   // distance in km
  w: number;   // walk minutes
}

export interface PG {
  id: string;
  name: string;
  actualName: string;
  area: string;
  locality: string;
  gender: Gender;
  tier: Tier;
  audience: string;
  prices: Prices;
  rooms: string;
  furnishing: string;
  amenities: string[];
  safety: string[];
  foodType: string;
  mealsIncluded: string;
  utilities: string;
  cleaning: string;
  noise: string;
  vibe: string;
  rules: string;
  lows: string;
  deposit: string;
  minStay: string;
  usp: string;
  manager: Contact;
  owner: Contact;
  groupName: string;
  mapsLink: string;
  wa_card: string;
  location_card: string;
  landmarksInline: string[];
  lat?: number | null;
  lng?: number | null;
  nearbyLandmarks: NearbyLandmark[];
  iq: number;
  iqBreakdown: Record<string, IQCheck>;
  persona: Persona;
  scripts: Scripts;
}

export interface Landmark {
  n: string;            // name
  a: string;            // area
  t: string;            // type (Tech Park, MNC, College, Hospital, Mall, Company, ...)
  p: string;            // pin
  m: string;            // metro
  x: string;            // notes / aliases / tenants
  lat?: number | null;
  lng?: number | null;
}

export interface AreaIntel {
  area: string;
  subAreas: string;
  budget: string;
  demand: string;
  profile: string;
  commute: string;
  topCompanies: string;
}

export type DistanceMatrix = Record<string, Record<string, number>>;

export interface Block {
  name: string;
  area: string;
  pin: string;
}
