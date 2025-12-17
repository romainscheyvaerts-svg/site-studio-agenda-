import { useState, useRef, useCallback } from "react";

interface UseAudioRecorderOptions {
  sampleRate?: number;
  onRecordingComplete?: (audioBuffer: AudioBuffer) => void;
}

export const useAudioRecorder = (audioContext: AudioContext | null, options: UseAudioRecorderOptions = {}) => {
  const { sampleRate = 44100, onRecordingComplete } = options;
  
  const [isRecording, setIsRecording] = useState(false);
  const [recordingDuration, setRecordingDuration] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const startTimeRef = useRef<number>(0);
  const durationIntervalRef = useRef<number | null>(null);

  const startRecording = useCallback(async () => {
    if (!audioContext) {
      setError("AudioContext non initialisé");
      return;
    }

    try {
      // Request microphone access
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          sampleRate,
          channelCount: 1,
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        }
      });

      streamRef.current = stream;
      chunksRef.current = [];

      // Create MediaRecorder
      const mediaRecorder = new MediaRecorder(stream, {
        mimeType: MediaRecorder.isTypeSupported('audio/webm') ? 'audio/webm' : 'audio/mp4'
      });

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          chunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = async () => {
        // Convert chunks to AudioBuffer
        const blob = new Blob(chunksRef.current, { type: mediaRecorder.mimeType });
        const arrayBuffer = await blob.arrayBuffer();
        
        try {
          const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
          onRecordingComplete?.(audioBuffer);
        } catch (err) {
          console.error("Error decoding recorded audio:", err);
          setError("Erreur lors du décodage de l'enregistrement");
        }

        // Stop duration tracking
        if (durationIntervalRef.current) {
          clearInterval(durationIntervalRef.current);
          durationIntervalRef.current = null;
        }
      };

      mediaRecorderRef.current = mediaRecorder;
      mediaRecorder.start(100); // Collect data every 100ms

      setIsRecording(true);
      setError(null);
      startTimeRef.current = Date.now();
      setRecordingDuration(0);

      // Track duration
      durationIntervalRef.current = window.setInterval(() => {
        setRecordingDuration((Date.now() - startTimeRef.current) / 1000);
      }, 100);

    } catch (err) {
      console.error("Error starting recording:", err);
      if (err instanceof DOMException && err.name === "NotAllowedError") {
        setError("Accès au microphone refusé. Veuillez autoriser l'accès.");
      } else if (err instanceof DOMException && err.name === "NotFoundError") {
        setError("Aucun microphone détecté.");
      } else {
        setError("Erreur lors de l'accès au microphone");
      }
    }
  }, [audioContext, sampleRate, onRecordingComplete]);

  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      
      // Stop all tracks
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
        streamRef.current = null;
      }

      setIsRecording(false);
    }
  }, [isRecording]);

  const cancelRecording = useCallback(() => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      chunksRef.current = []; // Clear chunks to discard recording
      
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
        streamRef.current = null;
      }

      if (durationIntervalRef.current) {
        clearInterval(durationIntervalRef.current);
        durationIntervalRef.current = null;
      }

      setIsRecording(false);
      setRecordingDuration(0);
    }
  }, [isRecording]);

  return {
    isRecording,
    recordingDuration,
    error,
    startRecording,
    stopRecording,
    cancelRecording,
  };
};
