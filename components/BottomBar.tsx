import { useState, useRef, useEffect } from 'react';
import React from 'react';
import { 
  SparklesIcon, 
  SettingsIcon, 
  ArrowIcon,
  CheckIcon,
  LayoutGridIcon,
  SlidersIcon,
  PlusIcon,
  XIcon,
  ChevronUpIcon,
  FlaskIcon,
  TrashIcon,
  DownloadIcon,
  UploadIcon,
  ZapIcon
} from './Icons';
import { STYLES, ASPECT_RATIOS } from '../constants';
import { ResolutionType, DesignRecipe, Playstyle } from '../types';
import { getAllRecipes, deleteRecipe } from '../services/dbService';
import PlaystylePanel from './PlaystylePanel';

interface BottomBarProps {
  lastGenerated: string | null;
  externalRef: string | null;
  onExternalRefConsumed: () => void;
  onGenerate: (prompt: string, style: string, ratio: string, refImages: string[], imageCount: number, artisticLevel: number, resolution: ResolutionType, recipeId?: string, usePro?: boolean) => void;
  onClose?: () => void;
  onExportRecipes?: () => void;
  onImportRecipes?: (file: File) => void;
}

const detectAndMatchRatio = (base64: string): Promise<string> => {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      const ratio = img.naturalWidth / img.naturalHeight;
      const targets = ASPECT_RATIOS.map(r => {
        const [w, h] = r.id.split(':').map(Number);
        return { id: r.id, val: w / h };
      });
      const closest = targets.reduce((prev, curr) => 
        Math.abs(curr.val - ratio) < Math.abs(prev.val - ratio) ? curr : prev
      );
      resolve(closest.id);
    };
    img.onerror = () => resolve('1:1');
    img.src = base64;
  });
};

const BottomBar: React.FC<BottomBarProps> = ({ 
  lastGenerated, 
  externalRef, 
  onExternalRefConsumed, 
  onGenerate,
  onClose,
  onExportRecipes,
  onImportRecipes
}) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [prompt, setPrompt] = useState('');
  const [selectedStyle, setSelectedStyle] = useState(STYLES[0]);
  const [selectedRatio, setSelectedRatio] = useState(ASPECT_RATIOS[0]);
  const [refImages, setRefImages] = useState<string[]>([]);
  const [selectedResolution, setSelectedResolution] = useState<ResolutionType>('1K');
  const [usePro, setUsePro] = useState(false); 
  
  const [showStyles, setShowStyles] = useState(false);
  const [showRatios, setShowRatios] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [showResolution, setShowResolution] = useState(false);
  const [showRecipes, setShowRecipes] = useState(false);
  const [showPlaystyles, setShowPlaystyles] = useState(false);

  const [artisticLevel, setArtisticLevel] = useState(50);
  const [imageCount, setImageCount] = useState(1);
  const [recipes, setRecipes] = useState<DesignRecipe[]>([]);
  const [selectedRecipeId, setSelectedRecipeId] = useState<string | undefined>(undefined);
  const [activePlaystyle, setActivePlaystyle] = useState<Playstyle | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const recipeImportRef = useRef<HTMLInputElement>(null);

  const loadRecipes = async () => {
    const data = await getAllRecipes();
    setRecipes(data);
  };

  // 挂载时立即加载食谱
  useEffect(() => {
    loadRecipes();
  }, []);

  useEffect(() => {
    if (showRecipes) loadRecipes();
  }, [showRecipes]);

  useEffect(() => {
    const handleOpenPlaystyles = () => {
      setShowPlaystyles(true);
      setShowRecipes(false);
      setShowStyles(false);
      setShowRatios(false);
    };
    window.addEventListener('open_playstyles', handleOpenPlaystyles);
    return () => window.removeEventListener('open_playstyles', handleOpenPlaystyles);
  }, []);

  useEffect(() => {
    if (externalRef) {
      const handleExternalRef = async () => {
        setIsExpanded(true);
        setRefImages(prev => {
          if (prev.includes(externalRef)) return prev;
          return [...prev, externalRef].slice(-3);
        });
        const matchedId = await detectAndMatchRatio(externalRef);
        const matchedRatioObj = ASPECT_RATIOS.find(r => r.id === matchedId);
        if (matchedRatioObj) setSelectedRatio(matchedRatioObj);
        onExternalRefConsumed();
      };
      handleExternalRef();
    }
  }, [externalRef, onExternalRefConsumed]);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = async (event) => {
        const content = event.target?.result as string;
        setRefImages(prev => [...prev, content].slice(-3));
        const matchedId = await detectAndMatchRatio(content);
        const matchedRatioObj = ASPECT_RATIOS.find(r => r.id === matchedId);
        if (matchedRatioObj) setSelectedRatio(matchedRatioObj);
      };
      reader.readAsDataURL(file);
    }
    e.target.value = '';
  };

  const removeRefImage = (index: number) => {
    setRefImages(prev => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (prompt.trim() || refImages.length > 0 || activePlaystyle) {
      let finalPrompt = prompt.trim();
      
      if (activePlaystyle) {
        if (finalPrompt) {
          finalPrompt = activePlaystyle.template.replace('{{subject}}', finalPrompt);
        } else {
          finalPrompt = activePlaystyle.template.replace('{{subject}}', 'subject');
        }
      }

      onGenerate(
        finalPrompt || "Generated asset", 
        selectedStyle.id, 
        selectedRatio.id, 
        refImages,
        imageCount,
        artisticLevel,
        selectedResolution,
        selectedRecipeId,
        usePro
      );
      setPrompt('');
      setRefImages([]);
      setIsExpanded(false);
      setSelectedRecipeId(undefined);
      setActivePlaystyle(null);
    }
  };

  const handleDeleteRecipe = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    await deleteRecipe(id);
    loadRecipes();
    if (selectedRecipeId === id) setSelectedRecipeId(undefined);
  };

  const handlePlaystyleSelect = (ps: Playstyle) => {
    setActivePlaystyle(ps);
    setShowPlaystyles(false);
    setIsExpanded(true);
  };

  if (!isExpanded) {
    return (
        <div 
            onClick={() => setIsExpanded(true)}
            className="group w-[600px] h-[56px] bg-white/95 border border-zinc-200/50 shadow-[0_15px_45px_rgba(0,0,0,0.08)] rounded-[24px] flex items-center justify-between px-6 cursor-pointer hover:bg-white transition-all animate-in slide-in-from-bottom-4 duration-500 pointer-events-auto backdrop-blur-xl"
        >
            <div className="flex items-center gap-4">
                <div className="w-8 h-8 rounded-full bg-zinc-50 border border-zinc-100 flex items-center justify-center text-zinc-400 group-hover:text-indigo-600 transition-colors">
                    <PlusIcon className="w-4" />
                </div>
                <span className="text-[14px] font-bold text-zinc-300 group-hover:text-zinc-400 transition-colors uppercase tracking-widest">在画框内生成新灵感...</span>
            </div>
            <div className="flex items-center gap-3">
                 <div className="flex items-center gap-1.5 bg-zinc-50 px-3 py-1.5 rounded-full border border-zinc-100">
                    <span className="text-[9px] font-black text-zinc-400 uppercase tracking-widest">{selectedStyle.label}</span>
                    <div className="w-px h-2.5 bg-zinc-200 mx-1" />
                    <span className="text-[9px] font-mono text-zinc-500">{selectedRatio.id}</span>
                 </div>
                 <ArrowIcon className="w-5 h-5 text-zinc-200 group-hover:text-indigo-500 transition-all group-hover:translate-x-1" />
            </div>
        </div>
    );
  }

  const activeRecipe = recipes.find(r => r.id === selectedRecipeId);

  return (
    <div className="relative w-[680px] bg-white border border-zinc-200/50 shadow-[0_32px_80px_rgba(0,0,0,0.15)] rounded-[28px] p-2 z-10 flex flex-col gap-0.5 pointer-events-auto animate-in zoom-in-95 fade-in duration-300">
      <input type="file" ref={fileInputRef} onChange={handleFileUpload} className="hidden" accept="image/*" />
      <input type="file" ref={recipeImportRef} onChange={(e) => { const f = e.target.files?.[0]; if (f) onImportRecipes?.(f); e.target.value = ''; }} className="hidden" accept=".json" />

      {showPlaystyles && <PlaystylePanel onSelect={handlePlaystyleSelect} onClose={() => setShowPlaystyles(false)} />}

      {showAdvanced && (
          <div className="absolute bottom-full mb-5 right-0 bg-white border border-zinc-200 rounded-[22px] shadow-3xl p-5 w-[300px] flex flex-col gap-5 z-[100] animate-in fade-in zoom-in-95 duration-300 origin-bottom-right">
               <div className="flex items-center justify-between">
                    <span className="text-[11px] font-black text-zinc-900 tracking-tight uppercase">高级配置</span>
                    <button type="button" onClick={() => setShowAdvanced(false)} className="text-zinc-400 hover:text-zinc-900 transition-colors">
                      <XIcon className="w-3.5 h-3.5"/>
                    </button>
               </div>
               
               <div className="space-y-5">
                    <div className="space-y-2.5">
                        <div className="flex items-center justify-between mb-1">
                            <label className="text-[8px] font-black text-zinc-400 uppercase tracking-widest flex items-center gap-2">
                                <ZapIcon className="w-3 h-3 opacity-50" /> 模型引擎
                            </label>
                        </div>
                        <div className="flex bg-zinc-100 rounded-lg p-1 gap-1">
                            <button 
                                type="button"
                                onClick={() => setUsePro(false)}
                                className={`flex-1 py-2 text-[9px] font-black rounded-md transition-all ${!usePro ? 'bg-white shadow-md text-indigo-600' : 'text-zinc-400 hover:text-zinc-600'}`}
                            >
                                FLASH (极速)
                            </button>
                            <button 
                                type="button"
                                onClick={() => setUsePro(true)}
                                className={`flex-1 py-2 text-[9px] font-black rounded-md transition-all ${usePro ? 'bg-indigo-600 shadow-md text-white' : 'text-zinc-400 hover:text-zinc-600'}`}
                            >
                                PRO (高质量)
                            </button>
                        </div>
                    </div>

                    <div className="space-y-2.5">
                        <label className="text-[8px] font-black text-zinc-400 uppercase tracking-widest flex items-center gap-2">
                             <LayoutGridIcon className="w-3 h-3 opacity-50" /> 生成数量
                        </label>
                        <div className="flex bg-zinc-100 rounded-lg p-1 gap-1">
                             {[1, 2, 4].map(num => (
                                 <button 
                                    key={num}
                                    type="button"
                                    onClick={() => setImageCount(num)}
                                    className={`flex-1 py-2 text-[10px] font-black rounded-md transition-all ${imageCount === num ? 'bg-white shadow-md text-indigo-600' : 'text-zinc-400 hover:text-zinc-600'}`}
                                 >
                                     {num}
                                 </button>
                             ))}
                        </div>
                    </div>

                    <div className="space-y-2.5">
                        <label className="text-[8px] font-black text-zinc-400 uppercase tracking-widest flex items-center gap-2">
                             <SlidersIcon className="w-3 h-3 opacity-50" /> 创意表现强度
                        </label>
                        <div className="space-y-4">
                             <div className="relative h-1 w-full flex items-center">
                               <input 
                                  type="range" 
                                  min="0" 
                                  max="100" 
                                  value={artisticLevel} 
                                  onChange={(e) => setArtisticLevel(Number(e.target.value))}
                                  className="w-full h-1 bg-zinc-100 rounded-full appearance-none cursor-pointer accent-indigo-600 shadow-inner" 
                               />
                             </div>
                             <div className="flex justify-between items-center text-[8px] font-black uppercase tracking-[0.15em]">
                                 <span className="text-zinc-400">写实</span>
                                 <span className="text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded font-mono text-[10px] border border-indigo-100">{artisticLevel}%</span>
                                 <span className="text-zinc-400">创意</span>
                             </div>
                        </div>
                    </div>
               </div>
          </div>
      )}

      {showStyles && (
         <div className="absolute bottom-full mb-5 left-0 bg-white border border-zinc-200 rounded-[20px] shadow-3xl p-1.5 w-60 flex flex-col gap-0.5 max-h-[320px] overflow-y-auto z-50 animate-in fade-in zoom-in-95 duration-300 origin-bottom-left no-scrollbar">
            <div className="text-[8px] font-black text-zinc-400 px-4 py-2.5 uppercase tracking-[0.2em] border-b border-zinc-100 mb-1">视觉风格</div>
            {STYLES.map(s => (
                <button 
                    key={s.id}
                    type="button"
                    onClick={() => { setSelectedStyle(s); setShowStyles(false); }}
                    className={`flex items-center justify-between px-4 py-3 text-[10px] font-black rounded-lg transition-all ${selectedStyle.id === s.id ? 'bg-indigo-50 text-indigo-600 shadow-inner' : 'hover:bg-zinc-50 text-zinc-700'}`}
                >
                    <span className="tracking-tight">{s.label}</span>
                    {selectedStyle.id === s.id && <div className="w-1.5 h-1.5 rounded-full bg-indigo-500 shadow-[0_0_8px_rgba(99,102,241,0.6)]" />}
                </button>
            ))}
         </div>
      )}

      {showRatios && (
         <div className="absolute bottom-full mb-5 left-40 bg-white border border-zinc-200 rounded-[20px] shadow-3xl p-1.5 w-52 flex flex-col gap-0.5 z-50 animate-in fade-in zoom-in-95 duration-300 origin-bottom-left">
            <div className="text-[8px] font-black text-zinc-400 px-4 py-2.5 uppercase tracking-[0.2em] border-b border-zinc-100 mb-1">画布比例</div>
            {ASPECT_RATIOS.map(r => (
                <button 
                    key={r.id}
                    type="button"
                    onClick={() => { setSelectedRatio(r); setShowRatios(false); }}
                    className={`flex items-center justify-between px-4 py-3 text-[10px] font-black rounded-lg transition-all ${selectedRatio.id === r.id ? 'bg-indigo-50 text-indigo-600 shadow-inner' : 'hover:bg-zinc-50 text-zinc-700'}`}
                >
                    <div className="flex flex-col text-left">
                        <span className="text-[11px] font-black tracking-tight">{r.label}</span>
                        <span className="text-[8px] text-zinc-400 font-mono opacity-60 tracking-tighter">{r.id}</span>
                    </div>
                    {selectedRatio.id === r.id && <CheckIcon className="w-3.5 h-3.5 text-indigo-500" />}
                </button>
            ))}
         </div>
      )}

      {showResolution && (
         <div className="absolute bottom-full mb-5 right-20 bg-white border border-zinc-200 rounded-[20px] shadow-3xl p-1.5 w-32 flex flex-col gap-0.5 z-50 animate-in fade-in zoom-in-95 duration-300 origin-bottom-right">
            <div className="text-[8px] font-black text-zinc-400 px-4 py-2 uppercase tracking-[0.2em] border-b border-zinc-100 mb-1">分辨率</div>
            {(['1K', '2K', '4K'] as ResolutionType[]).map(res => (
                <button 
                    key={res}
                    type="button"
                    onClick={() => { setSelectedResolution(res); setShowResolution(false); }}
                    className={`flex items-center justify-between px-4 py-3 text-[10px] font-black rounded-lg transition-all ${selectedResolution === res ? 'bg-indigo-50 text-indigo-600 shadow-inner' : 'hover:bg-zinc-50 text-zinc-700'}`}
                >
                    <span>{res}</span>
                    {selectedResolution === res && <CheckIcon className="w-3.5 h-3.5 text-indigo-500" />}
                </button>
            ))}
         </div>
      )}

      {showRecipes && (
         <div className="absolute bottom-full mb-5 left-0 bg-white border border-zinc-200 rounded-[24px] shadow-3xl p-1.5 w-72 flex flex-col gap-0.5 max-h-[400px] overflow-y-auto z-50 animate-in fade-in zoom-in-95 duration-300 origin-bottom-left no-scrollbar">
            <div className="text-[8px] font-black text-zinc-400 px-4 py-3 uppercase tracking-[0.2em] border-b border-zinc-100 mb-1 flex items-center justify-between">
                <span>审美设计食谱 ({recipes.length})</span>
                <div className="flex items-center gap-1.5">
                    <button 
                        onClick={() => recipeImportRef.current?.click()}
                        className="p-1.5 hover:bg-zinc-100 rounded-md text-zinc-400 hover:text-indigo-600 transition-all"
                        title="导入食谱"
                    >
                        <UploadIcon className="w-3.5 h-3.5" />
                    </button>
                    <button 
                        onClick={onExportRecipes}
                        className="p-1.5 hover:bg-zinc-100 rounded-md text-zinc-400 hover:text-indigo-600 transition-all"
                        title="导出全部食谱"
                    >
                        <DownloadIcon className="w-3.5 h-3.5" />
                    </button>
                </div>
            </div>
            {recipes.length === 0 ? (
                <div className="p-8 text-center space-y-2 opacity-40">
                    <FlaskIcon className="w-8 h-8 mx-auto text-zinc-300" />
                    <p className="text-[9px] font-black uppercase tracking-widest">暂无已存食谱</p>
                </div>
            ) : (
                recipes.map(r => (
                    <button 
                        key={r.id}
                        type="button"
                        onClick={() => { setSelectedRecipeId(selectedRecipeId === r.id ? undefined : r.id); setShowRecipes(false); }}
                        className={`group flex items-center justify-between px-4 py-3 text-[10px] font-black rounded-xl transition-all ${selectedRecipeId === r.id ? 'bg-indigo-600 text-white shadow-xl' : 'hover:bg-zinc-50 text-zinc-700'}`}
                    >
                        <div className="flex items-center gap-3">
                            <div className={`w-8 h-8 rounded-lg overflow-hidden border border-white/10 ${selectedRecipeId === r.id ? 'ring-2 ring-white/20' : ''}`}>
                                <img src={r.exampleImages[0]} className="w-full h-full object-cover" />
                            </div>
                            <span className="tracking-tight max-w-[140px] truncate">{r.name}</span>
                        </div>
                        <div className="flex items-center gap-1">
                            {selectedRecipeId === r.id && <CheckIcon className="w-3.5 h-3.5" />}
                            <button 
                                onClick={(e) => handleDeleteRecipe(e, r.id)}
                                className={`p-1.5 rounded-md hover:bg-red-500/10 hover:text-red-500 transition-all ${selectedRecipeId === r.id ? 'text-white/50 hover:text-white' : 'text-zinc-300 opacity-0 group-hover:opacity-100'}`}
                            >
                                <TrashIcon className="w-3 h-3" />
                            </button>
                        </div>
                    </button>
                ))
            )}
         </div>
      )}

      <form onSubmit={handleSubmit} className="flex flex-col gap-0.5 relative z-10">
        <div className="absolute top-2 right-2 flex items-center gap-1 z-20">
            <button 
                type="button" 
                onClick={() => setIsExpanded(false)} 
                className="w-8 h-8 flex items-center justify-center rounded-xl text-zinc-300 hover:text-zinc-600 hover:bg-zinc-50 transition-all group"
            >
                <ChevronUpIcon className="w-4 h-4 transition-transform group-hover:scale-110 rotate-180" />
            </button>
            {onClose && (
                <button 
                    type="button" 
                    onClick={onClose} 
                    className="w-8 h-8 flex items-center justify-center rounded-xl text-zinc-300 hover:text-zinc-600 hover:bg-zinc-50 transition-all group"
                >
                    <XIcon className="w-3.5 h-3.5 transition-transform group-hover:scale-110" />
                </button>
            )}
        </div>

        {activePlaystyle && (
            <div className="px-4 pt-2">
                <div className="bg-indigo-600 text-white px-3 py-1.5 rounded-full text-[9px] font-black uppercase tracking-widest flex items-center gap-2 w-fit shadow-lg shadow-indigo-600/20">
                    <SparklesIcon className="w-3.5 h-3.5" />
                    当前玩法: {activePlaystyle.name}
                    <button type="button" onClick={() => setActivePlaystyle(null)} className="ml-1 hover:text-white/70 transition-colors">
                        <XIcon className="w-3 h-3" />
                    </button>
                </div>
            </div>
        )}

        <div className="relative flex items-center gap-3 px-4 pt-2">
             <div className="flex items-center gap-2 shrink-0">
                <button type="button" onClick={() => fileInputRef.current?.click()} className="w-10 h-10 flex items-center justify-center rounded-[14px] border border-zinc-100 bg-zinc-50 text-zinc-400 hover:text-indigo-600 transition-all hover:scale-[1.05] active:scale-95 group shadow-sm">
                    <PlusIcon className="w-4.5 group-hover:rotate-90 transition-transform duration-500" />
                </button>
                {refImages.map((img, i) => (
                    <div key={i} className="relative group w-10 h-10 rounded-[14px] overflow-hidden border border-zinc-200 shadow-md transition-all hover:scale-110 ring-0 hover:ring-2 ring-indigo-500/15">
                        <img src={img} className="w-full h-full object-cover" />
                        <button type="button" onClick={() => removeRefImage(i)} className="absolute inset-0 bg-red-600/80 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-300 backdrop-blur-sm">
                            <XIcon className="w-3.5 h-3.5" />
                        </button>
                    </div>
                ))}
             </div>

             <textarea 
                autoFocus
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                placeholder={activePlaystyle ? `在此描述 "${activePlaystyle.name}" 的主体内容...` : (selectedRecipeId ? `正在应用食谱: ${activeRecipe?.name}...` : "输入指令，释放灵感...")}
                className="flex-1 bg-transparent text-[16px] font-bold text-zinc-900 placeholder-zinc-300 py-3 focus:outline-none resize-none h-[48px] leading-snug transition-all no-scrollbar pr-16"
                onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault();
                        handleSubmit();
                    }
                }}
             />
        </div>

        <div className="flex items-center justify-between px-4 pb-2.5 pt-2 border-t border-zinc-50/60 mt-1">
            <div className="flex items-center gap-2">
                 <button type="button" onClick={() => { setShowPlaystyles(true); setShowRecipes(false); setShowStyles(false); setShowRatios(false); }} className={`flex items-center gap-2 px-4 py-2 rounded-full text-[10px] font-black uppercase tracking-[0.1em] transition-all shadow-sm bg-gradient-to-r from-indigo-500 to-purple-600 text-white hover:scale-105 active:scale-95 shadow-indigo-500/20`}>
                   <SparklesIcon className="w-3.5 h-3.5" />
                   有趣的玩法
                </button>
                 <button type="button" onClick={() => { setShowRecipes(!showRecipes); setShowStyles(false); setShowRatios(false); setShowResolution(false); setShowPlaystyles(false); }} className={`flex items-center gap-2 px-4 py-2 rounded-full text-[10px] font-black uppercase tracking-[0.1em] transition-all shadow-sm ${selectedRecipeId ? 'bg-indigo-600 text-white shadow-xl' : 'bg-zinc-100 text-zinc-600 hover:bg-zinc-200'}`}>
                   <FlaskIcon className="w-3.5 h-3.5" />
                   {selectedRecipeId ? activeRecipe?.name : '设计食谱'}
                </button>
                 <button type="button" onClick={() => { setShowStyles(!showStyles); setShowRatios(false); setShowResolution(false); setShowRecipes(false); setShowPlaystyles(false); }} className={`flex items-center gap-2 px-4 py-2 rounded-full text-[10px] font-black uppercase tracking-[0.1em] transition-all shadow-sm ${showStyles ? 'bg-indigo-600 text-white shadow-xl' : 'bg-zinc-100 text-zinc-600 hover:bg-zinc-200'}`}>
                   {selectedStyle.label}
                </button>
                 <button type="button" onClick={() => { setShowRatios(!showRatios); setShowStyles(false); setShowResolution(false); setShowRecipes(false); setShowPlaystyles(false); }} className={`flex items-center gap-2 px-4 py-2 rounded-full text-[10px] font-black uppercase tracking-[0.1em] transition-all shadow-sm ${showRatios ? 'bg-indigo-600 text-white shadow-xl' : 'bg-zinc-100 text-zinc-600 hover:bg-zinc-200'}`}>
                   {selectedRatio.id}
                </button>
            </div>
            <div className="flex items-center gap-3 pr-0.5">
                 <button type="button" onClick={() => { setShowResolution(!showResolution); setShowRatios(false); setShowStyles(false); setShowRecipes(false); }} className="flex items-center justify-center bg-zinc-100/80 rounded-[12px] px-3.5 py-2 text-[10px] font-black text-zinc-500 transition-all hover:bg-zinc-200 uppercase tracking-widest border border-zinc-200/20 shadow-sm min-w-[48px]">
                    {selectedResolution}
                 </button>
                 <button type="button" onClick={() => { setShowAdvanced(!showAdvanced); setShowRecipes(false); }} className={`w-10 h-10 flex items-center justify-center rounded-[14px] transition-all duration-300 ${showAdvanced ? 'text-indigo-600 bg-indigo-50 shadow-inner' : 'text-zinc-400 hover:text-zinc-700'}`}>
                    <SettingsIcon className={`w-5 h-5 transition-transform ${showAdvanced ? 'rotate-90' : ''}`} />
                 </button>
                 <button type="button" onClick={() => handleSubmit()} disabled={!prompt.trim() && refImages.length === 0 && !activePlaystyle} className={`w-10 h-10 flex items-center justify-center rounded-[16px] transition-all duration-500 ${ (prompt.trim() || refImages.length > 0 || activePlaystyle) ? 'bg-[#09090b] text-white hover:scale-110 active:scale-95 shadow-[0_12px_32px_rgba(0,0,0,0.25)]' : 'bg-zinc-100 text-zinc-300 cursor-not-allowed opacity-50'}`}>
                    <ArrowIcon className="w-6 h-6" />
                 </button>
            </div>
        </div>
      </form>
    </div>
  );
};

export default BottomBar;