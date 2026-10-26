import type { QueryClient } from '@tanstack/react-query';

/**
 * Refreshes every server-derived view that can be affected by a workflow
 * mutation. The dataset is small and correctness matters more than saving a
 * handful of requests here.
 */
export async function invalidateWorkspace(queryClient: QueryClient): Promise<void> {
  await Promise.all([
    queryClient.invalidateQueries({ queryKey: ['requests'] }),
    queryClient.invalidateQueries({ queryKey: ['responses'] }),
    queryClient.invalidateQueries({ queryKey: ['dashboard'] }),
    queryClient.invalidateQueries({ queryKey: ['notifications'] }),
    queryClient.invalidateQueries({ queryKey: ['hospital'] }),
    queryClient.invalidateQueries({ queryKey: ['admin'] }),
    queryClient.invalidateQueries({ queryKey: ['blockchain'] }),
  ]);
}

/**
 * Keeps an open request view in sync after a decision, while the broader
 * workspace query refresh runs in the background.
 */
export async function invalidateRequest(
  queryClient: QueryClient,
  requestId: string,
): Promise<void> {
  await Promise.all([
    queryClient.invalidateQueries({ queryKey: ['requests', requestId] }),
    queryClient.invalidateQueries({ queryKey: ['requests'] }),
    queryClient.invalidateQueries({ queryKey: ['responses'] }),
    queryClient.invalidateQueries({ queryKey: ['dashboard'] }),
    queryClient.invalidateQueries({ queryKey: ['hospital'] }),
    queryClient.invalidateQueries({ queryKey: ['admin'] }),
  ]);
}
