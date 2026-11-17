import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

/** D28: server-state cache is only needed behind the auth gate. Keeping this
 *  module lazy removes @tanstack/query from the login/register first paint.
 *  The singleton survives provider remounts, so navigating between shell and
 *  full-screen routes does not drop cached data. */
const queryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: 1, refetchOnWindowFocus: false, staleTime: 30_000 },
  },
});

export function ServerStateProvider({ children }) {
  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
}

/** D28: sign-out/account deletion must not leave one learner's cached
 *  server state available to the next account in the same tab. */
export function clearServerState() {
  queryClient.clear();
}
