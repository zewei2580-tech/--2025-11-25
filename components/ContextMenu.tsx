
import React from 'react';
import { 
  FrameIcon, UploadIcon, RefreshIcon, EraserIcon, 
  LayoutGridIcon, TrashIcon, CopyIcon, LockIcon, MessageCircleIcon, FileIcon
} from './Icons';
import { CanvasItem, ItemType } from '../types';

interface ContextMenuProps {
  x: number; y: number;
  selectedItem: CanvasItem | null;
  onClose: () => void;
  onSelect: (action: string) => void;
  isMulti?: boolean;
}

const ContextMenu: React.FC<ContextMenuProps> = ({ x, y, selectedItem, onClose, onSelect, isMulti }) => {
  return (
    <>
      <div className="fixed inset-0 z-[90]" onClick={onClose} />
      <div className="fixed z-[100] bg-zinc-900 border border-zinc-800 rounded-xl shadow-2xl w-56 py-2 overflow-hidden" style={{ top: y, left: x }}>
         {isMulti && (
             <>
                <button onClick={() => onSelect('frame_selection')} className="w-full px-4 py-2 text-[10px] flex items-center gap-3 text-indigo-400 hover:bg-zinc-800 font-black uppercase tracking-widest transition-colors">
                    <FrameIcon className="w-4 h-4" /> Frame Selection
                </button>
                <button onClick={() => onSelect('gridify')} className="w-full px-4 py-2 text-[10px] flex items-center gap-3 text-indigo-400 hover:bg-zinc-800 font-black uppercase tracking-widest transition-colors">
                    <LayoutGridIcon className="w-4 h-4" /> Align to Grid
                </button>
             </>
         )}
         {!isMulti && !selectedItem && (
             <>
                <button onClick={() => onSelect('frame')} className="w-full px-4 py-2 text-[10px] font-bold uppercase tracking-widest flex items-center gap-3 text-zinc-300 hover:bg-zinc-800 transition-colors"><FrameIcon className="w-4 h-4" /> Add Frame</button>
                <button onClick={() => onSelect('upload')} className="w-full px-4 py-2 text-[10px] font-bold uppercase tracking-widest flex items-center gap-3 text-zinc-300 hover:bg-zinc-800 transition-colors"><UploadIcon className="w-4 h-4" /> Upload</button>
             </>
         )}
         {selectedItem && (
             <>
                {selectedItem.type === ItemType.IMAGE && (
                    <>
                        <button onClick={() => onSelect('send_to_gemini')} className="w-full px-4 py-2 text-[10px] font-bold uppercase tracking-widest flex items-center gap-3 text-[#8b80ff] hover:bg-zinc-800 transition-colors">
                            <MessageCircleIcon className="w-4 h-4" /> Send to Gemini
                        </button>
                        <button onClick={() => onSelect('send_to_prompt')} className="w-full px-4 py-2 text-[10px] font-bold uppercase tracking-widest flex items-center gap-3 text-indigo-400 hover:bg-zinc-800 transition-colors">
                            <FileIcon className="w-4 h-4" /> 引用此图 (To Prompt)
                        </button>
                    </>
                )}
                <div className="h-px bg-zinc-800 my-1" />
                <button onClick={() => onSelect('frame_selection')} className="w-full px-4 py-2 text-[10px] font-bold uppercase tracking-widest flex items-center gap-3 text-zinc-300 hover:bg-zinc-800 transition-colors">
                    <FrameIcon className="w-4 h-4" /> Frame Selection
                </button>
                <button onClick={() => onSelect('variations')} className="w-full px-4 py-2 text-[10px] font-bold uppercase tracking-widest flex items-center gap-3 text-zinc-300 hover:bg-zinc-800 transition-colors"><RefreshIcon className="w-4 h-4" /> Variations</button>
                <button onClick={() => onSelect('copy')} className="w-full px-4 py-2 text-[10px] font-bold uppercase tracking-widest flex items-center gap-3 text-zinc-300 hover:bg-zinc-800 transition-colors"><CopyIcon className="w-4 h-4" /> Copy Content</button>
                <div className="h-px bg-zinc-800 my-1" />
                <button onClick={() => onSelect('delete')} className="w-full px-4 py-2 text-[10px] font-black uppercase tracking-widest flex items-center gap-3 text-red-500 hover:bg-red-500/10 transition-colors"><TrashIcon className="w-4 h-4" /> Delete</button>
             </>
         )}
      </div>
    </>
  );
};
export default ContextMenu;
