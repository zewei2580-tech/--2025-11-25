
import React, { useState, useRef, useEffect } from 'react';
import { XIcon, SparklesIcon, ChevronDownIcon, WandIcon, BoxIcon, EvolutionIcon, CreativeScaleIcon } from './Icons';
import { CanvasItem } from '../types';
import { EVOLUTION_STAGES, getEvolutionStage } from '../services/evolutionService';

interface ExpressionControllerProps {
  item: CanvasItem;
  view: { x: number; y: number; scale: number };
  onClose: () => void;
  onGenerate: (expressionOrLevel: string) => void;
  initialEvolutionLevel?: number;
}

const EMOTIONS = [
  { id: 'angry', label: 'Angry', emoji: '😠', prompt: 'an angry and furious facial expression, intense gaze' },
  { id: 'sad', label: 'Sad', emoji: '😢', prompt: 'a sad and melancholic facial expression, downcast eyes' },
  { id: 'indifferent', label: 'Indifferent', emoji: '😐', prompt: 'an indifferent and neutral facial expression, blank state' },
  { id: 'happy', label: 'Happy', emoji: '😊', prompt: 'a happy and joyful facial expression, warm smile' },
  { id: 'silly', label: 'Silly', emoji: '😜', prompt: 'a silly and playful facial expression, sticking tongue out, funny look' },
  { id: 'curious', label: 'Curious', emoji: '🤔', prompt: 'a curious and inquisitive facial expression, raised eyebrow, tilted head' },
  { id: 'infatuated', label: 'Infatuated', emoji: '😍', prompt: 'an infatuated and loving facial expression, heart eyes vibe, soft look' },
  { id: 'excited', label: 'Excited', emoji: '🤩', prompt: 'an extremely excited and enthusiastic facial expression, energetic eyes, big smile' },
];

const ExpressionController: React.FC<ExpressionControllerProps> = ({ item, view, onClose, onGenerate, initialEvolutionLevel = 60 }) => {
  const [mode, setMode] = useState<'expression' | 'evolution'>('evolution');
  const [selectedIndex, setSelectedIndex] = useState(3); 
  const [localEvolutionLevel, setLocalEvolutionLevel] = useState(initialEvolutionLevel); 
  const [isDragging, setIsDragging] = useState(false);
  const sliderRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setLocalEvolutionLevel(initialEvolutionLevel);
  }, [initialEvolutionLevel]);

  // 当处于 Canvas 内部绝对定位时，位置相对于 item
  const top = (item.height * view.scale / 2) - 160;
  const left = (item.width * view.scale) + 40;

  const handleMouseDown = (e: React.MouseEvent) => {
    setIsDragging(true);
    updateValue(e);
  };

  const handleMouseMove = (e: MouseEvent) => {
    if (isDragging) updateValue(e);
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  useEffect(() => {
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging]);

  const updateValue = (e: React.MouseEvent | MouseEvent) => {
    if (!sliderRef.current) return;
    const rect = sliderRef.current.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + (110 / 130) * rect.height; 
    const dx = e.clientX - centerX;
    const dy = e.clientY - centerY;
    let angle = Math.atan2(dy, dx);
    let normalized = (angle + Math.PI) / Math.PI;
    normalized = Math.max(0, Math.min(1, normalized));
    if (mode === 'expression') {
      const newIndex = Math.round(normalized * (EMOTIONS.length - 1));
      setSelectedIndex(newIndex);
    } else {
      const newLevel = Math.round(normalized * 100);
      setLocalEvolutionLevel(newLevel);
    }
  };

  const handleGenerate = () => {
    if (mode === 'expression') {
      onGenerate(`expr:${EMOTIONS[selectedIndex].prompt}`);
    } else {
      onGenerate(`evolve_with_level:${localEvolutionLevel}`);
    }
  };

  const getPointOnArc = (percent: number) => {
    const angle = (percent / 100) * Math.PI - Math.PI;
    const radius = 100;
    return { x: Math.cos(angle) * radius + 110, y: Math.sin(angle) * radius + 110 };
  };

  const handleToggleMode = () => {
    setMode(mode === 'expression' ? 'evolution' : 'expression');
  };

  const currentStage = getEvolutionStage(localEvolutionLevel);
  const handlePercent = mode === 'expression' ? (selectedIndex / (EMOTIONS.length - 1)) * 100 : localEvolutionLevel;
  const currentPos = getPointOnArc(handlePercent);

  const getStageIcon = (id: string) => {
      switch(id) {
          case 'polish': return <WandIcon className="w-8 h-8 text-indigo-400" />;
          case 'detailing': return <CreativeScaleIcon className="w-8 h-8 text-indigo-400" />;
          case 'reconstruction': return <BoxIcon className="w-8 h-8 text-indigo-400" />;
          case 'radical': return <EvolutionIcon className="w-8 h-8 text-indigo-400" />;
          default: return <WandIcon className="w-8 h-8 text-indigo-400" />;
      }
  };

  return (
    <div 
      className="absolute z-[200] bg-[#0c0c0e]/95 backdrop-blur-3xl border border-white/10 p-6 rounded-[32px] shadow-[0_40px_100px_rgba(0,0,0,0.8)] animate-in zoom-in-95 duration-300 pointer-events-auto flex flex-col items-center gap-6 select-none w-[280px]"
      onMouseDown={e => e.stopPropagation()}
    >
      <div className="w-full flex items-center justify-between mb-2">
        <button 
          onClick={handleToggleMode}
          className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest transition-all ${mode === 'evolution' ? 'bg-indigo-500/20 text-indigo-400 border border-indigo-500/30' : 'bg-white/5 text-zinc-400 hover:bg-white/10'}`}
        >
          {mode === 'expression' ? '情感/表达调节' : '工业智能演化 (ID)'}
          <ChevronDownIcon className="w-3 h-3" />
        </button>
        <button onClick={onClose} className="p-2 text-zinc-500 hover:text-white transition-colors">
          <XIcon className="w-4 h-4" />
        </button>
      </div>

      <div className="relative w-[220px] h-[130px] flex items-end justify-center overflow-visible" ref={sliderRef} onMouseDown={handleMouseDown}>
         <svg className="absolute inset-0 overflow-visible" viewBox="0 0 220 130">
            <path d="M 10 110 A 100 100 0 0 1 210 110" fill="none" stroke="white" strokeWidth="2" strokeOpacity="0.05" strokeLinecap="round" />
            <path d={`M 10 110 A 100 100 0 0 1 ${currentPos.x} ${currentPos.y}`} fill="none" stroke={mode === 'evolution' ? "#8b80ff" : "#5546fe"} strokeWidth="4" strokeLinecap="round" className={isDragging ? "" : "transition-all duration-300"} />
            {mode === 'expression' && EMOTIONS.map((_, i) => {
                const p = getPointOnArc((i / (EMOTIONS.length - 1)) * 100);
                const isActive = selectedIndex === i;
                return <circle key={i} cx={p.x} cy={p.y} r={isActive ? 4 : 2} fill={isActive ? "#5546fe" : "white"} fillOpacity={isActive ? 1 : 0.2} className="transition-all duration-300" />;
            })}
            <circle cx={currentPos.x} cy={currentPos.y} r="8" fill={mode === 'evolution' ? "#8b80ff" : "#5546fe"} className={`shadow-2xl ${isDragging ? "" : "transition-all duration-300"}`} style={{ filter: 'drop-shadow(0 0 8px rgba(139, 128, 255, 0.5))' }} />
            <circle cx={currentPos.x} cy={currentPos.y} r="3" fill="white" className={isDragging ? "" : "transition-all duration-300"} />
         </svg>
         <div className="flex flex-col items-center gap-3 animate-in fade-in duration-500 mb-2">
             <div className="w-16 h-16 rounded-[24px] bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center shadow-inner overflow-hidden relative">
                {mode === 'expression' ? ( <span className="text-4xl animate-in zoom-in duration-300" key={EMOTIONS[selectedIndex].emoji}>{EMOTIONS[selectedIndex].emoji}</span> ) : ( <div className="flex flex-col items-center gap-0.5 animate-in zoom-in duration-300" key={currentStage.id}>{getStageIcon(currentStage.id)}</div> )}
             </div>
             <div className="flex flex-col items-center min-h-[32px]">
                <span className="text-white font-black text-[11px] uppercase tracking-[0.2em] text-center">{mode === 'expression' ? EMOTIONS[selectedIndex].label : currentStage.label}</span>
                {mode === 'evolution' && ( <span className="text-indigo-400 font-mono text-[10px] font-black mt-0.5 animate-in fade-in">{localEvolutionLevel}% STRENGTH</span> )}
             </div>
         </div>
      </div>
      <button onClick={handleGenerate} className={`w-full py-4 rounded-[20px] font-black text-[12px] uppercase tracking-[0.2em] shadow-2xl transition-all active:scale-95 flex items-center justify-center gap-3 group ${mode === 'evolution' ? 'bg-indigo-600 hover:bg-indigo-500 text-white' : 'bg-[#5546fe] hover:bg-[#6366f1] text-white'}`} > <SparklesIcon className="w-4 h-4 group-hover:rotate-12 transition-transform" /> {mode === 'evolution' ? '执行精确演化' : '立即重绘表情'} </button>
      <div className="w-full flex justify-between items-center text-[8px] font-black text-zinc-700 uppercase tracking-widest px-2"> <span>{mode === 'expression' ? 'Angry' : 'Polish'}</span> <span>{mode === 'expression' ? 'Excited' : 'Radical'}</span> </div>
    </div>
  );
};

export default ExpressionController;
