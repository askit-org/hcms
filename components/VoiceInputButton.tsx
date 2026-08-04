'use client';

import { useState, useEffect, useRef } from 'react';
import { Mic, MicOff, Loader2 } from 'lucide-react';
import { toast } from '@/components/Toast';

interface VoiceInputButtonProps {
  onTranscript: (text: string) => void;
  title?: string;
  className?: string;
  size?: number;
}

// Global declaration for SpeechRecognition window extension
declare global {
  interface Window {
    SpeechRecognition: any;
    webkitSpeechRecognition: any;
  }
}

export default function VoiceInputButton({
  onTranscript,
  title = 'Click to dictate voice text',
  className = '',
  size = 16,
}: VoiceInputButtonProps) {
  const [isListening, setIsListening] = useState(false);
  const [isSupported, setIsSupported] = useState(true);
  const recognitionRef = useRef<any>(null);

  useEffect(() => {
    const SpeechRecognition =
      typeof window !== 'undefined' &&
      (window.SpeechRecognition || window.webkitSpeechRecognition);

    if (!SpeechRecognition) {
      setIsSupported(false);
    }
  }, []);

  const toggleListening = (e?: React.MouseEvent) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }

    if (!isSupported) {
      toast('Speech recognition is not supported in this browser. Please use Google Chrome, Edge, or Safari.', 'error');
      return;
    }

    if (isListening) {
      if (recognitionRef.current) {
        try { recognitionRef.current.stop(); } catch (_) {}
      }
      setIsListening(false);
      return;
    }

    try {
      const SpeechRecognition =
        window.SpeechRecognition || window.webkitSpeechRecognition;
      const recognition = new SpeechRecognition();

      recognition.continuous = false;
      recognition.interimResults = false;
      recognition.lang = 'en-US';

      recognition.onstart = () => {
        setIsListening(true);
        toast('Listening... Speak now', 'info');
      };

      recognition.onresult = (event: any) => {
        if (event.results && event.results[0] && event.results[0][0]) {
          const text = event.results[0][0].transcript;
          if (text && text.trim()) {
            onTranscript(text.trim());
            toast('Voice text added!', 'success');
          }
        }
      };

      recognition.onerror = (event: any) => {
        console.error('Speech recognition error:', event);
        setIsListening(false);
        const err = event.error || 'unknown';
        if (err === 'not-allowed' || err === 'service-not-allowed') {
          toast('Microphone permission denied. Click lock icon in browser URL bar to grant mic permission.', 'error');
        } else if (err === 'no-speech') {
          toast('No speech detected. Please try speaking again.', 'error');
        } else if (err === 'audio-capture') {
          toast('No microphone found on your system.', 'error');
        } else {
          toast(`Voice input error: ${err}`, 'error');
        }
      };

      recognition.onend = () => {
        setIsListening(false);
      };

      recognitionRef.current = recognition;
      recognition.start();
    } catch (err: any) {
      console.error(err);
      setIsListening(false);
      toast('Could not start voice recognition.', 'error');
    }
  };

  return (
    <button
      type="button"
      onClick={toggleListening}
      className={`btn-icon ${isListening ? 'listening-active' : ''} ${className}`}
      title={isListening ? 'Click to stop listening' : title}
      style={{
        position: 'relative',
        color: isListening ? 'var(--red, #ef4444)' : 'var(--text-muted, #64748b)',
        background: isListening ? 'rgba(239, 68, 68, 0.1)' : undefined,
        borderColor: isListening ? 'var(--red, #ef4444)' : undefined,
        transition: 'all 0.2s ease',
        cursor: 'pointer',
      }}
    >
      {isListening ? (
        <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
          <MicOff size={size} className="animate-pulse" />
          <span 
            style={{ 
              position: 'absolute', 
              top: -2, 
              right: -2, 
              width: 8, 
              height: 8, 
              borderRadius: '50%', 
              background: 'var(--red, #ef4444)',
              animation: 'ping 1s cubic-bezier(0, 0, 0.2, 1) infinite'
            }} 
          />
        </span>
      ) : (
        <Mic size={size} />
      )}
    </button>
  );
}
