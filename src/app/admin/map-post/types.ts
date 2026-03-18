export interface MapPost {
  id: string;
  location?: {
    latitude: number;
    longitude: number;
  };
  latitude?: number;
  longitude?: number;
  description?: string;
  caption?: string;
  user?: {
    displayName?: string;
    username?: string;
    email?: string;
  };
  createdAtLocal?: number;
}
