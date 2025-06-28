'use client';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ReactNode } from 'react';

interface Props {
  children: ReactNode;
}

// Create QueryClient instance outside the component and export it
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000, // 5 minutes
      gcTime: 10 * 60 * 1000, // 10 minutes (formerly cacheTime)
      retry: (failureCount, error) => {
        // Type guard to check if error has a status property
        function hasStatus(err: unknown): err is Error & { status: number } {
          return (
            typeof err === 'object' &&
            err !== null &&
            'status' in err &&
            typeof (err as { status?: unknown }).status === 'number'
          );
        }
        // Don't retry on 4xx errors
        if (hasStatus(error)) {
          const status = error.status;
          if (status >= 400 && status < 500) {
            return false;
          }
        }
        return failureCount < 3;
      },
    },
  },
});

export function QueryProvider({ children }: Props) {
  return (
    <QueryClientProvider client={queryClient}>
      {children}
    </QueryClientProvider>
  );
}