import React, { useState, useRef, useEffect } from 'react';
import { SparklesIcon, WandIcon, PlusIcon, TrashIcon, EyeIcon, XIcon, LineIcon, CircleIcon, SquareIcon, BrushIcon, LassoIcon, UndoIcon, RedoIcon, PenIcon, EraserIcon, VectorIcon } from './Icons';
import { generatePromptSuggestions } from '../services/geminiService';
import { EditToolType } from '../types';

interface FloatingPromptInputProps {
  imageBase64?: string;
  onGenerate: (prompt: string) => void;
  onClose?: () => void;
  editTool?: EditToolType;
  setEditTool?: (tool: EditToolType) => void;
  setEditMode?: (mode: boolean) => void;
  brushSize?: number;
  setBrushSize?: (size: number) => void;
  brushColor?: string;
  setBrushColor?: (color: string) => void;
  brushOpacity?: number;
  setBrushOpacity?: (opacity: number) => void;
  onUndo?: () => void;
  onRedo?: () => void;
}

const FloatingPromptInput: React.FC<FloatingPromptInputProps> = ({ 
  imageBase64, onGenerate, onClose, 
  editTool, setEditTool, setEditMode, 
  brushSize = 30, setBrushSize,
  brushColor = '#ef4444', setBrushColor,
  brushOpacity = 1, setBrushOpacity,
  onUndo, onRedo
}) => {
  const [prompt, setPrompt] = useState('');
  const [activeTab, setActiveTab] = useState<string | null>(null);
  const [isGeneratingOptions, setIsGeneratingOptions] = useState(false);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const tabs = [
    { id: 'modify', label: '修改', icon: <WandIcon className="w-4 h-4" /> },
    { id: 'generate', label: '生成', icon: <SparklesIcon className="w-4 h-4" /> },
    { id: 'add', label: '添加', icon: <PlusIcon className="w-4 h-4" /> },
    { id: 'remove', label: '去除', icon: <TrashIcon className="w-4 h-4" /> },
    { id: 'imagine', label: '想象', icon: <EyeIcon className="w-4 h-4" /> },
  ];

  const [options, setOptions] = useState<Record<string, string[]>>({
    modify: [
      '修改造型，添加细节特征。',
      '将材质更换为铝合金',
      '将表面处理更换为碳纤维',
      '将背景更换为...',
    ],
    generate: [
      '使表面产生轻微划痕',
      '使标志更加突出',
      '让场景呈现出...',
      '转换为线条艺术素描效果',
    ],
    add: [
      '添加装饰物品',
      '添加细节特征。',
      '添加二级特征。',
      '添加用于交互的手。',
    ],
    remove: [
      '去除细微反光',
      '去除背景人物',
      '去除图片噪点',
      '去除背景',
    ],
    imagine: [
      '想象位于XXX地方',
      '想象XXX的状态',
      '想象XXX的动作',
      '想象XXX的镜头',
    ]
  });

  useEffect(() => {
    if (imageBase64) {
      setIsGeneratingOptions(true);
      generatePromptSuggestions(imageBase64)
        .then(newOptions => {
          setOptions(newOptions);
        })
        .catch(error => {
          console.error("Failed to generate initial options:", error);
        })
        .finally(() => {
          setIsGeneratingOptions(false);
        });
    }
  }, [imageBase64]);

  const handleTabClick = (tabId: string) => {
    setActiveTab(activeTab === tabId ? null : tabId);
    const prefixMap: Record<string, string> = {
      modify: '修改：',
      generate: '生成：',
      add: '添加：',
      remove: '去除：',
      imagine: '想象：'
    };
    if (activeTab !== tabId) {
      setPrompt(prev => {
        const prefix = prefixMap[tabId];
        const currentPrefixMatch = prev.match(/^(修改：|生成：|添加：|去除：|想象：)/);
        if (currentPrefixMatch) {
          return prefix + prev.substring(currentPrefixMatch[0].length);
        } else {
          return prefix + prev;
        }
      });
    }
    inputRef.current?.focus();
  };

  const handleOptionClick = (option: string) => {
    setPrompt(prev => {
      const prefixMatch = prev.match(/^(修改：|生成：|添加：|去除：|想象：)/);
      const prefix = prefixMatch ? prefixMatch[0] : '';
      const currentContent = prev.substring(prefix.length).trim();
      
      if (currentContent) {
        // If the option is already in the prompt, remove it (toggle behavior)
        if (currentContent.includes(option)) {
          const newContent = currentContent.replace(new RegExp(`(，)?${option}(，)?`), (match, p1, p2) => {
            return p1 && p2 ? '，' : '';
          }).trim().replace(/^，|，$/g, '');
          return prefix + newContent;
        }
        return prev + '，' + option;
      }
      return prefix + option;
    });
    inputRef.current?.focus();
  };

  const handleRandomPrompt = async () => {
    if (imageBase64) {
      setIsGeneratingOptions(true);
      try {
        const newOptions = await generatePromptSuggestions(imageBase64);
        setOptions(newOptions);
        
        // Also set a random prompt in the input
        const allOptions = Object.values(newOptions).flat();
        if (allOptions.length > 0) {
          setPrompt(allOptions[Math.floor(Math.random() * allOptions.length)]);
        }
      } catch (error) {
        console.error("Failed to generate random options:", error);
        // Fallback to simple random prompt
        const randomPrompts = [
          '赛博朋克风格的未来城市，霓虹灯闪烁',
          '极简主义的工业设计产品，白色背景',
          '复古风格的胶片摄影，颗粒感',
          '超现实主义的梦境场景，漂浮的岛屿'
        ];
        setPrompt(randomPrompts[Math.floor(Math.random() * randomPrompts.length)]);
      } finally {
        setIsGeneratingOptions(false);
      }
    } else {
      const randomPrompts = [
        '赛博朋克风格的未来城市，霓虹灯闪烁',
        '极简主义的工业设计产品，白色背景',
        '复古风格的胶片摄影，颗粒感',
        '超现实主义的梦境场景，漂浮的岛屿'
      ];
      setPrompt(randomPrompts[Math.floor(Math.random() * randomPrompts.length)]);
    }
  };

  const handleSubmit = () => {
    if (prompt.trim()) {
      onGenerate(prompt.trim());
      setPrompt('');
      setActiveTab(null);
    }
  };

  const handleToolSelect = (tool: EditToolType) => {
    if (setEditTool && setEditMode) {
      setEditTool(tool);
      setEditMode(true);
    }
  };

  return (
    <div className="absolute left-[calc(100%+16px)] top-0 flex flex-col gap-2 z-50">
      <div 
        className="w-[400px] bg-[#0c0c0e]/95 backdrop-blur-2xl border border-white/10 rounded-2xl shadow-[0_30px_60px_rgba(0,0,0,0.6)] flex flex-col overflow-hidden pointer-events-auto transition-all duration-300 no-canvas-wheel"
        onMouseDown={e => e.stopPropagation()}
      >
      <div className="p-2 border-b border-white/5 flex items-center justify-between">
        <div className="flex items-center gap-1 overflow-x-auto scrollbar-hide">
          {tabs.map(tab => (
            <button
              key={tab.id}
              onClick={() => handleTabClick(tab.id)}
              className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-xs font-medium transition-all whitespace-nowrap ${
                activeTab === tab.id 
                  ? 'bg-indigo-500 text-white shadow-lg shadow-indigo-500/20' 
                  : 'text-zinc-400 hover:text-white hover:bg-white/5'
              }`}
            >
              {tab.icon}
              {tab.label}
            </button>
          ))}
        </div>
        {onClose && (
          <button 
            onClick={onClose}
            className="p-1.5 text-zinc-400 hover:text-white hover:bg-white/10 rounded-lg transition-colors flex-shrink-0 ml-1"
          >
            <XIcon className="w-4 h-4" />
          </button>
        )}
      </div>

      {activeTab && (
        <div className="p-1.5 border-b border-white/5 bg-black/40 max-h-48 overflow-y-auto">
          <div className="flex flex-col gap-0.5">
            {options[activeTab].map((option, idx) => {
              const isSelected = prompt.includes(option);
              return (
                <button
                  key={idx}
                  onClick={() => handleOptionClick(option)}
                  className={`text-left px-3 py-2 text-xs rounded-lg transition-colors flex items-center justify-between ${isSelected ? 'bg-indigo-500/20 text-indigo-300' : 'text-zinc-300 hover:text-white hover:bg-white/10'}`}
                >
                  <span>{option}</span>
                  {isSelected && <div className="w-1.5 h-1.5 rounded-full bg-indigo-400" />}
                </button>
              );
            })}
          </div>
        </div>
      )}

      <div className="p-3 relative">
        <textarea
          ref={inputRef}
          value={prompt}
          onChange={e => setPrompt(e.target.value)}
          onKeyDown={e => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              handleSubmit();
            }
          }}
          placeholder="描述你想要的设计..."
          className="w-full h-24 bg-black/40 border border-white/10 rounded-xl p-3 text-sm text-white placeholder-zinc-500 focus:outline-none focus:border-indigo-500/50 focus:ring-1 focus:ring-indigo-500/50 resize-none"
        />
        <div className="absolute bottom-5 right-5 flex items-center gap-2">
          <button
            onClick={handleRandomPrompt}
            disabled={isGeneratingOptions}
            className={`p-1.5 rounded-lg transition-colors ${isGeneratingOptions ? 'text-indigo-400 bg-indigo-500/10 animate-pulse' : 'text-zinc-400 hover:text-indigo-400 hover:bg-indigo-500/10'}`}
            title="随机灵感"
          >
            <span className="text-lg leading-none">🎲</span>
          </button>
          <button
            onClick={handleSubmit}
            disabled={!prompt.trim()}
            className="p-1.5 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 disabled:hover:bg-indigo-600 text-white rounded-lg transition-colors shadow-lg shadow-indigo-600/20"
          >
            <SparklesIcon className="w-4 h-4" />
          </button>
        </div>
      </div>
      </div>

      {/* Drawing Tools Toolbar */}
      {setEditTool && (
        <div 
          className="w-[400px] bg-[#0c0c0e]/95 backdrop-blur-2xl border border-white/10 rounded-2xl shadow-[0_30px_60px_rgba(0,0,0,0.6)] flex flex-col p-2 gap-2 pointer-events-auto z-50 transition-all duration-300"
          onMouseDown={e => e.stopPropagation()}
        >
          <div className="flex items-center gap-1 overflow-x-auto scrollbar-hide pb-1">
            <button onClick={() => handleToolSelect('pen')} className={`p-2 rounded-xl transition-all flex-shrink-0 ${editTool === 'pen' ? 'bg-indigo-500 text-white' : 'text-zinc-400 hover:text-white hover:bg-white/10'}`} title="钢笔工具">
              <PenIcon className="w-4 h-4" />
            </button>
            <button onClick={() => handleToolSelect('bezier')} className={`p-2 rounded-xl transition-all flex-shrink-0 ${editTool === 'bezier' ? 'bg-indigo-500 text-white' : 'text-zinc-400 hover:text-white hover:bg-white/10'}`} title="贝塞尔曲线">
              <VectorIcon className="w-4 h-4" />
            </button>
            <button onClick={() => handleToolSelect('line')} className={`p-2 rounded-xl transition-all flex-shrink-0 ${editTool === 'line' ? 'bg-indigo-500 text-white' : 'text-zinc-400 hover:text-white hover:bg-white/10'}`} title="直线">
              <LineIcon className="w-4 h-4" />
            </button>
            <button onClick={() => handleToolSelect('circle')} className={`p-2 rounded-xl transition-all flex-shrink-0 ${editTool === 'circle' ? 'bg-indigo-500 text-white' : 'text-zinc-400 hover:text-white hover:bg-white/10'}`} title="圆形">
              <CircleIcon className="w-4 h-4" />
            </button>
            <button onClick={() => handleToolSelect('rect')} className={`p-2 rounded-xl transition-all flex-shrink-0 ${editTool === 'rect' ? 'bg-indigo-500 text-white' : 'text-zinc-400 hover:text-white hover:bg-white/10'}`} title="矩形">
              <SquareIcon className="w-4 h-4" />
            </button>
            <button onClick={() => handleToolSelect('brush')} className={`p-2 rounded-xl transition-all flex-shrink-0 ${editTool === 'brush' ? 'bg-indigo-500 text-white' : 'text-zinc-400 hover:text-white hover:bg-white/10'}`} title="自由涂鸦">
              <BrushIcon className="w-4 h-4" />
            </button>
            <button onClick={() => handleToolSelect('eraser')} className={`p-2 rounded-xl transition-all flex-shrink-0 ${editTool === 'eraser' ? 'bg-indigo-500 text-white' : 'text-zinc-400 hover:text-white hover:bg-white/10'}`} title="橡皮擦">
              <EraserIcon className="w-4 h-4" />
            </button>
            <button onClick={() => handleToolSelect('lasso')} className={`p-2 rounded-xl transition-all flex-shrink-0 ${editTool === 'lasso' ? 'bg-indigo-500 text-white' : 'text-zinc-400 hover:text-white hover:bg-white/10'}`} title="套索选区">
              <LassoIcon className="w-4 h-4" />
            </button>
            
            <div className="w-px h-6 bg-white/10 mx-1 flex-shrink-0" />
            
            <button onClick={onUndo} className="p-2 rounded-xl transition-all flex-shrink-0 text-zinc-400 hover:text-white hover:bg-white/10" title="撤销">
              <UndoIcon className="w-4 h-4" />
            </button>
            <button onClick={onRedo} className="p-2 rounded-xl transition-all flex-shrink-0 text-zinc-400 hover:text-white hover:bg-white/10" title="重做">
              <RedoIcon className="w-4 h-4" />
            </button>
          </div>
          
          <div className="flex items-center gap-4 px-2 pt-1 border-t border-white/5">
            <div className="flex items-center gap-2">
              <input 
                type="color" 
                value={brushColor} 
                onChange={(e) => setBrushColor?.(e.target.value)}
                className="w-6 h-6 rounded cursor-pointer border-0 p-0 bg-transparent"
                title="颜色拾取"
              />
            </div>
            <div className="flex items-center gap-2 flex-1">
              <span className="text-zinc-400 text-[10px] whitespace-nowrap">粗细</span>
              <input 
                type="range" 
                min="1" 
                max="100" 
                value={brushSize} 
                onChange={(e) => setBrushSize?.(Number(e.target.value))}
                className="w-full h-1 bg-white/10 rounded-lg appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:bg-indigo-500 [&::-webkit-slider-thumb]:rounded-full"
              />
            </div>
            <div className="flex items-center gap-2 flex-1">
              <span className="text-zinc-400 text-[10px] whitespace-nowrap">透明</span>
              <input 
                type="range" 
                min="0.1" 
                max="1" 
                step="0.1"
                value={brushOpacity} 
                onChange={(e) => setBrushOpacity?.(Number(e.target.value))}
                className="w-full h-1 bg-white/10 rounded-lg appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:bg-indigo-500 [&::-webkit-slider-thumb]:rounded-full"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default FloatingPromptInput;
