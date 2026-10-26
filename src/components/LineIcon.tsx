import type { LucideIcon } from "lucide-react";
import {
  Accessibility, AirVent, Anchor, Armchair, Baby, BadgeCheck, Banknote, Bath, BedDouble, Bike, Binoculars,
  BroomSparkles, Bus, Cake, CalendarCheck, Camera, Car, CarFront, Cctv, ChefHat, Clock, Coffee, Compass,
  ConciergeBell, CookingPot, CreditCard, Croissant, Dog, Drama, Dumbbell, EighthNotes, Eye, Fan, Fish,
  FishingRod, Flame, Flower2, Footprints, Fuel, Gem, Gift, GlassWater, Globe, HandHeart, Hamburger, Heart,
  House, IceCreamCone, Key, Lamp, Landmark, Languages, Leaf, LifeBuoy, Lock, Mail, Map, MapPin, Martini,
  Maximize, MessageCircle, Mountain, Navigation, PartyPopper, PersonStanding, Phone, Pill, Plane, Refrigerator,
  Route, Ruler, Sailboat, Salad, Shell, Ship, ShieldCheck, Shirt, ShoppingCart, ShowerHead, Sofa, Sparkles,
  Snowflake, Speaker, SquareParking, Star, Store, Sun, Sunrise, Sunset, Tag, Tent, Thermometer, Ticket, TreePalm, Tv,
  Umbrella, Users, Utensils, UtensilsCrossed, Vault, Volleyball, WashingMachine, WavesHorizontal, WavesLadder,
  Wifi, Wind, Wine,
} from "lucide-react";

/**
 * The site's line icons: thin, single colour, drawn in the accent gold by
 * default. Content stored in the database (amenities, key facts, concierge
 * activities…) names an icon by its key here, so the admin can pick another
 * one without touching the code. The French label is what the admin's picker
 * shows and searches.
 */
export const ICONS: Record<string, [LucideIcon, string]> = {
  // the villa
  house: [House, "Maison"],
  bed: [BedDouble, "Lit"],
  bath: [Bath, "Baignoire"],
  shower: [ShowerHead, "Douche"],
  users: [Users, "Personnes"],
  size: [Maximize, "Surface"],
  ruler: [Ruler, "Mètre"],
  pool: [WavesLadder, "Piscine"],
  waves: [WavesHorizontal, "Vagues"],
  sunset: [Sunset, "Coucher de soleil"],
  sunrise: [Sunrise, "Lever de soleil"],
  sun: [Sun, "Soleil"],
  view: [Eye, "Vue"],
  binoculars: [Binoculars, "Jumelles"],
  wifi: [Wifi, "Wi-Fi"],
  ac: [AirVent, "Climatisation"],
  snowflake: [Snowflake, "Flocon"],
  fan: [Fan, "Ventilateur"],
  thermometer: [Thermometer, "Température"],
  kitchen: [ChefHat, "Toque de chef"],
  pot: [CookingPot, "Cuisine"],
  fridge: [Refrigerator, "Réfrigérateur"],
  washer: [WashingMachine, "Lave-linge"],
  speaker: [Speaker, "Enceinte"],
  music: [EighthNotes, "Musique"],
  tv: [Tv, "Télévision"],
  bbq: [Flame, "Barbecue / feu"],
  parking: [SquareParking, "Parking"],
  car: [CarFront, "Voiture"],
  carSide: [Car, "Voiture (profil)"],
  safe: [Vault, "Coffre-fort"],
  lock: [Lock, "Cadenas"],
  key: [Key, "Clé"],
  cctv: [Cctv, "Caméra de sécurité"],
  shield: [ShieldCheck, "Sécurité"],
  concierge: [ConciergeBell, "Conciergerie"],
  housekeeping: [BroomSparkles, "Ménage"],
  sparkles: [Sparkles, "Étincelles"],
  linens: [Shirt, "Linge"],
  sofa: [Sofa, "Canapé"],
  armchair: [Armchair, "Fauteuil"],
  lamp: [Lamp, "Lampe"],
  baby: [Baby, "Bébé"],
  accessibility: [Accessibility, "Accessibilité"],
  dog: [Dog, "Animaux"],
  // the island
  pin: [MapPin, "Lieu"],
  map: [Map, "Carte"],
  compass: [Compass, "Boussole"],
  navigation: [Navigation, "Itinéraire"],
  route: [Route, "Route"],
  plane: [Plane, "Avion"],
  ship: [Ship, "Ferry / bateau"],
  sailboat: [Sailboat, "Voilier"],
  anchor: [Anchor, "Port"],
  bus: [Bus, "Navette"],
  bike: [Bike, "Vélo"],
  fuel: [Fuel, "Station-service"],
  beach: [Umbrella, "Plage (parasol)"],
  palm: [TreePalm, "Palmier"],
  shell: [Shell, "Coquillage"],
  mountain: [Mountain, "Randonnée / colline"],
  leaf: [Leaf, "Nature"],
  flower: [Flower2, "Fleur"],
  wind: [Wind, "Vent"],
  landmark: [Landmark, "Monument"],
  camera: [Camera, "Photo"],
  store: [Store, "Boutique"],
  cart: [ShoppingCart, "Supermarché"],
  pharmacy: [Pill, "Pharmacie"],
  lifebuoy: [LifeBuoy, "Bouée / secours"],
  // food & drink
  restaurant: [UtensilsCrossed, "Restaurant"],
  utensils: [Utensils, "Couverts"],
  chef: [ChefHat, "Chef"],
  bakery: [Croissant, "Boulangerie"],
  coffee: [Coffee, "Café"],
  wine: [Wine, "Vin"],
  cocktail: [Martini, "Cocktail"],
  snack: [Hamburger, "Snack"],
  salad: [Salad, "Salade"],
  icecream: [IceCreamCone, "Glace"],
  cake: [Cake, "Gâteau"],
  water: [GlassWater, "Eau"],
  // activities
  diving: [WavesLadder, "Plongée"],
  snorkel: [Fish, "Snorkeling / poisson"],
  fishing: [FishingRod, "Pêche"],
  jetski: [WavesHorizontal, "Jet ski"],
  hiking: [Footprints, "Randonnée"],
  yoga: [PersonStanding, "Yoga"],
  massage: [HandHeart, "Massage / bien-être"],
  gym: [Dumbbell, "Sport / coach"],
  tennis: [Volleyball, "Tennis / ballon"],
  party: [PartyPopper, "Fête"],
  show: [Drama, "Spectacle"],
  tent: [Tent, "Camping"],
  // booking & contact
  calendar: [CalendarCheck, "Calendrier"],
  price: [Banknote, "Prix"],
  tag: [Tag, "Étiquette"],
  card: [CreditCard, "Carte bancaire"],
  gift: [Gift, "Cadeau"],
  ticket: [Ticket, "Billet"],
  badge: [BadgeCheck, "Inclus / vérifié"],
  star: [Star, "Étoile"],
  heart: [Heart, "Cœur"],
  gem: [Gem, "Luxe"],
  phone: [Phone, "Téléphone"],
  message: [MessageCircle, "Message"],
  mail: [Mail, "Email"],
  clock: [Clock, "Horaires"],
  languages: [Languages, "Langues"],
  globe: [Globe, "Monde"],
};

/**
 * Emojis the database held before the line icons (concierge activities and
 * categories), drawn as their nearest line icon until the admin picks one.
 */
const EMOJI: Record<string, string> = {
  "🤿": "diving", "🐠": "snorkel", "🌊": "jetski", "🚤": "jetski", "🥾": "hiking", "🧘": "yoga", "💆": "massage",
  "🛶": "sailboat", "🏄": "waves", "🎣": "fishing", "🏋️": "gym", "🏋": "gym", "🎾": "tennis", "⛵": "sailboat",
  "🛥️": "ship", "🛥": "ship", "🍽️": "restaurant", "🍽": "restaurant", "👨‍🍳": "chef", "🚗": "car", "🚕": "car",
  "✈️": "plane", "✈": "plane", "🏖️": "beach", "🏖": "beach", "🛎️": "concierge", "🛎": "concierge", "🍷": "wine",
  "🍸": "cocktail", "🌅": "sunset", "📍": "pin", "🏠": "house", "🎉": "party", "💐": "flower", "🧹": "housekeeping",
};

/** The icon a stored value names: a key above, a legacy emoji, or nothing. */
export function iconFor(value: string | null | undefined): LucideIcon | null {
  if (!value) return null;
  const key = ICONS[value] ? value : EMOJI[value.trim()];
  return key ? ICONS[key][0] : null;
}

export function LineIcon({
  name,
  className = "h-5 w-5 text-gold",
  strokeWidth = 1.25,
}: {
  name: string | null | undefined;
  className?: string;
  strokeWidth?: number;
}) {
  const Icon = iconFor(name);
  if (Icon) return <Icon aria-hidden className={`shrink-0 ${className}`} strokeWidth={strokeWidth} />;
  // anything else typed in the admin (an emoji…) shows as it is
  return name ? <span aria-hidden>{name}</span> : null;
}
