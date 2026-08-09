import React, { useState, useRef, useEffect, useMemo } from 'react';
import { VideoMetadata, EditorFilters } from '../types';
import { Play, Pause, Download, Trash2, ArrowLeft, Wand2, Save } from 'lucide-react';
import { deleteRecording, saveRecording } from '../services/storage';
import { generateSmartTitle } from '../services/gemini';

interface EditorProps {
  video: VideoMetadata;
  onBack: () => void;
  onDelete: () => void;
}

const Editor: React.FC<EditorProps> = ({ video, onBack, onDelete }) => {
  const videoUrl = useMemo(() => URL.createObjectURL(video.blob), [video.blob]);
  const videoRef = useRef<HTMLVideoElement>(null);
  
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [filters, setFilters] = useState<EditorFilters>({
    brightness: 100,
    contrast: 100,
    saturate: 100,
    grayscale: 0,
    sepia: 0,
    blur: 0
  });

  // AI Feature State
  // Fix: Remove manual API key state to comply with guidelines
  const [isGeneratingTitle, setIsGeneratingTitle] = useState(false);
  const [currentTitle, setCurrentTitle] = useState(video.title);

  const filterString = useMemo(() => {
    return `brightness(${filters.brightness}%) contrast(${filters.contrast}%) saturate(${filters.saturate}%) grayscale(${filters.grayscale}%) sepia(${filters.sepia}%) blur(${filters.blur}px)`;
  }, [filters]);

  // Safe time formatting helper to prevent RangeError
  const formatTime = (timeInSeconds: number) => {
    if (!Number.isFinite(timeInSeconds) || isNaN(timeInSeconds) || timeInSeconds < 0) return "00:00";
    try {
        return new Date(timeInSeconds * 1000).toISOString().substr(14, 5);
    } catch (e) {
        return "00:00";
    }
  };

  const togglePlay = () => {
    if (videoRef.current) {
      if (isPlaying) videoRef.current.pause();
      else videoRef.current.play();
      setIsPlaying(!isPlaying);
    }
  };

  const handleTimeUpdate = () => {
    if (videoRef.current) {
      setCurrentTime(videoRef.current.currentTime);
    }
  };

  const handleLoadedMetadata = () => {
    if (videoRef.current) {
      setDuration(videoRef.current.duration);
    }
  };

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const time = parseFloat(e.target.value);
    if (videoRef.current) {
      videoRef.current.currentTime = time;
      setCurrentTime(time);
    }
  };

  const downloadVideo = () => {
    const a = document.createElement('a');
    a.href = videoUrl;
    a.download = `${currentTitle.replace(/[^a-z0-9]/gi, '_').toLowerCase()}.webm`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  const confirmDelete = () => {
    if (window.confirm("Are you sure you want to permanently delete this recording? This action cannot be undone.")) {
      deleteRecording(video.id).then(onDelete);
    }
  };

  const updateTitle = async () => {
    if (!videoRef.current) return;
    setIsGeneratingTitle(true);
    
    try {
        // Capture frame
        const canvas = document.createElement('canvas');
        canvas.width = videoRef.current.videoWidth;
        canvas.height = videoRef.current.videoHeight;
        const ctx = canvas.getContext('2d');
        ctx?.drawImage(videoRef.current, 0, 0);
        const base64 = canvas.toDataURL('image/jpeg', 0.7).split(',')[1];
        
        // Fix: generateSmartTitle now uses process.env.API_KEY internally
        const title = await generateSmartTitle(base64);
        setCurrentTitle(title);
        
        // Save new title to DB
        await saveRecording({ ...video, title });
    } catch (e) {
        console.error(e);
        alert("Failed to generate title. Check API Key.");
    } finally {
        setIsGeneratingTitle(false);
    }
  };

  return (
    <div className="flex flex-col h-full bg-gray-950">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-gray-800 bg-gray-900/50 backdrop-blur">
        <button onClick={onBack} className="flex items-center gap-2 text-gray-400 hover:text-white transition">
          <ArrowLeft className="w-5 h-5" /> Back
        </button>
        <div className="flex items-center gap-2">
            <input 
                type="text" 
                value={currentTitle} 
                onChange={(e) => setCurrentTitle(e.target.value)}
                className="bg-transparent text-center font-bold text-lg focus:outline-none border-b border-transparent focus:border-blue-500"
            />
             <button 
                onClick={updateTitle}
                disabled={isGeneratingTitle}
                className="p-1 rounded bg-gradient-to-r from-blue-500 to-purple-500 hover:opacity-80"
                title="Generate AI Title"
             >
                <Wand2 className={`w-4 h-4 text-white ${isGeneratingTitle ? 'animate-spin' : ''}`} />
             </button>
        </div>
        <div className="flex items-center gap-3">
           <button onClick={confirmDelete} className="p-2 text-red-400 hover:bg-red-900/20 rounded-lg transition" title="Delete">
            <Trash2 className="w-5 h-5" />
          </button>
          <button onClick={downloadVideo} className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-500 rounded-lg font-medium transition shadow-lg shadow-blue-900/20">
            <Download className="w-4 h-4" /> Export
          </button>
        </div>
      </div>

      <div className="flex-1 flex overflow-hidden">
        {/* Video Player Area */}
        <div className="flex-1 flex flex-col items-center justify-center bg-black p-4 relative">
          <div className="relative w-full max-w-5xl aspect-video bg-gray-900 rounded-lg overflow-hidden shadow-2xl">
            <video
              ref={videoRef}
              src={videoUrl}
              className="w-full h-full object-contain"
              style={{ filter: filterString }}
              onTimeUpdate={handleTimeUpdate}
              onLoadedMetadata={handleLoadedMetadata}
              onEnded={() => setIsPlaying(false)}
              onClick={togglePlay}
            />
            
            {/* Overlay Controls */}
            <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-4 opacity-0 hover:opacity-100 transition-opacity duration-300">
               <div className="flex items-center gap-4 mb-2">
                  <button onClick={togglePlay} className="text-white hover:text-blue-400">
                     {isPlaying ? <Pause className="fill-current" /> : <Play className="fill-current" />}
                  </button>
                  <input
                    type="range"
                    min="0"
                    max={duration || 100}
                    value={currentTime}
                    onChange={handleSeek}
                    className="flex-1 h-1 bg-gray-600 rounded-lg appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:bg-blue-500 [&::-webkit-slider-thumb]:rounded-full"
                  />
                  <span className="text-xs font-mono text-gray-300">
                    {formatTime(currentTime)} / {formatTime(duration)}
                  </span>
               </div>
            </div>
          </div>
        </div>

        {/* Sidebar Controls */}
        <div className="w-80 border-l border-gray-800 bg-gray-900 p-6 overflow-y-auto space-y-8">
            
            {/* Filters */}
            <div>
                <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-4">Visual Effects</h3>
                <div className="space-y-4">
                    <div className="space-y-1">
                        <div className="flex justify-between text-xs text-gray-400">
                            <span>Brightness</span>
                            <span>{filters.brightness}%</span>
                        </div>
                        <input 
                            type="range" min="0" max="200" 
                            value={filters.brightness}
                            onChange={(e) => setFilters(f => ({...f, brightness: parseInt(e.target.value)}))}
                            className="w-full h-1 bg-gray-700 rounded-lg appearance-none cursor-pointer"
                        />
                    </div>
                    <div className="space-y-1">
                        <div className="flex justify-between text-xs text-gray-400">
                            <span>Contrast</span>
                            <span>{filters.contrast}%</span>
                        </div>
                        <input 
                            type="range" min="0" max="200" 
                            value={filters.contrast}
                            onChange={(e) => setFilters(f => ({...f, contrast: parseInt(e.target.value)}))}
                            className="w-full h-1 bg-gray-700 rounded-lg appearance-none cursor-pointer"
                        />
                    </div>
                    <div className="space-y-1">
                        <div className="flex justify-between text-xs text-gray-400">
                            <span>Saturation</span>
                            <span>{filters.saturate}%</span>
                        </div>
                        <input 
                            type="range" min="0" max="200" 
                            value={filters.saturate}
                            onChange={(e) => setFilters(f => ({...f, saturate: parseInt(e.target.value)}))}
                            className="w-full h-1 bg-gray-700 rounded-lg appearance-none cursor-pointer"
                        />
                    </div>
                    <div className="space-y-1">
                        <div className="flex justify-between text-xs text-gray-400">
                            <span>Grayscale</span>
                            <span>{filters.grayscale}%</span>
                        </div>
                        <input 
                            type="range" min="0" max="100" 
                            value={filters.grayscale}
                            onChange={(e) => setFilters(f => ({...f, grayscale: parseInt(e.target.value)}))}
                            className="w-full h-1 bg-gray-700 rounded-lg appearance-none cursor-pointer"
                        />
                    </div>
                </div>
            </div>
            
            {/* Removed Manual API Key Settings to comply with guidelines */}
        </div>
      </div>
    </div>
  );
};

export default Editor;