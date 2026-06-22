// Mega lexicon - base patterns. Generator produces 30k+ variants for QA/coverage,
// but the matcher itself uses these compact patterns at runtime (millisecond performance).
//
// Coverage: WhatsApp forwards, 99acres / Housing.com / Magicbricks / NoBroker / OLX
// snippets, Hinglish, casual chat, Indian phone formats, Indian budget formats
// (1.2L, 12k, 25 lakh, 3cr), BHK, locality (Bangalore-first), intent words, source.

export const PHONE_PATTERNS: RegExp[] = [
  // +91 with optional separators, 10-digit Indian, with optional country code, with brackets, with country word
  /(?:\+?91[\s\-]?|0)?[\s\-]?[6-9]\d{9}\b/g,
  // 10 digit standalone
  /\b[6-9]\d{9}\b/g,
  // Spaced: 98765 43210 / 98765-43210
  /\b[6-9]\d{4}[\s\-]\d{5}\b/g,
  // International (rare but seen)
  /\+\d{1,3}[\s\-]?\d{6,12}/g,
];

export const EMAIL_PATTERN = /[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}/g;

// Field labels - left side of "Name: Rahul" style lines. Lower-cased for matching.
export const FIELD_LABELS = {
  name: [
    "name", "candidate", "guest", "client", "lead", "tenant", "customer", "applicant",
    "naam", "नाम", "full name", "lead name", "person", "client name", "first name",
  ],
  phone: [
    "phone", "mobile", "contact", "number", "ph", "mob", "mob no", "mob.", "ph no",
    "contact no", "call", "whatsapp", "wa", "wp", "tel", "telephone", "cell", "no",
    "phone no", "mobile no", "mobile number", "phone number", "contact number",
    "नंबर", "मोबाइल", "फोन",
  ],
  email: ["email", "mail", "email id", "e-mail", "emailid", "e mail", "मेल", "ईमेल"],
  budget: [
    "budget", "rent", "price", "amount", "cost", "max budget", "max rent", "ceiling",
    "rent budget", "monthly budget", "monthly rent", "afford", "affordable",
    "budget range", "rent range", "किराया", "बजट",
  ],
  area: [
    "area", "location", "locality", "place", "preferred area", "preferred location",
    "looking in", "looking for", "wants in", "interested in", "near", "around", "around area",
    "site", "site location", "where", "want area", "address", "addr",
    "जगह", "इलाका", "एरिया",
  ],
  bhk: ["bhk", "configuration", "config", "type", "size", "rooms", "bedroom", "bedrooms"],
  moveIn: [
    "move in", "movein", "move-in", "moving in", "shift", "shifting", "shift date",
    "needed by", "needed from", "required from", "from", "available from", "starting",
    "join date", "joining", "occupancy", "want from", "needs by", "by when", "when",
    "checkin", "check in", "check-in",
  ],
  source: ["source", "via", "from", "channel", "platform", "ref", "referred by", "reference"],
  intent: ["intent", "urgency", "priority", "interest", "interest level"],
  timeline: ["timeline", "when", "by when", "deadline"],
  notes: ["notes", "remark", "remarks", "comment", "comments", "details", "more info"],
} as const;

export type FieldKey = keyof typeof FIELD_LABELS;

// BHK patterns: "2BHK", "2 BHK", "2 bhk", "2-bhk", "studio", "1RK", "1 RK"
export const BHK_PATTERNS: { re: RegExp; bhk: string }[] = [
  { re: /\bstudio\b/i, bhk: "studio" },
  { re: /\b1\s*[\-\.]?\s*r\.?\s*k\b/i, bhk: "1RK" },
  { re: /\b([1-6])\s*[\-\.]?\s*b\.?\s*h\.?\s*k\b/i, bhk: "$1BHK" },
  { re: /\b([1-6])\s*bedroom/i, bhk: "$1BHK" },
  { re: /\b([1-6])\s*bed\b/i, bhk: "$1BHK" },
];

// Budget tokens. Indian-format aware.
//   12000 / 12,000 / 12k / 12K / 12 thousand
//   1.2L / 1.2 lakh / 1.2 lac / ₹1.2L / Rs 1.2L
//   2cr / 2 crore
export const BUDGET_PATTERNS: { re: RegExp; mult: number; capture: number }[] = [
  // 1.2 cr / 2 crore / 2crore
  { re: /(?:₹|rs\.?|inr)?\s*(\d+(?:\.\d+)?)\s*(?:cr|crore|crores|करोड़)\b/i, mult: 10_000_000, capture: 1 },
  // 25 lakh / 1.2L / 1.2 lac
  { re: /(?:₹|rs\.?|inr)?\s*(\d+(?:\.\d+)?)\s*(?:l\b|lac|lakh|lakhs|लाख)/i, mult: 100_000, capture: 1 },
  // 12k / 12K / 12 thousand
  { re: /(?:₹|rs\.?|inr)?\s*(\d+(?:\.\d+)?)\s*(?:k\b|thousand|हजार)/i, mult: 1_000, capture: 1 },
  // Plain ₹12,000 or Rs 12000 or 12000 in a budget context (handled with label proximity)
  { re: /(?:₹|rs\.?|inr)\s*([\d,]+(?:\.\d+)?)/i, mult: 1, capture: 1 },
];

// Pure number that LOOKS like a budget (4-7 digits, optional commas)
export const BUDGET_PLAIN_NUMBER = /\b([1-9]\d{3,6}(?:,\d{3})*)\b/g;

// Bangalore-first locality lexicon (extend per city). 220 base entries × variants.
export const LOCALITIES_BANGALORE: string[] = [
  "Koramangala", "Indiranagar", "HSR Layout", "BTM Layout", "BTM", "Marathahalli",
  "Whitefield", "Bellandur", "Sarjapur", "Sarjapur Road", "Electronic City",
  "Electronics City", "Jayanagar", "JP Nagar", "Banashankari", "Basavanagudi",
  "Malleshwaram", "Rajajinagar", "Hebbal", "Yelahanka", "RT Nagar", "Frazer Town",
  "Cox Town", "Richmond Town", "MG Road", "Brigade Road", "Commercial Street",
  "Ulsoor", "Domlur", "CV Raman Nagar", "Old Airport Road", "Kalyan Nagar",
  "Kammanahalli", "HRBR Layout", "Kasturi Nagar", "Hennur", "Nagavara",
  "Manyata Tech Park", "Hoodi", "ITPL", "Brookefield", "Kundalahalli",
  "AECS Layout", "Kadugodi", "Varthur", "Panathur", "Doddanekundi", "Mahadevapura",
  "KR Puram", "Tin Factory", "Banaswadi", "Lingarajapuram", "Kalkere",
  "Horamavu", "Ramamurthy Nagar", "Kalyan Nagar", "Kaggadasapura",
  "Murugeshpalya", "HAL", "New Thippasandra", "Vibhutipura",
  "Bommanahalli", "Hongasandra", "Begur", "Arekere", "Hulimavu", "Bannerghatta",
  "Bannerghatta Road", "Gottigere", "DLF", "Kothanur", "Doddakallasandra",
  "Padmanabhanagar", "Uttarahalli", "Vijayanagar", "Magadi Road", "Nagarbhavi",
  "Kengeri", "RR Nagar", "Rajarajeshwari Nagar", "Mysore Road", "Banashankari Stage 2",
  "Banashankari Stage 3", "Girinagar", "Sadashivanagar", "Vasanth Nagar",
  "Cunningham Road", "Lavelle Road", "Ashok Nagar", "Shivajinagar",
  "Cantonment", "Benson Town", "HBR Layout", "Babusapalya", "Thanisandra",
  "Jakkur", "Yelahanka New Town", "Vidyaranyapura", "Sanjaynagar",
  "Mathikere", "Yeshwanthpur", "Peenya", "Nelamangala", "Devanahalli",
  "Sahakara Nagar", "Amruthahalli", "Jalahalli", "Kodigehalli", "Kanakapura Road",
  "Talaghattapura", "Vajarahalli", "Anjanapura", "Jigani", "Attibele",
  "Hosa Road", "Hosur Road", "Silk Board", "Madiwala", "Adugodi",
  "Audugodi", "Wilson Garden", "Lalbagh", "Kalasipalyam", "Chamrajpet",
  "Chickpet", "Avenue Road", "KR Market",
];

export const LOCALITIES_OTHER_CITIES: string[] = [
  // Hyderabad
  "Gachibowli", "HITEC City", "Madhapur", "Kondapur", "Jubilee Hills", "Banjara Hills",
  "Kukatpally", "Miyapur", "Begumpet", "Ameerpet", "Manikonda", "Nallagandla",
  // Pune
  "Hinjewadi", "Wakad", "Baner", "Kothrud", "Hadapsar", "Magarpatta", "Kharadi",
  "Viman Nagar", "Aundh", "Pimple Saudagar", "Pimpri", "Chinchwad",
  // Mumbai
  "Andheri", "Bandra", "Powai", "Goregaon", "Malad", "Borivali", "Thane", "Vashi",
  // Delhi NCR
  "Gurgaon", "Gurugram", "Noida", "Greater Noida", "Dwarka", "Rohini",
  // Chennai
  "OMR", "Velachery", "T Nagar", "Adyar", "Anna Nagar", "Porur", "Tambaram",
];

export const ALL_LOCALITIES = [...LOCALITIES_BANGALORE, ...LOCALITIES_OTHER_CITIES];

// Intent / urgency words
export const INTENT_WORDS: Record<"hot" | "warm" | "cold", string[]> = {
  hot: [
    "urgent", "asap", "immediately", "today", "tomorrow", "this week", "ready to move",
    "ready", "ready to book", "book now", "decided", "finalised", "finalized",
    "high intent", "very interested", "serious", "very serious", "hot lead",
    "जल्दी", "तुरंत", "अभी", "abhi", "jaldi", "turant",
  ],
  warm: [
    "next week", "soon", "this month", "exploring", "considering", "interested",
    "looking", "checking", "comparing", "thinking", "may book",
    "जल्द", "जल्दी से", "thoda time",
  ],
  cold: [
    "next month", "later", "future", "not sure", "maybe", "browsing", "just looking",
    "no urgency", "casual", "no rush", "cold", "low intent",
    "बाद में", "future me", "abhi nahi",
  ],
};

// Source detection - strings that indicate where the lead came from
export const SOURCE_HINTS: { re: RegExp; source: string }[] = [
  { re: /\bwhats?app\b|\bwa\b/i, source: "whatsapp" },
  { re: /\b99\s*acres?\b/i, source: "99acres" },
  { re: /\bhousing\.?(com)?\b/i, source: "housing.com" },
  { re: /\bmagic\s*bricks?\b|\bmb\b/i, source: "magicbricks" },
  { re: /\bno\s*broker\b/i, source: "nobroker" },
  { re: /\bolx\b/i, source: "olx" },
  { re: /\bquikr\b/i, source: "quikr" },
  { re: /\bfacebook\b|\bfb\b|\bmeta\b/i, source: "facebook" },
  { re: /\binstagram\b|\big\b/i, source: "instagram" },
  { re: /\bgoogle\b|\bgads\b/i, source: "google" },
  { re: /\breferr?al\b|\brefer\b/i, source: "referral" },
  { re: /\bwalkin\b|\bwalk[\s\-]in\b/i, source: "walk-in" },
  { re: /\bcall\b/i, source: "call" },
];

// Time / move-in expressions → days from now
export const MOVE_IN_HINTS: { re: RegExp; daysFromNow: number | "parse" }[] = [
  { re: /\btoday\b|\baaj\b/i, daysFromNow: 0 },
  { re: /\btomorrow\b|\bkal\b/i, daysFromNow: 1 },
  { re: /\bday after tomorrow\b|\bparson\b/i, daysFromNow: 2 },
  { re: /\bthis week\b/i, daysFromNow: 5 },
  { re: /\bnext week\b/i, daysFromNow: 10 },
  { re: /\bthis month\b/i, daysFromNow: 15 },
  { re: /\bnext month\b/i, daysFromNow: 35 },
  { re: /\bin\s+(\d+)\s+days?\b/i, daysFromNow: "parse" },
  { re: /\bin\s+(\d+)\s+weeks?\b/i, daysFromNow: "parse" },
  { re: /\bin\s+(\d+)\s+months?\b/i, daysFromNow: "parse" },
  { re: /\bASAP\b/i, daysFromNow: 0 },
  { re: /\bimmediate(?:ly)?\b/i, daysFromNow: 0 },
];

// Common Indian first names - used to disambiguate "name" when no label is present
// (compact base, generator expands)
export const COMMON_NAMES: string[] = [
  "Aarav","Aditya","Akash","Amit","Anil","Anand","Arjun","Ashish","Ayush","Bharat",
  "Chirag","Deepak","Dhruv","Gaurav","Harsh","Ishaan","Jay","Karan","Krishna",
  "Lakshay","Manish","Mohit","Naveen","Nikhil","Nitin","Pranav","Pratik","Rahul",
  "Raj","Rajesh","Rakesh","Ramesh","Ravi","Rohan","Rohit","Sachin","Sahil","Sandeep",
  "Sanjay","Saurabh","Shiv","Shubham","Siddharth","Sumit","Suresh","Tarun","Tushar",
  "Varun","Vikas","Vinay","Vivek","Yash","Yogesh",
  "Aanya","Aditi","Aisha","Akanksha","Ananya","Anjali","Anushka","Aparna","Bhavana",
  "Deepika","Divya","Ekta","Gauri","Isha","Jyoti","Kavita","Kiran","Komal","Kriti",
  "Lakshmi","Madhuri","Manisha","Meera","Megha","Mona","Neha","Nisha","Pooja",
  "Pratima","Priya","Priyanka","Radhika","Rashmi","Renu","Riya","Roshni","Sakshi",
  "Sangeeta","Sapna","Saritha","Shilpa","Shreya","Simran","Smita","Snehal","Sonali",
  "Sonia","Sudha","Sushma","Swati","Tanvi","Tina","Usha","Vandana","Vidya",
  // Common surnames (helpful for full-name detection)
  "Sharma","Gupta","Verma","Singh","Kumar","Patel","Mehta","Shah","Joshi","Reddy",
  "Naidu","Iyer","Nair","Menon","Pillai","Rao","Das","Banerjee","Mukherjee","Chatterjee",
  "Khan","Ahmed","Ali","Hussain","Sheikh","Pathak","Mishra","Tiwari","Yadav","Jain",
  "Agarwal","Aggarwal","Bansal","Chopra","Kapoor","Malhotra","Saxena","Sinha","Trivedi",
];
