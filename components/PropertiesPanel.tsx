
import { useState, useEffect, useMemo, useRef } from 'react';
import React from 'react';
import { CanvasItem, ItemType, EditToolType, GenerationSettings, SpatialConfig, IdentifiedPoint, PartCMF } from '../types';
import { 
  SparklesIcon, RefreshIcon, EraserIcon, 
  ScissorsIcon, VectorIcon, 
  UpscaleIcon, SlidersIcon, ChevronRightIcon,
  ChevronLeftIcon, SquareIcon, TrashIcon,
  FileIcon, CopyIcon, EvolutionIcon,
  LassoIcon, BrushIcon, TypeIcon, CreativeScaleIcon, ZapIcon,
  PaletteIcon, XIcon, FocusIcon,
  MessageCircleIcon, TargetIcon, WandIcon, LinkIcon, CameraIcon,
  MaximizeIcon, BoxIcon, CheckIcon, RotateCcwIcon, MagicCurveIcon,
  MergeIcon, FrameIcon, ExpandIcon, LayoutGridIcon, GripIcon, ShuffleIcon,
  GalleryIcon, TerminalIcon, PlusIcon,
  ArrowIcon, FlaskIcon, EyeIcon, SearchIcon, EyeOffIcon, ListOrderedIcon, UndoIcon,
  VideoIcon, PlayIcon
} from './Icons';
import SpatialController from './SpatialController';
import { getEvolutionStage } from '../services/evolutionService';
import { CMF_LIBRARY } from '../constants';
import { generateInteractionSuggestions } from '../services/geminiService';

type PanelView = 'main' | 'variations' | 'edit_area' | 'adjust_colors' | 'change_bg' | 'evolution' | 'spatial' | 'transplant' | 'model_3d' | 'world_sim';

interface PropertiesPanelProps {
  selectedItem: CanvasItem | null;
  selectedItems?: CanvasItem[];
  onUpdateItem: (id: string, updates: Partial<CanvasItem>) => void;
  onGenerate: (id: string, overridePrompt?: string, settings?: Partial<GenerationSettings>) => void;
  onDelete: (id: string) => void;
  onAutoPrompt?: (id: string) => Promise<void>;
  onEnterEditMode?: (tool: EditToolType) => void;
  onExitEditMode?: () => void;
  initialView?: {view: string, ts: number} | null;
  onSendToPrompt?: (id: string) => void;
  onSendToGemini?: (id: string) => void;
  onSyncPointsToGemini?: (id: string) => void;
  onFrameAction?: (id: string, action: 'merge' | 'expand' | 'crop') => void;
  editTool?: EditToolType;
  setEditTool?: (tool: EditToolType) => void;
  brushSize?: number;
  setBrushSize?: (size: number) => void;
  onApplyEdit?: (prompt: string) => void;
  onClearMask?: () => void;
  onJSONAnalysis?: (id: string) => void;
  isAnalyzingJSON?: boolean;
  onStartPickPoint?: (id: string, temperature: number) => void;
  isPickingPoint?: boolean;
  currentEvolutionLevel?: number;
  isCncMode: boolean;
  setIsCncMode: (val: boolean) => void;
  onUpdatePoint?: (itemId: string, pointId: string, updates: Partial<IdentifiedPoint>) => void;
  onClearAllPoints?: (itemId: string) => void;
  onCommitPointChanges?: (itemId: string) => void;
  onAutoAlign?: (sourceId: string, targetId: string) => Promise<void>;
  onClosePanel?: () => void;
  onFloatingAction?: (id: string, action: string) => void;
}

const DEFAULT_SPATIAL: SpatialConfig = {
    azimuth: 45,
    elevation: 30,
    distance: 12,
    fov: 45
};

const CAUSAL_COMMANDS = [
    { cat: '物理模拟', tags: ['开启顶盖 → 烟雾溢出', '零件爆炸 → 展现内构', '物体坠落 → 产生撞击坑'] },
    { cat: '电力激活', tags: ['接通电源 → 屏幕亮起', '开启开关 → 核心发光', '感应器激活 → 改变CMF'] },
    { cat: '环境碰撞', tags: ['置于雨中 → 表面凝聚水珠', '激光照射 → 切割火花', '置入熔岩 → 边缘发红熔化'] },
];

const PropertiesPanel: React.FC<PropertiesPanelProps> = ({ 
  selectedItem, selectedItems = [], onUpdateItem, onGenerate, onDelete, onAutoPrompt, 
  onEnterEditMode, onExitEditMode, initialView, onSendToPrompt, onSendToGemini, onSyncPointsToGemini,
  onFrameAction, editTool = 'brush', setEditTool, brushSize = 30, setBrushSize, onApplyEdit, onClearMask,
  onJSONAnalysis, isAnalyzingJSON, onStartPickPoint, isPickingPoint, currentEvolutionLevel = 60,
  isCncMode, setIsCncMode, onUpdatePoint, onClearAllPoints, onCommitPointChanges, onAutoAlign, onClosePanel,
  onFloatingAction
}) => {
  const [currentView, setCurrentView] = useState<PanelView>('main');
  const [localPrompt, setLocalPrompt] = useState('');
  const [modelCommand, setModelCommand] = useState('');
  const [isCommandFocused, setIsCommandFocused] = useState(false);
  const [activeTab, setActiveTab] = useState<'actions' | 'details' | 'nodes'>('actions');
  const [artisticLevel, setArtisticLevel] = useState(currentEvolutionLevel);
  const [pickTemperature, setPickTemperature] = useState(0.8);
  const [isAligning, setIsAligning] = useState(false);
  const [isSwapped, setIsSwapped] = useState(false); 
  const [usePro, setUsePro] = useState(true);
  
  const [dynamicSuggestions, setDynamicSuggestions] = useState<string[]>([]);
  const [isRefreshingSuggestions, setIsRefreshingSuggestions] = useState(false);

  const textInputRef = useRef<HTMLTextAreaElement>(null);
  const commandRef = useRef<HTMLTextAreaElement>(null);

  const currentStage = useMemo(() => getEvolutionStage(artisticLevel), [artisticLevel]);

  const isTransplantMode = useMemo(() => {
    return selectedItems.length === 2 && selectedItems.every(i => i.type === ItemType.IMAGE);
  }, [selectedItems]);

  useEffect(() => {
    if (initialView) {
        setCurrentView(initialView.view as PanelView);
        if (initialView.view === 'edit_area') onEnterEditMode?.('brush');
    } else {
        setCurrentView('main');
    }
  }, [initialView?.ts, selectedItem?.id]);

  useEffect(() => {
    if (selectedItem) setLocalPrompt(selectedItem.prompt || '');
    if (selectedItem?.type === ItemType.TEXT) {
        setTimeout(() => {
            textInputRef.current?.focus();
            if (selectedItem.content === '在此输入内容') {
                textInputRef.current?.select();
            }
        }, 100);
    }
  }, [selectedItem?.id, selectedItem?.prompt, selectedItem?.type]);

  useEffect(() => {
    setArtisticLevel(currentEvolutionLevel);
  }, [currentEvolutionLevel]);

  const handleRefreshSuggestions = async () => {
    if (!selectedItem || selectedItem.type !== ItemType.MODEL || isRefreshingSuggestions) return;
    setIsRefreshingSuggestions(true);
    try {
        const ideas = await generateInteractionSuggestions(selectedItem.content || 'Industrial model');
        setDynamicSuggestions(ideas);
    } catch (e) {
        console.error("Failed to fetch suggestions", e);
    } finally {
        setIsRefreshingSuggestions(false);
    }
  };

  useEffect(() => {
    if (selectedItem?.type === ItemType.MODEL && dynamicSuggestions.length === 0) {
        handleRefreshSuggestions();
    }
  }, [selectedItem?.id]);

  const handleAutoAlignInternal = async (targetId: string, sourceId: string) => {
    if (!onAutoAlign) return;
    setIsAligning(true);
    try {
      await onAutoAlign(sourceId, targetId);
    } finally {
      setIsAligning(false);
    }
  };

  const handleFontSizeChange = (size: number) => {
    if (selectedItem) {
      onUpdateItem(selectedItem.id, { fontSize: size });
    }
  };

  if (!selectedItem && !isTransplantMode) {
    return (
      <div className="w-full h-full bg-[#09090b] border border-zinc-800 rounded-[24px] p-6 flex flex-col text-zinc-500 shadow-2xl overflow-y-auto no-scrollbar">
         <div className="text-center space-y-6 mt-8 mb-12">
            <div className="w-16 h-16 bg-zinc-800/50 rounded-[20px] flex items-center justify-center mx-auto border border-zinc-700/50 shadow-inner">
                <SparklesIcon className="w-8 h-8 text-indigo-400 opacity-50" />
            </div>
            <div className="space-y-2">
                <h3 className="font-black text-white text-[12px] uppercase tracking-[0.2em]">工作台</h3>
                <p className="text-[11px] text-zinc-500 leading-relaxed max-w-[180px] mx-auto">选择一个画框、图像或 3D 模型来编辑其属性、生成变体或应用空间控制。</p>
            </div>
         </div>

         <div className="space-y-2 mt-auto">
             <div className="px-2 mb-4">
                 <span className="text-[10px] font-black text-zinc-500 uppercase tracking-widest">探索与发现</span>
             </div>
             {[
                 { label: '有趣的玩法', icon: <SparklesIcon className="w-4.5 h-4.5 text-yellow-400"/>, action: () => onFloatingAction?.('', 'open_playstyles') },
                 { label: '提取设计食谱', icon: <FlaskIcon className="w-4.5 h-4.5 text-pink-400"/>, action: () => onFloatingAction?.('', 'extract_recipe') },
                 { label: '拓扑变体', icon: <ShuffleIcon className="w-4.5 h-4.5 text-emerald-400"/>, action: () => onFloatingAction?.('', 'topology_variation') },
             ].map(b => (
                 <button 
                   key={b.label} 
                   onClick={b.action} 
                   className="w-full flex items-center justify-between p-4 rounded-2xl transition-all group hover:bg-white/5 border border-transparent hover:border-white/5"
                 >
                   <div className="flex items-center gap-4">
                     <div className="w-10 h-10 rounded-xl bg-zinc-800/50 flex items-center justify-center group-hover:scale-110 transition-transform shadow-sm">
                         {b.icon}
                     </div>
                     <span className="text-[13px] font-bold text-zinc-300 group-hover:text-white transition-colors">{b.label}</span>
                   </div>
                   <ChevronRightIcon className="w-4 h-4 text-zinc-700 group-hover:text-zinc-400 transition-transform group-hover:translate-x-1"/>
                 </button>
             ))}
         </div>
      </div>
    );
  }

  const handleBack = () => {
    setCurrentView('main');
    onExitEditMode?.();
  };

  const renderModelPanel = () => {
    if (!selectedItem || selectedItem.type !== ItemType.MODEL) return null;
    
    const handleCaptureView = () => {
        if (!selectedItem.spatialConfig) return;
        const currentViews = selectedItem.savedViews || [];
        onUpdateItem(selectedItem.id, { 
            savedViews: [...currentViews, { ...selectedItem.spatialConfig }] 
        });
    };

    const handleApplyStandardView = (viewAngle: string, config: any) => {
        onUpdateItem(selectedItem.id, { 
            viewAngle: viewAngle as any, 
            spatialConfig: config,
            cameraMode: 'orthographic' 
        });
    };

    const handleExecuteModelCommand = (cmdText?: string) => {
        const finalCmd = cmdText || modelCommand;
        if (!finalCmd.trim()) return;
        onFloatingAction?.(selectedItem.id, `model_cmd:${finalCmd}`);
        setModelCommand('');
        setIsCommandFocused(false);
    };

    const handleAppendCausalTag = (tag: string) => {
        const currentPrompt = selectedItem.worldSimPrompt || '';
        const newPrompt = currentPrompt ? `${currentPrompt}\n${tag}` : tag;
        onUpdateItem(selectedItem.id, { worldSimPrompt: newPrompt });
    };

    const handleApplyMaterial = (partId: string | undefined, cmfKey: string) => {
        const cmf = (CMF_LIBRARY as any)[cmfKey];
        if (!cmf) return;
        const targetPart = partId || selectedItem.activePartId;
        if (!targetPart) {
            alert("请先选择一个零件或指定操作目标。");
            return;
        }
        const currentCMFMap = selectedItem.partCMFMap || {};
        onUpdateItem(selectedItem.id, {
            partCMFMap: {
                ...currentCMFMap,
                [targetPart]: { ...cmf }
            }
        });
    };

    const handleExpressionAction = (action: 'clay' | 'xray' | 'isolate' | 'reset') => {
        const updates: Partial<CanvasItem> = {};
        const parts = selectedItem.partList || [];
        const active = selectedItem.activePartId;

        if (action === 'reset') {
            updates.partCMFMap = {};
            updates.hiddenPartIds = [];
            updates.highlightedPartIds = [];
            updates.wireframeMode = false;
            updates.showExplodeTrails = false;
            updates.technicalCallouts = false;
            updates.knollingFactor = 0;
            updates.explodeFactor = 0;
            updates.viewAngle = 'perspective';
            updates.cameraMode = 'perspective';
        } else if (action === 'clay') {
            const clayCMF: Record<string, PartCMF> = {};
            parts.forEach(p => clayCMF[p] = { color: '#eeeeee', metalness: 0, roughness: 1, opacity: 1 });
            updates.partCMFMap = clayCMF;
        } else if (action === 'xray') {
            const xrayCMF: Record<string, PartCMF> = { ...selectedItem.partCMFMap };
            parts.forEach(p => {
                if (p !== active) xrayCMF[p] = { ...xrayCMF[p], opacity: 0.15 };
                else xrayCMF[p] = { ...xrayCMF[p], opacity: 1.0 };
            });
            updates.partCMFMap = xrayCMF;
        } else if (action === 'isolate' && active) {
            updates.hiddenPartIds = parts.filter(p => p !== active);
        }

        onUpdateItem(selectedItem.id, updates);
    };

    const standardViews = [
        { id: 'front', label: 'FRONT', config: { azimuth: 0, elevation: 0, distance: selectedItem.spatialConfig?.distance || 12, fov: 45 } },
        { id: 'back', label: 'BACK', config: { azimuth: 180, elevation: 0, distance: selectedItem.spatialConfig?.distance || 12, fov: 45 } },
        { id: 'left', label: 'LEFT', config: { azimuth: 270, elevation: 0, distance: selectedItem.spatialConfig?.distance || 12, fov: 45 } },
        { id: 'right', label: 'RIGHT', config: { azimuth: 90, elevation: 0, distance: selectedItem.spatialConfig?.distance || 12, fov: 45 } },
        { id: 'top', label: 'TOP', config: { azimuth: 0, elevation: 89, distance: selectedItem.spatialConfig?.distance || 12, fov: 45 } },
        { id: 'bottom', label: 'BOT', config: { azimuth: 0, elevation: -89, distance: selectedItem.spatialConfig?.distance || 12, fov: 45 } },
        { id: 'iso_fr', label: 'ISO FR', config: { azimuth: 45, elevation: 35, distance: selectedItem.spatialConfig?.distance || 12, fov: 45 } },
        { id: 'iso_fl', label: 'ISO FL', config: { azimuth: 315, elevation: 35, distance: selectedItem.spatialConfig?.distance || 12, fov: 45 } },
        { id: 'iso_br', label: 'ISO BR', config: { azimuth: 135, elevation: 35, distance: selectedItem.spatialConfig?.distance || 12, fov: 45 } },
        { id: 'iso_bl', label: 'ISO BL', config: { azimuth: 225, elevation: 35, distance: selectedItem.spatialConfig?.distance || 12, fov: 45 } },
    ];

    const staticSuggestions = [
        { label: '复位模型状态', cmd: '重置所有设置' },
        { label: '物理爆炸展开', cmd: '将模型爆炸 60%' },
        { label: '聚焦选中零件', cmd: '高亮选中零件' },
        { label: '零件平铺模式', cmd: '开启平铺模式 100%' },
    ];

    return (
        <div className="flex flex-col h-full bg-[#09090b] text-white p-6 overflow-y-auto no-scrollbar pointer-events-auto space-y-8 relative">
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <BoxIcon className="w-5 h-5 text-indigo-500"/>
                    <span className="font-black text-[11px] uppercase tracking-[0.2em] text-zinc-100">3D 对象编排器</span>
                </div>
                <button onClick={() => onDelete(selectedItem.id)} className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-red-500/10 text-zinc-500 hover:text-red-500 transition-all">
                    <TrashIcon className="w-4 h-4"/>
                </button>
            </div>

            <div className="space-y-4 p-5 bg-zinc-900/40 border border-white/5 rounded-[32px]">
                <div className="flex items-center justify-between mb-2">
                    <label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest flex items-center gap-2">
                        <CameraIcon className="w-3.5 h-3.5 text-indigo-400" /> Viewport Control
                    </label>
                    <div className="flex gap-1.5">
                        <button 
                            onClick={() => onFloatingAction?.(selectedItem.id, 'maximized_3d')}
                            className="p-1.5 bg-white/5 text-zinc-400 hover:text-white rounded-lg border border-white/5 transition-all"
                            title="最大化视图"
                        >
                            <MaximizeIcon className="w-3.5 h-3.5" />
                        </button>
                        <button 
                            onClick={handleCaptureView}
                            className="p-1.5 bg-indigo-500/10 text-indigo-400 hover:bg-indigo-500/20 rounded-lg border border-indigo-500/20 transition-all"
                            title="保存视图"
                        >
                            <PlusIcon className="w-3 h-3" />
                        </button>
                    </div>
                </div>

                <div className="grid grid-cols-3 grid-rows-3 gap-1.5 aspect-square">
                    <button onClick={() => handleApplyStandardView('iso_fl', standardViews[7].config)} className="py-2.5 bg-zinc-800/40 hover:bg-zinc-700 rounded-lg text-[8px] font-black transition-all border border-white/5">FL</button>
                    <button onClick={() => handleApplyStandardView('top', standardViews[4].config)} className="py-2.5 bg-zinc-800/60 hover:bg-indigo-600 rounded-lg text-[8px] font-black transition-all border border-white/5">TOP</button>
                    <button onClick={() => handleApplyStandardView('iso_fr', standardViews[6].config)} className="py-2.5 bg-zinc-800/40 hover:bg-zinc-700 rounded-lg text-[8px] font-black transition-all border border-white/5">FR</button>
                    
                    <button onClick={() => handleApplyStandardView('left', standardViews[2].config)} className="py-2.5 bg-zinc-800/60 hover:bg-indigo-600 rounded-lg text-[8px] font-black transition-all border border-white/5">LEFT</button>
                    <button onClick={() => handleApplyStandardView('front', standardViews[0].config)} className="py-2.5 bg-indigo-600 text-white rounded-lg text-[9px] font-black shadow-lg shadow-indigo-600/20 border border-white/10">FRONT</button>
                    <button onClick={() => handleApplyStandardView('right', standardViews[3].config)} className="py-2.5 bg-zinc-800/60 hover:bg-indigo-600 rounded-lg text-[8px] font-black transition-all border border-white/5">RIGHT</button>
                    
                    <button onClick={() => handleApplyStandardView('iso_bl', standardViews[9].config)} className="py-2.5 bg-zinc-800/40 hover:bg-zinc-700 rounded-lg text-[8px] font-black transition-all border border-white/5">BL</button>
                    <button onClick={() => handleApplyStandardView('bottom', standardViews[5].config)} className="py-2.5 bg-zinc-800/60 hover:bg-indigo-600 rounded-lg text-[8px] font-black transition-all border border-white/5">BOT</button>
                    <button onClick={() => handleApplyStandardView('iso_br', standardViews[8].config)} className="py-2.5 bg-zinc-800/40 hover:bg-zinc-700 rounded-lg text-[8px] font-black transition-all border border-white/5">BR</button>
                </div>
                
                <div className="pt-2">
                    <button onClick={() => handleApplyStandardView('back', standardViews[1].config)} className="w-full py-2.5 bg-zinc-900/80 hover:bg-zinc-700 rounded-xl text-[9px] font-black border border-white/5 tracking-widest transition-all">REAR VIEW (BACK)</button>
                </div>

                <div className="flex bg-zinc-800/50 p-1 rounded-xl gap-1 border border-white/5 mt-2">
                    <button 
                        onClick={() => onUpdateItem(selectedItem.id, { cameraMode: 'perspective' })}
                        className={`flex-1 py-2 text-[10px] font-black uppercase tracking-widest rounded-lg transition-all ${selectedItem.cameraMode !== 'orthographic' ? 'bg-indigo-600 text-white shadow-lg' : 'text-zinc-500 hover:text-zinc-300'}`}
                    >
                        透视
                    </button>
                    <button 
                        onClick={() => onUpdateItem(selectedItem.id, { cameraMode: 'orthographic' })}
                        className={`flex-1 py-2 text-[10px] font-black uppercase tracking-widest rounded-lg transition-all ${selectedItem.cameraMode === 'orthographic' ? 'bg-indigo-600 text-white shadow-lg' : 'text-zinc-500 hover:text-zinc-300'}`}
                    >
                        正交
                    </button>
                </div>
            </div>

            <div className="space-y-4 p-5 bg-indigo-500/5 border border-indigo-500/10 rounded-[32px]">
                <div className="flex items-center justify-between">
                    <label className="text-[10px] font-black text-indigo-400 uppercase tracking-widest flex items-center gap-2">
                        <SparklesIcon className="w-3.5 h-3.5" /> World Model Sim
                    </label>
                    <button 
                        onClick={() => onUpdateItem(selectedItem.id, { twinEnabled: !selectedItem.twinEnabled })}
                        className={`px-3 py-1 text-[8px] font-black rounded-md transition-all ${selectedItem.twinEnabled ? 'bg-indigo-600 text-white shadow-lg' : 'text-zinc-500 bg-zinc-800/50'}`}
                    >
                        TWIN {selectedItem.twinEnabled ? 'ON' : 'OFF'}
                    </button>
                </div>

                <div className="space-y-4">
                   <textarea 
                      value={selectedItem.worldSimPrompt || ''}
                      onChange={(e) => onUpdateItem(selectedItem.id, { worldSimPrompt: e.target.value })}
                      className="w-full bg-black/40 border border-white/5 rounded-2xl p-4 text-[12px] h-24 outline-none focus:border-indigo-500/30 transition-all placeholder:text-zinc-700 font-medium leading-relaxed resize-none"
                      placeholder="描述交互因果 (例如：按下开关 -> 核心发光)..."
                   />

                   <div className="grid grid-cols-2 gap-2">
                       <button 
                          onClick={() => onFloatingAction?.(selectedItem.id, 'world_sim_video')}
                          disabled={!selectedItem.worldSimPrompt?.trim()}
                          className="flex items-center justify-center gap-2 py-3.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-[9px] font-black uppercase tracking-widest transition-all disabled:opacity-30 shadow-xl shadow-indigo-600/20"
                       >
                           <VideoIcon className="w-3.5 h-3.5" /> 渲染短片
                       </button>
                       <button 
                          onClick={() => onFloatingAction?.(selectedItem.id, 'twin_render_manual')}
                          className="flex items-center justify-center gap-2 py-3.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all border border-white/5"
                       >
                           <RefreshIcon className="w-3.5 h-3.5" /> 同步渲染
                       </button>
                   </div>
                </div>
            </div>

            <div className="space-y-4">
                <label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest flex items-center gap-2">
                    <MagicCurveIcon className="w-3.5 h-3.5" /> Quick Expressions
                </label>
                <div className="grid grid-cols-2 gap-2">
                    {[
                        { id: 'reset', label: '还原状态', icon: <RotateCcwIcon className="w-3.5 h-3.5" /> },
                        { id: 'xray', label: 'X-Ray 透视', icon: <EyeIcon className="w-3.5 h-3.5" /> },
                        { id: 'clay', label: 'Clay 模式', icon: <BoxIcon className="w-3.5 h-3.5" /> },
                        { id: 'isolate', label: '孤立选中件', icon: <TargetIcon className="w-3.5 h-3.5" /> },
                    ].map(btn => (
                        <button 
                            key={btn.id}
                            onClick={() => handleExpressionAction(btn.id as any)}
                            className="flex items-center gap-2 py-3 px-4 bg-zinc-800/40 hover:bg-indigo-600/20 rounded-xl text-[10px] font-black uppercase tracking-widest border border-white/5 transition-all"
                        >
                            {btn.icon} {btn.label}
                        </button>
                    ))}
                </div>
            </div>

            <div className="space-y-6">
                <div className="space-y-4">
                    <div className="flex justify-between items-center px-1">
                        <label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest">3D 零件平铺强度</label>
                        <span className="text-indigo-400 font-mono text-[11px] font-black bg-indigo-500/10 px-2 py-0.5 rounded-md border border-indigo-500/20">{Math.round((selectedItem.knollingFactor || 0) * 100)}%</span>
                    </div>
                    <input 
                        type="range" min="0" max="1" step="0.01"
                        value={selectedItem.knollingFactor || 0}
                        onChange={(e) => onUpdateItem(selectedItem.id, { knollingFactor: Number(e.target.value) })}
                        className="w-full h-1 bg-zinc-800 rounded-lg appearance-none accent-indigo-500 cursor-pointer"
                    />
                </div>

                <div className="space-y-4">
                    <div className="flex justify-between items-center px-1">
                        <label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest">物理爆炸强度</label>
                        <span className="text-indigo-400 font-mono text-[11px] font-black bg-indigo-500/10 px-2 py-0.5 rounded-md border border-indigo-500/20">{Math.round((selectedItem.explodeFactor || 0) * 100)}%</span>
                    </div>
                    <input 
                        type="range" min="0" max="1" step="0.01"
                        value={selectedItem.explodeFactor || 0}
                        onChange={(e) => onUpdateItem(selectedItem.id, { explodeFactor: Number(e.target.value) })}
                        className="w-full h-1 bg-zinc-800 rounded-lg appearance-none accent-indigo-500 cursor-pointer"
                    />
                </div>
            </div>

            <div className="space-y-3">
                <label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest flex items-center gap-2">
                    <PaletteIcon className="w-3.5 h-3.5" /> Material Library (CMF)
                </label>
                <div className="grid grid-cols-4 gap-2">
                    {Object.entries(CMF_LIBRARY).map(([key, cmf]) => (
                        <button 
                            key={key}
                            onClick={() => handleApplyMaterial(undefined, key)}
                            className="group relative aspect-square rounded-xl overflow-hidden border border-white/5 hover:border-indigo-500 transition-all shadow-lg"
                            title={(cmf as any).label}
                        >
                            <div className="absolute inset-0" style={{ backgroundColor: (cmf as any).color, opacity: (cmf as any).opacity ?? 1 }} />
                            <div className="absolute inset-0 bg-gradient-to-tr from-black/40 to-white/10 opacity-60" />
                            <div className="absolute inset-0 opacity-0 group-hover:opacity-100 bg-black/40 flex items-center justify-center transition-opacity">
                                <CheckIcon className="w-4 h-4 text-white" />
                            </div>
                        </button>
                    ))}
                </div>
            </div>

            <div className="grid grid-cols-1 gap-3">
                <button 
                    onClick={() => onFloatingAction?.(selectedItem.id, 'auto_staging')}
                    className="w-full py-4 bg-indigo-600 hover:bg-indigo-500 text-white font-black uppercase tracking-[0.2em] text-[10px] rounded-2xl shadow-xl flex items-center justify-center gap-3 transition-all active:scale-[0.98]"
                >
                    <LayoutGridIcon className="w-4 h-4" /> 一键生成三视图
                </button>
            </div>
        </div>
    );
  };
  
  const renderEditArea = () => {
    if (!selectedItem) return null;
    return (
      <div className="flex flex-col h-full bg-[#09090b] animate-in slide-in-from-right-4 duration-500">
          <div className="flex items-center p-6 border-b border-zinc-800 bg-[#09090b]">
              <button onClick={handleBack} className="w-9 h-9 flex items-center justify-center hover:bg-zinc-800 rounded-xl mr-3 transition-all text-zinc-400 hover:text-white">
                <ChevronLeftIcon className="w-4 h-4"/>
              </button>
              <span className="text-[11px] font-black uppercase tracking-[0.2em] text-zinc-100">局部修改与重绘</span>
          </div>

          <div className="flex-1 overflow-y-auto no-scrollbar p-6 space-y-8">
              <div className="space-y-4">
                  <label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest flex items-center gap-2">
                    <BrushIcon className="w-3.5 h-3.5" /> 画笔工具配置
                  </label>
                  <div className="flex bg-zinc-800/50 p-1 rounded-xl gap-1 border border-white/5">
                      <button 
                          onClick={() => setEditTool?.('brush')}
                          className={`flex-1 py-3 flex flex-col items-center gap-1 rounded-lg transition-all ${editTool === 'brush' ? 'bg-indigo-600 text-white shadow-lg' : 'text-zinc-500 hover:text-zinc-300'}`}
                      >
                          <BrushIcon className="w-4 h-4" />
                          <span className="text-[8px] font-black uppercase tracking-widest">添加区域</span>
                      </button>
                      <button 
                          onClick={() => setEditTool?.('eraser')}
                          className={`flex-1 py-3 flex flex-col items-center gap-1 rounded-lg transition-all ${editTool === 'eraser' ? 'bg-indigo-600 text-white shadow-lg' : 'text-zinc-500 hover:text-zinc-300'}`}
                      >
                          <EraserIcon className="w-4 h-4" />
                          <span className="text-[8px] font-black uppercase tracking-widest">擦除区域</span>
                      </button>
                  </div>
              </div>

              <div className="space-y-4">
                  <div className="flex justify-between items-center px-1">
                      <label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest">笔触大小 (BRUSH SIZE)</label>
                      <span className="text-indigo-400 font-mono text-[11px] font-black bg-indigo-500/10 px-2 py-0.5 rounded-md border border-indigo-500/20">{brushSize}px</span>
                  </div>
                  <input 
                      type="range" min="1" max="150" step="1"
                      value={brushSize}
                      onChange={(e) => setBrushSize?.(Number(e.target.value))}
                      className="w-full h-1 bg-zinc-800 rounded-lg appearance-none accent-indigo-500 cursor-pointer"
                  />
              </div>

              <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest">重绘指令描述</label>
                    <button onClick={onClearMask} className="text-[9px] font-black text-zinc-600 hover:text-red-400 uppercase tracking-widest transition-colors flex items-center gap-1.5">
                        <RotateCcwIcon className="w-3.5 h-3.5" /> 清空涂抹
                    </button>
                  </div>
                  <textarea 
                      value={localPrompt}
                      onChange={(e) => setLocalPrompt(e.target.value)}
                      className="w-full bg-[#111113] border border-zinc-800 rounded-xl px-4 py-3 text-[13px] font-bold text-white focus:border-indigo-500 outline-none resize-none h-32 shadow-inner leading-relaxed placeholder:text-zinc-800"
                      placeholder="描述您想在这个涂抹区域内生成的新物体、材质或变化..."
                  />
              </div>
          </div>

          <div className="p-6 bg-[#09090b] border-t border-zinc-800">
              <button 
                  onClick={() => onApplyEdit?.(localPrompt)}
                  disabled={!localPrompt.trim()}
                  className="w-full py-4 bg-[#5546fe] hover:bg-indigo-500 text-white font-black uppercase tracking-[0.2em] text-[11px] rounded-[18px] shadow-2xl transition-all flex items-center justify-center gap-3 active:scale-[0.98] disabled:opacity-40"
              >
                  <SparklesIcon className="w-4.5 h-4.5"/>
                  立即重绘所选区域
              </button>
          </div>
      </div>
    );
  };

  const renderTransplantPanel = () => {
    const targetImg = isSwapped ? selectedItems[1] : selectedItems[0];
    const sourceImg = isSwapped ? selectedItems[0] : selectedItems[1];
    const targetPoints = targetImg?.identifiedPoints || [];
    const sourcePoints = sourceImg?.identifiedPoints || [];
    
    return (
        <div className="flex flex-col h-full animate-in fade-in duration-500 bg-[#09090b]">
            <div className="p-6 border-b border-zinc-800 flex flex-col gap-5">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <MagicCurveIcon className="w-5 h-5 text-indigo-400" />
                        <span className="font-black text-[12px] uppercase tracking-[0.2em] text-white">跨图设计移植</span>
                    </div>
                </div>
                
                <div className="flex gap-4 relative items-center">
                    <div className={`flex-1 p-2 rounded-2xl border transition-all duration-500 ${!isSwapped ? 'bg-white/5 border-indigo-500/30 ring-1 ring-indigo-500/20 shadow-[0_0_20px_rgba(99,102,241,0.1)]' : 'bg-black border-white/5 opacity-50'}`}>
                        <div className="flex items-center justify-between mb-1.5 px-1">
                            <span className={`text-[9px] font-black uppercase tracking-widest ${!isSwapped ? 'text-indigo-400' : 'text-zinc-500'}`}>结构 (Target)</span>
                        </div>
                        <div className="aspect-video rounded-xl bg-black overflow-hidden relative border border-white/5 shadow-inner">
                            <img src={isSwapped ? selectedItems[1]?.content : selectedItems[0]?.content} className="w-full h-full object-cover" />
                        </div>
                    </div>

                    <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-20">
                        <button 
                            onClick={() => setIsSwapped(!isSwapped)}
                            className="w-10 h-10 rounded-full bg-indigo-600 border-4 border-[#09090b] text-white flex items-center justify-center shadow-[0_8px_24px_rgba(0,0,0,0.8)] hover:scale-110 active:rotate-180 transition-all duration-500 hover:bg-indigo-500"
                            title="互换角色"
                        >
                            <RefreshIcon className="w-5 h-5" />
                        </button>
                    </div>

                    <div className={`flex-1 p-2 rounded-2xl border transition-all duration-500 ${isSwapped ? 'bg-white/5 border-indigo-500/30 ring-1 ring-indigo-500/20 shadow-[0_0_20px_rgba(99,102,241,0.1)]' : 'bg-black border-white/5 opacity-50'}`}>
                        <div className="flex items-center justify-between mb-1.5 px-1">
                            <span className={`text-[9px] font-black uppercase tracking-widest ${isSwapped ? 'text-indigo-400' : 'text-zinc-500'}`}>审美 (Source)</span>
                        </div>
                        <div className="aspect-video rounded-xl bg-black overflow-hidden relative border border-white/5 shadow-inner">
                            <img src={isSwapped ? selectedItems[0]?.content : selectedItems[1]?.content} className="w-full h-full object-cover" />
                        </div>
                    </div>
                </div>
            </div>

            <div className="flex-1 overflow-y-auto no-scrollbar p-6 space-y-6">
                <div className="space-y-4">
                    <div className="flex items-center justify-between">
                        <span className="text-[10px] font-black text-zinc-500 uppercase tracking-widest">特征点配对细节</span>
                        <button 
                            onClick={() => handleAutoAlignInternal(targetImg.id, sourceImg.id)}
                            disabled={isAligning || targetPoints.length === 0 || sourcePoints.length === 0}
                            className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-[9px] font-black uppercase tracking-widest transition-all ${isAligning ? 'bg-indigo-600 animate-pulse text-white' : 'bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 hover:bg-indigo-500/20'}`}
                        >
                            {isAligning ? <RefreshIcon className="w-3 h-3 animate-spin" /> : <SparklesIcon className="w-3 h-3" />}
                            语义自动对齐
                        </button>
                    </div>

                    <div className="space-y-4">
                        {targetPoints.map(p => {
                            const pairedPoint = sourcePoints.find(sp => sp.id === p.pairingId);
                            return (
                                <div key={p.id} className="p-4 bg-[#111113] rounded-2xl border border-white/5 flex flex-col gap-4 shadow-sm hover:border-white/10 transition-all group/item">
                                    <div className="flex items-start gap-3">
                                        <div className="w-6 h-6 rounded-lg bg-zinc-800 flex items-center justify-center text-[10px] font-black text-white shrink-0 mt-0.5">
                                            {p.label}
                                        </div>
                                        <div className="flex flex-col min-w-0 flex-1">
                                            <span className="text-[8px] font-black text-zinc-600 uppercase tracking-widest">Target 结构件</span>
                                            <span className="text-[12px] font-bold text-zinc-100 break-all leading-snug">{p.description}</span>
                                        </div>
                                    </div>
                                    
                                    <div className="flex items-start gap-3 ml-2 border-l border-zinc-800/80 pl-4">
                                        <div className="w-1.5 h-1.5 rounded-full bg-indigo-500 shrink-0 shadow-[0_0_10px_rgba(99,102,241,0.5)] mt-3.5" />
                                        {pairedPoint ? (
                                            <div className="flex-1 flex items-start justify-between min-w-0 bg-indigo-500/5 px-4 py-3 rounded-xl border border-indigo-500/10 transition-all group-hover/item:border-indigo-500/30">
                                                <div className="flex flex-col min-w-0 flex-1">
                                                    <span className="text-[8px] font-black text-indigo-400 uppercase tracking-widest flex items-center gap-1.5">
                                                        Source 移植源 ({pairedPoint.label})
                                                    </span>
                                                    <span className="text-[12px] font-black text-indigo-300 break-all leading-snug mt-0.5">{pairedPoint.description}</span>
                                                </div>
                                                <button onClick={() => onUpdatePoint?.(targetImg.id, p.id, { pairingId: undefined, pairingSourceItemId: undefined })} className="p-1 text-zinc-600 hover:text-red-400 transition-colors ml-2 shrink-0">
                                                    <XIcon className="w-4 h-4" />
                                                </button>
                                            </div>
                                        ) : (
                                            <div className="flex-1 py-3 text-[10px] font-black text-zinc-700 uppercase tracking-widest border border-dashed border-zinc-800/50 rounded-xl text-center">
                                                等待配对...
                                            </div>
                                        )}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            </div>

            <div className="p-6 border-t border-zinc-800 space-y-4 bg-black/20">
                <button 
                    onClick={() => onCommitPointChanges?.(targetImg.id)}
                    disabled={!targetPoints.some(p => p.pairingId)}
                    className="w-full py-4 bg-indigo-600 hover:bg-indigo-500 text-white font-black uppercase tracking-[0.25em] text-[12px] rounded-[18px] shadow-[0_15px_30px_rgba(79,70,229,0.3)] transition-all flex items-center justify-center gap-3 active:scale-[0.98] disabled:opacity-40 disabled:cursor-not-allowed"
                >
                    <SparklesIcon className="w-5 h-5" />
                    执行精准设计移植
                </button>
            </div>
        </div>
    );
  };

  const renderPointNodes = () => {
    if (!selectedItem) return null;
    const points = selectedItem.identifiedPoints || [];
    
    const hasChanges = points.some(p => 
        p.isRemoving || 
        (p.modifiedDescription && p.modifiedDescription !== p.description) || 
        p.pairingId || 
        (p.originalPos && (Math.abs(p.originalPos[0] - p.y) > 1 || Math.abs(p.originalPos[1] - p.x) > 1))
    );

    return (
        <div className="space-y-5 animate-in fade-in slide-in-from-bottom-2 duration-400">
            <div className="flex items-center justify-between px-1">
                <div className="flex flex-col">
                    <span className="text-[11px] font-black text-white uppercase tracking-widest">特征点管理器</span>
                    <span className="text-[8px] text-zinc-500 font-bold uppercase tracking-widest mt-0.5">Semantic Node Controller</span>
                </div>
                <div className="flex items-center gap-2">
                    <button 
                        onClick={() => onClearAllPoints?.(selectedItem.id)}
                        className="flex items-center gap-1.5 px-3 py-1.5 bg-red-500/10 text-red-500 hover:bg-red-500/20 rounded-full text-[9px] font-black uppercase tracking-widest transition-all border border-red-500/20"
                        title="清空当前图片的所有点位"
                    >
                        <TrashIcon className="w-3.5 h-3.5" />
                        一键清空
                    </button>
                </div>
            </div>

            <div className="space-y-3 max-h-[400px] overflow-y-auto no-scrollbar pr-1">
                {points.length === 0 ? (
                    <div className="py-12 border-2 border-dashed border-zinc-800 rounded-3xl flex flex-col items-center justify-center text-center px-6 gap-4 opacity-40">
                         <TargetIcon className="w-8 h-8 text-zinc-700" />
                         <p className="text-[10px] font-bold text-zinc-500 leading-relaxed">未检测到锚点。请执行“拾取细节”或在画布上右键添加点位。</p>
                    </div>
                ) : points.map((pt) => {
                    const isChanged = pt.modifiedDescription && pt.modifiedDescription !== pt.description;
                    return (
                        <div key={pt.id} className={`p-3 rounded-2xl border transition-all ${pt.isRemoving ? 'bg-red-500/5 border-red-500/20' : pt.pairingId ? 'bg-indigo-500/5 border-indigo-500/20' : isChanged ? 'bg-indigo-600/10 border-indigo-500/40' : 'bg-[#111113] border-white/5'}`}>
                            <div className="flex items-center justify-between mb-3">
                                <div className="flex items-center gap-3">
                                    <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-black ${pt.isRemoving ? 'bg-red-600 text-white' : pt.pairingId ? 'bg-indigo-600 text-white' : isChanged ? 'bg-indigo-500 text-white animate-pulse' : 'bg-zinc-700 text-white shadow-lg'}`}>
                                        {pt.label}
                                    </div>
                                    <div className="flex flex-col">
                                        <span className="text-[9px] font-black text-zinc-500 font-mono">COORD: {Math.round(pt.y)},{Math.round(pt.x)}</span>
                                    </div>
                                </div>
                                <button 
                                    onClick={() => onUpdatePoint?.(selectedItem.id, pt.id, { isRemoving: !pt.isRemoving })}
                                    className={`p-1.5 rounded-lg transition-all ${pt.isRemoving ? 'bg-red-600 text-white' : 'text-zinc-600 hover:text-red-400 hover:bg-red-500/10'}`}
                                >
                                    <EraserIcon className="w-3.5 h-3.5" />
                                </button>
                            </div>
                            <input 
                                value={pt.modifiedDescription ?? pt.description ?? ''}
                                onChange={(e) => onUpdatePoint?.(selectedItem.id, pt.id, { modifiedDescription: e.target.value })}
                                className={`w-full bg-black/40 border border-white/5 rounded-xl px-3 py-2 text-[11px] font-bold outline-none focus:border-indigo-500/50 transition-all ${pt.isRemoving ? 'line-through text-zinc-600 opacity-50' : 'text-zinc-200'}`}
                                placeholder="输入对此点的重构描述..."
                            />
                        </div>
                    );
                })}
            </div>

            <div className="space-y-4 pt-2">
                {hasChanges && (
                    <div className="animate-in fade-in zoom-in-95">
                        <button 
                            onClick={() => onCommitPointChanges?.(selectedItem.id)}
                            className="w-full py-4 bg-indigo-600 hover:bg-indigo-500 text-white font-black uppercase tracking-[0.2em] text-[11px] rounded-[18px] shadow-[0_15px_30px_rgba(79,70,229,0.3)] animate-pulse transition-all flex items-center justify-center gap-3 active:scale-[0.98]"
                        >
                            <SparklesIcon className="w-4 h-4" />
                            提交并执行批量语义重构
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
  };

  const renderFramePanel = () => {
    if (!selectedItem) return null;
    return (
        <div className="flex flex-col h-full bg-[#09090b] text-white p-6 overflow-y-auto no-scrollbar pointer-events-auto space-y-8">
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <SquareIcon className="w-5 h-5 text-indigo-500"/>
                    <span className="font-black text-[11px] uppercase tracking-[0.2em] text-zinc-100">画框视口控制</span>
                </div>
                <button onClick={() => onDelete(selectedItem.id)} className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-red-500/10 text-zinc-500 hover:text-red-500 transition-all">
                    <TrashIcon className="w-4 h-4"/>
                </button>
            </div>

            <div className="space-y-4">
                <label className="text-[10px] font-black text-zinc-500 uppercase tracking-[0.15em] flex items-center gap-2">
                    <SparklesIcon className="w-3.5 h-3.5 opacity-50"/> 场景融合提示词
                </label>
                <textarea 
                    value={localPrompt} 
                    onChange={(e) => { const val = e.target.value; setLocalPrompt(val); onUpdateItem(selectedItem.id, { prompt: val }); }} 
                    className="w-full bg-[#111113] border border-zinc-800 rounded-xl p-4 text-[12px] h-32 focus:border-indigo-500 outline-none resize-none transition-all placeholder:text-zinc-700 font-medium leading-relaxed" 
                    placeholder="描述画框内多主体的融合背景..." 
                />
            </div>

            <div className="grid grid-cols-1 gap-3">
                <button 
                    onClick={() => onFrameAction?.(selectedItem.id, 'merge')}
                    className="w-full py-4 bg-indigo-600 hover:bg-indigo-500 text-white font-black uppercase tracking-[0.2em] text-[11px] rounded-[16px] shadow-xl flex items-center justify-center gap-3 transition-all active:scale-[0.98]"
                >
                    <MergeIcon className="w-4.5 h-4.5" /> 场景融合生成
                </button>
                <div className="grid grid-cols-2 gap-3">
                    <button 
                        onClick={() => onFrameAction?.(selectedItem.id, 'expand')}
                        className="py-3 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded-xl text-[10px] font-black uppercase tracking-widest flex items-center justify-center gap-2 transition-all"
                    >
                        <ExpandIcon className="w-4 h-4" /> 扩展填充
                    </button>
                    <button 
                        onClick={() => onFrameAction?.(selectedItem.id, 'crop')}
                        className="py-3 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded-xl text-[10px] font-black uppercase tracking-widest flex items-center justify-center gap-2 transition-all"
                    >
                        <FrameIcon className="w-4 h-4" /> 裁剪视口
                    </button>
                </div>
            </div>
        </div>
    );
  };

  const renderTextPanel = () => {
    if (!selectedItem) return null;
    return (
        <div className="flex flex-col h-full bg-[#09090b] text-white p-6 overflow-y-auto no-scrollbar pointer-events-auto space-y-8">
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <TypeIcon className="w-5 h-5 text-indigo-500"/>
                    <span className="font-black text-[11px] uppercase tracking-[0.2em] text-zinc-100">文字属性控制</span>
                </div>
                <button onClick={() => onDelete(selectedItem.id)} className="p-2 hover:bg-red-500/10 text-zinc-500 hover:text-red-500 rounded-lg transition-all">
                    <TrashIcon className="w-4 h-4"/>
                </button>
            </div>

            <div className="space-y-4">
                <label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest">实时内容编辑</label>
                <textarea 
                    ref={textInputRef}
                    value={selectedItem.content || ''} 
                    onChange={(e) => onUpdateItem(selectedItem.id, { content: e.target.value })}
                    className="w-full bg-[#111113] border border-zinc-800 rounded-xl px-4 py-3 text-[14px] font-bold text-white focus:border-indigo-500 outline-none resize-none h-32 shadow-inner leading-relaxed"
                    placeholder="在此输入您的内容..."
                />
            </div>

            <div className="space-y-4">
                <div className="flex justify-between items-center px-1">
                    <label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest">字体大小 (SIZE)</label>
                    <span className="text-indigo-400 font-mono text-[11px] font-black">{Math.round(selectedItem.fontSize || 24)}px</span>
                </div>
                <input 
                    type="range" min="8" max="400" step="1"
                    value={selectedItem.fontSize || 24}
                    onChange={(e) => handleFontSizeChange(Number(e.target.value))}
                    className="w-full h-1 bg-zinc-800 rounded-lg appearance-none accent-indigo-500 cursor-pointer"
                />
            </div>

            <div className="space-y-4">
                <label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest">排版样式</label>
                <div className="flex gap-2">
                    <button 
                        onClick={() => onUpdateItem(selectedItem.id, { fontWeight: '900' })}
                        className={`flex-1 py-3 rounded-xl text-[10px] font-black uppercase border transition-all ${selectedItem.fontWeight === '900' ? 'bg-indigo-600 text-white border-indigo-500' : 'bg-zinc-800 text-zinc-400 border-zinc-700'}`}
                    >
                        极粗 (Heavy)
                    </button>
                    <button 
                        onClick={() => onUpdateItem(selectedItem.id, { fontWeight: '400' })}
                        className={`flex-1 py-3 rounded-xl text-[10px] font-black uppercase border transition-all ${selectedItem.fontWeight === '400' ? 'bg-indigo-600 text-white border-indigo-500' : 'bg-zinc-800 text-zinc-400 border-zinc-700'}`}
                    >
                        常规 (Regular)
                    </button>
                </div>
            </div>

            <div className="pt-4 border-t border-white/5">
                <button 
                    onClick={() => onClosePanel?.()}
                    className="w-full py-4 bg-indigo-600 hover:bg-indigo-500 text-white font-black uppercase tracking-[0.25em] text-[12px] rounded-[18px] shadow-[0_15px_30px_rgba(79,70,229,0.3)] transition-all flex items-center justify-center gap-3 active:scale-[0.98]"
                >
                    <CheckIcon className="w-5 h-5" />
                    确认完成
                </button>
            </div>
        </div>
    );
  };

  const renderImageActions = () => (
    <div className="space-y-4 mt-4">
        <div className="px-3 space-y-2 mb-4">
            <div className="flex justify-between items-center mb-1">
                <label className="text-[9px] font-black text-zinc-500 uppercase tracking-widest">解析深度 (TEMP)</label>
                <span className="text-indigo-400 font-mono text-[11px] font-black bg-indigo-500/10 px-2 py-0.5 rounded-md border border-indigo-500/20">
                    {pickTemperature.toFixed(2)}
                </span>
            </div>
            <input 
                type="range" min="0" max="2" step="0.05"
                value={pickTemperature}
                onChange={(e) => setPickTemperature(Number(e.target.value))}
                className="w-full h-1 bg-zinc-800 rounded-lg appearance-none accent-indigo-500 cursor-pointer"
            />
        </div>

        <div className="space-y-1">
            <button 
                onClick={() => onSyncPointsToGemini?.(selectedItem!.id)}
                disabled={!selectedItem?.identifiedPoints?.length}
                className={`w-full flex items-center justify-between p-3 rounded-xl transition-all group mb-2 ${selectedItem?.identifiedPoints?.length ? 'bg-indigo-600/10 border border-indigo-500/20 hover:bg-indigo-600/20' : 'opacity-40 cursor-not-allowed'}`}
            >
                <div className="flex items-center gap-3.5">
                  <LinkIcon className="w-4.5 h-4.5 text-indigo-400" />
                  <span className="text-[12px] font-black text-white uppercase tracking-[0.15em]">移植特征点到对话</span>
                </div>
            </button>

            <button 
                onClick={() => onStartPickPoint?.(selectedItem!.id, pickTemperature)} 
                className="w-full flex items-center justify-between p-3 rounded-xl transition-all group hover:bg-[#18181b]"
            >
                <div className="flex items-center gap-3.5">
                    <span className="shrink-0">
                        <FocusIcon className={`w-4.5 h-4.5 ${isPickingPoint ? 'text-indigo-400 animate-spin' : 'text-indigo-400'}`}/>
                    </span>
                    <span className="text-[12px] font-bold tracking-tight text-zinc-300 group-hover:text-white transition-colors">
                        {isPickingPoint ? '正在执行结构化解构...' : '拾取细节 (AI POINT)'}
                    </span>
                </div>
                <ChevronRightIcon className="w-3.5 h-3.5 text-zinc-700 group-hover:text-zinc-500 transition-transform group-hover:translate-x-0.5"/>
            </button>

            {[
                { label: '拓扑变体', icon: <ShuffleIcon className="w-4.5 h-4.5 text-emerald-400"/>, action: () => onFloatingAction?.(selectedItem!.id, 'topology_variation') },
                { label: '提取设计食谱', icon: <FlaskIcon className="w-4.5 h-4.5 text-pink-400"/>, action: () => onFloatingAction?.(selectedItem!.id, 'extract_recipe') },
                { label: '有趣的玩法', icon: <SparklesIcon className="w-4.5 h-4.5 text-yellow-400"/>, action: () => onFloatingAction?.(selectedItem!.id, 'open_playstyles') },
                { label: '3D 视角重构', icon: <CameraIcon className="w-4.5 h-4.5 text-orange-400"/>, action: () => setCurrentView('spatial') },
                { label: '智能演化', icon: <EvolutionIcon className="w-4 h-4 text-indigo-400"/>, action: () => setCurrentView('evolution') },
                { label: '局部重绘', icon: <ScissorsIcon className="w-4 h-4 text-zinc-400"/>, action: () => { setCurrentView('edit_area'); onEnterEditMode?.('brush'); } },
                { label: '极致放大 (4K)', icon: <UpscaleIcon className="w-4 h-4 text-indigo-400"/>, action: () => onGenerate(selectedItem!.id, "UPSCALE TO 4K", { resolution: '4K', usePro: true }) },
            ].map(b => (
                <button 
                  key={b.label} 
                  onClick={b.action} 
                  className="w-full flex items-center justify-between p-3 rounded-xl transition-all group hover:bg-white/5"
                >
                  <div className="flex items-center gap-3.5">
                    <span className="shrink-0">{b.icon}</span>
                    <span className="text-[12px] font-bold text-zinc-300 group-hover:text-white">{b.label}</span>
                  </div>
                  <ChevronRightIcon className="w-3.5 h-3.5 text-zinc-700 group-hover:text-zinc-500"/>
                </button>
            ))}
        </div>
    </div>
  );

  const spatialConfig = selectedItem?.spatialConfig || DEFAULT_SPATIAL;

  return (
    <div className="w-full h-full bg-[#09090b] border border-zinc-800 rounded-[24px] shadow-3xl overflow-hidden flex flex-col pointer-events-auto backdrop-blur-md">
       {isTransplantMode ? renderTransplantPanel() : selectedItem?.type === ItemType.FRAME ? renderFramePanel() : selectedItem?.type === ItemType.TEXT ? renderTextPanel() : selectedItem?.type === ItemType.MODEL ? renderModelPanel() : (
         <>
            {currentView === 'main' ? (
              <>
                <div className="flex border-b border-zinc-800/50 px-6 pt-1 overflow-x-auto no-scrollbar">
                    {[
                      { id: 'actions', label: '主要动作' },
                      { id: 'nodes', label: '特征锚点' },
                      { id: 'details', label: '元数据' }
                    ].map(t => (
                      <button 
                        key={t.id} 
                        onClick={() => setActiveTab(t.id as any)} 
                        className={`mr-6 py-4 text-[11px] font-black uppercase tracking-[0.2em] border-b-2 transition-all whitespace-nowrap ${activeTab === t.id ? 'text-white border-white' : 'text-zinc-500 border-transparent hover:text-zinc-300'}`}
                      >
                        {t.label}
                      </button>
                    ))}
                </div>
                <div className="flex-1 overflow-y-auto no-scrollbar p-6 space-y-6">
                  {activeTab === 'actions' ? (
                    <div className="space-y-5 animate-in fade-in duration-300">
                        <div className="flex justify-between items-center">
                          <label className="text-[10px] font-black text-zinc-500 uppercase tracking-[0.15em]">Prompt 描述</label>
                          <button onClick={() => onAutoPrompt?.(selectedItem!.id)} className="text-indigo-400 text-[10px] font-black uppercase tracking-[0.1em] hover:text-indigo-300 flex items-center gap-1.5 bg-indigo-500/10 px-3 py-1.5 rounded-full border border-indigo-500/20">
                            <SparklesIcon className="w-3.5 h-3.5" /> 自动推词
                          </button>
                        </div>
                        <textarea 
                          value={localPrompt} 
                          onChange={(e) => { const val = e.target.value; setLocalPrompt(val); onUpdateItem(selectedItem!.id, { prompt: val }); }} 
                          className="w-full bg-[#111113] border border-zinc-800 rounded-xl p-4 text-[12px] h-32 font-medium focus:border-indigo-500 outline-none resize-none transition-all text-zinc-100 shadow-inner placeholder:text-zinc-800" 
                          placeholder="描述图像细节..." 
                        />
                        
                        <div className="p-3 bg-zinc-800/30 rounded-xl border border-white/5 flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                <ZapIcon className="w-3.5 h-3.5 text-indigo-400" />
                                <span className="text-[10px] font-black text-zinc-500 uppercase tracking-widest">使用 PRO 渲染引擎</span>
                            </div>
                            <button 
                                onClick={() => setUsePro(!usePro)}
                                className={`w-10 h-5 rounded-full p-1 transition-all ${usePro ? 'bg-indigo-600' : 'bg-zinc-700'}`}
                            >
                                <div className={`w-3 h-3 bg-white rounded-full transition-all ${usePro ? 'translate-x-5' : 'translate-x-0'}`} />
                            </button>
                        </div>

                        <div className="flex gap-2">
                             <button onClick={() => onSendToPrompt?.(selectedItem!.id)} className="flex-1 py-3 bg-[#18181b] text-zinc-400 hover:text-indigo-400 hover:bg-zinc-800 rounded-xl text-[10px] font-black uppercase tracking-widest flex items-center justify-center gap-2 border border-zinc-800 transition-all">
                                 <FileIcon className="w-4 h-4"/> 引用此图
                             </button>
                             <button onClick={() => { if (selectedItem?.content) navigator.clipboard.writeText(selectedItem.content); }} className="flex-1 py-3 bg-zinc-800 text-zinc-400 hover:text-white rounded-xl text-[10px] font-black uppercase tracking-widest flex items-center justify-center gap-2 transition-all">
                                 <CopyIcon className="w-4 h-4"/> 复制内容
                             </button>
                        </div>
                        {renderImageActions()}
                    </div>
                  ) : activeTab === 'nodes' ? (
                      renderPointNodes()
                  ) : (
                    <div className="space-y-6">
                         <div className="space-y-3">
                             <span className="text-[10px] font-black text-zinc-500 uppercase tracking-[0.15em]">对象参数</span>
                             <div className="bg-[#111113] rounded-xl p-4 text-[11px] font-mono text-zinc-500 space-y-2 border border-zinc-800/50 shadow-inner">
                                 <div className="flex justify-between"><span>TYPE</span> <span className="text-zinc-300">{selectedItem?.type}</span></div>
                                 <div className="flex justify-between"><span>ENGINE</span> <span className="text-indigo-400 font-black">{selectedItem?.engine || 'Flash 2.5'}</span></div>
                                 <div className="flex justify-between"><span>SIZE</span> <span className="text-zinc-300">{selectedItem ? Math.round(selectedItem.width) : 0}x{selectedItem ? Math.round(selectedItem.height) : 0} px</span></div>
                             </div>
                         </div>
                    </div>
                  )}
                </div>
              </>
            ) : currentView === 'spatial' ? (
                <div className="flex flex-col h-full bg-[#09090b] animate-in slide-in-from-right-4 duration-500">
                    <div className="flex items-center p-6 border-b border-zinc-800 bg-[#09090b]">
                        <button onClick={handleBack} className="w-9 h-9 flex items-center justify-center hover:bg-zinc-800 rounded-xl mr-3 transition-all text-zinc-400 hover:text-white">
                        <ChevronLeftIcon className="w-4 h-4"/>
                        </button>
                        <span className="text-[11px] font-black uppercase tracking-[0.2em] text-zinc-100">3D 视角重构</span>
                    </div>
                    <div className="flex-1 overflow-y-auto no-scrollbar p-6 space-y-6">
                        <SpatialController config={spatialConfig} imageSrc={selectedItem?.content} onChange={(cfg) => onUpdateItem(selectedItem!.id, { spatialConfig: cfg })} />
                    </div>
                    <div className="p-6 bg-[#09090b] border-t border-zinc-800">
                        <button 
                            onClick={() => onGenerate(selectedItem!.id, localPrompt, { spatialConfig: spatialConfig, usePro })}
                            className="w-full py-4 bg-orange-600 hover:bg-orange-500 text-white font-black uppercase tracking-[0.2em] text-[11px] rounded-[16px] shadow-2xl transition-all flex items-center justify-center gap-3"
                        >
                            <CameraIcon className="w-4 h-4"/> 立即重绘视图
                        </button>
                    </div>
                </div>
            ) : currentView === 'evolution' ? (
              <div className="flex flex-col h-full bg-[#09090b] animate-in slide-in-from-right-4 duration-500">
                  <div className="flex items-center p-6 border-b border-zinc-800 bg-[#09090b]">
                    <button onClick={handleBack} className="w-9 h-9 flex items-center justify-center hover:bg-zinc-800 rounded-xl mr-3 transition-all text-zinc-400 hover:text-white">
                      <ChevronLeftIcon className="w-4 h-4"/>
                    </button>
                    <span className="text-[11px] font-black uppercase tracking-[0.2em] text-zinc-100">工业演化分析</span>
                  </div>
                  <div className="flex-1 overflow-y-auto no-scrollbar p-6 space-y-8">
                    <div className="space-y-4">
                      <div className="flex justify-between items-center">
                        <label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest">设计演化强度 (DNA INTENSITY)</label>
                        <span className="text-indigo-400 font-mono text-[11px] font-black bg-indigo-500/10 px-2 py-0.5 rounded-md border border-indigo-500/20">{artisticLevel}%</span>
                      </div>
                      <input 
                        type="range" min="0" max="100" step="1"
                        value={artisticLevel}
                        onChange={(e) => setArtisticLevel(Number(e.target.value))}
                        className="w-full h-1 bg-zinc-800 rounded-lg appearance-none accent-indigo-500 cursor-pointer"
                      />
                    </div>

                    <div className="space-y-4">
                        <div className="flex items-center justify-between p-4 bg-[#111113] rounded-2xl border border-white/5 group hover:border-indigo-500/30 transition-all cursor-pointer" onClick={() => setIsCncMode(!isCncMode)}>
                            <div className="flex items-center gap-3">
                                <div className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all ${isCncMode ? 'bg-indigo-600 text-white shadow-[0_0_15px_rgba(79,70,229,0.4)]' : 'bg-zinc-800 text-zinc-500'}`}>
                                    <BoxIcon className="w-5 h-5" />
                                </div>
                                <div className="flex flex-col">
                                    <span className={`text-[11px] font-black uppercase tracking-widest transition-colors ${isCncMode ? 'text-white' : 'text-zinc-500'}`}>CNC 机械加工模式</span>
                                    <span className="text-[8px] font-bold text-zinc-600 uppercase tracking-tighter">Subtractive Machining Protocol</span>
                                </div>
                            </div>
                            <div className={`w-12 h-6 rounded-full p-1 transition-all ${isCncMode ? 'bg-indigo-600' : 'bg-zinc-800'}`}>
                                <div className={`w-4 h-4 bg-white rounded-full transition-all ${isCncMode ? 'translate-x-6' : 'translate-x-0'}`} />
                            </div>
                        </div>
                    </div>

                    <div className="p-5 bg-indigo-600/5 border border-indigo-500/10 rounded-2xl space-y-3">
                      <div className="flex items-center gap-3">
                         <div className="p-2 bg-indigo-500/10 rounded-lg text-indigo-400">
                            <ZapIcon className="w-4 h-4" />
                         </div>
                         <span className="text-[11px] font-black text-zinc-100 uppercase tracking-widest">{currentStage.label}</span>
                      </div>
                      <p className="text-[11px] text-zinc-400 leading-relaxed font-medium">{currentStage.description}</p>
                    </div>
                  </div>
                  <div className="p-6 bg-[#09090b] border-t border-zinc-800">
                    <button 
                      onClick={() => onGenerate(selectedItem!.id, `__EVOLUTION__|${artisticLevel}${isCncMode ? '|CNC' : ''}`, { usePro })}
                      className="w-full py-4 bg-indigo-600 hover:bg-indigo-500 text-white font-black uppercase tracking-[0.2em] text-[11px] rounded-[16px] shadow-2xl transition-all flex items-center justify-center gap-3"
                    >
                      <SparklesIcon className="w-4 h-4"/> 启动演化引擎
                    </button>
                  </div>
              </div>
            ) : currentView === 'edit_area' ? (
                renderEditArea()
            ) : null}
         </>
       )}
    </div>
  );
};

export default PropertiesPanel;
