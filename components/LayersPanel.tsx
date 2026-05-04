import React, { useState } from 'react';
import { CanvasItem, ItemType } from '../types';
import { 
  ImageIcon, TypeIcon, SquareIcon, CircleIcon, ArrowIcon, 
  LineIcon, PenIcon, FrameIcon, LockIcon, GripIcon
} from './Icons';

interface LayersPanelProps {
  isOpen: boolean;
  items: CanvasItem[];
  selection: string | null;
  onSelectItem: (id: string) => void;
  onUpdateItem: (id: string, updates: Partial<CanvasItem>) => void;
}

const LayersPanel: React.FC<LayersPanelProps> = ({ isOpen, items, selection, onSelectItem, onUpdateItem }) => {
  const [editingId, setEditingId] = useState<string | null>(null);

  if (!isOpen) return null;

  const getItemIcon = (item: CanvasItem) => {
    switch (item.type) {
      case ItemType.IMAGE: return <ImageIcon className="w-4 h-4" />;
      case ItemType.TEXT: return <TypeIcon className="w-4 h-4" />;
      case ItemType.SHAPE:
        if (item.content === 'rectangle') return <SquareIcon className="w-4 h-4" />;
        if (item.content === 'circle') return <CircleIcon className="w-4 h-4" />;
        return <SquareIcon className="w-4 h-4" />;
      case ItemType.PEN: return <PenIcon className="w-4 h-4" />;
      case ItemType.FRAME: return <FrameIcon className="w-4 h-4 text-indigo-500" />;
      default: return null;
    }
  };

  const getItemName = (item: CanvasItem) => {
    if (item.type === ItemType.FRAME || item.type === ItemType.TEXT) {
      return item.content || (item.type === ItemType.FRAME ? 'Unnamed Frame' : 'Empty Text');
    }
    if (item.type === ItemType.IMAGE) {
      return item.prompt?.slice(0, 24) || 'Untitled Design';
    }
    return item.type.toLowerCase();
  };

  // Build Hierarchy
  const frames = items.filter(i => i.type === ItemType.FRAME);
  const looseItems = items.filter(i => i.type !== ItemType.FRAME && !frames.some(f => 
      (i.x + i.width/2) >= f.x && (i.x + i.width/2) <= f.x + f.width && 
      (i.y + i.height/2) >= f.y && (i.y + i.height/2) <= f.y + f.height
  ));

  const renderItemRow = (item: CanvasItem, depth = 0) => {
    const isSelected = selection === item.id;
    const isEditing = editingId === item.id;

    return (
      <div 
        key={item.id}
        className={`group flex items-center gap-3 px-4 py-2.5 cursor-pointer transition-all border-l-[3px] ${isSelected ? 'bg-indigo-600/5 border-indigo-500' : 'border-transparent hover:bg-zinc-50'}`}
        style={{ paddingLeft: `${depth * 20 + 16}px` }}
        onClick={() => onSelectItem(item.id)}
        onDoubleClick={(e) => { e.stopPropagation(); setEditingId(item.id); }}
      >
        <div className={`shrink-0 transition-colors ${isSelected ? 'text-indigo-600' : 'text-zinc-400 group-hover:text-zinc-600'}`}>
          {getItemIcon(item)}
        </div>
        
        {isEditing ? (
            <input 
                autoFocus
                className="bg-white text-zinc-900 text-[12px] px-2 py-0.5 rounded border-2 border-indigo-500 focus:outline-none w-full font-bold"
                value={item.content || ''}
                onChange={(e) => onUpdateItem(item.id, { content: e.target.value })}
                onBlur={() => setEditingId(null)}
                onKeyDown={(e) => e.key === 'Enter' && setEditingId(null)}
                onClick={(e) => e.stopPropagation()}
            />
        ) : (
            <span className={`text-[12px] font-bold truncate flex-1 uppercase tracking-tight transition-colors ${isSelected ? 'text-indigo-600' : 'text-zinc-500 group-hover:text-zinc-800'}`}>
                {getItemName(item)}
            </span>
        )}

        {item.locked && <LockIcon className="w-3.5 h-3.5 text-zinc-300" />}
      </div>
    );
  };

  return (
    <div className="absolute top-4 left-[76px] bottom-10 w-64 bg-white border border-zinc-200 shadow-[0_12px_40px_rgba(0,0,0,0.12)] rounded-[24px] z-40 flex flex-col pointer-events-auto overflow-hidden animate-in slide-in-from-left-6 duration-500">
        <div className="p-5 border-b border-zinc-50 flex items-center justify-between">
            <span className="text-[11px] font-black text-zinc-400 uppercase tracking-[0.2em]">Outline</span>
            <span className="text-[10px] bg-zinc-100 text-zinc-500 px-2 py-1 rounded-lg font-black">{items.length}</span>
        </div>

        <div className="flex-1 overflow-y-auto no-scrollbar py-4">
            {/* Frames and their children */}
            {frames.map(frame => (
                <div key={frame.id} className="mb-2">
                    {renderItemRow(frame)}
                    <div className="ml-8 border-l-2 border-zinc-50 my-1 py-1">
                        {items.filter(i => 
                            i.id !== frame.id && i.type !== ItemType.FRAME && 
                            (i.x + i.width/2) >= frame.x && (i.x + i.width/2) <= frame.x + frame.width && 
                            (i.y + i.height/2) >= frame.y && (i.y + i.height/2) <= frame.y + frame.height
                        ).map(child => renderItemRow(child, 0))}
                    </div>
                </div>
            ))}

            {/* Independent Layers */}
            {looseItems.length > 0 && (
                <div className="mt-6">
                    <div className="px-5 py-2 mb-2 text-[10px] font-black text-zinc-400 uppercase tracking-[0.2em] opacity-60">Independent Layers</div>
                    {looseItems.map(item => renderItemRow(item))}
                </div>
            )}

            {items.length === 0 && (
                <div className="flex flex-col items-center justify-center h-64 text-zinc-300 px-8 text-center gap-4">
                    <div className="w-12 h-12 bg-zinc-50 rounded-2xl flex items-center justify-center">
                        <GripIcon className="w-6 h-6 opacity-20" />
                    </div>
                    <div className="space-y-1">
                        <p className="text-[11px] font-black uppercase tracking-widest text-zinc-400">Canvas is empty</p>
                        <p className="text-[10px] leading-relaxed opacity-50">Upload designs or add frames to see the outline structure.</p>
                    </div>
                </div>
            )}
        </div>

        <div className="p-4 bg-zinc-50 text-[10px] text-zinc-400 font-black text-center uppercase tracking-[0.2em] border-t border-zinc-100/50">
            Press "L" to toggle
        </div>
    </div>
  );
};

export default LayersPanel;