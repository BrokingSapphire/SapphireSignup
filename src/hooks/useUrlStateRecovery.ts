// hooks/useUrlStateRecovery.ts
import { useEffect, useState } from 'react';
import Cookies from 'js-cookie';
import { toast } from 'sonner';
import axios from 'axios';

interface RecoveredState {
  token: string;
  email: string;
  phone: string;
  step: string;
  timestamp: number;
}

export const useUrlStateRecovery = () => {
  const [isRecovering, setIsRecovering] = useState(false);
  const [hasRecovered, setHasRecovered] = useState(false);

  useEffect(() => {
    const recoverStateFromUrl = () => {
      const urlParams = new URLSearchParams(window.location.search);
      const stateParam = urlParams.get('state');
      
      if (!stateParam) return;

      try {
        setIsRecovering(true);
        
        // Decode the state data
        const decodedState = JSON.parse(atob(stateParam)) as RecoveredState;
        
        // Validate timestamp (ensure it's not too old - within 1 hour)
        const oneHour = 60 * 60 * 1000;
        if (Date.now() - decodedState.timestamp > oneHour) {
          console.log('State data too old, ignoring');
          return;
        }

        console.log('Recovering state from URL:', decodedState);

        // Restore auth token
        if (decodedState.token) {
          Cookies.set('authToken', decodedState.token, { 
            expires: 1, 
            secure: true, 
            sameSite: 'strict' 
          });
          axios.defaults.headers.common['Authorization'] = `Bearer ${decodedState.token}`;
        }

        // Restore email to localStorage with expiry
        if (decodedState.email) {
          const emailData = {
            value: decodedState.email,
            expiry: Date.now() + (24 * 60 * 60 * 1000), // 24 hours
            verified: true,
            recoveredFromUrl: true
          };
          localStorage.setItem('email', JSON.stringify(emailData));
        }

        // Restore phone to localStorage with expiry
        if (decodedState.phone) {
          const phoneData = {
            value: decodedState.phone,
            expiry: Date.now() + (24 * 60 * 60 * 1000), // 24 hours
            verified: true,
            recoveredFromUrl: true
          };
          localStorage.setItem('verifiedPhone', JSON.stringify(phoneData));
        }

        // Clean the URL to remove the state parameter
        const cleanUrl = new URL(window.location.href);
        cleanUrl.searchParams.delete('state');
        window.history.replaceState({}, '', cleanUrl.pathname);

        setHasRecovered(true);
        toast.success('Session restored successfully!');
        
        console.log('State recovery completed successfully');

      } catch (error) {
        console.error('Error recovering state from URL:', error);
        toast.error('Failed to restore session. You may need to start over.');
      } finally {
        setIsRecovering(false);
      }
    };

    // Run recovery on component mount
    recoverStateFromUrl();
  }, []);

  return { isRecovering, hasRecovered };
};