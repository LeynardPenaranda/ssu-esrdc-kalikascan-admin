"use client";

import { useCallback, useEffect, useState } from "react";
import dynamic from "next/dynamic";
import "leaflet/dist/leaflet.css";
import { MapPost } from "./types";
import MapPostDetailsModal from "@/src/components/modals/MapPostDetailsModal";

const MapComponent = dynamic(() => import("./MapComponent"), {
  ssr: false,
  loading: () => (
    <div className="flex justify-center items-center h-screen">
      Loading map...
    </div>
  ),
});

export default function MapPostPage() {
  const [posts, setPosts] = useState<MapPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedPost, setSelectedPost] = useState<MapPost | null>(null);
  const [modalOpen, setModalOpen] = useState(false);

  useEffect(() => {
    const fetchPosts = async () => {
      try {
        const res = await fetch("/api/admin/map-posts");
        const data = await res.json();
        setPosts(data.posts || []);
      } catch (error) {
        console.error("Failed to fetch map posts:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchPosts();
  }, []);

  const handlePostClick = useCallback((post: MapPost) => {
    setSelectedPost(post);
    setModalOpen(true);
  }, []);

  const handleCloseModal = useCallback(() => {
    setModalOpen(false);
    setSelectedPost(null);
  }, []);

  if (loading) {
    return (
      <div className="flex justify-center items-center h-screen">
        Loading map...
      </div>
    );
  }

  return (
    <>
      <MapComponent posts={posts} onPostClick={handlePostClick} />
      <MapPostDetailsModal
        open={modalOpen}
        post={selectedPost}
        onClose={handleCloseModal}
      />
    </>
  );
}
