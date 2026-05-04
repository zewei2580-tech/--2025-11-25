
import React, { useState, useEffect } from 'react';
import { XIcon, SparklesIcon, FlaskIcon, CheckIcon, TargetIcon, RefreshIcon } from './Icons';
import { extractDesignRecipe } from '../services/geminiService';

interface DesignRecipePanelProps {
  initialInstruction: string;
  exampleImages: string[];
  onSave: (name: string, instruction: string) => void;
  onClose: () => void;
  isSaving?: boolean;
}

const DesignRecipePanel: React.FC<DesignRecipePanelProps> = ({ 
  initialInstruction, 
  exampleImages, 
  onSave, 
  onClose,
  isSaving
}) => {
  const [name, setName] = useState('My Aesthetic Logic');
  const [instruction, setInstruction] = useState(initialInstruction);
  const [baselineIndex, setBaselineIndex] = useState<number | undefined>(0);
  const [isAnalyzing, setIsAnalyzing] = useState(false);

  const handleModeToggle = async (index: number | undefined) => {
    setBaselineIndex(index);
    setIsAnalyzing(true);
    try {
        const newLogic = await extractDesignRecipe(exampleImages, index);
        setInstruction(newLogic);
    } catch (e) {
        console.error("Failed to re-extract recipe", e);
    } finally {
        setIsAnalyzing(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[300] flex items-center justify-center p-4 md:p-10 animate-in fade-in duration-300">
      <div className="absolute inset-0 bg-black/80 backdrop-blur-xl" onClick={onClose} />
      
      <div className="relative w-full max-w-[640px] max-h-[90vh] bg-[#0c0c0e] border border-white/10 rounded-[40px] shadow-[0_80px_200px_rgba(0,0,0,1)] overflow-hidden flex flex-col animate-in zoom-in-95 duration-500">
        
        {/* Header - Fixed */}
        <div className="shrink-0 p-8 border-b border-white/5 bg-zinc-900/40 flex items-center justify-between">
           <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center">
                  <FlaskIcon className="w-6 h-6 text-indigo-400" />
              </div>
              <div className="flex flex-col">
                  <h3 className="text-white font-black text-sm uppercase tracking-[0.2em]">提取设计食谱</h3>
                  <span className="text-zinc-500 text-[9px] font-bold uppercase tracking-widest mt-0.5">
                    {baselineIndex !== undefined ? '差异进化分析 (DELTA ANALYSIS)' : '共性审美归纳 (INDUCTION)'}
                  </span>
              </div>
           </div>
           <button onClick={onClose} className="p-2 text-zinc-500 hover:text-white transition-colors">
              <XIcon className="w-5 h-5" />
           </button>
        </div>

        {/* Scrollable Body */}
        <div className="flex-1 overflow-y-auto no-scrollbar p-8 space-y-10">
            <div className="space-y-4">
                <div className="flex items-center justify-between">
                    <span className="text-[10px] font-black text-zinc-500 uppercase tracking-widest block">样本示例 (点击设定/取消参照图)</span>
                    {baselineIndex !== undefined && (
                        <button 
                            onClick={() => handleModeToggle(undefined)}
                            className="text-[9px] font-black text-indigo-400 hover:text-indigo-300 uppercase tracking-widest transition-colors flex items-center gap-1.5"
                        >
                            <RefreshIcon className="w-3 h-3" /> 切换到共性提取
                        </button>
                    )}
                </div>
                <div className="flex gap-4 overflow-x-auto no-scrollbar pb-2">
                    {exampleImages.map((img, i) => (
                        <div 
                            key={i} 
                            onClick={() => handleModeToggle(baselineIndex === i ? undefined : i)}
                            className={`relative group cursor-pointer w-32 h-32 rounded-[24px] border-2 transition-all duration-500 overflow-hidden shrink-0 shadow-lg ${baselineIndex === i ? 'border-indigo-500 ring-4 ring-indigo-500/20 scale-105' : 'border-white/5 hover:border-white/20 opacity-60 hover:opacity-100'}`}
                        >
                            <img src={img} className="w-full h-full object-cover" />
                            {baselineIndex === i && (
                                <div className="absolute top-2 left-2 px-2 py-1 bg-indigo-600 text-white rounded-lg text-[8px] font-black uppercase tracking-widest shadow-xl flex items-center gap-1">
                                    <TargetIcon className="w-2.5 h-2.5" /> REFERENCE
                                </div>
                            )}
                            <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                                <span className="text-[9px] font-black text-white uppercase tracking-widest bg-black/60 px-2 py-1 rounded-md border border-white/10">
                                    {baselineIndex === i ? '取消参照' : '设为参照'}
                                </span>
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            <div className="space-y-4 relative">
                <span className="text-[10px] font-black text-zinc-500 uppercase tracking-widest block">AI 提取的审美配方</span>
                <div className={`p-6 bg-white/5 rounded-[28px] border border-white/5 relative overflow-hidden transition-all min-h-[160px] ${isAnalyzing ? 'opacity-40 grayscale blur-[2px]' : 'opacity-100'}`}>
                    {!isAnalyzing && (
                        <div className="absolute top-0 right-0 p-3 opacity-10">
                            <SparklesIcon className="w-12 h-12" />
                        </div>
                    )}
                    <p className="text-zinc-300 text-[14px] leading-relaxed font-medium whitespace-pre-wrap italic">
                        {instruction}
                    </p>
                </div>

                {isAnalyzing && (
                    <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 animate-in fade-in">
                        <RefreshIcon className="w-8 h-8 text-indigo-400 animate-spin" />
                        <span className="text-[10px] font-black text-indigo-400 uppercase tracking-[0.3em]">深度解构中...</span>
                    </div>
                )}
            </div>
        </div>

        {/* Footer - Fixed */}
        <div className="shrink-0 p-8 bg-[#09090b] border-t border-white/5 space-y-6">
            <div className="space-y-3">
                <label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest block px-1">给这个食谱命名</label>
                <input 
                    autoFocus
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full bg-zinc-900 border border-white/10 rounded-[20px] px-6 py-4 text-white font-bold focus:border-indigo-500 transition-all outline-none shadow-inner"
                    placeholder="例如：极简流线型金属..."
                />
            </div>
            
            <div className="flex gap-4">
                <button 
                    onClick={onClose}
                    className="flex-1 py-4 bg-zinc-800 hover:bg-zinc-700 text-zinc-400 hover:text-white rounded-[20px] font-black text-[12px] uppercase tracking-[0.2em] transition-all"
                >
                    取消
                </button>
                <button 
                    onClick={() => onSave(name, instruction)}
                    disabled={isSaving || isAnalyzing || !name.trim()}
                    className="flex-[2] py-4 bg-indigo-600 hover:bg-indigo-500 text-white rounded-[20px] font-black text-[12px] uppercase tracking-[0.2em] shadow-2xl transition-all active:scale-95 flex items-center justify-center gap-3 group disabled:opacity-50 disabled:scale-100"
                >
                    {isSaving ? <CheckIcon className="w-4 h-4 animate-bounce" /> : <SparklesIcon className="w-4 h-4 group-hover:rotate-12 transition-transform" />}
                    {isSaving ? '保存中...' : '保存食谱到库'}
                </button>
            </div>
        </div>
      </div>
    </div>
  );
};

export default DesignRecipePanel;
