import { Vehicle, SearchAnalytics, Feature } from './types';

const API_BASE_URL = 'https://avdsback2.pythonanywhere.com/api';
const BASE_URL = 'https://avdsback2.pythonanywhere.com/';

const getFullImageUrl = (url: string) => {
  if (!url) return '';
  if (url.startsWith('http') || url.startsWith('blob:')) return url;
  return `${BASE_URL}${url}`;
};

export interface VehicleFilters {
  brand?: string;
  engineType?: string;
  fuelType?: string;
  minPrice?: number;
  maxPrice?: number;
  minYear?: number;
  maxYear?: number;
  q?: string;
  sortBy?: 'views' | 'price_asc' | 'price_desc' | 'year_desc';
}

const mapVehicleData = (v: any): Vehicle => {
  const basePrice = 20000;
  const yearFactor = (v.year - 1990) * 500;
  const engineFactor = (v.engine_cc || 2000) * 5;
  const estimatedPrice = basePrice + yearFactor + engineFactor;

  return {
    id: v.id.toString(),
    title: v.vehicle_display_name || `Vehicle ${v.id}`,
    brand: v.make_name,
    detailedDescription: `Engine: ${v.engine} (${v.engine_cc}cc, ${v.engine_cylinders} cyl)`,
    price: estimatedPrice > 0 ? estimatedPrice : 25000,
    productionYear: v.year,
    engineType: v.engine,
    fuelType: v.fuel_type_id ? v.fuel_type_id.toString() : 'Unknown',
    images: v.images && v.images.length > 0 ? v.images.map(getFullImageUrl) : [
      (() => {
        const isClassic = v.year < 1990;
        const cleanModel = (v.model_name || '').replace(/Base|Edition|Package|Sport|Premium|Limited|Touring/g, '');
        const keywords = ['car', isClassic ? 'classic' : '', v.make_name, cleanModel]
          .filter(Boolean)
          .join(',')
          .replace(/ /g, ',');
        return `https://loremflickr.com/640/480/${keywords}/all?lock=${v.id}`;
      })()
    ],
    reviews: v.reviews ? v.reviews.map((r: any) => ({
      id: r.id,
      userId: r.user_id.toString(),
      userName: r.user,
      rating: r.rating,
      comment: r.comment,
      date: new Date(r.created_at).toLocaleDateString()
    })) : [],
    description: v.description, // From metadata
    custom_title: v.custom_title, // From metadata
    image_data: v.image_data ? v.image_data.map((img: any) => ({
      ...img,
      image: getFullImageUrl(img.image)
    })) : undefined // From serializer
  };
};

export const api = {
  async getVehicles(filters: VehicleFilters = {}): Promise<Vehicle[]> {
    const params = new URLSearchParams();
    if (filters.brand) params.append('make_name', filters.brand);
    if (filters.engineType) params.append('engine', filters.engineType);
    if (filters.minYear) params.append('min_year', filters.minYear.toString());
    if (filters.maxYear) params.append('max_year', filters.maxYear.toString());
    if (filters.minPrice) params.append('min_price', filters.minPrice.toString());
    if (filters.maxPrice) params.append('max_price', filters.maxPrice.toString());
    if (filters.q) params.append('q', filters.q);
    if (filters.sortBy) params.append('sort_by', filters.sortBy);

    const response = await fetch(`${API_BASE_URL}/vehicles/?${params.toString()}`);
    if (!response.ok) {
      throw new Error('Failed to fetch vehicles');
    }
    const data = await response.json();
    const results = data.results || data;

    return results.map(mapVehicleData);
  },

  async getMostViewedVehicles(limit: number = 4): Promise<Vehicle[]> {
    const vehicles = await this.getVehicles({ sortBy: 'views' });
    return vehicles.slice(0, limit);
  },

  async getLatestVehicles(limit: number = 6): Promise<Vehicle[]> {
    const vehicles = await this.getVehicles({ sortBy: 'year_desc' });
    return vehicles.slice(0, limit);
  },

  async getVehicle(id: string): Promise<Vehicle> {
    const response = await fetch(`${API_BASE_URL}/vehicles/${id}/`);
    if (!response.ok) {
      throw new Error('Failed to fetch vehicle');
    }
    const v = await response.json();

    return mapVehicleData(v);
  },

  async searchVehicles(query: string): Promise<Vehicle[]> {
    const response = await fetch(`${API_BASE_URL}/vehicles/`);
    if (!response.ok) {
      throw new Error('Failed to search vehicles');
    }
    const data = await response.json();
    const results = data.results || data;
    const lowerQuery = query.toLowerCase();

    return results.filter((v: any) =>
      (v.vehicle_display_name && v.vehicle_display_name.toLowerCase().includes(lowerQuery)) ||
      (v.make_name && v.make_name.toLowerCase().includes(lowerQuery)) ||
      (v.model_name && v.model_name.toLowerCase().includes(lowerQuery))
    ).map(mapVehicleData);
  },

  async getDailyAnalytics(): Promise<SearchAnalytics[]> {
    return []; // Mock
  },

  async getMonthlyAnalytics(): Promise<SearchAnalytics[]> {
    return []; // Mock
  },

  async login(email: string, password: string) {
    const response = await fetch(`${API_BASE_URL}/token/`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: email, password }),
    });
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.detail || 'Login failed');
    }
    return response.json(); // Returns { access, refresh }
  },

  async refreshToken(refresh: string) {
    const response = await fetch(`${API_BASE_URL}/token/refresh/`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refresh }),
    });
    if (!response.ok) {
      throw new Error('Failed to refresh token');
    }
    return response.json(); // Returns { access }
  },

  async register(name: string, email: string, password: string) {
    const response = await fetch(`${API_BASE_URL}/register/`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: name, email, password, first_name: name }),
    });
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      let errorMessage = 'Registration failed';
      if (errorData) {
        // Handle DRF error format: { field: ["error"] }
        const messages = Object.entries(errorData).map(([key, val]) => {
           if (Array.isArray(val)) return `${key}: ${val.join(', ')}`;
           return `${key}: ${val}`;
        });
        if (messages.length > 0) {
          errorMessage = messages.join('\n');
        }
      }
      throw new Error(errorMessage);
    }
    // Auto login after register
    return this.login(name, password);
  },

  async me(token: string) {
    const response = await fetch(`${API_BASE_URL}/me/`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    if (!response.ok) throw new Error('Failed to fetch user');
    return response.json();
  },

  async deleteAccount() {
    const token = localStorage.getItem('access_token');
    const response = await fetch(`${API_BASE_URL}/me/`, {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${token}`,
      },
    });

    if (!response.ok) {
      throw new Error('Failed to delete account');
    }
  },

  async chat(message: string, context: any = {}, history: any[] = []) {
    const response = await fetch(`${API_BASE_URL}/chat/`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ message, context, history }),
    });

    if (!response.ok) {
      throw new Error('Failed to send message');
    }

    return response.json();
  },

  async toggleFavorite(vehicleId: string) {
    const token = localStorage.getItem('access_token');
    const response = await fetch(`${API_BASE_URL}/favorites/`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({ vehicle_id: vehicleId }),
    });
    if (!response.ok) throw new Error('Failed to toggle favorite');
    return response.json();
  },

  async getFavorites(): Promise<Vehicle[]> {
    const token = localStorage.getItem('access_token');
    const response = await fetch(`${API_BASE_URL}/favorites/`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    if (!response.ok) throw new Error('Failed to fetch favorites');
    const data = await response.json();
    return data.map(mapVehicleData);
  },

  async addReview(vehicleId: string, rating: number, comment: string) {
    const token = localStorage.getItem('access_token');
    const response = await fetch(`${API_BASE_URL}/reviews/`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({ vehicle_id: vehicleId, rating, comment }),
    });
    if (!response.ok) throw new Error('Failed to add review');
    return response.json();
  },

  async deleteReview(reviewId: string) {
    const token = localStorage.getItem('access_token');
    const response = await fetch(`${API_BASE_URL}/reviews/${reviewId}/`, {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${token}`,
      },
    });

    if (!response.ok) {
      throw new Error('Failed to delete review');
    }
  },

  async updateVehicle(id: string, data: { description?: string; custom_title?: string }) {
    const token = localStorage.getItem('access_token');
    const response = await fetch(`${API_BASE_URL}/vehicles/${id}/update/`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify(data),
    });

    if (!response.ok) {
      throw new Error('Failed to update vehicle');
    }
    const v = await response.json();
    return mapVehicleData(v);
  },

  async uploadVehicleImage(id: string, file: File) {
    const token = localStorage.getItem('access_token');
    const formData = new FormData();
    formData.append('image', file);

    const response = await fetch(`${API_BASE_URL}/vehicles/${id}/images/`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
      },
      body: formData,
    });

    if (!response.ok) {
      throw new Error('Failed to upload image');
    }
    return response.json();
  },

  async deleteVehicleImage(imageId: number) {
    const token = localStorage.getItem('access_token');
    const response = await fetch(`${API_BASE_URL}/images/${imageId}/`, {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${token}`,
      },
    });

    if (!response.ok) {
      throw new Error('Failed to delete image');
    }
  },

  async getAdminStats() {
    const token = localStorage.getItem('access_token');
    const response = await fetch(`${API_BASE_URL}/admin/stats/`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Failed to fetch admin stats: ${response.status} ${response.statusText} - ${errorText}`);
    }
    return response.json();
  },

  async uploadVehicles(file: File) {
    const token = localStorage.getItem('access_token');
    const formData = new FormData();
    formData.append('file', file);

    const response = await fetch(`${API_BASE_URL}/admin/upload-vehicles/`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${token}` },
      body: formData
    });
    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || 'Failed to upload vehicles');
    }
    return response.json();
  },

  async getUploadTemplate() {
    const token = localStorage.getItem('access_token');
    const response = await fetch(`${API_BASE_URL}/admin/upload-template/`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    if (!response.ok) throw new Error('Failed to download template');
    return response.blob();
  },

  async getFeatures(): Promise<Feature[]> {
    const token = localStorage.getItem('access_token');
    const response = await fetch(`${API_BASE_URL}/admin/features/`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    if (!response.ok) throw new Error('Failed to fetch features');
    // Map backend fields to frontend interface if needed, or ensure backend matches
    // Backend: title_en, title_tr, etc. Frontend: titleEn, titleTr
    const data = await response.json();
    return data.map((f: any) => ({
      id: f.id.toString(),
      emoji: f.emoji,
      titleEn: f.title_en,
      titleTr: f.title_tr,
        titleAr: f.title_ar,
      descriptionEn: f.description_en,
      descriptionTr: f.description_tr,
        descriptionAr: f.description_ar
    }));
  },

  async updateFeatures(features: Feature[]) {
    const token = localStorage.getItem('access_token');
    // Map frontend to backend
    const backendFeatures = features.map(f => ({
      emoji: f.emoji,
      title_en: f.titleEn,
      title_tr: f.titleTr,
        title_ar: f.titleAr,
      description_en: f.descriptionEn,
      description_tr: f.descriptionTr,
        description_ar: f.descriptionAr
    }));

    const response = await fetch(`${API_BASE_URL}/admin/features/`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify(backendFeatures)
    });
    if (!response.ok) throw new Error('Failed to update features');
    return response.json();
  },

  requestPasswordReset: async (email: string) => {
    const response = await fetch(`${API_BASE_URL}/password-reset/`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email })
    });
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to request password reset');
    }
    return response.json();
  },

  confirmPasswordReset: async (uidb64: string, token: string, password: string) => {
    const response = await fetch(`${API_BASE_URL}/password-reset/confirm/`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ uidb64, token, password })
    });
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to reset password');
    }
    return response.json();
  }
};
