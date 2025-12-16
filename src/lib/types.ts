export interface Vehicle {
  id: string;
  title: string;
  brand: string;
  description: string;
  detailedDescription: string;
  price: number;
  productionYear: number;
  engineType: string;
  fuelType: string;
  images: string[];
  image_data?: { id: number; image: string | null; image_url: string | null; is_primary: boolean }[];
  custom_title?: string;
  reviews?: Review[];
}

export interface Review {
  id: string;
  userId: string;
  userName: string;
  rating: number;
  comment: string;
  date: string;
}

export interface User {
  id: string;
  name: string;
  email: string;
  favorites: string[];
  isAdmin: boolean;
}

export interface SearchAnalytics {
  query: string;
  count: number;
  date: string;
}

export interface Feature {
  id: string;
  emoji: string;
  titleEn: string;
  titleTr: string;
  descriptionEn: string;
  descriptionTr: string;
}

export type Theme = 'light' | 'dark' | 'elite';
