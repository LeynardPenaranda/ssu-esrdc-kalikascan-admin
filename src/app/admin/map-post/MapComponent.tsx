"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { MapPost } from "./types";

interface MapComponentProps {
  posts: MapPost[];
  onPostClick: (post: MapPost) => void;
}

export default function MapComponent({
  posts,
  onPostClick,
}: MapComponentProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<L.Map | null>(null);
  const [currentLocation, setCurrentLocation] = useState<
    [number, number] | null
  >(null);
  const [locationLoading, setLocationLoading] = useState(true);

  const validPosts = useMemo(() => {
    return posts.filter((post) => {
      const lat = post.location?.latitude ?? post.latitude;
      const lon = post.location?.longitude ?? post.longitude;
      return typeof lat === "number" && typeof lon === "number";
    });
  }, [posts]);

  const center: [number, number] = useMemo(() => {
    if (currentLocation) return currentLocation;
    if (validPosts.length === 0) return [0, 0];

    const avgLat =
      validPosts.reduce((sum, p) => {
        const lat = p.location?.latitude ?? p.latitude ?? 0;
        return sum + lat;
      }, 0) / validPosts.length;

    const avgLon =
      validPosts.reduce((sum, p) => {
        const lon = p.location?.longitude ?? p.longitude ?? 0;
        return sum + lon;
      }, 0) / validPosts.length;

    return [avgLat, avgLon];
  }, [validPosts, currentLocation]);

  useEffect(() => {
    if (navigator.geolocation) {
      setLocationLoading(true);
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const { latitude, longitude } = position.coords;
          setCurrentLocation([latitude, longitude]);
          setLocationLoading(false);
        },
        (error) => {
          console.warn("Could not get current location:", error);
          setLocationLoading(false);
        },
        { enableHighAccuracy: true, timeout: 10000 },
      );
    } else {
      setLocationLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!containerRef.current || locationLoading) return;

    if (mapRef.current) {
      mapRef.current.remove();
      mapRef.current = null;
    }

    delete (L.Icon.Default.prototype as any)._getIconUrl;
    L.Icon.Default.mergeOptions({
      iconRetinaUrl:
        "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png",
      iconUrl:
        "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png",
      shadowUrl:
        "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png",
    });

    const map = L.map(containerRef.current).setView(center, 13);
    mapRef.current = map;

    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution:
        '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    }).addTo(map);

    return () => {
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
    };
  }, [center, locationLoading]);

  // Separate effect for markers to prevent map recreation
  useEffect(() => {
    if (!mapRef.current || locationLoading) return;

    // Clear existing markers
    mapRef.current.eachLayer((layer) => {
      if (layer instanceof L.Marker) {
        mapRef.current!.removeLayer(layer);
      }
    });

    // Create green marker icon
    const greenIcon = L.icon({
      iconUrl:
        "https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-green.png",
      shadowUrl:
        "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png",
      iconSize: [25, 41],
      iconAnchor: [12, 41],
      popupAnchor: [1, -34],
      shadowSize: [41, 41],
    });

    validPosts.forEach((post) => {
      const lat = post.location?.latitude ?? post.latitude ?? 0;
      const lon = post.location?.longitude ?? post.longitude ?? 0;

      const marker = L.marker([lat, lon], { icon: greenIcon }).addTo(
        mapRef.current!,
      );
      marker.on("click", () => onPostClick(post));
    });
  }, [validPosts, onPostClick, locationLoading]);

  useEffect(() => {
    if (mapRef.current && currentLocation) {
      mapRef.current.setView(currentLocation, 13);
    }
  }, [currentLocation]);

  if (locationLoading) {
    return (
      <div className="flex flex-col justify-center items-center h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-600 mb-4"></div>
        <p className="text-gray-600">Getting your current location...</p>
      </div>
    );
  }

  if (validPosts.length === 0) {
    return (
      <div className="flex justify-center items-center h-screen">
        No map posts found
      </div>
    );
  }

  return <div ref={containerRef} className="h-screen w-full" />;
}
