export enum AppMode {
  HOME = 'HOME',
  RECORDING = 'RECORDING',
  EDITOR = 'EDITOR',
  LIBRARY = 'LIBRARY',
  ABOUT = 'ABOUT'
}

export interface VideoMetadata {
  id: string;
  blob: Blob;
  title: string;
  createdAt: number;
  duration: number;
  thumbnail?: string;
}

export interface RecordingSettings {
  resolution: '720p' | '1080p' | '4k';
  frameRate: number;
  recordMic: boolean;
  recordSystemAudio: boolean;
  showWebcam: boolean;
  webcamShape: 'circle' | 'square';
  webcamPosition: 'bottom-right' | 'bottom-left' | 'top-right' | 'top-left';
}

export interface EditorFilters {
  brightness: number; // 100 is default
  contrast: number; // 100 is default
  saturate: number; // 100 is default
  grayscale: number; // 0 is default
  sepia: number; // 0 is default
  blur: number; // 0 is default
}