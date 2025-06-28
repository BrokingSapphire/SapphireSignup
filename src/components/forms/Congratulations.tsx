import React, { useState } from 'react';
import { Button } from '../ui/button';
import { Copy, Check } from 'lucide-react';
import Link from 'next/link';

interface CongratulationsPageProps {
  onNext: () => void;
  clientId?: string;
}

const CongratulationsPage: React.FC<CongratulationsPageProps> = ({ 
  clientId = 'DEFAULT' // Default client ID if none provided
}) => {
  const [copied, setCopied] = useState(false);

  const handleCopyClientId = async () => {
    if (clientId) {
      try {
        await navigator.clipboard.writeText(clientId);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      } catch (err) {
        console.error('Failed to copy client ID:', err);
        // Fallback for older browsers
        const textArea = document.createElement('textarea');
        textArea.value = clientId;
        document.body.appendChild(textArea);
        textArea.select();
        try {
          document.execCommand('copy');
          setCopied(true);
          setTimeout(() => setCopied(false), 2000);
        } catch (fallbackErr) {
          console.error('Fallback copy failed:', fallbackErr);
        }
        document.body.removeChild(textArea);
      }
    }
  };

  // Construct the terminal URL with client ID as query parameter
  const terminalUrl = `https://terminal.sapphirebroking.com?clientId=${encodeURIComponent(clientId)}`;

  return (
    <div className="w-full mx-auto text-center text-xl">
      <div className="mb-8">
      </div>

      <h1 className="text-4xl font-bold mb-4">Congratulations!</h1>

      <p className="text-gray-600 mb-8">
        Your application is being reviewed. This could take up to 24 hours. We
        will send you an email once processed.
      </p>

      <div className="mb-8">
        <p className="text-gray-600 mb-2">Your Client ID is</p>
        <div className="inline-flex items-center border border-gray-300 rounded px-4 py-2">
          <span className="font-mono font-semibold select-all mr-2">
            {clientId}
          </span>
          <button
            onClick={handleCopyClientId}
            className="p-1 hover:bg-gray-100 rounded transition-colors"
            title="Copy Client ID"
          >
            {copied ? (
              <Check className="w-4 h-4 text-green-600" />
            ) : (
              <Copy className="w-4 h-4 text-gray-600" />
            )}
          </button>
        </div>
        {copied && (
          <p className="text-sm text-green-600 mt-2">
            Client ID copied to clipboard!
          </p>
        )}
      </div>

      <Link href={terminalUrl} target="_blank" rel="noopener noreferrer">
        <Button variant="ghost" className="py-6">
          Login to Terminal
        </Button>
      </Link>
    </div>
  );
};

export default CongratulationsPage;