import React, { useState } from 'react';
import { XIcon, SparklesIcon, RefreshIcon, WandIcon } from './Icons';
import { CanvasItem, TopologyStrategy } from '../types';
import { recommendTopology } from '../services/geminiService';

interface TopologyPanelProps {
  item: CanvasItem;
  onClose: () => void;
  onGenerate: (strategies: TopologyStrategy[]) => void;
}

const CATEGORIZED_STRATEGIES = [
  {
    category: '1. 几何形态 (Form)',
    items: [
      { id: 'split', label: '逻辑分割 (Split)' },
      { id: 'cut', label: '精密切削 (Cut)' },
      { id: 'bend', label: '轴向弯曲 (Bend)' },
      { id: 'twist', label: '扭曲扭力 (Twist)' },
      { id: 'boolean', label: '布尔交集 (Boolean)' },
      { id: 'stack', label: '垂直堆叠 (Stack)' },
      { id: 'penetrate', label: '非互斥穿插' },
      { id: 'fold', label: '钣金折叠 (Fold)' },
      { id: 'symmetry', label: '绝对对称协议' },
      { id: 'golden_ratio', label: '黄金分割重构' },
      { id: 'cyber_orthogonal', label: '赛博正交逻辑' },
      { id: 'accumulate', label: '体量累积' },
      { id: 'fragment', label: '结构断裂' },
      { id: 'conflict', label: '特征线冲突' },
    ]
  },
  {
    category: '2. 表面处理 (Surface)',
    items: [
      { id: 'pattern', label: '程序阵列 (Pattern)' },
      { id: 'texture', label: '微观纹理 (Texture)' },
      { id: 'fade_surface', label: '高级渐消面' },
      { id: 'vanishing_crease', label: '消失折痕特征' },
      { id: 'variable_chamfer', label: '变截面倒角' },
      { id: 'geometric_lines', label: '几何特征特征线' },
      { id: 'engraved_detail', label: '精密工艺刻线' },
      { id: 'surface_continuity', label: '曲面连续性优化' },
      { id: 'bionic_gills', label: '仿生鳃裂散热' },
      { id: 'floating_layers', label: '悬浮分层导流' },
      { id: 'toolpath_texture', label: '刀路纹理美学' },
      { id: 'geometric_echo', label: '几何形态回响' },
      { id: 'laser_engraving', label: '激光镭雕刻印' },
      { id: 'carbon_fiber', label: '碳纤维纹理版' },
      { id: 'anodized_aluminum', label: '阳极氧化铝面' },
    ]
  },
  {
    category: '3. 工程制造 (MFG)',
    items: [
      { id: 'shell', label: '壁厚抽壳 (Shell)' },
      { id: 'interweave', label: '皮骨交织' },
      { id: 'parting_line', label: '分模线设计' },
      { id: 'nested_structure', label: '层级嵌套结构' },
      { id: 'hard_surface', label: '硬朗棱角化' },
      { id: 'geometric_grille', label: '几何栅栏系统' },
      { id: 'intake_feature', label: '进气口功能特征' },
      { id: 'cnc_machining', label: 'CNC 减法加工' },
      { id: 'injection_molding', label: '注塑模具优化' },
      { id: 'functional_wear', label: '功能耐磨' },
    ]
  }
];

const TopologyPanel: React.FC<TopologyPanelProps> = ({ item, onClose, onGenerate }) => {
  const [selected, setSelected] = useState<TopologyStrategy[]>([]);
  const [isRecommending, setIsRecommending] = useState(false);

  const toggle = (id: TopologyStrategy) => {
    setSelected(prev => prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]);
  };

  const handleRecommend = async () => {
    if (!item.content || isRecommending) return;
    setIsRecommending(true);
    try {
        const recommended = await recommendTopology(item.content);
        setSelected(recommended);
    } catch (e) {
        alert("智能推荐失败，请重试。");
    } finally {
        setIsRecommending(false);
    }
  };

  return (
    <div 
      className="z-[300] bg-[#0c0c0e]/95 backdrop-blur-3xl border border-white/10 p-6 rounded-[32px] shadow-[0_40px_100px_rgba(0,0,0,0.8)] animate-in zoom-in-95 duration-300 pointer-events-auto flex flex-col gap-6 w-[900px] max-h-[85vh] no-canvas-wheel"
      onMouseDown={e => e.stopPropagation()}
    >
      <div className="flex items-center justify-between shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center">
            <RefreshIcon className="w-5 h-5 text-indigo-400" />
          </div>
          <div className="flex flex-col">
            <span className="text-white font-black text-[12px] uppercase tracking-[0.2em]">拓扑几何变体 (Topology)</span>
            <span className="text-zinc-500 text-[8px] font-bold uppercase tracking-widest mt-0.5">Advanced Industrial Logic Engine</span>
          </div>
        </div>
        <div className="flex items-center gap-2">
            <button 
                onClick={handleRecommend}
                disabled={isRecommending}
                className="flex items-center gap-2 px-3 py-1.5 bg-indigo-600/10 border border-indigo-500/20 rounded-xl text-[10px] font-black text-indigo-400 uppercase tracking-widest hover:bg-indigo-600/20 transition-all disabled:opacity-40"
            >
                {isRecommending ? <RefreshIcon className="w-3 h-3 animate-spin" /> : <WandIcon className="w-3 h-3" />}
                智能推荐
            </button>
            <button onClick={onClose} className="p-2 text-zinc-500 hover:text-white transition-colors bg-white/5 rounded-xl border border-white/5">
                <XIcon className="w-4 h-4" />
            </button>
        </div>
      </div>

      <div className="flex flex-col gap-6 overflow-y-auto pr-2 flex-1 min-h-0">
        {CATEGORIZED_STRATEGIES.map((category, catIdx) => (
          <div key={catIdx} className="flex flex-col gap-3">
            <h3 className="text-white/70 text-sm font-bold uppercase tracking-widest pl-1 border-l-2 border-indigo-500">{category.category}</h3>
            <div className="grid grid-cols-4 gap-3">
              {category.items.map(s => {
                const isActive = selected.includes(s.id as TopologyStrategy);
                return (
                  <button 
                    key={s.id}
                    onClick={() => toggle(s.id as TopologyStrategy)}
                    className={`flex flex-col items-center justify-center text-center p-4 rounded-2xl border transition-all relative overflow-hidden group min-h-[60px] w-full ${isActive ? 'bg-indigo-600/20 border-indigo-500 text-white shadow-[0_0_20px_rgba(79,70,229,0.2)]' : 'bg-white/5 border-white/10 hover:bg-white/10 hover:border-white/30'}`}
                  >
                    <span className={`text-sm font-extrabold tracking-tight w-full text-center ${isActive ? 'text-white' : 'text-white'}`}>{s.label}</span>
                    {isActive && (
                      <div className="absolute top-2 right-2">
                        <div className="w-1.5 h-1.5 rounded-full bg-indigo-400 animate-pulse shadow-[0_0_8px_rgba(129,140,248,0.8)]" />
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      <div className="space-y-4 shrink-0 border-t border-white/5 pt-4">
        <div className="p-4 bg-black/40 rounded-2xl border border-white/5 shadow-inner">
           <div className="flex items-center gap-2 mb-2">
              <SparklesIcon className="w-3 h-3 text-indigo-400" />
              <span className="text-[8px] font-black text-zinc-500 uppercase tracking-widest">即将注入的拓扑指令流</span>
           </div>
           <p className="text-[10px] font-mono text-zinc-400 italic leading-relaxed min-h-[40px]">
              {selected.length > 0 
                ? `MANDATE: ${selected.map(s => s.toUpperCase()).join(" + ")} SYNERGY.` 
                : "请至少选择一种拓扑手段以启动引擎..."}
           </p>
        </div>

        <button 
          onClick={() => onGenerate(selected)}
          disabled={selected.length === 0}
          className="w-full py-4 bg-indigo-600 hover:bg-indigo-500 text-white rounded-[20px] font-black text-[12px] uppercase tracking-[0.2em] shadow-2xl transition-all active:scale-95 flex items-center justify-center gap-3 disabled:opacity-30 disabled:scale-100 group"
        >
          <SparklesIcon className="w-4.5 h-4.5 group-hover:rotate-12 transition-transform" />
          立即生成拓扑方案
        </button>
      </div>

      <div className="px-1 flex items-center justify-center gap-2 shrink-0">
         <div className="w-1 h-1 rounded-full bg-indigo-500/40" />
         <span className="text-[7px] font-black text-zinc-700 uppercase tracking-[0.4em]">Perspective Lock Active</span>
         <div className="w-1 h-1 rounded-full bg-indigo-500/40" />
      </div>
    </div>
  );
};

export default TopologyPanel;