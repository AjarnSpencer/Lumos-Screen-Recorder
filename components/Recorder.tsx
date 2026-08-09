import React, { useEffect, useRef, useState, useCallback } from 'react';
import { VideoMetadata, RecordingSettings } from '../types';
import { Maximize, Mic, MicOff, Monitor, StopCircle, Video, VideoOff, Settings2, AlertCircle } from 'lucide-react';
import { saveRecording } from '../services/storage';

interface RecorderProps {
  onRecordingComplete: (video: VideoMetadata) => void;
}

const Recorder: React.FC<RecorderProps> = ({ onRecordingComplete }) => {
  const [isRecording, setIsRecording] = useState(false);
  const [timer, setTimer] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [settings, setSettings] = useState<RecordingSettings>({
    resolution: '1080p',
    frameRate: 30,
    recordMic: true,
    recordSystemAudio: true,
    showWebcam: true,
    webcamShape: 'circle',
    webcamPosition: 'bottom-right'
  });

  const videoPreviewRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const webcamStreamRef = useRef<MediaStream | null>(null);
  const animationFrameRef = useRef<number>();
  const audioContextRef = useRef<AudioContext | null>(null);

  // Helper to get formatted time
  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60).toString().padStart(2, '0');
    const secs = (seconds % 60).toString().padStart(2, '0');
    return `${mins}:${secs}`;
  };

  const stopStreams = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
    }
    if (webcamStreamRef.current) {
      webcamStreamRef.current.getTracks().forEach(track => track.stop());
    }
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
    }
    // Fix: Check if context is already closed before closing
    if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
      try {
        audioContextRef.current.close();
      } catch (e) {
        console.warn("Error closing audio context", e);
      }
    }
  }, []);

  const startRecording = async () => {
    setError(null);
    try {
      // 1. Get Screen Stream
      // Using try/catch specifically for getDisplayMedia to handle permission policy errors
      let displayStream: MediaStream;
      try {
        displayStream = await navigator.mediaDevices.getDisplayMedia({
            video: {
                width: settings.resolution === '4k' ? 3840 : settings.resolution === '1080p' ? 1920 : 1280,
                height: settings.resolution === '4k' ? 2160 : settings.resolution === '1080p' ? 1080 : 720,
                frameRate: settings.frameRate
            },
            audio: settings.recordSystemAudio
        });
      } catch (err: any) {
        if (err.name === 'NotAllowedError') {
             throw new Error("Screen recording permission was denied.");
        } else if (err.message && err.message.includes('display-capture')) {
             throw new Error("Screen recording is disabled by the browser or environment policy.");
        }
        throw err;
      }

      // 2. Get Webcam Stream (if enabled)
      let camStream: MediaStream | null = null;
      if (settings.showWebcam) {
        try {
          camStream = await navigator.mediaDevices.getUserMedia({
            video: { width: 320, height: 240, facingMode: 'user' }
          });
          webcamStreamRef.current = camStream;
        } catch (e) {
          console.warn("Could not access webcam", e);
          // Don't fail the whole recording if just webcam fails, but maybe notify?
        }
      }

      // 3. Get Mic Stream (if enabled)
      let micStream: MediaStream | null = null;
      if (settings.recordMic) {
         try {
            micStream = await navigator.mediaDevices.getUserMedia({ audio: true });
         } catch (e) {
             console.warn("Could not access microphone", e);
         }
      }

      // 4. Set up Canvas Compositor
      const canvas = canvasRef.current!;
      const ctx = canvas.getContext('2d')!;
      // Set canvas size to match video track settings
      const settingsTrack = displayStream.getVideoTracks()[0].getSettings();
      canvas.width = settingsTrack.width || 1920;
      canvas.height = settingsTrack.height || 1080;

      // HTML Elements for source playback (hidden)
      const screenVideo = document.createElement('video');
      screenVideo.srcObject = displayStream;
      screenVideo.muted = true;
      await screenVideo.play();

      const camVideo = document.createElement('video');
      if (camStream) {
        camVideo.srcObject = camStream;
        camVideo.muted = true; // Avoid feedback
        await camVideo.play();
      }

      // 5. Audio Mixing
      // Fix: cast window to any to allow webkitAudioContext property
      const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
      audioContextRef.current = audioCtx;
      const dest = audioCtx.createMediaStreamDestination();

      if (displayStream.getAudioTracks().length > 0) {
        const sysSource = audioCtx.createMediaStreamSource(displayStream);
        const sysGain = audioCtx.createGain();
        sysGain.gain.value = 1.0;
        sysSource.connect(sysGain).connect(dest);
      }

      if (micStream && micStream.getAudioTracks().length > 0) {
        const micSource = audioCtx.createMediaStreamSource(micStream);
        const micGain = audioCtx.createGain();
        micGain.gain.value = 1.0; // Adjustable volume could go here
        micSource.connect(micGain).connect(dest);
      }

      // 6. Animation Loop (Draw to Canvas)
      const draw = () => {
        if (!ctx) return;
        
        // Draw Screen
        ctx.drawImage(screenVideo, 0, 0, canvas.width, canvas.height);

        // Draw Webcam Overlay
        if (camStream && settings.showWebcam) {
          const w = canvas.width * 0.2; // 20% width
          const h = (w / 4) * 3; // 4:3 aspect
          
          let x = 20;
          let y = 20;
          
          if (settings.webcamPosition.includes('right')) x = canvas.width - w - 20;
          if (settings.webcamPosition.includes('bottom')) y = canvas.height - h - 20;

          ctx.save();
          if (settings.webcamShape === 'circle') {
             ctx.beginPath();
             ctx.arc(x + w/2, y + h/2, h/2, 0, Math.PI * 2);
             ctx.closePath();
             ctx.clip();
          }
          ctx.drawImage(camVideo, x, y, w, h);
          
          // Border
          ctx.strokeStyle = '#3b82f6';
          ctx.lineWidth = 4;
          if (settings.webcamShape === 'circle') {
             ctx.stroke();
          } else {
             ctx.strokeRect(x,y,w,h);
          }
          
          ctx.restore();
        }

        animationFrameRef.current = requestAnimationFrame(draw);
      };
      draw();

      // 7. Start MediaRecorder
      const canvasStream = canvas.captureStream(settings.frameRate);
      
      // Add mixed audio track to canvas stream
      if (dest.stream.getAudioTracks().length > 0) {
        canvasStream.addTrack(dest.stream.getAudioTracks()[0]);
      }

      const recorder = new MediaRecorder(canvasStream, {
        mimeType: 'video/webm;codecs=vp9'
      });

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };

      recorder.onstop = async () => {
        stopStreams();
        const blob = new Blob(chunksRef.current, { type: 'video/webm' });
        const id = crypto.randomUUID();
        const meta: VideoMetadata = {
          id,
          blob,
          title: `Recording ${new Date().toLocaleString()}`,
          createdAt: Date.now(),
          duration: timer
        };
        
        // Autosave immediately
        await saveRecording(meta);
        onRecordingComplete(meta);
      };

      // Handle stream stop from browser UI
      displayStream.getVideoTracks()[0].onended = () => {
        if (recorder.state === 'recording') recorder.stop();
        setIsRecording(false);
      };

      recorder.start(1000); // chunk every second for safety
      mediaRecorderRef.current = recorder;
      streamRef.current = displayStream;
      setIsRecording(true);

    } catch (err: any) {
      console.error("Error starting recording:", err);
      setError(err.message || "Could not start recording.");
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }
  };

  useEffect(() => {
    let interval: any;
    if (isRecording) {
      interval = setInterval(() => {
        setTimer(t => t + 1);
      }, 1000);
    } else {
      setTimer(0);
    }
    return () => clearInterval(interval);
  }, [isRecording]);

  useEffect(() => {
    return () => stopStreams();
  }, [stopStreams]);

  return (
    <div className="flex flex-col items-center justify-center h-full space-y-8 animate-in fade-in duration-500">
      
      {/* Hidden Canvas for Composition */}
      <canvas ref={canvasRef} className="hidden" />

      <div className="text-center space-y-2">
        <h2 className="text-3xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-blue-400 to-purple-500">
          Ready to Record
        </h2>
        <p className="text-gray-400">Capture screen, camera, and audio instantly.</p>
      </div>

      {/* Error Message Display */}
      {error && (
        <div className="flex items-center gap-2 text-red-400 bg-red-900/20 px-4 py-2 rounded-lg border border-red-900/50">
           <AlertCircle className="w-5 h-5" />
           <span>{error}</span>
        </div>
      )}

      {/* Main Action Button */}
      <div className="relative group">
        <div className={`absolute -inset-1 bg-gradient-to-r from-red-600 to-violet-600 rounded-full blur opacity-25 group-hover:opacity-100 transition duration-1000 group-hover:duration-200 ${isRecording ? 'animate-pulse' : ''}`}></div>
        <button
          onClick={isRecording ? stopRecording : startRecording}
          className={`relative flex items-center justify-center w-32 h-32 rounded-full border-4 transition-all duration-300 shadow-2xl ${
            isRecording 
              ? 'bg-gray-900 border-red-500 scale-95' 
              : 'bg-white text-gray-900 border-transparent hover:scale-105'
          }`}
        >
          {isRecording ? (
            <div className="flex flex-col items-center">
              <div className="w-8 h-8 bg-red-500 rounded-sm mb-2" />
              <span className="text-red-500 font-mono font-bold text-sm animate-pulse">{formatTime(timer)}</span>
            </div>
          ) : (
            <div className="w-8 h-8 bg-red-600 rounded-full" />
          )}
        </button>
      </div>

      {/* Settings Panel */}
      {!isRecording && (
        <div className="bg-gray-900/50 p-6 rounded-2xl border border-gray-800 backdrop-blur-sm w-full max-w-2xl">
          <div className="flex items-center gap-2 mb-4 text-gray-300">
            <Settings2 className="w-5 h-5" />
            <span className="font-semibold">Quick Settings</span>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            
            {/* Audio Sources */}
            <div className="space-y-3">
              <label className="text-sm font-medium text-gray-500 uppercase tracking-wider">Audio</label>
              <button
                onClick={() => setSettings(s => ({ ...s, recordMic: !s.recordMic }))}
                className={`flex items-center gap-3 w-full p-3 rounded-xl transition-colors ${settings.recordMic ? 'bg-blue-500/20 text-blue-400 border border-blue-500/50' : 'bg-gray-800 text-gray-400 border border-transparent'}`}
              >
                {settings.recordMic ? <Mic className="w-5 h-5" /> : <MicOff className="w-5 h-5" />}
                <span>Microphone</span>
              </button>
              
              <button
                onClick={() => setSettings(s => ({ ...s, recordSystemAudio: !s.recordSystemAudio }))}
                className={`flex items-center gap-3 w-full p-3 rounded-xl transition-colors ${settings.recordSystemAudio ? 'bg-purple-500/20 text-purple-400 border border-purple-500/50' : 'bg-gray-800 text-gray-400 border border-transparent'}`}
              >
                <Monitor className="w-5 h-5" />
                <span>System Audio</span>
              </button>
            </div>

            {/* Video Sources */}
            <div className="space-y-3">
              <label className="text-sm font-medium text-gray-500 uppercase tracking-wider">Video</label>
              <button
                onClick={() => setSettings(s => ({ ...s, showWebcam: !s.showWebcam }))}
                className={`flex items-center gap-3 w-full p-3 rounded-xl transition-colors ${settings.showWebcam ? 'bg-green-500/20 text-green-400 border border-green-500/50' : 'bg-gray-800 text-gray-400 border border-transparent'}`}
              >
                {settings.showWebcam ? <Video className="w-5 h-5" /> : <VideoOff className="w-5 h-5" />}
                <span>Webcam Overlay</span>
              </button>

              <div className="flex gap-2">
                 <select 
                    value={settings.resolution}
                    onChange={(e) => setSettings(s => ({...s, resolution: e.target.value as any}))}
                    className="flex-1 bg-gray-800 text-gray-300 p-3 rounded-xl border border-gray-700 focus:outline-none focus:border-blue-500"
                 >
                    <option value="720p">720p HD</option>
                    <option value="1080p">1080p FHD</option>
                    <option value="4k">4K UHD</option>
                 </select>
                 
                 {settings.showWebcam && (
                   <button 
                     onClick={() => setSettings(s => ({...s, webcamShape: s.webcamShape === 'circle' ? 'square' : 'circle'}))}
                     className="bg-gray-800 p-3 rounded-xl border border-gray-700 hover:bg-gray-700"
                     title="Toggle Shape"
                   >
                     <div className={`w-5 h-5 border-2 border-current ${settings.webcamShape === 'circle' ? 'rounded-full' : 'rounded-none'}`} />
                   </button>
                 )}
              </div>
            </div>
          </div>
        </div>
      )}
      
      <p className="text-xs text-gray-600 mt-8">
        Files are auto-saved locally. No data leaves your device.
      </p>
    </div>
  );
};

export default Recorder;