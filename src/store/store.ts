import { configureStore } from "@reduxjs/toolkit";
import adminNotifReducer from "./slices/adminNotifSlice";

export const store = configureStore({
  reducer: {
    adminNotif: adminNotifReducer,
  },
});

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;
