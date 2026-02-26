import { createAsyncThunk, createSlice, PayloadAction } from "@reduxjs/toolkit";
import { auth } from "@/src/lib/firebase/client";
import { getAdminLastSeen } from "@/src/lib/adminLastSeen";

export type AdminNotifCounts = {
  plant_scans: number;
  map_posts: number;
  health_assessments: number;
  expert_applications: number;
};

type State = {
  loading: boolean;
  error: string | null;
  counts: AdminNotifCounts;
};

const initialState: State = {
  loading: false,
  error: null,
  counts: {
    plant_scans: 0,
    map_posts: 0,
    health_assessments: 0,
    expert_applications: 0,
  },
};

export const fetchAdminNotifSummary = createAsyncThunk<
  AdminNotifCounts,
  void,
  { rejectValue: string }
>("adminNotif/fetchSummary", async (_, { rejectWithValue }) => {
  try {
    const user = auth.currentUser;
    if (!user) return rejectWithValue("Not signed in");

    const token = await user.getIdToken();
    const lastSeen = getAdminLastSeen();

    // Convert ISO -> ms for collections that use createdAtLocal number
    const plantMs = lastSeen.plant_scans
      ? new Date(lastSeen.plant_scans).getTime()
      : undefined;
    const mapMs = lastSeen.map_posts
      ? new Date(lastSeen.map_posts).getTime()
      : undefined;

    const res = await fetch("/api/admin/notifications/summary", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        lastSeen: {
          plant_scans: Number.isFinite(plantMs as any) ? plantMs : undefined,
          map_posts: Number.isFinite(mapMs as any) ? mapMs : undefined,
          health_assessments: lastSeen.health_assessments ?? undefined,
          expert_applications: lastSeen.expert_applications ?? undefined,
        },
      }),
    });

    const data = await res.json().catch(() => ({}));
    if (!res.ok)
      return rejectWithValue(data?.error ?? "Failed to load notifications");

    return (data?.counts ?? initialState.counts) as AdminNotifCounts;
  } catch (e: any) {
    return rejectWithValue(e?.message ?? "Unknown error");
  }
});

const adminNotifSlice = createSlice({
  name: "adminNotif",
  initialState,
  reducers: {
    setCounts(state, action: PayloadAction<AdminNotifCounts>) {
      state.counts = action.payload;
    },
    clearCount(state, action: PayloadAction<keyof AdminNotifCounts>) {
      state.counts[action.payload] = 0;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchAdminNotifSummary.pending, (s) => {
        s.loading = true;
        s.error = null;
      })
      .addCase(fetchAdminNotifSummary.fulfilled, (s, a) => {
        s.loading = false;
        s.counts = a.payload;
      })
      .addCase(fetchAdminNotifSummary.rejected, (s, a) => {
        s.loading = false;
        s.error = a.payload ?? "Failed";
      });
  },
});

export const { setCounts, clearCount } = adminNotifSlice.actions;
export default adminNotifSlice.reducer;
