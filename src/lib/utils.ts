import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

// Utility function to determine API endpoint based on current route
export const getApiEndpoint = (baseEndpoint: string): string => {
  if (typeof window !== 'undefined') {
    const currentPath = window.location.pathname;
    if (currentPath === '/minor') {
      // Replace 'signup' with 'minor' in the endpoint
      return baseEndpoint.replace('/signup/', '/minor/');
    }
  }
  return baseEndpoint;
};
