
import React, { useState } from 'react';
import { ToolType } from '../types';
import { 
  PlusIcon, CursorIcon, TypeIcon, UploadIcon, 
  LayoutGridIcon, FrameIcon, ClockIcon, VideoIcon, StopIcon, TargetIcon
} from './Icons';

interface LeftToolbarProps {
  activeTool: ToolType;
  setTool: (tool: ToolType) => void;
  onUpload: () => void;
  onToggleLayers?: () => void;
  showLayers?: boolean;
  onAddFrame?: () => void;
  onToggleHistory?: () => void;
  showHistory?: boolean;
  recordingStatus: 'idle' | 'recording' | 'paused';
  onStartRecording: (res: string) => void;
  onStopRecording: () => void;
  onPauseRecording: () => void;
  onResumeRecording: () => void;
  recordingTime: number;
  onAction?: (action: string) => void;
}

const LeftToolbar: React.FC<LeftToolbarProps> = ({ 
  activeTool, setTool, onUpload, onToggleLayers, showLayers, 
  onAddFrame, onToggleHistory, showHistory,
  recordingStatus, onStartRecording, onStopRecording, onPauseRecording, onResumeRecording, recordingTime,
  onAction
}) => {
  const [showResMenu, setShowResMenu] = useState(false);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className="absolute top-4 left-4 flex flex-col gap-3 z-50 pointer-events-none">
      <button className="w-12 h-12 bg-[#09090b] text-white rounded-[18px] flex items-center justify-center shadow-[0_12px_30px_rgba(0,0,0,0.4)] hover:scale-110 active:scale-95 transition-all group pointer-events-auto border border-white/5">
        <PlusIcon className="w-6 h-6 group-hover:rotate-90 transition-transform duration-500" />
      </button>

      <div className="bg-[#09090b]/90 border border-white/10 rounded-[22px] shadow-[0_15px_45px_rgba(0,0,0,0.2)] flex flex-col p-1.5 gap-1 backdrop-blur-3xl pointer-events-auto">
        <button
          onClick={onToggleLayers}
          className={`w-9 h-9 rounded-[14px] flex items-center justify-center transition-all ${showLayers ? 'bg-indigo-600 text-white shadow-lg' : 'text-zinc-500 hover:bg-white/5 hover:text-zinc-200'}`}
          title="Outline"
        >
          <LayoutGridIcon className="w-5 h-5" />
        </button>

        <button
          onClick={onToggleHistory}
          className={`w-9 h-9 rounded-[14px] flex items-center justify-center transition-all ${showHistory ? 'bg-indigo-600 text-white shadow-xl' : 'text-zinc-500 hover:bg-white/5 hover:text-zinc-200'}`}
          title="History"
        >
          <ClockIcon className="w-5 h-5" />
        </button>

        <div className="h-px bg-white/5 my-1 mx-2" />

        <button 
            onClick={() => setTool('select')} 
            className={`w-9 h-9 rounded-[14px] flex items-center justify-center transition-all ${activeTool === 'select' ? 'bg-white text-black shadow-xl' : 'text-zinc-500 hover:bg-white/5 hover:text-zinc-200'}`} 
            title="Select (V)"
        >
          <CursorIcon className="w-5 h-5" />
        </button>

        <button onClick={() => setTool('frame')} className={`w-9 h-9 rounded-[14px] flex items-center justify-center transition-all ${activeTool === 'frame' ? 'bg-white text-black shadow-xl' : 'text-zinc-500 hover:bg-white/5 hover:text-zinc-200'}`} title="Frame (F)">
          <FrameIcon className="w-5 h-5" />
        </button>

        <button onClick={() => setTool('text')} className={`w-9 h-9 rounded-[14px] flex items-center justify-center transition-all ${activeTool === 'text' ? 'bg-white text-black shadow-xl' : 'text-zinc-500 hover:bg-white/5 hover:text-zinc-200'}`} title="Text (T)">
          <TypeIcon className="w-5 h-5" />
        </button>

        <div className="h-px bg-white/5 my-1 mx-2" />

        <button 
            onClick={() => setTool('point')} 
            className={`w-9 h-9 rounded-[14px] flex items-center justify-center transition-all ${activeTool === 'point' ? 'bg-blue-600 text-white shadow-[0_5px_15px_rgba(37,99,235,0.3)]' : 'text-zinc-500 hover:bg-white/5 hover:text-blue-400'}`} 
            title="Point Reference (R)"
        >
          <TargetIcon className="w-5 h-5" />
        </button>

        <button onClick={onUpload} className="w-9 h-9 rounded-[14px] flex items-center justify-center text-indigo-400 hover:bg-indigo-500/10 transition-all border border-transparent hover:border-indigo-500/20" title="Upload Image">
          <UploadIcon className="w-5 h-5" />
        </button>

        <div className="h-px bg-white/5 my-1 mx-2" />

        <div className="relative group">
          <button 
            onClick={() => {
              if (recordingStatus === 'idle') setShowResMenu(!showResMenu);
              else onStopRecording();
            }}
            className={`w-9 h-9 rounded-[14px] flex items-center justify-center transition-all ${recordingStatus !== 'idle' ? 'bg-red-500 text-white animate-pulse shadow-xl' : 'text-zinc-500 hover:bg-white/5 hover:text-red-500'}`}
            title={recordingStatus === 'idle' ? "Recording" : "Stop"}
          >
            {recordingStatus === 'idle' ? <VideoIcon className="w-5 h-5" /> : <StopIcon className="w-5 h-5" />}
          </button>

          {showResMenu && recordingStatus === 'idle' && (
            <div className="absolute left-full top-0 ml-4 bg-[#121214] border border-white/10 rounded-[20px] shadow-3xl p-1.5 w-32 animate-in slide-in-from-left-4 fade-in duration-300 backdrop-blur-2xl">
              <div className="text-[9px] font-black text-zinc-500 px-3 py-2 uppercase tracking-[0.2em] border-b border-white/5 mb-1">分辨率</div>
              {['720P', '1080P', '2K'].map(res => (
                <button 
                  key={res}
                  onClick={() => { onStartRecording(res); setShowResMenu(false); }}
                  className="w-full text-left px-3 py-2.5 text-[11px] font-black text-zinc-400 hover:bg-white/5 hover:text-white rounded-xl transition-all"
                >
                  {res}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default LeftToolbar;
