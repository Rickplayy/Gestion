import axios from 'axios';
import { useAuthStore } from '@/stores/auth';
import type { ApiErrorBody } from '@/types/api';

const API_BASE = import.meta.env.VITE_API_URL ?? 'http://localhost:3001/api/v1';

export const http = axios.create({ baseURL: API_BASE });

http.interceptors.request.use((config) => {
  const auth = useAuthStore();
  if (auth.token) {
    config.headers.set('Authorization', `Bearer ${auth.token}`);
  }
  return config;
});

http.interceptors.response.use(
  (response) => response,
  (error: unknown) => {
    if (axios.isAxiosError<ApiErrorBody>(error)) {
      if (error.response?.status === 401) {
        useAuthStore().logout();
      }
      const message = error.response?.data?.message ?? error.message;
      return Promise.reject(new Error(message));
    }
    return Promise.reject(error);
  },
);
