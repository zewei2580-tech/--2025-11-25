
import React from 'react';
import { 
  SparklesIcon, 
  RefreshIcon, 
  EraserIcon, 
  UpscaleIcon, 
  TrashIcon, 
  CopyIcon,
  MaximizeIcon,
  ScissorsIcon,
  EvolutionIcon,
  SmileIcon,
  FlaskIcon,
  BoxIcon,
  RotateCcwIcon,
  WandIcon,
  ShuffleIcon,
  // Fix: Removed non-existent Maximize2Icon import and using MaximizeIcon instead.
} from './Icons';
import { CanvasItem, ItemType } from '../types';

interface FloatingSelectionBarProps {
  items: CanvasItem[]; 
  onAction: (action: string) => void;
}

const FloatingSelectionBar: React.FC<FloatingSelectionBarProps> = ({ items, onAction }) => {
  if (items.length === 0) return null;

  const isMulti = items.length > 1;
  const isAllImages = items.every(it => it.type === ItemType.IMAGE);
  const firstItem = items[0];

  return (
    <div 
      className="flex items-center gap-1 bg-[#0c0c0e]/95 backdrop-blur-2xl border border-white/10 p-1.5 rounded-[22px] shadow-[0_30px_60px_rgba(0,0,0,0.6)] pointer-events-auto"
      onMouseDown={e => e.stopPropagation()}
    >
      {!isMulti ? (
          <>
            <div className="flex items-center gap-1.5 pr-1.5 border-r border-white/5">
                <button 
                  onClick={() => onAction('topology_variation')}
                  className="w-10.5 h-10.5 flex items-center justify-center bg-zinc-800 hover:bg-zinc-700 text-emerald-400 rounded-[14px] transition-all"
                  title="拓扑变体"
                >
                  <ShuffleIcon className="w-5 h-5" />
                </button>
                <button 
                  onClick={() => onAction('expression')}
                  className="w-10.5 h-10.5 flex items-center justify-center text-zinc-400 hover:text-white hover:bg-white/5 rounded-[14px] transition-all"
                  title="表情调节"
                >
                  <SmileIcon className="w-5 h-5" />
                </button>
                {firstItem.type === ItemType.MODEL && (
                    <button 
                        onClick={() => onAction('maximized_3d')}
                        className="w-10.5 h-10.5 flex items-center justify-center bg-white text-black rounded-[14px] transition-all group active:scale-90 shadow-lg"
                        title="进入聚焦模式"
                    >
                        {/* Fix: Replaced non-existent Maximize2Icon with MaximizeIcon */}
                        <MaximizeIcon className="w-5 h-5" />
                    </button>
                )}
                <button 
                  onClick={() => onAction('evolve')}
                  className="w-10.5 h-10.5 flex items-center justify-center bg-[#5546fe] hover:bg-indigo-500 text-white rounded-[14px] transition-all group active:scale-90 shadow-lg shadow-indigo-600/20"
                  title="智能演化"
                >
                  <EvolutionIcon className="w-5 h-5" />
                </button>
            </div>

            <div className="flex items-center gap-1 px-1.5 border-r border-white/5">
                <button 
                  onClick={() => onAction('redo')}
                  className="w-10.5 h-10.5 flex items-center justify-center text-indigo-400 hover:text-white hover:bg-white/5 rounded-[14px] transition-all"
                  title="重新生成"
                >
                  <RotateCcwIcon className="w-5 h-5" />
                </button>
                <button 
                  onClick={() => onAction('smart_eraser')}
                  className="w-10.5 h-10.5 flex items-center justify-center text-zinc-400 hover:text-white hover:bg-white/5 rounded-[14px] transition-all"
                  title="智能橡皮擦"
                >
                  <EraserIcon className="w-5 h-5" />
                </button>
                <button 
                  onClick={() => onAction('upscale')}
                  className="w-10.5 h-10.5 flex items-center justify-center text-zinc-400 hover:text-white hover:bg-white/5 rounded-[14px] transition-all"
                  title="高清放大"
                >
                  <UpscaleIcon className="w-5 h-5" />
                </button>
            </div>

            <div className="flex items-center gap-1 pl-1.5">
                <button 
                  onClick={() => onAction('edit')}
                  className="w-10.5 h-10.5 flex items-center justify-center text-zinc-400 hover:text-white hover:bg-white/5 rounded-[14px] transition-all"
                  title="局部修改"
                >
                  <ScissorsIcon className="w-5 h-5" />
                </button>
                <button 
                  onClick={() => onAction('delete')}
                  className="w-10.5 h-10.5 flex items-center justify-center text-zinc-500 hover:text-red-500 hover:bg-red-500/10 rounded-[14px] transition-all"
                  title="删除"
                >
                  <TrashIcon className="w-5 h-5" />
                </button>
            </div>
          </>
      ) : (
          <div className="flex items-center gap-1.5 px-1.5 py-1">
            {isAllImages && (
                <button 
                    onClick={() => onAction('extract_recipe')}
                    className="flex items-center gap-2.5 px-5 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-[16px] transition-all group active:scale-95 shadow-xl shadow-indigo-600/30"
                >
                    <FlaskIcon className="w-4.5 h-4.5" />
                    <span className="text-[11px] font-black uppercase tracking-widest whitespace-nowrap">提取设计食谱</span>
                </button>
            )}
            <button 
                onClick={() => onAction('copy')}
                className="w-10.5 h-10.5 flex items-center justify-center text-zinc-400 hover:text-white hover:bg-white/5 rounded-[14px] transition-all"
                title="复制选中的项"
            >
                <CopyIcon className="w-5 h-5" />
            </button>
            <button 
                onClick={() => onAction('delete')}
                className="w-10.5 h-10.5 flex items-center justify-center text-zinc-500 hover:text-red-500 hover:bg-red-500/10 rounded-[14px] transition-all"
                title="删除选中的项"
            >
                <TrashIcon className="w-5 h-5" />
            </button>
          </div>
      )}
    </div>
  );
};

export default FloatingSelectionBar;
