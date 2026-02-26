"use client";

import MapPostsReport from "@/src/components/tables/MapPostsReport";
import { markSeen } from "@/src/lib/adminLastSeen";
import { useAppDispatch } from "@/src/store/hooks";
import { fetchAdminNotifSummary } from "@/src/store/slices/adminNotifSlice";
import { useEffect } from "react";

export default function MapPosts() {
  const dispatch = useAppDispatch();

  useEffect(() => {
    markSeen("map_posts");
    dispatch(fetchAdminNotifSummary());
  }, [dispatch]);
  return (
    <div className="mt-5 pl-2 pr-2">
      <MapPostsReport />
    </div>
  );
}
