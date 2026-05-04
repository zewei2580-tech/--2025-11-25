import { useState, useRef, useEffect, useMemo, useImperativeHandle, forwardRef } from 'react';
import React from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import * as monaco from 'monaco-editor';
import { 
  PlusIcon, 
  SendIcon, 
  XIcon, 
  SparklesIcon, 
  CopyIcon,
  VideoIcon,
  ImageIcon,
  ExpandIcon,
  TrashIcon,
  ChevronDownIcon,
  RefreshIcon,
  GlobeIcon,
  FilmIcon,
  BananaIcon,
  LayoutGridIcon,
  BookIcon,
  FlaskIcon,
  CheckIcon,
  MessageCircleIcon,
  TerminalIcon,
  ZapIcon,
  LinkIcon,
  MagicCurveIcon,
  TypeIcon,
  UndoIcon,
  RedoIcon,
  RotateCcwIcon,
  ChevronLeftIcon,
  ClockIcon,
  TargetIcon,
  PenIcon,
  ChevronUpIcon,
  EraserIcon,
  SearchIcon,
  FolderPlusIcon,
  FolderIcon,
  FileTextIcon,
  MinimizeIcon,
  MoreIcon,
  ListIcon,
  ExternalLinkIcon,
  FileJsonIcon,
  ImageSelectionIcon,
  DownloadIcon
} from './Icons';
import { chatWithGemini, generateVideo, generateImage, detectImageJSONSegments, generateWithReferences, getClosestGeminiRatio, editImage } from '../services/geminiService';
import { STYLES } from '../constants';
import MaskCanvas, { MaskCanvasRef } from './MaskCanvas';
import { ChatMessage, ChatSession, ChatFolder, Attachment } from '../types';

interface GeminiChatPanelProps {
    onAddToCanvas?: (base64: string, promptText?: string, refId?: string) => void;
    onReceiveSegments?: (segments: any[]) => void;
    onExpandChange?: (expanded: boolean) => void;
}

export interface GeminiChatPanelRef {
    addPointReference: (itemId: string, imageBase64: string, label: string, point?: [number, number]) => void;
    addBulkPointReferences: (itemId: string, imageBase64: string, points: {label: string, point: [number, number]}[]) => void;
    appendMovementDescription: (itemId: string, imageBase64: string, label: string, from: [number, number], to: [number, number]) => void;
    requestObjectRemoval: (itemId: string, imageBase64: string, label: string, point?: [number, number]) => void;
    addExternalAttachment: (itemId: string, imageBase64: string) => void;
}

const MonacoCodeEditor: React.FC<{ code: string; language?: string }> = ({ code, language = 'json' }) => {
    const editorRef = useRef<HTMLDivElement>(null);
    const monacoInstance = useRef<monaco.editor.IStandaloneCodeEditor | null>(null);

    useEffect(() => {
        if (!editorRef.current) return;

        monacoInstance.current = monaco.editor.create(editorRef.current, {
            value: code,
            language: language,
            theme: 'vs-dark',
            automaticLayout: true,
            readOnly: true,
            minimap: { enabled: false },
            fontSize: 12,
            fontFamily: 'Menlo, Monaco, "Courier New", monospace',
            scrollBeyondLastLine: false,
            padding: { top: 16, bottom: 16 },
            lineNumbers: 'on',
            renderLineHighlight: 'none',
            scrollbar: {
                vertical: 'auto',
                horizontal: 'auto',
            }
        });

        return () => {
            monacoInstance.current?.dispose();
        };
    }, [code, language]);

    return (
        <div 
            ref={editorRef} 
            className="w-full h-[300px] rounded-b-[28px] overflow-hidden" 
            style={{ backgroundColor: '#0d0d0f' }}
        />
    );
};

const compressImage = (base64: string, maxWidth = 1024, maxHeight = 1024): Promise<string> => {
  return new Promise((resolve) => {
    if (!base64 || !base64.startsWith('data:image')) {
        resolve(base64 || '');
        return;
    }
    const img = new Image();
    img.src = base64;
    img.onload = () => {
      const canvas = document.createElement('canvas');
      let width = img.width;
      let height = img.height;
      if (width > height) {
        if (width > maxWidth) {
          height *= maxWidth / width;
          width = maxWidth;
        }
      } else {
        if (height > maxHeight) {
          width *= maxHeight / height;
          height = maxHeight;
        }
      }
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      if (!ctx) { resolve(base64); return; }
      ctx.drawImage(img, 0, 0, width, height);
      resolve(canvas.toDataURL('image/jpeg', 0.75));
    };
    img.onerror = () => resolve(base64);
  });
};

const MarkdownContent: React.FC<{ content: string }> = ({ content }) => {
    return (
        <div className="markdown-renderer text-[14px] leading-[1.6] text-zinc-100">
            <ReactMarkdown 
                remarkPlugins={[remarkGfm]}
                components={{
                    h1: ({node, ...props}) => <h1 className="text-[18px] font-black uppercase tracking-wider mb-4 mt-6 text-white border-b border-white/5 pb-2" {...props} />,
                    h2: ({node, ...props}) => <h2 className="text-[16px] font-black uppercase tracking-wide mb-3 mt-5 text-white" {...props} />,
                    h3: ({node, ...props}) => <h3 className="text-[14px] font-black uppercase tracking-normal mb-2 mt-4 text-indigo-400" {...props} />,
                    p: ({node, ...props}) => <p className="mb-4 last:mb-0 font-medium opacity-90" {...props} />,
                    strong: ({node, ...props}) => <strong className="font-black text-white bg-white/5 px-1 rounded" {...props} />,
                    ul: ({node, ...props}) => <ul className="list-disc pl-5 mb-4 space-y-1 opacity-90" {...props} />,
                    ol: ({node, ...props}) => <ol className="list-decimal pl-5 mb-4 space-y-1 opacity-90" {...props} />,
                    li: ({node, ...props}) => <li className="marker:text-indigo-500" {...props} />,
                    code: ({node, inline, ...props}: any) => 
                        inline ? 
                        <code className="bg-[#27272a] text-[#8b80ff] px-1.5 py-0.5 rounded-md font-mono text-[12px] font-bold" {...props} /> :
                        <div className="relative group my-4">
                            <pre className="bg-[#09090b] border border-white/10 rounded-xl p-4 overflow-x-auto font-mono text-[12px] no-scrollbar">
                                <code {...props} />
                            </pre>
                            <button className="absolute top-3 right-3 p-2 bg-white/5 hover:bg-white/10 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity">
                                <CopyIcon className="w-3.5 h-3.5 text-zinc-400" />
                            </button>
                        </div>,
                    table: ({node, ...props}) => (
                        <div className="overflow-x-auto my-6 border border-white/10 rounded-xl bg-white/[0.02]">
                            <table className="w-full border-collapse text-[12px]" {...props} />
                        </div>
                    ),
                    thead: ({node, ...props}) => <thead className="bg-white/5 text-zinc-400 font-black uppercase tracking-widest border-b border-white/10" {...props} />,
                    th: ({node, ...props}) => <th className="px-4 py-3 text-left" {...props} />,
                    td: ({node, ...props}) => <td className="px-4 py-3 border-b border-white/5 last:border-0" {...props} />,
                    blockquote: ({node, ...props}) => <blockquote className="border-l-4 border-indigo-500 bg-indigo-500/5 px-4 py-2 my-4 rounded-r-lg italic opacity-80" {...props} />,
                    hr: ({node, ...props}) => <hr className="my-8 border-white/5" {...props} />
                }}
            >
                {content}
            </ReactMarkdown>
        </div>
    );
};

const bakeMarkersOnImage = async (base64: string, points: Record<string, [number, number]>): Promise<string> => {
    return new Promise((resolve) => {
        const img = new Image();
        img.onload = () => {
            const canvas = document.createElement('canvas');
            canvas.width = img.naturalWidth;
            canvas.height = img.naturalHeight;
            const ctx = canvas.getContext('2d');
            if (!ctx) { resolve(base64); return; }
            ctx.drawImage(img, 0, 0);
            Object.entries(points).forEach(([label, coord]) => {
                const [y, x] = coord; 
                const px = (x / 1000) * canvas.width;
                const py = (y / 1000) * canvas.height;
                ctx.shadowBlur = 30;
                ctx.shadowColor = '#5546fe';
                ctx.fillStyle = '#5546fe';
                ctx.strokeStyle = 'white';
                ctx.lineWidth = 10;
                ctx.beginPath();
                ctx.arc(px, py, 24, 0, Math.PI * 2);
                ctx.fill();
                ctx.stroke();
                ctx.shadowBlur = 10;
                ctx.shadowColor = 'black';
                ctx.font = 'bold 64px Inter, sans-serif';
                ctx.fillStyle = 'white';
                ctx.fillText(label, px + 40, py + 24);
            });
            resolve(canvas.toDataURL('image/jpeg', 0.8));
        };
        img.onerror = () => resolve(base64);
        img.src = base64;
    });
};

const ChatBubble: React.FC<{ 
    msg: ChatMessage, 
    onAddToCanvas?: (base64: string, prompt?: string, refId?: string) => void,
    onSendToContext?: (base64: string) => void,
    onRedo?: (msg: ChatMessage) => void,
    onEditPrompt?: (text: string, attachments?: Attachment[]) => void,
    onDelete?: (id: string) => void,
    onToggleCollapse?: (id: string) => void
}> = ({ msg, onAddToCanvas, onSendToContext, onRedo, onEditPrompt, onDelete, onToggleCollapse }) => {
    const [copied, setCopied] = useState(false);
    const handleCopy = (text: string) => {
        navigator.clipboard.writeText(text);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };
    const jsonMatch = msg.text.match(/```json\n([\s\S]*?)\n```/);
    const jsonContent = jsonMatch ? jsonMatch[1] : (msg.isJson ? msg.text : null);
    const introText = jsonMatch ? msg.text.split('```json')[0].trim() : (msg.isJson ? '' : msg.text);
    const imagesToDisplay = msg.images || (msg.image ? [msg.image] : []);
    
    const sourceRefId = msg.context?.attachments?.[0]?.sourceId;

    if (msg.isError) {
        return (
            <div id={`msg-${msg.id}`} className="flex items-center gap-4 px-6 py-4 bg-red-500/5 border border-red-500/20 rounded-[24px] w-full max-w-[90%] animate-in fade-in slide-in-from-bottom-2">
                <div className="w-10 h-10 rounded-full bg-red-500/10 flex items-center justify-center shrink-0">
                    <RefreshIcon className="w-5 h-5 text-red-500" />
                </div>
                <div className="flex flex-col gap-1 overflow-hidden">
                    <span className="text-[10px] font-black text-red-500 uppercase tracking-widest">GEMINI 响应异常</span>
                    <p className="text-[12px] font-mono text-zinc-400 truncate">{msg.text}</p>
                </div>
                <div className="ml-auto flex items-center gap-2">
                  <button onClick={() => onRedo?.(msg)} className="px-4 py-2 bg-red-500 text-white rounded-xl text-[10px] font-black uppercase tracking-widest active:scale-95 transition-all">重试</button>
                  <button onClick={() => onDelete?.(msg.id)} className="p-2 text-zinc-500 hover:text-red-500 transition-colors" title="删除">
                    <TrashIcon className="w-4 h-4" />
                  </button>
                </div>
            </div>
        );
    }
    return (
        <div id={`msg-${msg.id}`} className={`flex flex-col ${msg.role === 'user' ? 'items-end' : 'items-start'} gap-4 animate-in fade-in slide-in-from-bottom-2 duration-300 w-full group/bubble relative`}>
            {imagesToDisplay.length > 0 && (
                <div className={`flex flex-wrap gap-4 w-full max-w-[95%] ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                    {imagesToDisplay.map((img, idx) => (
                        <div key={idx} className="relative group rounded-[28px] overflow-hidden border border-white/10 shadow-[0_24px_48px_rgba(0,0,0,0.6)] bg-[#111113] w-64 flex-shrink-0 animate-in zoom-in-95 duration-500">
                            <img src={img} className="w-full h-auto" />
                            <div className="absolute top-4 left-4 px-3 py-2 bg-[#1a1a1c]/90 backdrop-blur-xl rounded-[10px] text-[10px] font-black text-white uppercase tracking-[0.2em] border border-white/5 shadow-2xl">REFERENCE ASSET</div>
                            <div className="absolute inset-0 bg-black/80 opacity-0 group-hover:opacity-100 flex flex-col items-center justify-center transition-all duration-300 backdrop-blur-xl gap-4">
                                <button onClick={() => onAddToCanvas?.(img, "AI Reference", sourceRefId)} className="w-40 py-2.5 bg-white text-black rounded-xl font-black text-[11px] uppercase tracking-[0.2em] flex items-center justify-center gap-2 hover:scale-105 active:scale-95 transition-all shadow-xl">
                                    <PlusIcon className="w-4 h-4" /> 添加到画布
                                </button>
                                <button onClick={() => onSendToContext?.(img)} className="w-40 py-2.5 bg-[#5546fe] text-white rounded-xl font-black text-[11px] uppercase tracking-[0.2em] flex items-center justify-center gap-2 hover:scale-105 active:scale-95 transition-all shadow-xl">
                                    <MessageCircleIcon className="w-4 h-4" /> 引用到对话
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
            )}
            {msg.videoUrl && (
                <div className="rounded-[32px] overflow-hidden border border-white/10 shadow-[0_40px_100px_rgba(0,0,0,0.8)] w-full max-w-[95%]">
                    <video src={msg.videoUrl} controls className="w-full" />
                </div>
            )}
            <div className={`flex flex-col gap-2 max-w-[90%] w-full ${msg.role === 'user' ? 'items-end' : 'items-start'}`}>
                {introText && (
                    <div className={`px-6 py-5 rounded-[24px] w-fit relative transition-all shadow-xl ${msg.role === 'user' ? 'bg-[#5546fe] text-white' : 'bg-[#1a1a1c] text-zinc-100 border border-white/5 backdrop-blur-xl'}`}>
                        {/* 内部内容层：负责裁剪逻辑 */}
                        <div className={`relative ${msg.isCollapsed ? 'max-h-24 overflow-hidden mask-fade-bottom' : ''}`}>
                            {msg.role === 'model' ? (
                                <MarkdownContent content={introText} />
                            ) : (
                                <div className="text-[14px] font-semibold leading-relaxed">{introText}</div>
                            )}
                        </div>
                        
                        {/* 侧边工具栏：调整至顶部，不再居中 */}
                        <div className={`absolute ${msg.role === 'user' ? '-left-20' : '-right-20'} top-0 pt-2 opacity-0 group-hover/bubble:opacity-100 transition-opacity flex items-center gap-1 z-10`}>
                            {msg.role === 'model' && (
                                <button onClick={() => onToggleCollapse?.(msg.id)} className="p-2 text-zinc-500 hover:text-white transition-colors" title={msg.isCollapsed ? "展开" : "折叠"}>
                                    {msg.isCollapsed ? <ExpandIcon className="w-4 h-4" /> : <MinimizeIcon className="w-4 h-4" />}
                                </button>
                            )}
                            {msg.role === 'user' && (
                                <button onClick={() => onEditPrompt?.(msg.text, msg.context?.attachments)} className="p-2 text-zinc-500 hover:text-white transition-colors" title="修改此指令">
                                    <PenIcon className="w-4 h-4" />
                                </button>
                            )}
                            <button onClick={() => onDelete?.(msg.id)} className="p-2 text-zinc-500 hover:text-red-500 transition-colors" title="彻底删除此记录">
                                <TrashIcon className="w-4 h-4" />
                            </button>
                        </div>
                    </div>
                )}
                {msg.role === 'model' && (imagesToDisplay.length > 0 || msg.videoUrl) && (
                    <div className="flex items-center gap-3 px-2 opacity-0 group-hover/bubble:opacity-100 transition-opacity">
                        <button onClick={() => onRedo?.(msg)} className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.1em] text-zinc-500 hover:text-indigo-400 transition-colors">
                            <RefreshIcon className="w-3.5 h-3.5" /> 不满意重做
                        </button>
                        <div className="w-1 h-1 bg-zinc-800 rounded-full" />
                        <button onClick={() => onEditPrompt?.(msg.context?.prompt || msg.text, msg.context?.attachments)} className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.1em] text-zinc-500 hover:text-indigo-400 transition-colors">
                            <TargetIcon className="w-3.5 h-3.5" /> 修改提示词
                        </button>
                    </div>
                )}
            </div>
            {jsonContent && !msg.isCollapsed && (
                <div className="w-full bg-[#0d0d0f]/95 rounded-[28px] border border-white/10 overflow-hidden shadow-2xl mt-2 animate-in zoom-in-95">
                    <div className="flex items-center justify-between px-6 py-4 bg-zinc-900/60 border-b border-white/5">
                        <div className="flex items-center gap-3">
                            <TerminalIcon className="w-4 h-4 text-orange-400" />
                            <span className="text-[11px] font-black text-zinc-500 uppercase tracking-[0.2em]">结构化视觉解析</span>
                        </div>
                        <button onClick={() => handleCopy(jsonContent)} className={`p-2.5 rounded-xl transition-all ${copied ? 'text-emerald-400 bg-emerald-500/10' : 'text-zinc-600 hover:text-white hover:bg-zinc-800'}`}>
                            {copied ? <CheckIcon className="w-4.5 h-4.5" /> : <CopyIcon className="w-4.5 h-4.5" />}
                        </button>
                    </div>
                    <MonacoCodeEditor code={jsonContent} language="json" />
                </div>
            )}
        </div>
    );
};

const detectAspectRatio = (base64: string): Promise<string> => {
    return new Promise((resolve) => {
        const img = new Image();
        img.onload = () => {
            const ratioId = getClosestGeminiRatio(img.naturalWidth, img.naturalHeight);
            resolve(ratioId);
        };
        img.onerror = () => resolve('1:1');
        img.src = base64;
    });
};

const GeminiChatPanel = forwardRef<GeminiChatPanelRef, GeminiChatPanelProps>(({ onAddToCanvas, onReceiveSegments, onExpandChange }, ref) => {
  const [isMinimized, setIsMinimized] = useState(true);
  const [isExpanded, setIsExpanded] = useState(false);
  const [showHistorySidebar, setShowHistorySidebar] = useState(false);
  const [inputText, setInputText] = useState('');
  const [mode, setMode] = useState<'fast' | 'think'>('fast');
  const [isLoading, setIsLoading] = useState(false);
  const [showTools, setShowTools] = useState(false);
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [activeTool, setActiveTool] = useState<{label: string, type: string, icon: React.ReactNode} | null>(null);
  const [editingAttachmentId, setEditingAttachmentId] = useState<string | null>(null);
  const [brushColor, setBrushColor] = useState('#ef4444');
  const [brushSize, setBrushSize] = useState(30);
  const [magicSubMode, setMagicSubMode] = useState<'paint' | 'text'>('paint');
  const [stagedPulse, setStagedPulse] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [showExportMenu, setShowExportMenu] = useState(false);
  const [showToC, setShowToC] = useState(false);
  const magicCanvasRef = useRef<MaskCanvasRef>(null);

  useEffect(() => {
    onExpandChange?.(isExpanded);
  }, [isExpanded, onExpandChange]);

  const floatingColors = [
    { id: 'red', value: '#ef4444' },
    { id: 'yellow', value: '#facc15' },
    { id: 'green', value: '#22c55e' },
    { id: 'blue', value: '#3b82f6' },
    { id: 'white', value: '#ffffff' },
  ];

  const triggerStagedPulse = () => {
    setStagedPulse(true);
    setTimeout(() => setStagedPulse(false), 800);
  };

  const ensureAttachment = async (itemId: string | null, imageBase64: string, label?: string, point?: [number, number], bulkPoints?: {label: string, point: [number, number]}[]) => {
      const compressed = await compressImage(imageBase64);
      const existingIdx = attachments.findIndex(a => a.original === compressed);
      let newAttachments = [...attachments];
      
      const pointsToApply: Record<string, [number, number]> = {};
      if (label && point) pointsToApply[label] = point;
      if (bulkPoints) bulkPoints.forEach(p => pointsToApply[p.label] = p.point);

      if (existingIdx === -1) {
          const marked = (Object.keys(pointsToApply).length > 0) ? await bakeMarkersOnImage(compressed, pointsToApply) : compressed;
          newAttachments.push({ id: crypto.randomUUID(), original: compressed, marked, points: pointsToApply, sourceId: itemId || undefined });
      } else {
          const currentPoints = { ...newAttachments[existingIdx].points, ...pointsToApply };
          const marked = await bakeMarkersOnImage(compressed, currentPoints);
          newAttachments[existingIdx] = { ...newAttachments[existingIdx], points: currentPoints, marked, sourceId: itemId || newAttachments[existingIdx].sourceId };
      }
      setAttachments(newAttachments.slice(-3));
      triggerStagedPulse();
      return compressed;
  };

  useImperativeHandle(ref, () => ({
    addPointReference: async (itemId, imageBase64, label, point) => {
      await ensureAttachment(itemId, imageBase64, label, point);
      setInputText(prev => {
        const tag = `【特征点:${label}】`;
        if (prev.includes(tag)) return prev;
        const base = prev.trim();
        if (!base) return `${tag}的位置`;
        return `${base}\n在${tag}的位置`;
      });
      if (!activeTool) setActiveTool(TOOLS.find(t => t.type === 'image') || null);
    },
    addBulkPointReferences: async (itemId, imageBase64, points) => {
        await ensureAttachment(itemId, imageBase64, undefined, undefined, points);
        const tags = points.map(p => `【特征点:${p.label}】`).join('、');
        const bulkText = `已成功捕获${points.length}个精确锚点：${tags}。请针对这些点位执行设计移植。`;
        setInputText(prev => prev.trim() ? `${prev}\n${bulkText}` : bulkText);
        if (!activeTool) setActiveTool(TOOLS.find(t => t.type === 'image') || null);
    },
    appendMovementDescription: (itemId, imageBase64, label, from, to) => {
      ensureAttachment(itemId, imageBase64);
      const moveText = `将【特征点:${label}】从坐标 [${Math.round(from[0])}, ${Math.round(from[1])}] 移动到了 [${Math.round(to[0])}, ${Math.round(to[1])}]，并自然的修复背景。`;
      setInputText(prev => {
          const base = prev.trim();
          if (!base) return moveText;
          return `${base}\n${moveText}`;
      });
      triggerStagedPulse();
      if (!activeTool) setActiveTool(TOOLS.find(t => t.type === 'image') || null);
    },
    requestObjectRemoval: (itemId, imageBase64, label, point) => {
      ensureAttachment(itemId, imageBase64, label, point);
      const removeText = `请从图中完全移除【特征点:${label}】，并自然地修复背景。`;
      setInputText(prev => {
          const base = prev.trim();
          if (!base) return removeText;
          if (base.includes(removeText)) return base;
          return `${base}\n${removeText}`;
      });
      triggerStagedPulse();
      if (!activeTool) setActiveTool(TOOLS.find(t => t.type === 'image') || null);
    },
    addExternalAttachment: async (itemId, imageBase64) => {
      await ensureAttachment(itemId, imageBase64);
      triggerStagedPulse();
    }
  }));

  const [folders, setFolders] = useState<ChatFolder[]>(() => {
    const saved = localStorage.getItem('gemini_chat_folders');
    return saved ? JSON.parse(saved) : [];
  });

  const [sessions, setSessions] = useState<ChatSession[]>(() => {
    const saved = localStorage.getItem('gemini_chat_sessions');
    if (saved) { try { return JSON.parse(saved); } catch (e) { return []; } }
    return [{ id: 'default', title: '新对话', messages: [], createdAt: Date.now() }];
  });

  const [activeSessionId, setActiveSessionId] = useState<string>(() => sessions[0]?.id || 'default');
  const activeSession = useMemo(() => sessions.find(s => s.id === activeSessionId) || sessions[0], [sessions, activeSessionId]);
  const messages = activeSession.messages;

  useEffect(() => {
    localStorage.setItem('gemini_chat_sessions', JSON.stringify(sessions));
  }, [sessions]);

  useEffect(() => {
    localStorage.setItem('gemini_chat_folders', JSON.stringify(folders));
  }, [folders]);

  const filteredSessions = useMemo(() => {
    if (!searchQuery.trim()) return sessions;
    const q = searchQuery.toLowerCase();
    return sessions.filter(s => 
      s.title.toLowerCase().includes(q) || 
      s.messages.some(m => m.text.toLowerCase().includes(q))
    );
  }, [sessions, searchQuery]);

  const contextImageMarked = useMemo(() => {
    if (attachments.length > 0) return attachments[attachments.length - 1].marked;
    return null; 
  }, [attachments]);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const TOOLS = [
    { label: '标准对话', type: 'chat', icon: <MessageCircleIcon className="w-4 h-4" /> },
    { label: 'Deep Research', type: 'research', icon: <GlobeIcon className="w-4 h-4" /> },
    { label: '制作视频 (Veo 3.1)', type: 'video', icon: <FilmIcon className="w-4 h-4" /> },
    { label: '生成图片', type: 'image', icon: <BananaIcon className="w-4 h-4" /> },
    { label: '智能拆解 (Labs)', type: 'json_analysis', icon: <FlaskIcon className="w-4 h-4" /> },
    { label: '学习辅导', type: 'learning', icon: <BookIcon className="w-4 h-4" /> },
  ];

  const scrollToBottom = () => messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  useEffect(() => { if (isExpanded) scrollToBottom(); }, [messages, isExpanded, isLoading]);
  
  const handleCreateSession = (folderId?: string) => {
    const newSession: ChatSession = { id: crypto.randomUUID(), title: '新对话', messages: [], createdAt: Date.now(), folderId };
    setSessions([newSession, ...sessions]); setActiveSessionId(newSession.id); setIsExpanded(true); setInputText(''); setAttachments([]);
  };

  const handleCreateFolder = () => {
    const name = prompt("请输入文件夹名称");
    if (name) {
      setFolders([{ id: crypto.randomUUID(), name, createdAt: Date.now() }, ...folders]);
    }
  };

  const handleDeleteSession = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    const newSessions = sessions.filter(s => s.id !== id);
    if (newSessions.length === 0) handleCreateSession();
    else { setSessions(newSessions); if (activeSessionId === id) setActiveSessionId(newSessions[0].id); }
  };

  const handleMoveToFolder = (sessionId: string, folderId?: string) => {
    setSessions(prev => prev.map(s => s.id === sessionId ? { ...s, folderId } : s));
  };

  const handleDeleteMessage = (messageId: string) => {
    setSessions(prev => prev.map(s => s.id === activeSessionId ? { ...s, messages: s.messages.filter(m => m.id !== messageId) } : s));
  };

  const handleToggleCollapseMessage = (messageId: string) => {
    setSessions(prev => prev.map(s => s.id === activeSessionId ? { 
        ...s, 
        messages: s.messages.map(m => m.id === messageId ? { ...m, isCollapsed: !m.isCollapsed } : m) 
    } : s));
  };

  const updateSessionMessages = (newMessages: ChatMessage[]) => {
    setSessions(prev => prev.map(s => {
        if (s.id === activeSessionId) {
            let newTitle = s.title;
            if (s.messages.length === 0 && newMessages.length > 0) newTitle = newMessages[0].text.slice(0, 15) + (newMessages[0].text.length > 15 ? '...' : '');
            return { ...s, messages: newMessages, title: newTitle };
        }
        return s;
    }));
  };

  const handleExport = (format: 'md' | 'json' | 'pdf') => {
    if (format === 'json') {
      const blob = new Blob([JSON.stringify(activeSession, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a'); a.href = url; a.download = `${activeSession.title}.json`; a.click();
    } else if (format === 'md') {
      const md = messages.map(m => `### ${m.role === 'user' ? '用户提问' : 'Gemini 回答'}\n\n${m.text}\n\n---\n`).join('\n');
      const blob = new Blob([md], { type: 'text/markdown' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a'); a.href = url; a.download = `${activeSession.title}.md`; a.click();
    } else if (format === 'pdf') {
      window.print();
    }
    setShowExportMenu(false);
  };

  const handleToCJump = (id: string) => {
    const el = document.getElementById(`msg-${id}`);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' });
      setShowToC(false);
    }
  };

  const handleSend = async (overrideText?: string, overrideAttachments?: Attachment[], overrideToolType?: string | null) => {
    let textToSend = overrideText !== undefined ? overrideText : inputText.trim();
    const currentAttachments = overrideAttachments !== undefined ? overrideAttachments : [...attachments];
    let toolType = overrideToolType !== undefined ? overrideToolType : activeTool?.type;
    
    if (!textToSend && currentAttachments.length === 0 && !toolType || isLoading) return;
    const contextForRedo = { prompt: textToSend, attachments: [...currentAttachments], toolType: toolType || null };
    setInputText(''); setAttachments([]); setIsLoading(true); setIsExpanded(true); setShowTools(false);

    const userMsg: ChatMessage = { 
        id: crypto.randomUUID(), 
        role: 'user', 
        text: textToSend, 
        images: currentAttachments.length > 0 ? currentAttachments.map(a => a.marked) : undefined, 
        originalImages: currentAttachments.length > 0 ? currentAttachments.map(a => a.original) : undefined, 
        context: contextForRedo 
    };
    const newMessages: ChatMessage[] = [...messages, userMsg];
    updateSessionMessages(newMessages);

    try {
      let resultMsg: ChatMessage;

      if (toolType === 'video') {
        const videoUrl = await generateVideo(textToSend || "Professional visual motion");
        resultMsg = { id: crypto.randomUUID(), role: 'model', text: "视频生成成功。", videoUrl, context: contextForRedo };
      } else if (toolType === 'image') {
        const styleSuffix = STYLES[1].promptSuffix;
        let url: string;
        const maskedAttachment = currentAttachments.find(a => a.maskData);
        if (maskedAttachment) {
            const ratio = await detectAspectRatio(maskedAttachment.original);
            url = await editImage(maskedAttachment.original, textToSend, ratio, maskedAttachment.maskData);
        } else if (currentAttachments.length > 0) {
            const refs = currentAttachments.map((a, i) => ({ label: `Ref ${i+1}`, base64: a.original }));
            const ratio = await detectAspectRatio(currentAttachments[0].original);
            url = await generateWithReferences(textToSend, refs, ratio, styleSuffix, 0.8, '1K');
        } else {
            url = await generateImage(textToSend, styleSuffix, '1:1', 1.0, '1K');
        }
        resultMsg = { id: crypto.randomUUID(), role: 'model', text: "已生成。预览如下：", images: [url], context: contextForRedo };
      } else if (toolType === 'json_analysis' && currentAttachments.length > 0) {
        const result = await detectImageJSONSegments(currentAttachments[0].original);
        if (onReceiveSegments) onReceiveSegments(result.segments || []);
        resultMsg = { id: crypto.randomUUID(), role: 'model', text: `\`\`\`json\n${JSON.stringify(result, null, 2)}\n\`\`\``, isJson: true, context: contextForRedo };
      } else {
        const aiImages = currentAttachments.map(a => a.original);
        const response = await chatWithGemini(textToSend || "请分析。", messages.map(m => ({ role: m.role, parts: [{ text: m.text }] })), mode === 'think', aiImages, toolType === 'research');
        resultMsg = { id: crypto.randomUUID(), role: 'model', text: response, context: contextForRedo };
      }
      updateSessionMessages([...newMessages, resultMsg]);
    } catch (error: any) { 
        updateSessionMessages([...newMessages, { id: crypto.randomUUID(), role: 'model', text: error.message || "请求失败", isError: true, context: contextForRedo }]); 
    } finally { setIsLoading(false); }
  };

  const handleRedo = (msg: ChatMessage) => {
    if (msg.context) {
        handleSend(msg.context.prompt, msg.context.attachments, msg.context.toolType);
    }
  };

  const handleEditPrompt = (text: string, attachments?: Attachment[]) => {
      setInputText(text);
      if (attachments) {
          setAttachments([...attachments]);
      }
      setIsExpanded(true);
  };
  
  const handleSendToContext = async (base64: string) => {
    await ensureAttachment(null, base64);
  };

  return (
    <>
      {editingAttachmentId && attachments.find(a => a.id === editingAttachmentId) && (
        <div className="fixed inset-0 z-[1000] bg-[#09090b] animate-in fade-in duration-300 flex flex-col overflow-hidden">
          <div className="h-16 flex items-center justify-between px-8 border-b border-white/5 bg-[#0c0c0e]/80 backdrop-blur-md z-[1010]">
            <div className="flex items-center gap-6">
              <button onClick={() => setEditingAttachmentId(null)} className="p-2 text-zinc-400 hover:text-white transition-all hover:bg-white/5 rounded-xl">
                <ChevronLeftIcon className="w-6 h-6" />
              </button>
              <div className="flex items-center gap-4">
                 <span className="text-[14px] font-black text-white uppercase tracking-[0.4em]">Gemini</span>
                 <div className="w-px h-4 bg-white/10" />
                 <span className="text-[12px] font-bold text-zinc-500">魔法标记模式</span>
              </div>
            </div>
            <div className="flex items-center gap-4">
              <button onClick={() => {
                magicCanvasRef.current?.getSelectionMask().then(async (mask) => {
                    if (mask) {
                        const comp = await compressImage(mask);
                        setAttachments(prev => prev.map(a => a.id === editingAttachmentId ? { ...a, maskData: comp } : a));
                        triggerStagedPulse();
                    }
                    setEditingAttachmentId(null);
                });
              }} className="px-10 py-2.5 bg-[#5546fe] hover:bg-indigo-500 text-white rounded-[14px] text-[12px] font-black uppercase tracking-[0.2em] transition-all shadow-xl active:scale-95">完成标记</button>
            </div>
          </div>

          <div className="flex-1 relative flex items-center justify-center p-4 pt-8 pb-32">
             <div className="relative w-full h-full max-w-[calc(100vh-200px)] aspect-square rounded-[32px] overflow-hidden border border-white/10 shadow-[0_80px_200px_rgba(0,0,0,1)] bg-[#111113] group">
                <img src={attachments.find(a => a.id === editingAttachmentId)?.marked} className="w-full h-full object-contain select-none" />
                <MaskCanvas 
                  ref={magicCanvasRef}
                  width={1024} height={1024}
                  imageSrc={attachments.find(a => a.id === editingAttachmentId)?.marked || ''}
                  tool={magicSubMode === 'paint' ? 'brush' : 'eraser'}
                  brushColor={brushColor} brushSize={brushSize}
                  isTextMode={magicSubMode === 'text'}
                />
             </div>
             <div className="absolute bottom-12 left-1/2 -translate-x-1/2 flex flex-col items-center gap-5 z-[1020]">
                <div className="bg-[#18181b]/95 p-2 rounded-full shadow-2xl flex items-center gap-4 border border-white/10 pointer-events-auto backdrop-blur-2xl">
                    {floatingColors.map(c => (
                        <button 
                            key={c.id} 
                            onClick={() => setBrushColor(c.value)} 
                            className={`w-8 h-8 rounded-full border-2 transition-all hover:scale-110 active:scale-90 ${brushColor === c.value ? 'border-indigo-500 ring-4 ring-indigo-500/20' : 'border-transparent opacity-80'}`} 
                            style={{ backgroundColor: c.value }} 
                        />
                    ))}
                </div>
                <div className="bg-[#121214]/90 backdrop-blur-3xl p-2 rounded-[28px] flex items-center gap-4 border border-white/10 shadow-2xl pointer-events-auto">
                    <div className="flex items-center gap-1 border-r border-white/5 pr-3">
                        <button onClick={() => setMagicSubMode('paint')} className={`w-14 h-12 flex items-center justify-center rounded-[18px] transition-all ${magicSubMode === 'paint' ? 'bg-[#5546fe] text-white shadow-xl' : 'text-zinc-600 hover:text-zinc-200'}`} title="画笔模式">
                            <MagicCurveIcon className="w-6 h-6" />
                        </button>
                        <button onClick={() => setMagicSubMode('text')} className={`w-14 h-12 flex items-center justify-center rounded-[18px] transition-all ${magicSubMode === 'text' ? 'bg-[#5546fe] text-white shadow-xl' : 'text-zinc-600 hover:text-zinc-200'}`} title="擦除/文字模式">
                            <TypeIcon className="w-6 h-6" />
                        </button>
                    </div>
                    <div className="flex items-center gap-3 px-2 min-w-[200px]">
                        <span className="text-[10px] font-black text-zinc-500 uppercase tracking-widest shrink-0 w-8">Size</span>
                        <input 
                            type="range" min="1" max="150" step="1"
                            value={brushSize}
                            onChange={(e) => setBrushSize(Number(e.target.value))}
                            className="w-full h-1 bg-zinc-800 rounded-lg appearance-none accent-indigo-500 cursor-pointer"
                        />
                        <span className="text-zinc-400 font-mono text-[11px] font-black w-8 text-right">{brushSize}</span>
                    </div>
                    <div className="flex items-center gap-1 border-l border-white/5 pl-3">
                        <button onClick={() => magicCanvasRef.current?.undo()} className="w-12 h-12 flex items-center justify-center rounded-[18px] text-zinc-400 hover:bg-white/5 hover:text-white transition-all active:scale-90" title="撤销最后一步">
                            <UndoIcon className="w-5 h-5" />
                        </button>
                    </div>
                </div>
             </div>
          </div>
        </div>
      )}

      <div 
        className={`fixed right-6 bottom-6 z-[60] transition-all duration-500 ease-in-out flex flex-col items-end ${isMinimized ? 'w-16 h-16' : isExpanded ? 'w-[1000px] h-[calc(100vh-48px)] top-6' : 'w-[640px] h-[64px]'}`}
      >
        {!isMinimized && (
          <div className="w-full h-full bg-[#0c0c0e]/95 backdrop-blur-3xl border border-white/10 rounded-[32px] shadow-2xl flex overflow-hidden animate-in fade-in zoom-in-95 duration-500">
              <div className={`w-[280px] border-r border-white/5 bg-[#0c0c0e]/60 flex flex-col animate-in slide-in-from-left duration-300 ${isExpanded && showHistorySidebar ? '' : 'hidden'}`}>
                  <div className="p-6 space-y-4">
                      <div className="relative">
                          <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-600" />
                          <input 
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            placeholder="搜索历史对话..."
                            className="w-full bg-white/5 border border-white/5 rounded-xl pl-10 pr-4 py-2 text-[12px] text-zinc-300 focus:border-indigo-500/50 outline-none transition-all"
                          />
                      </div>
                      <div className="flex gap-2">
                        <button onClick={() => handleCreateSession()} className="flex-1 py-3 bg-[#5546fe] hover:bg-indigo-500 text-[10px] text-white font-black uppercase tracking-[0.2em] rounded-xl flex items-center justify-center gap-2 transition-all shadow-xl active:scale-95"><PlusIcon className="w-4 h-4" /> 对话</button>
                        <button onClick={handleCreateFolder} className="px-4 py-3 bg-white/5 hover:bg-white/10 text-zinc-400 hover:text-white rounded-xl transition-all border border-white/5" title="新建文件夹"><FolderPlusIcon className="w-4 h-4" /></button>
                      </div>
                  </div>
                  
                  <div className="flex-1 overflow-y-auto px-4 space-y-6 no-scrollbar pb-10">
                      {/* Folders */}
                      {folders.map(folder => (
                        <div key={folder.id} className="space-y-1">
                          <div className="flex items-center justify-between px-3 py-2 group/folder">
                            <div className="flex items-center gap-2 text-zinc-500 group-hover/folder:text-zinc-300 transition-colors">
                              <FolderIcon className="w-4 h-4" />
                              <span className="text-[11px] font-black uppercase tracking-widest">{folder.name}</span>
                            </div>
                            <button onClick={() => handleCreateSession(folder.id)} className="p-1 text-zinc-700 hover:text-indigo-400 opacity-0 group-hover/folder:opacity-100 transition-all"><PlusIcon className="w-3 h-3"/></button>
                          </div>
                          <div className="space-y-1 pl-2 border-l border-white/5">
                            {filteredSessions.filter(s => s.folderId === folder.id).map(s => (
                              <button key={s.id} onClick={() => setActiveSessionId(s.id)} className={`w-full group px-4 py-3 rounded-xl flex items-center gap-3 text-left transition-all ${activeSessionId === s.id ? 'bg-[#5546fe]/20 text-[#8b80ff] border border-[#5546fe]/30' : 'text-zinc-500 hover:bg-white/5'}`}>
                                  <MessageCircleIcon className="w-3.5 h-3.5 shrink-0" />
                                  <span className="text-[12px] font-bold truncate flex-1">{s.title}</span>
                                  <TrashIcon onClick={(e) => handleDeleteSession(e, s.id)} className="w-3.5 h-3.5 opacity-0 group-hover:opacity-100 hover:text-red-500 transition-all" />
                              </button>
                            ))}
                          </div>
                        </div>
                      ))}
                      
                      {/* Independent Sessions */}
                      <div className="space-y-1">
                          <div className="px-3 py-2 text-[10px] font-black text-zinc-700 uppercase tracking-widest">其他对话</div>
                          {filteredSessions.filter(s => !s.folderId).map(s => (
                              <button key={s.id} onClick={() => setActiveSessionId(s.id)} className={`w-full group px-4 py-3 rounded-xl flex items-center gap-3 text-left transition-all ${activeSessionId === s.id ? 'bg-[#5546fe]/20 text-[#8b80ff] border border-[#5546fe]/30' : 'text-zinc-500 hover:bg-white/5'}`}>
                                  <MessageCircleIcon className="w-3.5 h-3.5 shrink-0" />
                                  <span className="text-[12px] font-bold truncate flex-1">{s.title}</span>
                                  <TrashIcon onClick={(e) => handleDeleteSession(e, s.id)} className="w-3.5 h-3.5 opacity-0 group-hover:opacity-100 hover:text-red-500 transition-all" />
                              </button>
                          ))}
                      </div>
                  </div>
              </div>

              <div className="flex-1 flex flex-col min-0 bg-[#111113] relative">
                  <div className={`px-8 flex items-center justify-between border-b border-white/5 bg-[#111113]/40 backdrop-blur-3xl z-20 ${isExpanded ? 'py-4' : 'py-0 h-full'}`}>
                      <div className="flex items-center gap-5">
                          {isExpanded && (<button onClick={() => setShowHistorySidebar(!showHistorySidebar)} className={`p-3 rounded-2xl transition-all ${showHistorySidebar ? 'bg-indigo-500/20 text-[#8b80ff]' : 'text-zinc-500 hover:text-white hover:bg-white/5'}`}><ClockIcon className="w-6 h-6" /></button>)}
                          <div className="flex flex-col">
                            <span className="text-[13px] font-black text-white uppercase tracking-[0.3em] font-mono leading-none">Gemini 3 Pro</span>
                            {isExpanded && <span className="text-[10px] text-zinc-600 font-bold mt-1 truncate max-w-[200px]">{activeSession.title}</span>}
                          </div>
                      </div>
                      
                      <div className="flex items-center gap-2">
                          {isExpanded && (
                            <div className="flex items-center gap-1 bg-white/5 rounded-2xl p-1 border border-white/5">
                                <button onClick={() => setShowToC(!showToC)} className={`p-2 rounded-xl transition-all ${showToC ? 'bg-indigo-500 text-white' : 'text-zinc-500 hover:text-white'}`} title="问题索引">
                                    <ListIcon className="w-5 h-5" />
                                </button>
                                <div className="relative">
                                  <button onClick={() => setShowExportMenu(!showExportMenu)} className={`p-2 rounded-xl transition-all ${showExportMenu ? 'bg-indigo-500 text-white' : 'text-zinc-500 hover:text-white'}`} title="导出对话">
                                      <DownloadIcon className="w-5 h-5" />
                                  </button>
                                  {showExportMenu && (
                                    <div className="absolute top-full right-0 mt-3 w-44 bg-[#1a1a1c] border border-white/10 rounded-2xl shadow-3xl p-1.5 z-50 animate-in zoom-in-95">
                                      <button onClick={() => handleExport('md')} className="w-full flex items-center gap-3 px-4 py-3 text-[11px] font-black text-zinc-400 hover:text-white hover:bg-white/5 rounded-xl transition-all uppercase tracking-widest border-b border-white/5"><FileTextIcon className="w-4 h-4"/> Markdown</button>
                                      <button onClick={() => handleExport('json')} className="w-full flex items-center gap-3 px-4 py-3 text-[11px] font-black text-zinc-400 hover:text-white hover:bg-white/5 rounded-xl transition-all uppercase tracking-widest border-b border-white/5"><FileJsonIcon className="w-4 h-4"/> JSON 结构</button>
                                      <button onClick={() => handleExport('pdf')} className="w-full flex items-center gap-3 px-4 py-3 text-[11px] font-black text-zinc-400 hover:text-white hover:bg-white/5 rounded-xl transition-all uppercase tracking-widest"><ImageIcon className="w-4 h-4"/> 打印 / PDF</button>
                                    </div>
                                  )}
                                </div>
                            </div>
                          )}
                          <div className="w-px h-6 bg-white/5 mx-2" />
                          <button onClick={() => { if (isExpanded) setIsExpanded(false); else setIsExpanded(true); }} className="p-3 text-zinc-500 hover:text-white rounded-2xl transition-all">{isExpanded ? <ChevronDownIcon className="w-6 h-6" /> : <ChevronUpIcon className="w-6 h-6" />}</button>
                          <button onClick={() => { setIsMinimized(true); setIsExpanded(false); }} className="p-3 text-zinc-500 hover:text-white rounded-2xl transition-all"><MinimizeIcon className="w-6 h-6" /></button>
                      </div>
                  </div>

                  {/* Table of Contents Overlay */}
                  {isExpanded && showToC && (
                    <div className="absolute top-20 right-8 w-72 max-h-[60vh] bg-[#1a1a1c]/95 backdrop-blur-3xl border border-white/10 rounded-3xl shadow-3xl z-50 flex flex-col animate-in slide-in-from-right-4 duration-300">
                      <div className="p-5 border-b border-white/5 flex items-center justify-between">
                        <span className="text-[10px] font-black text-zinc-500 uppercase tracking-widest">对话导航索引</span>
                        <button onClick={() => setShowToC(false)} className="text-zinc-600 hover:text-white"><XIcon className="w-4 h-4"/></button>
                      </div>
                      <div className="flex-1 overflow-y-auto p-3 space-y-1 no-scrollbar">
                        {messages.filter(m => m.role === 'user').map((m, idx) => (
                          <button key={m.id} onClick={() => handleToCJump(m.id)} className="w-full text-left px-4 py-3 rounded-xl hover:bg-white/5 text-[12px] text-zinc-400 hover:text-indigo-400 transition-all font-bold flex gap-3">
                            <span className="text-zinc-700 font-mono">{idx + 1}.</span>
                            <span className="truncate">{m.text}</span>
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {isExpanded && (
                      <div className="flex-1 overflow-y-auto p-10 space-y-12 no-scrollbar scroll-smooth">
                          {messages.length === 0 && (
                              <div className="h-full flex flex-col items-center justify-center text-center space-y-10 animate-in fade-in zoom-in-95 duration-1000">
                                  <div className="w-28 h-28 bg-gradient-to-br from-[#5546fe]/25 to-purple-600/25 rounded-[44px] flex items-center justify-center border border-white/10 shadow-2xl relative overflow-hidden group">
                                      <SparklesIcon className="w-14 h-14 text-[#8b80ff] opacity-70 group-hover:scale-125 transition-transform duration-700" />
                                      <div className="absolute inset-0 bg-[#5546fe]/15 animate-pulse" />
                                  </div>
                                  <div className="space-y-4">
                                      <h3 className="text-white text-[18px] font-black uppercase tracking-[0.5em]">AI 创意实验室</h3>
                                      <p className="text-zinc-500 text-[14px] font-medium tracking-widest max-w-[300px] mx-auto leading-relaxed">提供草图、参考或文字，我将为您精准重构视觉方案。</p>
                                  </div>
                              </div>
                          )}
                          {messages.map((msg) => (
                            <ChatBubble 
                                key={msg.id} 
                                msg={msg} 
                                onAddToCanvas={onAddToCanvas} 
                                onSendToContext={handleSendToContext} 
                                onRedo={handleRedo} 
                                onDelete={handleDeleteMessage} 
                                onEditPrompt={handleEditPrompt}
                                onToggleCollapse={handleToggleCollapseMessage}
                            />
                          ))}
                          {isLoading && (
                              <div className="flex items-center gap-5 text-zinc-400 px-6 py-4 bg-white/5 w-fit rounded-[24px] border border-white/5 animate-pulse shadow-2xl">
                                  <RefreshIcon className="w-5 h-5 animate-spin text-[#8b80ff]" />
                                  <span className="text-[12px] font-black uppercase tracking-[0.3em] font-mono">GEMINI PROCESSING...</span>
                              </div>
                          )}
                          <div ref={messagesEndRef} />
                      </div>
                  )}

                  {isExpanded && (
                    <div className="p-8 bg-[#0c0c0e]/60 border-t border-white/5 rounded-b-[36px]">
                        <div className="relative">
                            {showTools && (
                                <div className="absolute bottom-full mb-6 left-0 w-96 bg-[#121214]/95 border border-white/10 rounded-[40px] shadow-2xl p-5 z-[70] animate-in slide-in-from-bottom-8 duration-500 backdrop-blur-3xl">
                                    <div className="space-y-2">
                                        {TOOLS.map((t) => (
                                            <button key={t.type} onClick={() => { setActiveTool(t.type === 'chat' ? null : t); setShowTools(false); }} className={`w-full flex items-center gap-6 px-6 py-5 rounded-[26px] transition-all ${(activeTool?.type === t.type || (!activeTool && t.type === 'chat')) ? 'bg-[#5546fe]/25 text-[#8b80ff] border border-[#5546fe]/30' : 'text-zinc-500 hover:bg-white/5 hover:text-white'}`}>
                                                <div className={`p-3 rounded-[16px] ${(activeTool?.type === t.type || (!activeTool && t.type === 'chat')) ? 'bg-[#5546fe]/30' : 'bg-[#1a1a1c]'}`}>{t.icon}</div>
                                                <span className="text-[16px] font-bold tracking-tight">{t.label}</span>
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            )}
                            <div className="flex items-center justify-between mb-5 px-1">
                                <button onClick={() => setShowTools(!showTools)} className="flex items-center gap-4 text-[11px] font-black uppercase tracking-[0.25em] pl-5 pr-3 py-2.5 text-[#8b80ff] bg-white/5 border border-white/5 rounded-full">
                                    {activeTool ? `MODE: ${activeTool.label}` : '标准对话'} <ChevronDownIcon className={`w-4.5 h-4.5 transition-transform ${showTools ? 'rotate-180' : ''}`} />
                                </button>
                            </div>
                            {attachments.length > 0 && (
                                <div className="mb-6 animate-in slide-in-from-bottom-4 duration-500 overflow-x-auto no-scrollbar pb-4">
                                    <div className="flex items-center gap-5">
                                        {attachments.map((att, idx) => (
                                            <div key={att.id} className="relative group shrink-0">
                                                <div className={`w-24 h-24 rounded-[28px] overflow-hidden border border-white/10 ring-2 ${att.maskData ? 'ring-emerald-500/40' : 'ring-[#5546fe]/25'} shadow-3xl bg-[#111113] relative`}>
                                                    <img src={att.marked} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700" />
                                                    <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 flex items-center justify-center gap-3 transition-opacity">
                                                        <button onClick={() => { setEditingAttachmentId(att.id); setMagicSubMode('paint'); }} className="w-10 h-10 bg-indigo-600 rounded-xl flex items-center justify-center text-white"><MagicCurveIcon className="w-5 h-5" /></button>
                                                        <button onClick={() => setAttachments(prev => prev.filter(a => a.id !== att.id))} className="w-10 h-10 bg-red-600 rounded-xl flex items-center justify-center text-white"><XIcon className="w-5 h-5" /></button>
                                                    </div>
                                                </div>
                                            </div>
                                        ))}
                                        <button onClick={() => fileInputRef.current?.click()} className="w-24 h-24 rounded-[28px] border-2 border-dashed border-white/10 flex items-center justify-center text-zinc-700 hover:text-zinc-500 bg-white/2"><PlusIcon className="w-8 h-8" /></button>
                                    </div>
                                </div>
                            )}
                            <div className="relative group shadow-2xl rounded-[32px] overflow-hidden border border-white/5">
                                <textarea 
                                    value={inputText} 
                                    onChange={(e) => setInputText(e.target.value)} 
                                    onFocus={() => setIsExpanded(true)} 
                                    placeholder={activeTool ? `在此描述任务 (${activeTool.label.toUpperCase()})...` : "告诉我你的想法..."}
                                    className="w-full bg-[#18181b]/95 border-none rounded-[32px] p-7 text-[14px] h-32 focus:ring-2 focus:ring-[#5546fe]/50 outline-none resize-none transition-all placeholder:text-zinc-300 text-zinc-100 font-semibold"
                                    onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
                                />
                            </div>
                            <div className="flex items-center justify-between mt-6 px-1">
                                <div className="flex items-center gap-5">
                                    <button onClick={() => fileInputRef.current?.click()} className="w-14 h-14 rounded-[20px] flex items-center justify-center text-zinc-500 hover:bg-white/10 border border-white/10 bg-white/5"><ImageIcon className="w-7 h-7" /></button>
                                    <div className="flex bg-white/5 rounded-[22px] p-1.5 gap-2 border border-white/10">
                                        <button onClick={() => setMode('fast')} className={`px-6 py-2.5 text-[11px] font-black uppercase tracking-[0.25em] rounded-[16px] transition-all ${mode === 'fast' ? 'bg-[#ff6b00] text-white' : 'text-zinc-600'}`}>FAST</button>
                                        <button onClick={() => setMode('think')} className={`px-6 py-2.5 text-[11px] font-black uppercase tracking-[0.25em] rounded-[16px] transition-all ${mode === 'think' ? 'bg-[#5546fe] text-white' : 'text-zinc-600'}`}>THINK</button>
                                    </div>
                                </div>
                                <button onClick={() => handleSend()} disabled={isLoading || (!inputText.trim() && attachments.length === 0 && !activeTool)} className={`w-16 h-16 rounded-[24px] flex items-center justify-center transition-all ${(!inputText.trim() && attachments.length === 0 && !activeTool) ? 'bg-zinc-800/60 text-zinc-700 opacity-40' : 'bg-[#5546fe] text-white shadow-xl'}`}>
                                    {isLoading ? <RefreshIcon className="w-7 h-7 animate-spin" /> : <SendIcon className="w-7 h-7" />}
                                </button>
                            </div>
                        </div>
                    </div>
                  )}
              </div>
          </div>
        )}
        {isMinimized && (
          <button 
            onClick={() => { setIsMinimized(false); setIsExpanded(true); }} 
            className={`w-24 h-24 bg-[#09090b] border border-white/15 rounded-[36px] shadow-2xl flex items-center justify-center text-white hover:scale-110 active:scale-95 transition-all group relative overflow-hidden ${stagedPulse ? 'animate-bounce' : ''}`}
          >
              <MessageCircleIcon className="w-10 h-10 text-[#8b80ff] relative z-10 group-hover:rotate-6 transition-all" />
              <div className="absolute inset-0 bg-gradient-to-br from-[#5546fe]/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
          </button>
        )}
        <input type="file" ref={fileInputRef} onChange={(e) => {
            const files = Array.from(e.target.files || []) as File[];
            files.forEach(f => {
                const reader = new FileReader();
                reader.onload = (ev) => handleSendToContext(ev.target?.result as string);
                reader.readAsDataURL(f);
            });
        }} className="hidden" accept="image/*" multiple />
      </div>

      <style>{`
        .mask-fade-bottom {
          mask-image: linear-gradient(to bottom, black 60%, transparent 100%);
          -webkit-mask-image: linear-gradient(to bottom, black 60%, transparent 100%);
        }
        @media print {
          body * { visibility: hidden; }
          #root, .fixed { display: none !important; }
          .markdown-renderer { visibility: visible; width: 100%; position: absolute; left: 0; top: 0; }
          .markdown-renderer * { visibility: visible; }
        }
      `}</style>
    </>
  );
});

export default GeminiChatPanel;