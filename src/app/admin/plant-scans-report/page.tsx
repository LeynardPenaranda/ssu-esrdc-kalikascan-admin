"use client";
import PlantScansReport from "@/src/components/tables/PlantScansReport";
import { markSeen } from "@/src/lib/adminLastSeen";
import { useAppDispatch } from "@/src/store/hooks";
import { fetchAdminNotifSummary } from "@/src/store/slices/adminNotifSlice";
import { useEffect } from "react";

export default function PlantScansPage() {
  const dispatch = useAppDispatch();

  useEffect(() => {
    markSeen("plant_scans");
    dispatch(fetchAdminNotifSummary());
  }, [dispatch]);
  return (
    <div className="h-full p-4">
      <PlantScansReport />
    </div>
  );
}
