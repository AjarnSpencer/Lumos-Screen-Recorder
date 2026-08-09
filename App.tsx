import React, { useState, useEffect } from 'react';
import { AppMode, VideoMetadata } from './types';
import Recorder from './components/Recorder';
import Editor from './components/Editor';
import { getAllRecordings, deleteRecording } from './services/storage';
import { Camera, Film, Info, LayoutGrid } from 'lucide-react';

const App: React.FC = () => {
  const [mode, setMode] = useState<AppMode>(AppMode.HOME);
  const [selectedVideo, setSelectedVideo] = useState<VideoMetadata | null>(null);
  const [library, setLibrary] = useState<VideoMetadata[]>([]);
  const [loading, setLoading] = useState(true);

  const refreshLibrary = async () => {
    try {
      const vids = await getAllRecordings();
      setLibrary(vids);
    } catch (e) {
      console.error("Failed to load library", e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    refreshLibrary();
  }, []);

  const handleRecordingComplete = (video: VideoMetadata) => {
    setSelectedVideo(video);
    setMode(AppMode.EDITOR);
    refreshLibrary();
  };

  const handleSelectVideo = (video: VideoMetadata) => {
    setSelectedVideo(video);
    setMode(AppMode.EDITOR);
  };

  const handleDeleteVideo = async () => {
    if (selectedVideo) {
       setMode(AppMode.LIBRARY);
       await refreshLibrary();
       setSelectedVideo(null);
    }
  };

  // Render Navigation
  const renderNav = () => (
    <nav className="w-20 flex flex-col items-center py-8 bg-gray-900 border-r border-gray-800 z-50">
      <div className="mb-8">
        <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-purple-600 rounded-xl flex items-center justify-center shadow-lg shadow-blue-500/20">
            <Camera className="text-white w-6 h-6" />
        </div>
      </div>
      
      <div className="flex flex-col gap-6 w-full">
        <NavButton 
            active={mode === AppMode.HOME || mode === AppMode.RECORDING} 
            onClick={() => setMode(AppMode.HOME)} 
            icon={<Camera />} 
            label="Record" 
        />
        <NavButton 
            active={mode === AppMode.LIBRARY} 
            onClick={() => { setMode(AppMode.LIBRARY); refreshLibrary(); }} 
            icon={<LayoutGrid />} 
            label="Library" 
        />
        <NavButton 
            active={mode === AppMode.ABOUT} 
            onClick={() => setMode(AppMode.ABOUT)} 
            icon={<Info />} 
            label="About" 
        />
      </div>
    </nav>
  );

  return (
    <div className="flex h-screen w-screen bg-gray-950 text-white font-sans selection:bg-blue-500/30">
      {/* If in editor, hide nav for full immersion, else show sidebar */}
      {mode !== AppMode.EDITOR && renderNav()}

      <main className="flex-1 overflow-hidden relative">
        
        {/* VIEW: HOME / RECORDER */}
        {(mode === AppMode.HOME || mode === AppMode.RECORDING) && (
          <Recorder onRecordingComplete={handleRecordingComplete} />
        )}

        {/* VIEW: LIBRARY */}
        {mode === AppMode.LIBRARY && (
            <div className="p-8 h-full overflow-y-auto">
                <header className="mb-8">
                    <h1 className="text-3xl font-bold mb-2">Library</h1>
                    <p className="text-gray-400">Manage your local recordings.</p>
                </header>
                
                {loading ? (
                    <div className="flex justify-center pt-20"><div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div></div>
                ) : library.length === 0 ? (
                    <div className="text-center pt-20 opacity-50">
                        <Film className="w-16 h-16 mx-auto mb-4 stroke-1" />
                        <p>No recordings yet. Go create something!</p>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                        {library.map(vid => (
                            <div key={vid.id} onClick={() => handleSelectVideo(vid)} className="group cursor-pointer bg-gray-900 rounded-xl border border-gray-800 hover:border-blue-500/50 hover:shadow-2xl hover:shadow-blue-900/10 transition overflow-hidden">
                                <div className="aspect-video bg-gray-800 relative flex items-center justify-center">
                                    <Film className="text-gray-600 w-12 h-12 group-hover:scale-110 transition duration-300" />
                                    <div className="absolute inset-0 bg-black/20 group-hover:bg-transparent transition"></div>
                                    <span className="absolute bottom-2 right-2 bg-black/70 px-2 py-0.5 rounded text-xs font-mono">
                                        {Math.floor(vid.duration / 60)}:{(vid.duration % 60).toString().padStart(2,'0')}
                                    </span>
                                </div>
                                <div className="p-4">
                                    <h3 className="font-medium truncate pr-4" title={vid.title}>{vid.title}</h3>
                                    <p className="text-xs text-gray-500 mt-1">{new Date(vid.createdAt).toLocaleDateString()}</p>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        )}

        {/* VIEW: EDITOR */}
        {mode === AppMode.EDITOR && selectedVideo && (
            <Editor video={selectedVideo} onBack={() => setMode(AppMode.LIBRARY)} onDelete={handleDeleteVideo} />
        )}

        {/* VIEW: ABOUT */}
        {mode === AppMode.ABOUT && (
            <div className="flex flex-col items-center justify-center h-full p-8 text-center max-w-2xl mx-auto space-y-8 animate-in zoom-in-95 duration-300">
                <div className="w-20 h-20 bg-gradient-to-br from-blue-500 to-purple-600 rounded-3xl flex items-center justify-center shadow-2xl shadow-blue-500/20 rotate-3 hover:rotate-6 transition">
                    <Camera className="text-white w-10 h-10" />
                </div>
                <div>
                    <h1 className="text-4xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-blue-400 via-purple-400 to-white mb-4">
                        Lumos Recorder
                    </h1>
                    <p className="text-gray-400 leading-relaxed">
                        A professional, privacy-first screen recording suite. Built for creators who need reliability without the subscription fatigue.
                        Features autosave crash recovery, multi-track audio mixing, and on-device processing.
                    </p>
                </div>
                
                <div className="grid grid-cols-2 gap-4 w-full text-left">
                     <div className="p-4 bg-gray-900/50 rounded-xl border border-gray-800">
                        <h3 className="font-bold text-white mb-1">Created By</h3>
                        <p className="text-blue-400">Ajarn Spencer Littlewood</p>
                     </div>
                     <div className="p-4 bg-gray-900/50 rounded-xl border border-gray-800">
                        <h3 className="font-bold text-white mb-1">Website</h3>
                        <a href="https://www.ajarnspencer.com" target="_blank" rel="noreferrer" className="text-blue-400 hover:underline">www.ajarnspencer.com</a>
                     </div>
                </div>

                <div className="flex gap-4">
                    <a href="https://github.com/AjarnSpencer" target="_blank" rel="noreferrer" className="px-6 py-2 bg-gray-800 hover:bg-gray-700 rounded-lg transition">
                        GitHub Profile
                    </a>
                </div>
                
                <p className="text-xs text-gray-600">
                    Version 1.0.0 &bull; Licensed MIT &bull; No Data Collection
                </p>
            </div>
        )}

      </main>
    </div>
  );
};

const NavButton = ({ active, onClick, icon, label }: any) => (
    <button 
        onClick={onClick}
        className={`w-full p-3 flex flex-col items-center gap-1 transition-all duration-300 relative ${active ? 'text-blue-400' : 'text-gray-500 hover:text-gray-300'}`}
    >
        {active && <div className="absolute left-0 top-0 bottom-0 w-1 bg-blue-500 rounded-r-full shadow-[0_0_10px_rgba(59,130,246,0.5)]"></div>}
        <div className={`transition-transform duration-300 ${active ? 'scale-110' : ''}`}>{icon}</div>
        <span className="text-[10px] font-medium tracking-wide">{label}</span>
    </button>
);

export default App;