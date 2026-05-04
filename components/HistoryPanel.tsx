
import React, { useEffect, useState } from 'react';
import { ProjectSnapshot, getAllSnapshots, deleteSnapshot } from '../services/dbService';
import { TrashIcon, ClockIcon, RotateCcwIcon, XIcon, ImageIcon } from './Icons';

interface HistoryPanelProps {
  isOpen: boolean;
  onClose: () => void;
  onRestore: (snapshot: ProjectSnapshot) => void;
}

const HistoryPanel: React.FC<HistoryPanelProps> = ({ isOpen, onClose, onRestore }) => {
  const [snapshots, setSnapshots] = useState<ProjectSnapshot[]>([]);

  useEffect(() => {
    if (isOpen) {
      loadSnapshots();
    }
  }, [isOpen]);

  const loadSnapshots = async () => {
    const data = await getAllSnapshots();
    setSnapshots(data);
  };

  const handleDelete = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    await deleteSnapshot(id);
    loadSnapshots();
  };

  const formatTime = (ts: number) => {
    const date = new Date(ts);
    return date.toLocaleString('zh-CN', { 
        month: 'short', 
        day: 'numeric', 
        hour: '2-digit', 
        minute: '2-digit' 
    });
  };

  if (!isOpen) return null;

  return (
    <div className="absolute top-4 left-[68px] bottom-6 w-80 bg-white/95 dark:bg-zinc-900/95 backdrop-blur-xl border border-zinc-200 dark:border-zinc-800 rounded-2xl shadow-2xl z-40 flex flex-col pointer-events-auto overflow-hidden animate-in slide-in-from-left-4 duration-300">
      <div className="p-4 border-b border-zinc-100 dark:border-zinc-800 flex items-center justify-between bg-zinc-50/50 dark:bg-zinc-800/20">
        <div className="flex items-center gap-2">
            <ClockIcon className="w-4 h-4 text-indigo-500" />
            <span className="text-[10px] font-black text-zinc-500 uppercase tracking-widest">History Log</span>
        </div>
        <button onClick={onClose} className="p-1 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-lg text-zinc-400">
          <XIcon className="w-4 h-4" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto no-scrollbar p-3 space-y-3">
        {snapshots.map((snapshot) => (
          <div 
            key={snapshot.id}
            onClick={() => onRestore(snapshot)}
            className="group relative bg-white dark:bg-zinc-800/40 border border-zinc-100 dark:border-zinc-800 rounded-xl overflow-hidden cursor-pointer hover:border-indigo-500/50 hover:shadow-lg transition-all"
          >
            <div className="aspect-[4/3] w-full bg-zinc-100 dark:bg-zinc-950 flex items-center justify-center overflow-hidden">
                {snapshot.thumbnail ? (
                    <img src={snapshot.thumbnail} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                ) : (
                    <ImageIcon className="w-8 h-8 opacity-10" />
                )}
                <div className="absolute inset-0 bg-indigo-600/0 group-hover:bg-indigo-600/10 transition-colors" />
            </div>
            
            <div className="p-3 space-y-1">
                <div className="flex items-center justify-between">
                    <span className="text-[10px] font-bold text-zinc-400 font-mono">{formatTime(snapshot.updatedAt)}</span>
                    <button 
                        onClick={(e) => handleDelete(e, snapshot.id)}
                        className="opacity-0 group-hover:opacity-100 p-1.5 hover:bg-red-500/10 text-zinc-500 hover:text-red-500 rounded-lg transition-all"
                    >
                        <TrashIcon className="w-3.5 h-3.5" />
                    </button>
                </div>
                <p className="text-[11px] font-bold text-zinc-800 dark:text-zinc-200 line-clamp-1 uppercase tracking-tight">
                    {snapshot.name || 'Untitled Design'}
                </p>
            </div>
          </div>
        ))}

        {snapshots.length === 0 && (
          <div className="flex flex-col items-center justify-center h-64 text-zinc-500 px-8 text-center gap-4">
             <div className="w-12 h-12 bg-zinc-100 dark:bg-zinc-800 rounded-2xl flex items-center justify-center">
                <ClockIcon className="w-6 h-6 opacity-20" />
             </div>
             <div className="space-y-1">
                <p className="text-[10px] font-black uppercase tracking-widest">No History Yet</p>
                <p className="text-[9px] leading-relaxed opacity-60">Your designs will automatically appear here once you start generating or creating.</p>
             </div>
          </div>
        )}
      </div>

      <div className="p-3 bg-zinc-50 dark:bg-zinc-950/50 border-t border-zinc-100 dark:border-zinc-800">
         <p className="text-[9px] text-zinc-400 font-bold text-center uppercase tracking-widest flex items-center justify-center gap-2">
            <RotateCcwIcon className="w-3 h-3" /> Auto-Synced to Local Storage
         </p>
      </div>
    </div>
  );
};

export default HistoryPanel;
