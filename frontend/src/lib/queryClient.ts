import { QueryClient } from '@tanstack/react-query';
import { ApiError } from './api';

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      refetchOnWindowFocus: false,
      retry(failureCount, error) {
        if (error instanceof ApiError) {
          if ([400, 401, 403, 404, 409, 422].includes(error.status)) return false;
        }
        return failureCount < 1;
      },
    },
    mutations: {
      retry: false,
    },
  },
});

export const queryKeys = {
  dashboard: ['dashboard'] as const,
  me: ['me'] as const,
  feed: (filters: Record<string, unknown>) => ['requests', 'feed', filters] as const,
  myRequests: (filters: Record<string, unknown>) => ['requests', 'mine', filters] as const,
  request: (id: string) => ['requests', id] as const,
  requestHistory: (id: string) => ['requests', id, 'history'] as const,
  requestMatches: (id: string) => ['requests', id, 'matches'] as const,
  requestResponses: (id: string) => ['requests', id, 'responses'] as const,
  requestBlockchain: (id: string) => ['requests', id, 'blockchain'] as const,
  myResponses: (page: number) => ['responses', 'mine', page] as const,
  notifications: (unreadOnly: boolean, page: number) =>
    ['notifications', unreadOnly, page] as const,
  hospitalQueue: (page: number) => ['hospital', 'queue', page] as const,
  hospitalDashboard: ['hospital', 'dashboard'] as const,
  hospitalAudit: (page: number) => ['hospital', 'audit', page] as const,
  hospitalApplication: ['hospital', 'application'] as const,
  adminOverview: ['admin', 'overview'] as const,
  adminUsers: (search: string, page: number) => ['admin', 'users', search, page] as const,
  adminRequests: (filters: Record<string, unknown>) =>
    ['admin', 'requests', filters] as const,
  adminSuspicious: ['admin', 'suspicious'] as const,
  adminAudit: (filters: Record<string, unknown>) => ['admin', 'audit', filters] as const,
  adminHospitals: (status: string, page: number) =>
    ['admin', 'hospitals', status, page] as const,
  blockchain: ['blockchain', 'status'] as const,
};
