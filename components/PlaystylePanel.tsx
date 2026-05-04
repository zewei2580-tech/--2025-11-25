
import React, { useState, useEffect, useRef } from 'react';
import { SparklesIcon, XIcon, PlusIcon, TrashIcon, WandIcon, ChevronRightIcon, SearchIcon, RefreshIcon, ZapIcon, CheckIcon, PenIcon, GripIcon } from './Icons';
import { Playstyle } from '../types';
import { getAllPlaystyles, savePlaystyle, deletePlaystyle } from '../services/dbService';
import { PRESET_PLAYSTYLES } from '../constants';
import { generatePlaystyleTemplate, discoverTrendingStyles } from '../services/geminiService';

interface PlaystylePanelProps {
  onSelect: (playstyle: Playstyle) => void;
  onClose: () => void;
}

const PlaystylePanel: React.FC<PlaystylePanelProps> = ({ onSelect, onClose }) => {
  const [userPlaystyles, setUserPlaystyles] = useState<Playstyle[]>([]);
  const [activeCategory, setActiveCategory] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  
  const [panelPos, setPanelPos] = useState({ x: 0, y: 0 });
  const isDraggingPanel = useRef(false);
  const dragStart = useRef({ x: 0, y: 0 });

  const [isCreating, setIsCreating] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [isGeneratingTemplate, setIsGeneratingTemplate] = useState(false);
  const [isDiscovering, setIsDiscovering] = useState(false);
  const [discoveredStyles, setDiscoveredStyles] = useState<Playstyle[]>([]);
  
  const [newStyle, setNewStyle] = useState<Partial<Playstyle>>({
    name: '',
    description: '',
    template: '',
    category: 'industrial'
  });

  const loadData = async () => {
    const data = await getAllPlaystyles();
    
    if (data.length === 0) {
        for (const p of PRESET_PLAYSTYLES) {
            await savePlaystyle({ 
                ...p, 
                id: crypto.randomUUID(), 
                createdAt: Date.now() 
            });
        }
        const newData = await getAllPlaystyles();
        setUserPlaystyles(newData);
    } else {
        setUserPlaystyles(data);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const allPlaystyles = [...discoveredStyles, ...userPlaystyles];
  
  const filtered = allPlaystyles.filter(p => {
    const matchesCategory = activeCategory === 'all' || p.category === activeCategory;
    const matchesSearch = p.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
                         p.description.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  const categories = [
    { id: 'all', label: '全部' },
    { id: 'industrial', label: '工业设计' },
    { id: 'poster', label: '电商海报' },
    { id: 'portrait', label: '人像' },
    { id: 'art', label: '前卫艺术' }
  ];

  const handleDelete = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    if (id.startsWith('trend-')) {
        setDiscoveredStyles(prev => prev.filter(p => p.id !== id));
        return;
    }
    if (window.confirm("确定要永久删除这个自定义玩法吗？")) {
        await deletePlaystyle(id);
        loadData();
    }
  };

  const handleEdit = (e: React.MouseEvent, p: Playstyle) => {
    e.stopPropagation();
    setEditingId(p.id);
    setNewStyle(p);
    setIsCreating(true);
  };

  const handleSaveNew = async () => {
    if (!newStyle.name || !newStyle.template) return;
    let finalTemplate = newStyle.template;
    if (!finalTemplate.includes('{{subject}}')) {
        finalTemplate = `{{subject}}, ${finalTemplate}`;
    }
    const styleToSave: Playstyle = {
        id: editingId || crypto.randomUUID(),
        name: newStyle.name || '未命名玩法',
        description: newStyle.description || '',
        template: finalTemplate,
        category: newStyle.category || 'industrial',
        createdAt: Date.now()
    };
    await savePlaystyle(styleToSave);
    setIsCreating(false);
    setEditingId(null);
    setNewStyle({ name: '', description: '', template: '', category: 'industrial' });
    loadData();
  };

  const handleDiscover = async () => {
    if (isDiscovering) return;
    setIsDiscovering(true);
    try {
        const trends = await discoverTrendingStyles();
        const mappedTrends: Playstyle[] = trends.map(t => ({
            ...t,
            id: `trend-${crypto.randomUUID()}`,
            createdAt: Date.now(),
            isTrending: true
        } as any));
        setDiscoveredStyles(prev => {
            const existingNames = new Set(prev.map(p => p.name));
            const uniqueNew = mappedTrends.filter(n => !existingNames.has(n.name));
            return [...uniqueNew, ...prev].slice(0, 15);
        });
    } catch (e) {
        alert("发现灵感失败，请重试。");
    } finally {
        setIsDiscovering(false);
    }
  };

  const handleAiAssist = async () => {
      if (!newStyle.name || isGeneratingTemplate) return;
      setIsGeneratingTemplate(true);
      try {
          const result = await generatePlaystyleTemplate(newStyle.name);
          setNewStyle({
              ...newStyle,
              name: result.name,
              description: result.description,
              template: result.template
          });
      } catch (e) {
          alert("AI 辅助失败。");
      } finally {
          setIsGeneratingTemplate(false);
      }
  };

  const onMouseDownHeader = (e: React.MouseEvent) => {
    isDraggingPanel.current = true;
    dragStart.current = { x: e.clientX - panelPos.x, y: e.clientY - panelPos.y };
  };

  useEffect(() => {
    const handleGlobalMove = (e: MouseEvent) => {
        if (!isDraggingPanel.current) return;
        setPanelPos({ x: e.clientX - dragStart.current.x, y: e.clientY - dragStart.current.y });
    };
    const handleGlobalUp = () => { isDraggingPanel.current = false; };
    window.addEventListener('mousemove', handleGlobalMove);
    window.addEventListener('mouseup', handleGlobalUp);
    return () => {
        window.removeEventListener('mousemove', handleGlobalMove);
        window.removeEventListener('mouseup', handleGlobalUp);
    };
  }, []);

  return (
    <div className="fixed inset-0 z-[1000] flex items-center justify-center p-4 animate-in fade-in duration-300 pointer-events-none">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-md pointer-events-auto" onClick={onClose} />
      
      <div 
        className="relative w-full max-w-[840px] h-[85vh] max-h-[760px] min-h-[540px] bg-[#0c0c0e] border border-white/10 rounded-[36px] shadow-[0_80px_200px_rgba(0,0,0,0.8)] overflow-hidden flex flex-col animate-in zoom-in-95 duration-500 pointer-events-auto"
        style={{ transform: `translate(${panelPos.x}px, ${panelPos.y}px)` }}
      >
        
        <div 
            onMouseDown={onMouseDownHeader}
            className="shrink-0 px-8 py-5 border-b border-white/5 bg-[#121214] flex items-center justify-between z-30 cursor-move"
        >
           {isCreating ? (
               <>
                <button 
                    onClick={() => { setIsCreating(false); setEditingId(null); }} 
                    className="px-5 py-2.5 text-[11px] font-black text-zinc-500 hover:text-white transition-all uppercase tracking-widest bg-white/5 rounded-xl border border-white/5"
                >
                    取消修改
                </button>
                <div className="flex flex-col items-center text-center">
                    <h3 className="text-white font-black text-[13px] uppercase tracking-[0.3em]">{editingId ? '编辑玩法逻辑' : '定义新玩法'}</h3>
                    <span className="text-zinc-600 text-[8px] font-bold uppercase tracking-widest mt-0.5">MODULAR DESIGN SYSTEM</span>
                </div>
                <button 
                    onClick={handleSaveNew}
                    disabled={!newStyle.name || !newStyle.template}
                    className="px-8 py-2.5 bg-white text-black hover:bg-indigo-600 hover:text-white rounded-xl font-black text-[11px] uppercase tracking-widest transition-all shadow-2xl active:scale-95 disabled:opacity-30"
                >
                    同步到库
                </button>
               </>
           ) : (
               <>
                <div className="flex items-center gap-5">
                    <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-indigo-500/20 to-purple-600/20 border border-indigo-500/30 flex items-center justify-center">
                        <SparklesIcon className="w-6 h-6 text-indigo-400" />
                    </div>
                    <div className="flex flex-col">
                        <h3 className="text-white font-black text-[13px] uppercase tracking-[0.3em]">我的玩法库</h3>
                        <span className="text-zinc-500 text-[8px] font-bold uppercase tracking-widest mt-0.5 opacity-60 italic">CUSTOMIZABLE VISUAL FORMULAS</span>
                    </div>
                </div>
                <div className="flex items-center gap-4">
                    <div className="px-3 py-1.5 bg-white/5 rounded-lg border border-white/10 text-[9px] text-zinc-500 font-black uppercase tracking-widest flex items-center gap-2">
                        <GripIcon className="w-3.5 h-3.5" /> 自由拖动标题栏
                    </div>
                    <button onClick={onClose} className="p-2.5 text-zinc-500 hover:text-white transition-colors bg-white/5 rounded-xl border border-white/5 hover:border-white/20">
                        <XIcon className="w-5 h-5" />
                    </button>
                </div>
               </>
           )}
        </div>

        {!isCreating ? (
            <>
            <div className="shrink-0 p-5 border-b border-white/5 flex items-center gap-5 bg-zinc-900/30 z-10 backdrop-blur-xl">
                <div className="flex bg-white/5 rounded-xl p-1 gap-1 overflow-x-auto no-scrollbar max-w-[440px]">
                    {categories.map(cat => (
                        <button 
                            key={cat.id}
                            onClick={() => setActiveCategory(cat.id)}
                            className={`px-4 py-2 text-[10px] font-black uppercase tracking-widest rounded-lg transition-all whitespace-nowrap ${activeCategory === cat.id ? 'bg-indigo-600 text-white shadow-xl' : 'text-zinc-500 hover:text-zinc-300'}`}
                        >
                            {cat.label}
                        </button>
                    ))}
                </div>
                
                <div className="flex-1 relative">
                    <SearchIcon className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-600" />
                    <input 
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        placeholder="在我的灵感库中搜索..."
                        className="w-full bg-[#161618] border border-white/5 rounded-xl pl-11 pr-5 py-3 text-[11px] font-bold text-white focus:border-indigo-500/50 outline-none transition-all placeholder:text-zinc-700 shadow-inner"
                    />
                </div>

                <button 
                    onClick={handleDiscover}
                    disabled={isDiscovering}
                    className="px-6 py-3 bg-gradient-to-r from-indigo-600 to-purple-600 hover:scale-[1.03] active:scale-95 text-white rounded-xl font-black text-[10px] uppercase tracking-widest flex items-center gap-3 transition-all shadow-xl shadow-indigo-600/20 shrink-0"
                >
                    {isDiscovering ? <RefreshIcon className="w-4 h-4 animate-spin" /> : <ZapIcon className="w-4 h-4" />}
                    全网发掘灵感
                </button>
            </div>

            <div className="flex-1 min-h-0 overflow-y-auto p-8 bg-[#0c0c0e] custom-scrollbar">
                <div className="grid grid-cols-2 gap-6 pb-6">
                    <button 
                        onClick={() => { setIsCreating(true); setEditingId(null); setNewStyle({ name: '', description: '', template: '', category: 'industrial' }); }}
                        className="flex flex-col items-center justify-center border-2 border-dashed border-indigo-500/10 rounded-[32px] p-8 gap-4 hover:border-indigo-500/40 hover:bg-indigo-500/5 transition-all text-zinc-500 hover:text-indigo-400 group min-h-[160px]"
                    >
                        <div className="w-12 h-12 rounded-full bg-white/5 flex items-center justify-center group-hover:scale-110 group-hover:bg-indigo-500/10 transition-all">
                            <PlusIcon className="w-6 h-6" />
                        </div>
                        <span className="text-[11px] font-black uppercase tracking-[0.2em]">创建我的专属玩法</span>
                    </button>

                    {filtered.map((p) => {
                        const isTrend = (p as any).isTrending;
                        return (
                            <div 
                                key={p.id}
                                onClick={() => onSelect(p)}
                                className={`group relative bg-[#111113] border rounded-[32px] p-6 hover:bg-indigo-500/5 transition-all cursor-pointer shadow-xl overflow-hidden flex flex-col gap-4 min-h-[160px] ${isTrend ? 'border-indigo-500/40 ring-1 ring-indigo-500/10' : 'border-white/5 hover:border-indigo-500/40'}`}
                            >
                                <div className="flex items-start justify-between relative z-10">
                                    <div className="flex flex-col gap-1.5 flex-1 pr-4">
                                        <div className="flex items-center gap-2.5">
                                            <span className="text-white font-black text-[12px] uppercase tracking-tight group-hover:text-indigo-400 transition-colors truncate">{p.name}</span>
                                            {isTrend && <span className="bg-indigo-600 text-white text-[7px] font-black px-2 py-0.5 rounded-sm animate-pulse">TRENDING</span>}
                                        </div>
                                        <span className="text-zinc-500 text-[10px] font-medium leading-relaxed line-clamp-1">{p.description}</span>
                                    </div>
                                    <div className="flex gap-2">
                                        <button onClick={(e) => handleEdit(e, p)} className="p-2 text-zinc-700 hover:text-indigo-400 transition-all bg-white/2 rounded-lg hover:bg-white/5">
                                            <PenIcon className="w-4 h-4" />
                                        </button>
                                        <button onClick={(e) => handleDelete(e, p.id)} className="p-2 text-zinc-700 hover:text-red-500 transition-all bg-white/2 rounded-lg hover:bg-white/5">
                                            <TrashIcon className="w-4 h-4" />
                                        </button>
                                    </div>
                                </div>
                                <div className="relative z-10 p-4 bg-black/40 rounded-2xl border border-white/5 shadow-inner">
                                    <p className="text-[10px] text-zinc-400 font-mono line-clamp-2 italic leading-relaxed opacity-60">
                                        {p.template.replace('{{subject}}', '...')}
                                    </p>
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>
            </>
        ) : (
            <div className="flex-1 min-h-0 overflow-y-auto p-10 bg-[#0c0c0e] no-scrollbar">
                <div className="max-w-[600px] mx-auto space-y-8 animate-in slide-in-from-bottom-4 duration-500 pb-12">
                    <div className="space-y-4">
                        <label className="text-[11px] font-black text-zinc-600 uppercase tracking-[0.2em] block px-1">玩法名称 / 创意定义</label>
                        <div className="flex flex-col gap-3">
                            <textarea 
                                autoFocus
                                value={newStyle.name}
                                onChange={(e) => setNewStyle({...newStyle, name: e.target.value})}
                                className="w-full bg-[#141416] border border-white/10 rounded-2xl px-6 py-4 text-white font-bold focus:border-indigo-500/50 transition-all outline-none text-sm shadow-inner h-24 resize-none leading-relaxed"
                                placeholder="给玩法起一个响亮的名字或详细描述它的核心灵魂..."
                            />
                            <button 
                                onClick={handleAiAssist}
                                disabled={!newStyle.name || isGeneratingTemplate}
                                className="w-fit self-end px-6 py-3 bg-indigo-600 hover:bg-indigo-500 text-white rounded-2xl font-black text-[10px] uppercase tracking-widest transition-all active:scale-95 disabled:opacity-40 flex items-center gap-3 shadow-2xl shadow-indigo-600/20"
                            >
                                {isGeneratingTemplate ? <RefreshIcon className="w-4 h-4 animate-spin" /> : <SparklesIcon className="w-4 h-4" />}
                                基于此定义 AI 补全模板
                            </button>
                        </div>
                    </div>

                    <div className="space-y-4">
                        <label className="text-[11px] font-black text-zinc-600 uppercase tracking-[0.2em] block px-1">视觉 Prompt 模板 (含 {'{{subject}}'})</label>
                        <div className="relative">
                            <textarea 
                                value={newStyle.template}
                                onChange={(e) => setNewStyle({...newStyle, template: e.target.value})}
                                className="w-full bg-[#141416] border border-white/10 rounded-[28px] px-6 py-5 text-zinc-300 font-mono text-[13px] h-40 focus:border-indigo-500/50 transition-all outline-none resize-none shadow-inner leading-relaxed"
                                placeholder="A cinematic render of {{subject}}, high-end materials, studio lighting, professional quality..."
                            />
                            <div className="absolute bottom-4 right-6 text-[9px] font-black text-zinc-700 uppercase tracking-widest">Fixed 1K Standard</div>
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-6">
                        <div className="space-y-4">
                            <label className="text-[11px] font-black text-zinc-600 uppercase tracking-[0.2em] block px-1">简短核心标签</label>
                            <input 
                                value={newStyle.description}
                                onChange={(e) => setNewStyle({...newStyle, description: e.target.value})}
                                className="w-full bg-[#141416] border border-white/10 rounded-2xl px-5 py-4 text-zinc-400 text-[11px] font-bold focus:border-indigo-500 transition-all outline-none shadow-inner"
                                placeholder="例如：超现实主义 / 消光金属..."
                            />
                        </div>
                        <div className="space-y-4">
                            <label className="text-[11px] font-black text-zinc-600 uppercase tracking-[0.2em] block px-1">领域分类</label>
                            <select 
                                value={newStyle.category}
                                onChange={(e) => setNewStyle({...newStyle, category: e.target.value})}
                                className="w-full bg-[#141416] border border-white/10 rounded-2xl px-5 py-4 text-zinc-400 text-[11px] font-bold focus:border-indigo-500 transition-all outline-none appearance-none cursor-pointer shadow-inner uppercase tracking-widest"
                            >
                                <option value="industrial">工业设计</option>
                                <option value="poster">电商/海报</option>
                                <option value="portrait">人像/写实</option>
                                <option value="art">概念/前卫艺术</option>
                            </select>
                        </div>
                    </div>
                </div>
            </div>
        )}

        <div className="shrink-0 p-5 bg-[#09090b] border-t border-white/5 z-20">
            <p className="text-[9px] font-black text-zinc-800 uppercase tracking-[0.5em] text-center">
                CRAFTING INFINITE VISUAL GENES
            </p>
        </div>
      </div>
    </div>
  );
};

export default PlaystylePanel;
