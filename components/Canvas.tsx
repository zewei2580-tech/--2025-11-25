import { useRef, useState, useImperativeHandle, forwardRef, useMemo, useEffect, useCallback } from 'react';
import React from 'react';
import { CanvasItem, ViewState, Point, ToolType, ItemType, EditToolType, Segment, IdentifiedPoint, Rect, ExpressionState, SpatialConfig, PartCMF, BOMEntry, TopologyStrategy } from '../types';
import { 
    RotateCcwIcon, SparklesIcon, XIcon,
    TrashIcon, CameraIcon, PenIcon, BoxIcon, LinkIcon, MessageCircleIcon,
    LanguagesIcon, ArrowIcon, SquareIcon, CircleIcon, BrushIcon, ScanIcon, RefreshIcon, EyeOffIcon, PaletteIcon, TargetIcon, ListOrderedIcon, ChevronDownIcon, EraserIcon
} from './Icons';
import MaskCanvas, { MaskCanvasRef } from './MaskCanvas';
import FloatingSelectionBar from './FloatingSelectionBar';
import FloatingPromptInput from './FloatingPromptInput';
import ExpressionController from './ExpressionController';
import TopologyPanel from './TopologyPanel';
import AntigravityLoading from './AntigravityLoading';
import ModelViewport from './ModelViewport';
import { useCanvasMath } from '../hooks/useCanvasMath';
import { useTransformEngine } from '../hooks/useTransformEngine';
import { useAnnotations, Annotation } from '../hooks/useAnnotations';
import { useCaptureManager } from '../hooks/useCaptureManager';
import { useFeaturePointInteraction } from '../hooks/useFeaturePointInteraction';
import { CMF_LIBRARY } from '../constants';

interface CanvasProps {
  items: CanvasItem[];
  selection: string[];
  tool: ToolType;
  view: ViewState;
  setView: (view: ViewState | ((prev: ViewState) => ViewState)) => void;
  setSelection: (ids: string[]) => void;
  addItem: (item: CanvasItem) => void;
  updateItem: (id: string, updates: Partial<CanvasItem>) => void;
  updateItems?: (updates: { id: string, updates: Partial<CanvasItem> }[]) => void;
  onContextMenu?: (e: React.MouseEvent, itemId?: string) => void;
  onDelete?: (id: string) => void;
  editMode?: boolean;
  setEditMode?: (mode: boolean) => void;
  editTool?: EditToolType;
  setEditTool?: (tool: EditToolType) => void;
  brushSize?: number;
  setBrushSize?: (size: number) => void;
  brushColor?: string;
  setBrushColor?: (color: string) => void;
  brushOpacity?: number;
  setBrushOpacity?: (opacity: number) => void;
  segments?: Segment[];
  onApplyEdit?: (prompt: string) => void;
  isSmartEraserMode?: boolean;
  onSmartEraserEnd?: () => void;
  onSelectItem?: (id: string) => void;
  onPointPicked?: (itemId: string, y: number, x: number) => void;
  isPickingPoint?: boolean;
  onPointTagClick?: (item: CanvasItem, point: IdentifiedPoint) => void;
  onPointRemoved?: (item: CanvasItem, point: IdentifiedPoint) => void;
  showPointLabels?: boolean;
  onDeletePoint?: (itemId: string, pointId: string) => void;
  onDeletePointLocal?: (itemId: string, pointId: string) => void;
  onMovePoint?: (itemId: string, pointId: string, ny: number, nx: number) => void;
  onMovePointEnd?: (itemId: string, pointId: string, from: [number, number], to: [number, number]) => void;
  isTextMode?: boolean;
  showGrid?: boolean;
  onZoomToFit?: () => void;
  onCaptureRegion?: (region: Rect, action: 'chat' | 'canvas' | 'translate', capturedImage?: string | null, annotations?: Annotation[]) => void;
  onFloatingAction?: (id: string, action: string) => void;
  expressionState: ExpressionState;
  setExpressionState: (state: ExpressionState) => void;
  topologyState: { itemId: string, isOpen: boolean };
  setTopologyState: (state: { itemId: string, isOpen: boolean }) => void;
  currentEvolutionLevel?: number;
  captureState?: ReturnType<typeof useCaptureManager>;
  onExitToolMode?: () => void;
  activePartId?: string;
  onPartSelect?: (partId: string) => void;
  onCameraChange?: (id: string, spatial: SpatialConfig) => void;
  onLoadParts?: (id: string, parts: string[]) => void;
}

export interface CanvasRef { 
    getMaskData: () => Promise<{ cutout: string, mask: string } | null>;
    clearMask: () => void;
}

const TechnicalOverlay: React.FC<{ items: CanvasItem[], projections: Record<string, {id: string, name: string, x: number, y: number, z: number}[]>, view: ViewState }> = ({ items, projections, view }) => {
    return (
        <svg className="absolute inset-0 pointer-events-none z-40 overflow-visible">
            {items.filter(it => it.type === ItemType.MODEL && it.technicalCallouts).map(it => {
                const parts = (projections[it.id] || [])
                    .filter(p => p.z < 0.999)
                    .sort((a, b) => a.z - b.z)
                    .slice(0, 12);
                
                return parts.map((p, idx) => {
                    const screenX = (it.x + p.x) * view.scale + view.x;
                    const screenY = (it.y + p.y) * view.scale + view.y;
                    
                    const side = idx % 2 === 0 ? 1 : -1;
                    const elbowX = screenX + (60 * view.scale * side);
                    const elbowY = screenY - (60 * view.scale);
                    const tagX = elbowX + (30 * view.scale * side);
                    const tagY = elbowY;

                    return (
                        <g key={`${it.id}-${p.id}`} className="animate-in fade-in duration-500">
                            <circle cx={screenX} cy={screenY} r={4 * view.scale} fill="none" stroke="#6366f1" strokeWidth={1 * view.scale} opacity="0.8" />
                            <circle cx={screenX} cy={screenY} r={1.5 * view.scale} fill="#6366f1" />
                            
                            <path 
                                d={`M ${screenX} ${screenY} L ${elbowX} ${elbowY} L ${tagX} ${tagY}`}
                                fill="none"
                                stroke="#6366f1"
                                strokeWidth={1.5 * view.scale}
                                strokeDasharray={`${4 * view.scale}, ${2 * view.scale}`}
                                opacity="0.5"
                            />
                            
                            <g transform={`translate(${tagX}, ${tagY})`}>
                                <circle r={12 * view.scale} fill="#0c0c0e" stroke="#6366f1" strokeWidth={2 * view.scale} />
                                <text textAnchor="middle" dy={4 * view.scale} fill="white" fontSize={10 * view.scale} fontWeight="900" fontFamily="monospace">{idx + 1}</text>
                                
                                <g transform={`translate(${side > 0 ? 18 * view.scale : -118 * view.scale}, ${-10 * view.scale})`}>
                                    <rect x="0" y="0" width={100 * view.scale} height={20 * view.scale} rx={6 * view.scale} fill="#18181b" opacity="0.9" stroke="#333" strokeWidth={0.5 * view.scale} />
                                    <text x={10 * view.scale} y={13 * view.scale} fill="#a1a1aa" fontSize={9 * view.scale} fontWeight="900" style={{ textTransform: 'uppercase' }}>{p.name.slice(0, 14)}</text>
                                </g>
                            </g>
                        </g>
                    );
                });
            })}
        </svg>
    );
};

const Canvas = forwardRef<CanvasRef, CanvasProps>(({ 
  items, selection, tool, view, setView, setSelection, addItem, updateItem, updateItems,
  onContextMenu, editMode, setEditMode, editTool = 'brush', setEditTool, brushSize = 30, brushColor = '#6366f1', setBrushColor, brushOpacity = 1, setBrushOpacity,
  onSelectItem, onPointPicked, isPickingPoint, onPointTagClick, onPointRemoved,
  isSmartEraserMode, onSmartEraserEnd, setBrushSize,
  showPointLabels = true, onDeletePoint, onDeletePointLocal, onMovePoint, onMovePointEnd, isTextMode,
  showGrid = true, onZoomToFit, onCaptureRegion, onFloatingAction,
  expressionState, setExpressionState, topologyState, setTopologyState, currentEvolutionLevel = 60,
  captureState, onExitToolMode, activePartId, onPartSelect, onCameraChange, onLoadParts
}, ref) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const maskCanvasRef = useRef<MaskCanvasRef>(null);

  const { screenToCanvas, handleScale, handleSize, borderWidth, rotateHandleSize, rotateHandleOffset, rotateIconSize, snapThreshold } = useCanvasMath(view, containerRef);
  const { transforming, snapLines, startTransform, updateTransform, endTransform } = useTransformEngine(items, updateItem, snapThreshold);
  const { annotations, activeTool: activeAnnoTool, setActiveTool: setActiveAnnoTool, isDrawing: isDrawingAnno, addAnnotation, updateCurrentAnnotation, stopDrawing: stopDrawingAnno, clearAnnotations, undoLast: undoLastAnno } = useAnnotations();
  const captureManager = useCaptureManager();
  
  const { isCapturing, captureRect, showCaptureMenu, capturedImage, isGrabbingStream, beginCapture, updateCapture, finishCapture, resetCapture, grabScreenPixels } = captureState || captureManager;

  const { draggingPoint, hoveredPointId, setHoveredPointWithDelay, handleStartDrag, handleDragUpdate, handleDragEnd, hoverTimeoutRef } = useFeaturePointInteraction(onMovePoint, onMovePointEnd);

  const [isPanning, setIsPanning] = useState(false);
  const [panStart, setPanStart] = useState<Point>({ x: 0, y: 0 });
  const [isMarquee, setIsMarquee] = useState(false);
  const [marqueeStart, setMarqueeStart] = useState<Point>({ x: 0, y: 0 });
  const [marqueeEnd, setMarqueeEnd] = useState<Point>({ x: 0, y: 0 });
  const [mouseCanvasPos, setMouseCanvasPos] = useState<Point>({ x: 0, y: 0 });
  const [spacePressed, setSpacePressed] = useState(false);

  const [editingTextId, setEditingTextId] = useState<string | null>(null);
  const textEditorRef = useRef<HTMLTextAreaElement>(null);

  const [projections, setProjections] = useState<Record<string, {id: string, name: string, x: number, y: number, z: number}[]>>({});
  const [partHUD, setPartHUD] = useState<{ partId: string, itemId: string, x: number, y: number } | null>(null);

  const [closedPromptInputId, setClosedPromptInputId] = useState<string | null>(null);

  useEffect(() => {
    if (selection.length !== 1 || selection[0] !== closedPromptInputId) {
      setClosedPromptInputId(null);
    }
  }, [selection, closedPromptInputId]);

  const lastMiddleClickRef = useRef<number>(0);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const handleWheel = (e: WheelEvent) => {
      if (isPanning) return;
      const target = e.target as HTMLElement;
      if (target.closest('.model-viewport-container') || target.closest('.no-canvas-wheel')) return;
      e.preventDefault(); 
      const delta = -e.deltaY;
      const zoomFactor = Math.pow(1.15, delta / 120); 
      setView((prev) => {
        const newScale = Math.min(Math.max(prev.scale * zoomFactor, 0.01), 50);
        const rect = container.getBoundingClientRect();
        const mouseX = e.clientX - rect.left;
        const mouseY = e.clientY - rect.top;
        const newX = mouseX - (mouseX - prev.x) * (newScale / prev.scale);
        const newY = mouseY - (mouseY - prev.y) * (newScale / prev.scale);
        return { scale: newScale, x: newX, y: newY };
      });
    };
    container.addEventListener('wheel', handleWheel, { passive: false });
    return () => container.removeEventListener('wheel', handleWheel);
  }, [setView, isPanning]);

  useEffect(() => {
    const hk = (e: KeyboardEvent) => { if (e.key === ' ' && !['INPUT', 'TEXTAREA'].includes((e.target as HTMLElement).tagName)) setSpacePressed(true); };
    const hku = (e: KeyboardEvent) => { if (e.key === ' ') setSpacePressed(false); };
    window.addEventListener('keydown', hk); window.addEventListener('keyup', hku);
    return () => { window.removeEventListener('keydown', hk); window.removeEventListener('keyup', hku); if (hoverTimeoutRef.current) window.clearTimeout(hoverTimeoutRef.current); };
  }, []);

  useImperativeHandle(ref, () => ({ 
    getMaskData: async () => { if (!maskCanvasRef.current) return null; const cutout = await maskCanvasRef.current.getMaskedImage(); const mask = await maskCanvasRef.current.getSelectionMask(); return (cutout && mask) ? { cutout, mask } : null; },
    clearMask: () => maskCanvasRef.current?.clearMask()
  }));

  const handleMouseDown = (e: React.MouseEvent) => {
    const pos = screenToCanvas(e.clientX, e.clientY);
    if (e.button === 2 && (tool === 'text' || tool === 'point' || tool === 'capture')) { e.preventDefault(); onExitToolMode?.(); return; }
    if (editingTextId) return;
    if (e.button === 1) { 
        e.preventDefault(); const now = Date.now();
        if (now - lastMiddleClickRef.current < 300) { onZoomToFit?.(); setIsPanning(false); lastMiddleClickRef.current = 0; return; }
        lastMiddleClickRef.current = now;
        setIsPanning(true); setPanStart({ x: e.clientX - view.x, y: e.clientY - view.y }); return; 
    }
    if (tool === 'hand' || spacePressed) { e.preventDefault(); setIsPanning(true); setPanStart({ x: e.clientX - view.x, y: e.clientY - view.y }); return; }
    if (tool === 'capture') {
        if (showCaptureMenu && activeAnnoTool !== 'none' && captureRect && pos.x >= captureRect.x && pos.x <= captureRect.x + captureRect.width && pos.y >= captureRect.y && pos.y <= captureRect.y + captureRect.height) {
            if (activeAnnoTool === 'number') addAnnotation('number', pos, (annotations.filter(a => a.type === 'number').length + 1).toString());
            else if (['arrow', 'rectangle', 'circle', 'brush'].includes(activeAnnoTool)) addAnnotation(activeAnnoTool as any, pos);
            return;
        }
        clearAnnotations(); beginCapture(pos); return;
    }
    if (tool === 'text' && !editMode) {
        const clickedTextItem = items.find(it => it.type === ItemType.TEXT && pos.x >= it.x && pos.x <= it.x + it.width && pos.y >= it.y && pos.y <= it.y + it.height);
        if (clickedTextItem) { setSelection([clickedTextItem.id]); return; }
        const newItem: CanvasItem = { id: crypto.randomUUID(), type: ItemType.TEXT, x: pos.x, y: pos.y, width: 240, height: 80, rotation: 0, content: '在此输入内容', status: 'generated', fontSize: 24, fontWeight: '700', textColor: '#18181b' };
        addItem(newItem); setSelection([newItem.id]); return;
    }
    if (editMode) return;
    const isBg = (e.target as HTMLElement).id === 'canvas-bg' || (e.target as HTMLElement).id === 'dot-grid';
    if (isBg && tool === 'select' && e.button === 0) { setPartHUD(null); setIsMarquee(true); setMarqueeStart(pos); setMarqueeEnd(pos); if (!e.shiftKey) setSelection([]); }
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    const pos = screenToCanvas(e.clientX, e.clientY); setMouseCanvasPos(pos);
    if (draggingPoint) handleDragUpdate(pos, items);
    else if (isPanning) setView({ ...view, x: e.clientX - panStart.x, y: e.clientY - panStart.y });
    else if (isCapturing) updateCapture(pos);
    else if (isDrawingAnno) updateCurrentAnnotation(pos);
    else if (isMarquee) { setMarqueeEnd(pos); const x1 = Math.min(marqueeStart.x, pos.x), y1 = Math.min(marqueeStart.y, pos.y), x2 = Math.max(marqueeStart.x, pos.x), y2 = Math.max(marqueeStart.y, pos.y); setSelection(items.filter(i => i.x >= x1 && i.x + i.width <= x2 && i.y >= y1 && i.y + i.height <= y2).map(i => i.id)); }
    else if (transforming) updateTransform(pos);
  };

  const handleMouseUp = (e: React.MouseEvent) => {
    const pos = screenToCanvas(e.clientX, e.clientY);
    if (draggingPoint) handleDragEnd(pos, items);
    if (isCapturing) finishCapture();
    if (isDrawingAnno) stopDrawingAnno();
    setIsPanning(false); setIsMarquee(false); endTransform();
  };

  const sortedItems = useMemo(() => [...items].sort((a, b) => {
      if (a.type === ItemType.FRAME) return -1;
      if (b.type === ItemType.FRAME) return 1;
      return 0;
  }), [items]);
  
  const floatingUIConfig = useMemo(() => {
    if (selection.length === 0) return null;
    const selectedItemsList = items.filter(i => selection.includes(i.id));
    const minL_Y = Math.min(...selectedItemsList.map(it => it.y));
    const maxL_Y = Math.max(...selectedItemsList.map(it => it.y + it.height));
    const minL_X = Math.min(...selectedItemsList.map(it => it.x));
    const maxL_X = Math.max(...selectedItemsList.map(it => it.x + it.width));
    const centerX = minL_X + (maxL_X - minL_X) / 2;
    const screenX = centerX * view.scale + view.x;
    const screenY_Top = minL_Y * view.scale + view.y;
    const screenY_Bottom = maxL_Y * view.scale + view.y;
    const isNearTop = screenY_Top < 100;
    return { screenX, screenY: isNearTop ? screenY_Bottom + 24 : screenY_Top - 24, isNearTop, expressionItem: selection.length === 1 ? selectedItemsList[0] : null };
  }, [selection, items, view.scale, view.x, view.y]);

  const executeCaptureAction = async (action: 'chat' | 'canvas' | 'translate') => {
      if (!captureRect) return;
      let finalImg = capturedImage;
      if (!finalImg) finalImg = await grabScreenPixels(captureRect, view.scale, view.x, view.y);
      onCaptureRegion?.(captureRect, action, finalImg, annotations);
      resetCapture();
  };

  const handleDoubleClick = (item: CanvasItem) => {
      if (item.type === ItemType.TEXT) setEditingTextId(item.id);
      else if (onSelectItem) onSelectItem(item.id);
  };

  const renderTableContent = (item: CanvasItem) => {
      try {
          const rawData = JSON.parse(item.content);
          if (!Array.isArray(rawData)) return item.content;
          const data = rawData as BOMEntry[];
          const modelId = item.links?.[0];
          const modelItem = items.find(i => i.id === modelId);

          const handleRowClick = (partName: string) => {
              if (modelId) {
                  onPartSelect?.(partName);
                  setSelection([modelId]);
              }
          };

          const handleUpdateBOMMaterial = (idx: number, cmfKey: string) => {
              const cmf = (CMF_LIBRARY as any)[cmfKey];
              if (!cmf || !modelId) return;
              const newData = [...data];
              newData[idx].material = cmf.label;
              updateItem(item.id, { content: JSON.stringify(newData) });
              
              const currentCMFMap = modelItem?.partCMFMap || {};
              updateItem(modelId, { 
                  partCMFMap: { ...currentCMFMap, [newData[idx].name]: { ...cmf } } 
              });
          };

          return (
              <div className="w-full bg-[#0c0c0e]/95 backdrop-blur-3xl border border-white/10 rounded-[28px] overflow-hidden shadow-3xl p-6 pointer-events-auto">
                  <div className="flex items-center justify-between mb-6 border-b border-white/5 pb-4">
                      <div className="flex items-center gap-4">
                          <div className="w-10 h-10 rounded-2xl bg-indigo-600/20 flex items-center justify-center">
                              <ListOrderedIcon className="w-5 h-5 text-indigo-400" />
                          </div>
                          <div className="flex flex-col">
                              <span className="text-[12px] font-black text-white uppercase tracking-[0.2em]">交互式 BOM 工程清单</span>
                              <span className="text-[9px] font-bold text-zinc-500 uppercase tracking-widest mt-0.5">Interactive Component Registry</span>
                          </div>
                      </div>
                      <div className="flex items-center gap-2">
                          <button onClick={() => onFloatingAction?.(item.id, 'copy')} className="p-2 text-zinc-500 hover:text-white transition-colors" title="复制 JSON"><RotateCcwIcon className="w-4 h-4" /></button>
                          <button onClick={() => updateItem(item.id, { content: '[]' })} className="p-2 text-zinc-500 hover:text-red-500 transition-colors" title="清空"><TrashIcon className="w-4 h-4" /></button>
                      </div>
                  </div>
                  <div className="max-h-[500px] overflow-y-auto no-scrollbar">
                      <table className="w-full text-left border-collapse">
                          <thead>
                              <tr className="text-[10px] font-black text-zinc-600 uppercase tracking-widest border-b border-white/5">
                                  <th className="py-3 px-4 w-12">#</th>
                                  <th className="py-3 px-4">零件名称 (ID)</th>
                                  <th className="py-3 px-4">材质方案 (CMF)</th>
                                  <th className="py-3 px-4">语义功能描述</th>
                              </tr>
                          </thead>
                          <tbody className="text-[12px] font-bold text-zinc-300">
                              {data.map((row, i) => {
                                  const isActive = activePartId === row.name;
                                  return (
                                      <tr 
                                          key={i} 
                                          onClick={() => handleRowClick(row.name)}
                                          className={`border-b border-white/5 last:border-0 transition-all group cursor-pointer ${isActive ? 'bg-indigo-600/10' : 'hover:bg-white/5'}`}
                                      >
                                          <td className={`py-4 px-4 font-mono transition-colors ${isActive ? 'text-indigo-400' : 'text-zinc-600'}`}>{i+1}</td>
                                          <td className="py-4 px-4 text-white font-black">{row.name}</td>
                                          <td className="py-4 px-4 relative">
                                              <div className="flex items-center gap-2">
                                                  <div className="w-3 h-3 rounded-full border border-white/10" style={{ backgroundColor: Object.values(CMF_LIBRARY).find(c => c.label === row.material)?.color || '#333' }} />
                                                  <span className="opacity-70 group-hover:opacity-100 transition-opacity">{row.material}</span>
                                                  <ChevronDownIcon className="w-3 h-3 opacity-0 group-hover:opacity-40 ml-1" />
                                              </div>
                                          </td>
                                          <td className="py-4 px-4 opacity-50 group-hover:opacity-90 leading-relaxed max-w-[200px]">{row.description}</td>
                                      </tr>
                                  );
                              })}
                          </tbody>
                      </table>
                  </div>
              </div>
          );
      } catch (e) {
          return item.content;
      }
  };

  return (
    <div ref={containerRef} onMouseDown={handleMouseDown} onMouseMove={handleMouseMove} onMouseUp={handleMouseUp} onContextMenu={e => { e.preventDefault(); onContextMenu?.(e); }} id="canvas-bg" className={`relative w-full h-full overflow-hidden select-none bg-[#f4f4f5] dark:bg-[#09090b] ${spacePressed || isPanning ? 'cursor-grabbing' : (tool === 'hand' ? 'cursor-grab' : '')} ${isPickingPoint || tool === 'point' || tool === 'capture' ? 'cursor-crosshair' : ''} ${tool === 'text' ? 'cursor-text' : ''}`}>
      {showGrid && <div id="dot-grid" className="absolute inset-0 pointer-events-none" style={{ backgroundSize: `${20*view.scale}px ${20*view.scale}px`, backgroundPosition: `${view.x}px ${view.y}px`, backgroundImage: `radial-gradient(circle, #27272a 0.5px, transparent 0.5px)` }} />}
      
      <div className="origin-top-left absolute" style={{ transform: `translate(${view.x}px, ${view.y}px) scale(${view.scale})` }}>
        {sortedItems.map(item => {
          const isSel = selection.includes(item.id), isFrame = item.type === ItemType.FRAME;
          const isBeingEdited = editMode && isSel, isBeingTransformed = transforming?.initialItems.some(ti => ti.id === item.id);
          const isTextEditing = editingTextId === item.id;
          const isTable = item.type === ItemType.TEXT && item.content.startsWith('[');

          return (
            <div key={item.id} data-item-id={item.id} className={`absolute group ${isSel ? 'z-50' : (isFrame ? 'z-0' : 'z-10')} ${isBeingTransformed ? 'pointer-events-none' : ''}`} style={{ left: item.x, top: item.y, width: item.width, height: item.height, transform: `rotate(${item.rotation || 0}deg)`, opacity: isBeingTransformed ? 0.6 : 1 }} onDoubleClick={() => !isPickingPoint && handleDoubleClick(item)}>
              {isFrame && <div className="absolute -top-7 left-0 px-2.5 py-1 bg-indigo-500 text-white text-[10px] font-black uppercase rounded-t-lg" style={{ transform: `scale(${handleScale})`, transformOrigin: 'bottom left' }}>{item.content || 'Frame'}</div>}
              <div 
                onMouseDown={e => { 
                    if (e.button !== 0 || editMode || isTextEditing) return; 
                    if (isPickingPoint || tool === 'point') { 
                        e.stopPropagation(); const r = (e.currentTarget as HTMLElement).getBoundingClientRect(); 
                        onPointPicked?.(item.id, ((e.clientY - r.top) / r.height) * 1000, ((e.clientX - r.left) / r.width) * 1000); return; 
                    }
                    if (tool === 'select' || tool === 'text') { e.stopPropagation(); const ns = e.shiftKey ? [...selection, item.id] : (selection.includes(item.id) ? selection : [item.id]); setSelection(ns); startTransform('drag', mouseCanvasPos, ns); } 
                }} 
                className={`w-full h-full relative rounded-xl overflow-hidden ${isSel ? 'border-indigo-500 shadow-xl' : (isFrame ? 'bg-white/5 border-zinc-800' : 'bg-transparent')}`} 
                style={{ borderWidth: (isSel && !isTable) ? `${borderWidth}px` : (isFrame ? `${1*handleScale}px` : 0) }}
              >
                {item.type === ItemType.IMAGE && (item.content ? <img src={item.content} className="w-full h-full object-contain pointer-events-none" /> : (
                  <div className="w-full h-full flex items-center justify-center bg-white relative overflow-hidden">
                    {item.status === 'loading' && (
                       <AntigravityLoading width={item.width} height={item.height} mousePos={{ x: mouseCanvasPos.x - item.x, y: mouseCanvasPos.y - item.y }} />
                    )}
                  </div>
                ))}
                {item.type === ItemType.MODEL && item.modelUrl && (
                  <div className="w-full h-full model-viewport-container" onMouseDown={e => e.stopPropagation()} onMouseMove={e => e.stopPropagation()} onMouseUp={e => e.stopPropagation()}>
                    <ModelViewport 
                        url={item.modelUrl} 
                        viewAngle={item.viewAngle} 
                        explodeFactor={item.explodeFactor} 
                        knollingFactor={item.knollingFactor}
                        activePartId={activePartId}
                        colorSeed={item.colorSeed}
                        partColorMap={item.partColorMap}
                        highlightedPartIds={item.highlightedPartIds || []}
                        hiddenPartIds={item.hiddenPartIds || []}
                        partCMFMap={item.partCMFMap}
                        wireframeMode={item.wireframeMode}
                        showExplodeTrails={item.showExplodeTrails}
                        onPartSelect={onPartSelect}
                        onPartHUD={(pid, pos) => { if(pid) setPartHUD({ partId: pid, itemId: item.id, x: pos.x, y: pos.y }); else setPartHUD(null); }}
                        onProjectedPoints={(proj) => setProjections(prev => ({ ...prev, [item.id]: proj }))}
                        onCameraChange={(s) => onCameraChange?.(item.id, s)}
                        onLoadParts={(p) => onLoadParts?.(item.id, p)}
                        width={item.width}
                        height={item.height}
                        spatialConfig={item.spatialConfig}
                        cameraMode={item.cameraMode}
                    />
                  </div>
                )}
                {item.type === ItemType.VIDEO && <video src={item.content} controls loop muted className="w-full h-full object-contain" />}
                {item.type === ItemType.TEXT && (
                    <div className="w-full h-full flex items-center justify-center p-4">
                        {isTextEditing ? (
                            <textarea autoFocus ref={textEditorRef} className="w-full h-full bg-transparent border-none outline-none resize-none text-center font-bold overflow-hidden" style={{ fontSize: `${item.fontSize || 24}px`, color: item.textColor || '#18181b', lineHeight: '1.2' }} value={item.content} onChange={(e) => updateItem(item.id, { content: e.target.value })} onFocus={(e) => { if (item.content === '在此输入内容') e.target.select(); }} onBlur={() => setEditingTextId(null)} onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); setEditingTextId(null); } }} />
                        ) : isTable ? (
                            renderTableContent(item)
                        ) : (
                            <p className="text-center w-full break-words outline-none select-none" style={{ fontSize: `${item.fontSize || 24}px`, fontWeight: item.fontWeight || 'bold', color: item.textColor || '#18181b' }}>{item.content}</p>
                        )}
                    </div>
                )}
                {isBeingEdited && <MaskCanvas ref={maskCanvasRef} width={item.width} height={item.height} imageSrc={item.content} tool={editTool} brushColor={brushColor} brushSize={brushSize} brushOpacity={brushOpacity} isTextMode={isTextMode} onDrawEnd={isSmartEraserMode ? onSmartEraserEnd : undefined} />}
                {showPointLabels && item.identifiedPoints?.map((pt) => {
                    const px = (pt.x / 1000) * item.width, py = (pt.y / 1000) * item.height;
                    return (
                        <div key={pt.id} className="absolute flex items-center gap-2 group/point" style={{ left: px, top: py }}>
                             <div onMouseDown={e => { if (e.button === 0) { e.stopPropagation(); handleStartDrag(item.id, pt); } }} onMouseEnter={() => setHoveredPointWithDelay(pt.id)} onMouseLeave={() => setHoveredPointWithDelay(null)} onContextMenu={e => { e.preventDefault(); e.stopPropagation(); onDeletePointLocal?.(item.id, pt.id); }} className={`point-trigger absolute -translate-x-1/2 -translate-y-1/2 w-6 h-6 rounded-full border-2 border-white bg-[#5546fe] shadow-lg flex items-center justify-center cursor-grab active:cursor-grabbing transition-all hover:scale-125 z-10 ${pt.isRemoving ? 'bg-red-600' : 'bg-[#5546fe]'}`} style={{ transform: `scale(${handleScale})` }}>
                                <span className="text-[10px] font-black text-white">{pt.label}</span>
                             </div>
                             {hoveredPointId === pt.id && (
                                 <div className="absolute top-4 left-4 bg-zinc-900/90 backdrop-blur-xl text-white p-3 rounded-xl shadow-2xl border border-white/10 min-w-[150px] z-[100] animate-in fade-in zoom-in-95 duration-200" style={{ transform: `scale(${handleScale})`, transformOrigin: 'top left' }}>
                                     <div className="text-[11px] font-black uppercase tracking-widest text-indigo-400 mb-1">Point {pt.label}</div>
                                     <div className="text-[12px] font-bold leading-snug">{pt.description || '特征点'}</div>
                                     <button onMouseDown={e => e.stopPropagation()} onClick={() => onPointTagClick?.(item, pt)} className="mt-3 w-full py-2 bg-indigo-600 hover:bg-indigo-500 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all active:scale-95">作为空间参考</button>
                                 </div>
                             )}
                        </div>
                    );
                })}
              </div>
              {isSel && !editMode && !isBeingTransformed && (tool === 'select' || tool === 'text') && !isTable && ( 
                <> 
                    {['top-left', 'top-right', 'bottom-left', 'bottom-right', 'top', 'bottom', 'left', 'right'].map(h => ( <div key={h} onMouseDown={e => { e.stopPropagation(); startTransform('resize', mouseCanvasPos, [item.id], h); }} className="absolute bg-white z-[90] shadow-xl rounded-full border-blue-500" style={{ width: `${handleSize}px`, height: `${handleSize}px`, borderWidth: `${borderWidth}px`, left: h.includes('left') ? 0 : h.includes('right') ? '100%' : '50%', top: h.includes('top') ? 0 : h.includes('bottom') ? '100%' : '50%', transform: 'translate(-50%, -50%)' }} /> ))} 
                    <div onMouseDown={e => { e.stopPropagation(); startTransform('rotate', mouseCanvasPos, [item.id]); }} className="absolute left-1/2 -translate-x-1/2 bg-white rounded-full flex items-center justify-center cursor-pointer shadow-[0_4px_12px_rgba(0,0,0,0.15)] z-[100]" style={{ width: `${rotateHandleSize}px`, height: `${rotateHandleSize}px`, top: `${rotateHandleOffset}px`, borderWidth: `${borderWidth}px`, borderColor: '#3b82f6' }}> <RotateCcwIcon className="text-blue-500" style={{ width: `${rotateIconSize}px` }} /> </div> 
                </> 
              )}
            </div>
          );
        })}
      </div>

      <div className="absolute inset-0 pointer-events-none z-[1000]">
        <TechnicalOverlay items={items} projections={projections} view={view} />
        
        {floatingUIConfig && !transforming && (tool === 'select' || tool === 'text') && !editingTextId && (
          <div className="absolute left-0 top-0 flex items-start" style={{ transform: `translate3d(${floatingUIConfig.screenX}px, ${floatingUIConfig.screenY}px, 0) translate(-50%, ${floatingUIConfig.isNearTop ? '0' : '-100%'})`, willChange: 'transform' }}>
            <div className="relative flex items-center">
              {!editMode && <FloatingSelectionBar items={items.filter(i => selection.includes(i.id))} onAction={a => onFloatingAction?.(selection[0], a)} />}
              {selection.length === 1 && items.find(i => i.id === selection[0])?.type === ItemType.IMAGE && selection[0] !== closedPromptInputId && !expressionState.isOpen && !topologyState.isOpen && !isSmartEraserMode && (
                <FloatingPromptInput 
                  imageBase64={items.find(i => i.id === selection[0])?.content}
                  onGenerate={(prompt) => onFloatingAction?.(selection[0], `prompt:${prompt}`)} 
                  onClose={() => setClosedPromptInputId(selection[0])}
                  editTool={editTool}
                  setEditTool={setEditTool}
                  setEditMode={setEditMode}
                  brushSize={brushSize}
                  setBrushSize={setBrushSize}
                  brushColor={brushColor}
                  setBrushColor={setBrushColor}
                  brushOpacity={brushOpacity}
                  setBrushOpacity={setBrushOpacity}
                  onUndo={() => maskCanvasRef.current?.undo()}
                  onRedo={() => maskCanvasRef.current?.redo()}
                />
              )}
            </div>
          </div>
        )}

        {floatingUIConfig && isSmartEraserMode && (
          <div className="absolute left-0 top-0 flex items-start z-[2000]" style={{ transform: `translate3d(${floatingUIConfig.screenX}px, ${floatingUIConfig.screenY}px, 0) translate(-50%, ${floatingUIConfig.isNearTop ? '0' : '-100%'})`, willChange: 'transform' }}>
            <div className="flex items-center gap-4 bg-[#0c0c0e]/95 backdrop-blur-2xl border border-white/10 p-3 rounded-[22px] shadow-[0_30px_60px_rgba(0,0,0,0.6)] pointer-events-auto">
              <div className="flex items-center gap-2">
                <EraserIcon className="w-5 h-5 text-indigo-400" />
                <span className="text-white text-sm font-bold">智能橡皮擦</span>
              </div>
              <div className="w-px h-6 bg-white/10" />
              <div className="flex items-center gap-3">
                <span className="text-zinc-400 text-xs">尺寸</span>
                <input 
                  type="range" 
                  min="5" 
                  max="100" 
                  value={brushSize} 
                  onChange={e => setBrushSize?.(parseInt(e.target.value))}
                  className="w-32 accent-indigo-500"
                />
                <span className="text-white text-xs w-6">{brushSize}</span>
              </div>
              <div className="w-px h-6 bg-white/10" />
              <button 
                onClick={() => onExitToolMode?.()}
                className="text-zinc-400 hover:text-white transition-colors"
                title="退出橡皮擦模式"
              >
                <XIcon className="w-5 h-5" />
              </button>
            </div>
          </div>
        )}

        {partHUD && (
          <div 
            className="absolute left-0 top-0 pointer-events-auto bg-[#0c0c0e]/95 backdrop-blur-xl border border-white/10 rounded-2xl shadow-3xl flex flex-col p-1 animate-in zoom-in-95 duration-200"
            style={{ 
                transform: `translate3d(${(items.find(i => i.id === partHUD.itemId)!.x + partHUD.x) * view.scale + view.x + 15}px, ${(items.find(i => i.id === partHUD.itemId)!.y + partHUD.y) * view.scale + view.y}px, 0) translateY(-50%)`,
                width: '160px'
            }}
          >
             <div className="px-3 py-2 border-b border-white/5 mb-1 flex items-center justify-between">
                <span className="text-[9px] font-black text-indigo-400 uppercase tracking-widest truncate max-w-[100px]">{partHUD.partId}</span>
                <XIcon onClick={() => setPartHUD(null)} className="w-3 h-3 text-zinc-600 hover:text-white cursor-pointer" />
             </div>
             <div className="flex flex-col gap-0.5 p-1">
                <button onClick={() => onFloatingAction?.(partHUD.itemId, `model_cmd:隐藏零件 ${partHUD.partId}`)} className="flex items-center gap-2.5 px-3 py-2 hover:bg-white/5 text-zinc-400 hover:text-white rounded-lg transition-all text-[10px] font-bold">
                    <EyeOffIcon className="w-3.5 h-3.5" /> 隐藏此零件
                </button>
                <button onClick={() => onFloatingAction?.(partHUD.itemId, `model_cmd:高亮零件 ${partHUD.partId}`)} className="flex items-center gap-2.5 px-3 py-2 hover:bg-white/5 text-zinc-400 hover:text-white rounded-lg transition-all text-[10px] font-bold">
                    <TargetIcon className="w-3.5 h-3.5" /> 聚焦/高亮
                </button>
                <div className="h-px bg-white/5 my-1 mx-2" />
                <div className="px-2 pb-1 text-[8px] font-black text-zinc-600 uppercase tracking-widest">应用材质</div>
                <div className="grid grid-cols-4 gap-1 px-2 pb-2">
                    {Object.entries(CMF_LIBRARY).slice(0, 8).map(([key, cmf]) => (
                        <button 
                            key={key} 
                            onClick={() => {
                                const item = items.find(i => i.id === partHUD.itemId)!;
                                updateItem(item.id, { partCMFMap: { ...(item.partCMFMap || {}), [partHUD.partId]: { ...cmf as PartCMF } } });
                            }}
                            className="w-6 h-6 rounded-md border border-white/5 transition-all hover:scale-110" 
                            style={{ backgroundColor: (cmf as any).color }}
                        />
                    ))}
                </div>
             </div>
          </div>
        )}

        {showCaptureMenu && captureRect && (
          <div className="absolute p-1.5 bg-[#09090b]/95 backdrop-blur-xl border border-white/10 rounded-[20px] shadow-3xl pointer-events-auto flex flex-col gap-1.5" style={{ left: (captureRect.x + captureRect.width) * view.scale + view.x + 10, top: (captureRect.y + captureRect.height) * view.scale + view.y, transform: 'translateY(-50%)' }}>
            {isGrabbingStream ? (
                <div className="w-10 h-32 flex flex-col items-center justify-center gap-4 bg-white/5 rounded-xl animate-pulse">
                    <RefreshIcon className="w-5 h-5 text-indigo-400 animate-spin" />
                    <span className="text-[8px] font-black text-indigo-400 uppercase vertical-text">Capture</span>
                </div>
            ) : (
                <>
                <div className="flex flex-col gap-1">
                  <button onClick={() => executeCaptureAction('chat')} className="w-10 h-10 flex items-center justify-center bg-[#5546fe] text-white rounded-xl hover:bg-indigo-500 transition-all" title="发送到 Gemini"><MessageCircleIcon className="w-5 h-5" /></button>
                  <button onClick={() => executeCaptureAction('translate')} className="w-10 h-10 flex items-center justify-center text-zinc-400 hover:text-white hover:bg-white/10 rounded-xl transition-all" title="智能翻译 (翻译全屏区域)"><LanguagesIcon className="w-5 h-5" /></button>
                  <button onClick={() => executeCaptureAction('canvas')} className="w-10 h-10 flex items-center justify-center text-zinc-400 hover:text-white hover:bg-white/10 rounded-xl transition-all" title="生成局部变体"><SparklesIcon className="w-5 h-5" /></button>
                </div>
                <div className="h-px bg-white/10 mx-2" />
                <div className="flex flex-col gap-1">
                  <button onClick={() => setActiveAnnoTool('number')} className={`w-10 h-10 flex items-center justify-center rounded-xl transition-all ${activeAnnoTool === 'number' ? 'bg-red-500 text-white' : 'text-zinc-500 hover:bg-white/5'}`} title="序号标注"><span className="text-[11px] font-black">①</span></button>
                  <button onClick={() => setActiveAnnoTool('arrow')} className={`w-10 h-10 flex items-center justify-center rounded-xl transition-all ${activeAnnoTool === 'arrow' ? 'bg-indigo-500 text-white' : 'text-zinc-500 hover:bg-white/5'}`} title="箭头标注"><ArrowIcon className="w-5 h-5" /></button>
                </div>
                <div className="h-px bg-white/10 mx-2" />
                <button onClick={resetCapture} className="w-10 h-10 flex items-center justify-center text-zinc-500 hover:text-red-500 hover:bg-red-500/10 rounded-xl transition-all" title="取消截图"><XIcon className="w-5 h-5" /></button>
                </>
            )}
          </div>
        )}

        {expressionState.isOpen && floatingUIConfig?.expressionItem && (
          <div className="absolute left-0 top-0" style={{ transform: `translate3d(${(floatingUIConfig.expressionItem.x + floatingUIConfig.expressionItem.width + 24) * view.scale + view.x}px, ${(floatingUIConfig.expressionItem.y + floatingUIConfig.expressionItem.height / 2) * view.scale + view.y}px, 0) translateY(-50%)`, willChange: 'transform' }}>
            <ExpressionController item={floatingUIConfig.expressionItem} view={{ x: 0, y: 0, scale: 1 }} onClose={() => setExpressionState({ itemId: '', isOpen: false })} onGenerate={(expressionOrLevel) => onFloatingAction?.(floatingUIConfig.expressionItem!.id, expressionOrLevel)} initialEvolutionLevel={currentEvolutionLevel} />
          </div>
        )}

        {topologyState.isOpen && floatingUIConfig?.expressionItem && (
          <div className="fixed inset-0 flex items-center justify-center z-[2000] bg-black/50 backdrop-blur-sm pointer-events-auto">
            <TopologyPanel 
                item={floatingUIConfig.expressionItem} 
                onClose={() => setTopologyState({ itemId: '', isOpen: false })} 
                onGenerate={(strategies) => onFloatingAction?.(floatingUIConfig.expressionItem!.id, `topology:${strategies.join(',')}`)} 
            />
          </div>
        )}
      </div>

      {isCapturing && captureRect && (
        <div className="absolute border-2 border-indigo-500 bg-indigo-500/5 z-[100] ring-[2000px] ring-black/40" style={{ left: captureRect.x * view.scale + view.x, top: captureRect.y * view.scale + view.y, width: captureRect.width * view.scale, height: captureRect.height * view.scale }} />
      )}

      {isMarquee && <div className="absolute border-2 border-blue-500 bg-blue-500/10 z-[100]" style={{ left: Math.min(marqueeStart.x, marqueeEnd.x) * view.scale + view.x, top: Math.min(marqueeStart.y, marqueeEnd.y) * view.scale + view.y, width: Math.abs(marqueeStart.x - marqueeEnd.x) * view.scale, height: Math.abs(marqueeStart.y - marqueeEnd.y) * view.scale }} />}
      <svg className="absolute inset-0 pointer-events-none z-30" style={{ transform: `translate(${view.x}px, ${view.y}px) scale(${view.scale})` }}>
          <defs><marker id="arrowhead" markerWidth="10" markerHeight="7" refX="0" refY="3.5" orient="auto"><polygon points="0 0, 10 3.5, 0 7" fill="#ef4444" /></marker></defs>
          {snapLines.map((line, i) => ( <line key={i} x1={line.x ?? -10000} y1={line.y ?? -10000} x2={line.x ?? 10000} y2={line.y ?? 10000} stroke="#3b82f6" strokeWidth={2/view.scale} strokeDasharray="4 4" /> ))}
      </svg>
    </div>
  );
});

export default Canvas;