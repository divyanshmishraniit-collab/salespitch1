import { useRef, useState, useCallback, useEffect } from 'react';

export function useSpeechRecognition() {
  const [transcript, setTranscript] = useState('');
  const [isRecording, setIsRecording] = useState(false);
  const recognitionRef = useRef(null);
  const isRecordingRef = useRef(false);

  useEffect(() => {
    if (!('webkitSpeechRecognition' in window || 'SpeechRecognition' in window)) return;

    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    const recognition = new SpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = 'en-US';

    recognition.onresult = (event) => {
      let final = '';
      for (let i = event.resultIndex; i < event.results.length; i++) {
        if (event.results[i].isFinal) final += event.results[i][0].transcript + ' ';
      }
      if (final) setTranscript(prev => prev + final);
    };

    recognition.onerror = (e) => {
      if (e.error === 'not-allowed') {
        alert('Microphone access denied.');
        isRecordingRef.current = false;
        setIsRecording(false);
      }
    };

    recognition.onend = () => {
      if (isRecordingRef.current) {
        try { recognition.start(); } catch {}
      }
    };

    recognitionRef.current = recognition;

    return () => {
      isRecordingRef.current = false;
      try { recognition.stop(); } catch {}
    };
  }, []);

  const startRecording = useCallback(() => {
    if (!recognitionRef.current || isRecordingRef.current) return;
    setTranscript('');
    isRecordingRef.current = true;
    setIsRecording(true);
    try { recognitionRef.current.start(); } catch {}
  }, []);

  const stopRecording = useCallback(() => {
    if (!recognitionRef.current) return;
    isRecordingRef.current = false;
    setIsRecording(false);
    try { recognitionRef.current.stop(); } catch {}
  }, []);

  const clearTranscript = useCallback(() => setTranscript(''), []);

  return { transcript, isRecording, startRecording, stopRecording, clearTranscript };
}