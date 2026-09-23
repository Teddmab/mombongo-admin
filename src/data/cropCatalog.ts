/**
 * Mirrors mombongo-web's src/data/cultures.ts (CROP_CATALOG) so an
 * admin-entered culture uses the same commodity names, icons and default
 * yields a farmer would see self-servicing the same form. Kept as a
 * separate copy rather than a cross-repo import, matching how this repo
 * already keeps its own copy of shared enums (see EditExploitationModal's
 * DRC_PROVINCES in mombongo-web).
 */
export const CROP_CATALOG = [
  { commodity: "Maïs", icon: "🌽", defaultYield: { traditionnel: 800, "semi-intensif": 2000, intensif: 4500 } },
  { commodity: "Manioc", icon: "🍠", defaultYield: { traditionnel: 6000, "semi-intensif": 12000, intensif: 20000 } },
  { commodity: "Haricot", icon: "🫘", defaultYield: { traditionnel: 400, "semi-intensif": 800, intensif: 1500 } },
  { commodity: "Riz", icon: "🍚", defaultYield: { traditionnel: 1200, "semi-intensif": 2500, intensif: 5000 } },
  { commodity: "Cacao", icon: "🍫", defaultYield: { traditionnel: 300, "semi-intensif": 700, intensif: 1200 } },
  { commodity: "Café", icon: "☕", defaultYield: { traditionnel: 400, "semi-intensif": 800, intensif: 1500 } },
  { commodity: "Tomates", icon: "🍅", defaultYield: { traditionnel: 8000, "semi-intensif": 20000, intensif: 40000 } },
  { commodity: "Arachides", icon: "🥜", defaultYield: { traditionnel: 600, "semi-intensif": 1200, intensif: 2000 } },
  { commodity: "Sorgho", icon: "🌿", defaultYield: { traditionnel: 700, "semi-intensif": 1500, intensif: 3000 } },
  { commodity: "Soja", icon: "🫛", defaultYield: { traditionnel: 800, "semi-intensif": 1500, intensif: 2500 } },
  { commodity: "Oignons", icon: "🧅", defaultYield: { traditionnel: 5000, "semi-intensif": 12000, intensif: 25000 } },
] as const;

export type Methode = "traditionnel" | "semi-intensif" | "intensif";
export type CropKey = typeof CROP_CATALOG[number]["commodity"];

export const DRC_PROVINCES = [
  "Kinshasa", "Kongo Central", "Kwango", "Kwilu", "Mai-Ndombe", "Kasaï", "Kasaï-Central",
  "Kasaï-Oriental", "Lomami", "Sankuru", "Maniema", "Sud-Kivu", "Nord-Kivu", "Ituri",
  "Haut-Uele", "Tshopo", "Bas-Uele", "Nord-Ubangi", "Mongala", "Sud-Ubangi", "Équateur",
  "Tshuapa", "Tanganyika", "Haut-Lomami", "Lualaba", "Haut-Katanga",
] as const;

export const MOBILE_MONEY_OPERATORS = [
  { value: "mpesa", label: "M-Pesa (Vodacom)" },
  { value: "airtel", label: "Airtel Money" },
  { value: "orange", label: "Orange Money" },
] as const;
