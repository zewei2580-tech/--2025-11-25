
import { useState, useEffect, useRef, useCallback } from 'react';
import React from 'react';
import Canvas, { CanvasRef } from './components/Canvas';
import LeftToolbar from './components/LeftToolbar';
import LayersPanel from './components/LayersPanel';
import HistoryPanel from './components/HistoryPanel';
import PropertiesPanel from './components/PropertiesPanel';
import ContextMenu from './components/ContextMenu';
import BottomBar from './components/BottomBar';
import GeminiChatPanel, { GeminiChatPanelRef } from './components/GeminiChatPanel';
import DesignRecipePanel from './components/DesignRecipePanel';
import TopBar from './components/TopBar';
import ModelViewport from './components/ModelViewport';
import { CanvasItem, ToolType, ViewState, ItemType, EditToolType, GenerationSettings, Segment, IdentifiedPoint, EditSubMode, Rect, ExpressionState, DesignRecipe, Point, ProjectPackage, ResolutionType, SpatialConfig, PartCMF, TopologyStrategy } from './types';
import { generateImage, analyzeImageForPrompt, generateWithReferences, editImage, detectImageJSONSegments, identifyPoint, detectAllPoints, extractDesignRecipe, extractSubjectEssence, generateVisualPeel, autoAlignPoints, generateTopologyVariation, chatWithGemini, parseModelSemanticCommand, generateBOMData, generateVideo } from './services/geminiService';
import { getAllRecipes, saveRecipe, deleteRecipe, getAllPlaystyles, savePlaystyle } from './services/dbService';
import { uploadProjectToCloud, downloadProjectFromCloud } from './services/firebaseService';
import { parseGenerationIntent } from './services/intentParser';
import { useAssetManager } from './hooks/useAssetManager';
import { useHistory } from './hooks/useHistory';
import { useProjectPersistence } from './hooks/useProjectPersistence';
import { useCaptureManager } from './hooks/useCaptureManager';
import { useAnnotations } from './hooks/useAnnotations';
import { STYLES, ASPECT_RATIOS } from './constants';
import { MinusIcon, PlusIcon, FocusIcon, XIcon, SparklesIcon, SlidersIcon, EyeIcon, EyeOffIcon, TypeIcon, VectorIcon, LayoutGridIcon, FlaskIcon, MaximizeIcon, ChevronLeftIcon, ChevronRightIcon, RefreshIcon, DownloadIcon, ImageIcon, UploadIcon, MessageCircleIcon, LanguagesIcon, ArrowIcon, MinimizeIcon } from './components/Icons';

const compressImageForSync = (base64: string, maxDim: number = 800): Promise<string> => {
  return new Promise((resolve) => {
    if (!base64 || !base64.startsWith('data:image')) {
      resolve(base64);
      return;
    }
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      let width = img.width;
      let height = img.height;
      if (width > height) {
        if (width > maxDim) { height *= maxDim / width; width = maxDim; }
      } else {
        if (height > maxDim) { width *= maxDim / height; height = maxDim; }
      }
      const canvas = document.createElement('canvas');
      canvas.width = width; canvas.height = height;
      const ctx = canvas.getContext('2d');
      if (!ctx) { resolve(base64); return; }
      ctx.drawImage(img, 0, 0, width, height);
      resolve(canvas.toDataURL('image/jpeg', 0.7));
    };
    img.onerror = () => resolve(base64);
    img.src = base64;
  });
};

const getClosestAspectRatio = (width: number, height: number): string => {
  const ratio = width / height;
  const targets = ASPECT_RATIOS.map(r => {
    const [w, h] = r.id.split(':').map(Number);
    return { id: r.id, val: w / h };
  });
  return targets.reduce((prev, curr) => Math.abs(curr.val - ratio) < Math.abs(prev.val - ratio) ? curr : prev).id;
};

const App: React.FC = () => {
  const { items, setItems, commit, undo, redo, resetHistory } = useHistory([]);
  const [selection, setSelection] = useState<string[]>([]);
  const [view, setView] = useState<ViewState>({ x: 0, y: 0, scale: 1 });
  
  const [activePartId, setActivePartId] = useState<string | undefined>(undefined);
  const [maximizedModelId, setMaximizedModelId] = useState<string | null>(null);

  const { handleFile, handlePaste, findPlacementSpot, getImageDimensions } = useAssetManager({
    view, items, setItems, setSelection
  });

  useProjectPersistence(items, (loadedItems) => { resetHistory(loadedItems); });

  const [tool, setTool] = useState<ToolType>('select');
  const [showLayers, setShowLayers] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [contextMenu, setContextMenu] = useState<{ isOpen: boolean; x: number; y: number; itemId?: string } | null>(null);
  const [externalRefImage, setExternalRefImage] = useState<string | null>(null);
  const [quickLookItem, setQuickLookItem] = useState<CanvasItem | null>(null);
  const [isPropertiesPanelOpen, setIsPropertiesPanelOpen] = useState(false);
  const [propertyPanelView, setPropertyPanelView] = useState<{view: string, ts: number} | null>(null);
  const [showGrid, setShowGrid] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [isSmartEraserMode, setIsSmartEraserMode] = useState(false);
  const [editTool, setEditTool] = useState<EditToolType>('brush');
  const [brushSize, setBrushSize] = useState(30);
  const [brushColor, setBrushColor] = useState('#ef4444');
  const [brushOpacity, setBrushOpacity] = useState(1);
  const [editSubMode, setEditSubMode] = useState<EditSubMode>('paint');
  const [segments, setSegments] = useState<Segment[]>([]);
  const [isAnalyzingJSON, setIsAnalyzingJSON] = useState(false);
  const [isPickingPoint, setIsPickingPoint] = useState(false);
  const [pickingTargetId, setPickingTargetId] = useState<string | null>(null);
  const [expressionState, setExpressionState] = useState<ExpressionState>({ itemId: '', isOpen: false });
  const [topologyState, setTopologyState] = useState({ itemId: '', isOpen: false });
  const [currentEvolutionLevel, setCurrentEvolutionLevel] = useState(60);
  const [isCncMode, setIsCncMode] = useState(false);
  const [recordingStatus, setRecordingStatus] = useState<'idle' | 'recording' | 'paused'>('idle');
  const [recordingTime, setRecordingTime] = useState(0);
  const [showPointLabels, setShowPointLabels] = useState(true);
  const [isChatPanelExpanded, setIsChatPanelExpanded] = useState(false);

  const captureState = useCaptureManager();
  const { isCapturing, captureRect, showCaptureMenu, isGrabbingStream, capturedImage, grabScreenPixels, resetCapture } = captureState;
  const { annotations, activeTool: activeAnnoTool, setActiveTool: setActiveAnnoTool } = useAnnotations();

  const [recipePanelData, setRecipePanelData] = useState<{ images: string[], instruction: string } | null>(null);
  const [isExtractingRecipe, setIsExtractingRecipe] = useState(false);
  const [recipeRefreshTrigger, setRecipeRefreshTrigger] = useState(0);
  const [playstyleRefreshTrigger, setPlaystyleRefreshTrigger] = useState(0);

  const lastGenerationRef = useRef<{ id: string, prompt?: string, settings?: Partial<GenerationSettings>, refs?: string[] } | null>(null);
  const twinTimerRef = useRef<number | null>(null);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const recordedChunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<number | null>(null);
  
  const canvasRef = useRef<CanvasRef>(null);
  const chatRef = useRef<GeminiChatPanelRef>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const selectedItem = selection.length === 1 ? items.find(it => it.id === selection[0]) || null : null;
  const selectedItems = items.filter(it => selection.includes(it.id));

  useEffect(() => {
    if (selectedItem?.type === ItemType.TEXT) {
        setIsPropertiesPanelOpen(true);
    }
  }, [selectedItem?.id]);

  const handleUpdateItem = useCallback((id: string, updates: Partial<CanvasItem>) => setItems(prev => prev.map(item => item.id === id ? { ...item, ...updates } : item)), [setItems]);
  const handleUpdateItems = useCallback((updates: { id: string, updates: Partial<CanvasItem> }[]) => setItems(prev => { const newItems = [...prev]; updates.forEach(({ id, updates: itemUpdates }) => { const idx = newItems.findIndex(i => i.id === id); if (idx !== -1) newItems[idx] = { ...newItems[idx], ...itemUpdates }; }); return newItems; }), [setItems]);
  const handleDeleteItems = useCallback((ids: string[]) => { const nextItems = items.filter(item => !ids.includes(item.id)); setItems(nextItems); commit(nextItems); setSelection([]); if (maximizedModelId && ids.includes(maximizedModelId)) setMaximizedModelId(null); }, [items, setItems, commit, maximizedModelId]);

  const centerOnItem = useCallback((item: CanvasItem, targetScale?: number) => {
    const scale = targetScale || Math.min(view.scale, 1.0);
    const leftPanelWidth = (showLayers || showHistory) ? 224 + 80 : 80;
    const rightPanelWidth = isPropertiesPanelOpen ? 320 : 80;
    const availableWidth = window.innerWidth - leftPanelWidth - rightPanelWidth;
    const centerX = leftPanelWidth + availableWidth / 2;
    const centerY = window.innerHeight / 2;
    setView({ scale, x: centerX - (item.x + item.width / 2) * scale, y: centerY - (item.y + item.height / 2) * scale });
  }, [view.scale, showLayers, showHistory, isPropertiesPanelOpen, setView]);

  const zoomToFit = useCallback(() => {
    if (items.length === 0) { setView({ x: 0, y: 0, scale: 1 }); return; }
    const minX = Math.min(...items.map(i => i.x)), minY = Math.min(...items.map(i => i.y));
    const maxX = Math.max(...items.map(i => i.x + i.width)), maxY = Math.max(...items.map(i => i.y + i.height));
    const contentWidth = maxX - minX, contentHeight = maxY - minY;
    const padding = 100;
    const leftPanelWidth = (showLayers || showHistory) ? 224 + 80 : 80;
    const rightPanelWidth = isPropertiesPanelOpen ? 320 : 80;
    const availableWidth = window.innerWidth - leftPanelWidth - rightPanelWidth - padding * 2;
    const availableHeight = window.innerHeight - padding * 2;
    const scale = Math.min(availableWidth / contentWidth, availableHeight / contentHeight, 1.5);
    const centerX = leftPanelWidth + (window.innerWidth - leftPanelWidth - rightPanelWidth) / 2;
    const centerY = window.innerHeight / 2;
    setView({ scale, x: centerX - (minX + contentWidth / 2) * scale, y: centerY - (minY + contentHeight / 2) * scale });
  }, [items, showLayers, showHistory, isPropertiesPanelOpen, setView]);

  const handleCopy = useCallback((id?: string | null) => {
    const targetId = id || (selection.length === 1 ? selection[0] : null);
    if (!targetId) return;
    const item = items.find(i => i.id === targetId);
    if (item && item.content) { navigator.clipboard.writeText(item.content); }
  }, [selection, items]);

  const handleDownloadAsset = useCallback((id: string) => {
    const item = items.find(i => i.id === id);
    if (item && item.content) {
      const a = document.createElement('a');
      a.href = item.content;
      a.download = `imagination_${id.slice(0, 8)}.${item.type === ItemType.VIDEO ? 'mp4' : 'png'}`;
      document.body.appendChild(a); a.click(); document.body.removeChild(a);
    }
  }, [items]);

  const handleAddToCanvas = useCallback(async (base64: string, promptText?: string, refId?: string) => {
    const { width, height } = await getImageDimensions(base64);
    const displayWidth = 512;
    const displayHeight = (height * displayWidth) / width;
    const spot = findPlacementSpot(displayWidth, displayHeight, items);
    const newItem: CanvasItem = { id: crypto.randomUUID(), type: ItemType.IMAGE, x: spot.x, y: spot.y, width: displayWidth, height: displayHeight, rotation: 0, content: base64, status: 'generated', prompt: promptText || '', aspectRatio: getClosestAspectRatio(width, height), links: refId ? [refId] : [] };
    const newItems = [...items, newItem];
    setItems(newItems); commit(newItems); setSelection([newItem.id]); centerOnItem(newItem);
  }, [items, findPlacementSpot, getImageDimensions, commit, setItems, setSelection, centerOnItem]);

  const getNextGlobalPointLabel = (items: CanvasItem[]): string => {
    let max = 0;
    items.forEach(it => {
        it.identifiedPoints?.forEach(p => {
            const num = parseInt(p.label, 10);
            if (!isNaN(num) && num > max) max = num;
        });
    });
    return (max + 1).toString();
  };

  const handlePickPoint = async (itemId: string, y: number, x: number) => {
    const item = items.find(i => i.id === itemId);
    if (!item || !item.content) return;
    const currentTemp = 0.8; 
    if (tool === 'point') {
        const nextLabel = getNextGlobalPointLabel(items);
        const newPoint: IdentifiedPoint = { id: crypto.randomUUID(), y, x, label: nextLabel };
        const nextItems = items.map(it => it.id === itemId ? { ...it, identifiedPoints: [...(it.identifiedPoints || []), newPoint] } : it);
        setItems(nextItems); commit(nextItems);
        chatRef.current?.addPointReference(itemId, item.content, nextLabel, [y, x]);
        return;
    }
    try {
        const aiLabel = await identifyPoint(item.content, y, x, currentTemp);
        const nextLabel = getNextGlobalPointLabel(items);
        const newPoint: IdentifiedPoint = { id: crypto.randomUUID(), y, x, label: nextLabel, description: aiLabel };
        const nextItems = items.map(it => it.id === itemId ? { ...it, identifiedPoints: [...(it.identifiedPoints || []), ...[newPoint]] } : it);
        setItems(nextItems); commit(nextItems);
        chatRef.current?.addPointReference(itemId, item.content, nextLabel, [y, x]);
    } catch (e) { console.error(e); }
  };

  const handleStartPickPoint = async (id: string, temperature: number) => {
    const item = items.find(i => i.id === id);
    if (!item || !item.content) return;
    setIsPickingPoint(true);
    setPickingTargetId(id);
    try {
        const rawPoints = await detectAllPoints(item.content, temperature);
        if (!rawPoints || rawPoints.length === 0) {
            alert("未能识别出明显的特征点，请尝试增加解析强度(TEMP)或换一张图片。");
            return;
        }

        let currentGlobalMax = 0;
        items.forEach(it => {
            it.identifiedPoints?.forEach(p => {
                const num = parseInt(p.label, 10);
                if (!isNaN(num) && num > currentGlobalMax) currentGlobalMax = num;
            });
        });

        const newIdentifiedPoints: IdentifiedPoint[] = rawPoints.map((p, idx) => ({
            id: crypto.randomUUID(),
            y: p.point[0],
            x: p.point[1],
            label: (currentGlobalMax + idx + 1).toString(),
            description: p.label
        }));

        const nextItems = items.map(it => it.id === id ? { ...it, identifiedPoints: [...(it.identifiedPoints || []), ...newIdentifiedPoints] } : it);
        setItems(nextItems);
        commit(nextItems); 

        if (chatRef.current) {
            chatRef.current.addBulkPointReferences(id, item.content, rawPoints.map((p, idx) => ({
                label: (currentGlobalMax + idx + 1).toString(),
                point: p.point
            })));
        }
    } catch (e: any) { 
        console.error("Pick Point Error:", e);
        alert(`拾取细节失败: ${e.message || '未知错误'}`);
    } finally { 
        setIsPickingPoint(false); 
        setPickingTargetId(null); 
    }
  };

  const handleGenerate = async (id: string, overridePrompt?: string, settings?: Partial<GenerationSettings>, manualRefs?: string[]) => {
    const rawPrompt = overridePrompt || (items.find(i => i.id === id)?.prompt || "Professional design");
    if (rawPrompt === '__START_PICK_POINT__') { handleStartPickPoint(id, settings?.artisticLevel || 0.8); return; }
    
    lastGenerationRef.current = { id, prompt: overridePrompt, settings, refs: manualRefs };

    const sourceItem = id ? items.find(i => i.id === id) : null; 
    let contextItem: CanvasItem | null = id ? (sourceItem || null) : null;
    const { tasks, isEvolution, level } = parseGenerationIntent(rawPrompt, contextItem, settings);
    if (isEvolution && level !== undefined) setCurrentEvolutionLevel(level);

    let targetW = 512, targetH = 512; 
    let ratioToUse = settings?.ratio || '1:1';
    if (contextItem) { targetW = contextItem.width; targetH = contextItem.height; ratioToUse = contextItem.aspectRatio || ratioToUse; } 
    else if (manualRefs && manualRefs.length > 0) { const dims = await getImageDimensions(manualRefs[0]); targetW = dims.width; targetH = dims.height; ratioToUse = getClosestAspectRatio(dims.width, dims.height); } 
    else { const ratioObj = ASPECT_RATIOS.find(r => r.id === ratioToUse) || ASPECT_RATIOS[0]; targetW = ratioObj.width; targetH = ratioObj.height; }
    
    const styleId = settings?.style || 'industrial'; 
    const styleObj = STYLES.find(s => s.id === styleId) || STYLES[1];
    let recipeTxt = "";
    if (settings?.recipeId) { const recipes = await getAllRecipes(); const targetRecipe = recipes.find(r => r.id === settings.recipeId); if (targetRecipe) recipeTxt = targetRecipe.instruction; }

    const usePro = settings?.usePro ?? (isEvolution || rawPrompt.includes('inference:') || rawPrompt.includes('__VISUAL_PEEL__') || rawPrompt.startsWith('[TOPOLOGY:'));
    const engineName = usePro ? 'Gemini 3 Pro' : 'Flash 2.5';

    let currentTempItems = [...items];
    tasks.forEach((t, nid) => {
        const spot = findPlacementSpot(targetW, targetH, currentTempItems, contextItem, nid);
        const placeholder: CanvasItem = { id: t.nid, type: ItemType.IMAGE, x: spot.x, y: spot.y, width: targetW, height: targetH, rotation: contextItem?.rotation || 0, content: '', status: 'loading', prompt: t.prompt, aspectRatio: ratioToUse, links: contextItem ? [contextItem.id] : [], engine: engineName };
        currentTempItems.push(placeholder);
    });
    setItems(currentTempItems); commit(currentTempItems); setSelection(tasks.map(t => t.nid));

    tasks.forEach(async (task) => {
        try {
            let url: string;
            const currentArtisticLevel = settings?.artisticLevel ?? 50;
            const resolution = settings?.resolution || '1K';

            if (task.prompt.startsWith('[TOPOLOGY:') && contextItem && contextItem.content) {
                url = await generateTopologyVariation(contextItem.content, ratioToUse, styleObj.promptSuffix, settings?.topologyStrategies || [], usePro);
            }
            else if (task.prompt === '__VISUAL_PEEL__' && contextItem && contextItem.content) {
                url = await generateVisualPeel(contextItem.content, ratioToUse, usePro);
            }
            else if (task.infCfg && contextItem && contextItem.content) { 
                url = await generateWithReferences(task.prompt, [{ label: 'Source Volume', base64: contextItem.content }], ratioToUse, styleObj.promptSuffix, currentArtisticLevel, resolution, settings?.spatialConfig || contextItem.spatialConfig, recipeTxt, task.infCfg, usePro); 
            }
            else if (contextItem && contextItem.content) { 
                const isDigitalTwin = (task.prompt === '[TWIN_RENDER]');
                const refs = [{ label: 'Source', base64: contextItem.content }];
                if (task.prompt.includes('[ACTION:TRANSPLANT]')) {
                    const firstPairedPoint = contextItem.identifiedPoints?.find(p => p.pairingId);
                    if (firstPairedPoint) { const styleRef = items.find(si => si.id === firstPairedPoint.pairingSourceItemId); if (styleRef?.content) refs.push({ label: 'Aesthetic Reference', base64: styleRef.content }); }
                }
                
                if (isDigitalTwin) {
                   url = await generateImage(contextItem.prompt || "Professional industrial design", styleObj.promptSuffix, ratioToUse, 50, '1K', contextItem.spatialConfig, recipeTxt, true, true, contextItem.content);
                } else {
                   url = await generateWithReferences(task.prompt, refs, ratioToUse, styleObj.promptSuffix, currentArtisticLevel, resolution, settings?.spatialConfig || contextItem.spatialConfig, recipeTxt, task.infCfg, usePro); 
                }
            }
            else if (manualRefs && manualRefs.length > 0) { 
                const refs = manualRefs.map((r, nid) => ({ label: `Ref ${nid}`, base64: r })); 
                url = await generateWithReferences(task.prompt, refs, ratioToUse, styleObj.promptSuffix, currentArtisticLevel, resolution, settings?.spatialConfig, recipeTxt, task.infCfg, usePro); 
            }
            else { 
                url = await generateImage(task.prompt, styleObj.promptSuffix, ratioToUse, currentArtisticLevel, resolution, settings?.spatialConfig, recipeTxt, usePro); 
            }
            
            const { width, height } = await getImageDimensions(url); 
            setItems(prev => prev.map(i => i.id === task.nid ? { ...i, content: url, status: 'generated', height: (height * i.width) / width, aspectRatio: getClosestAspectRatio(width, height) } : i));
        } catch (e: any) { setItems(prev => prev.map(i => i.id === task.nid ? { ...i, status: 'error' } : i)); }
    });
  };

  const captureModelSnapshot = (itemId: string): string | null => {
    const el = document.querySelector(`[data-item-id="${itemId}"] canvas`);
    if (el instanceof HTMLCanvasElement) return el.toDataURL('image/png');
    return null;
  };

  const handleDigitalTwinSync = useCallback(async (modelId: string) => {
    const model = items.find(i => i.id === modelId);
    if (!model || !model.twinEnabled) return;
    
    const snapshot = captureModelSnapshot(modelId);
    if (!snapshot) return;

    let twinItem = model.twinItemId ? items.find(i => i.id === model.twinItemId) : null;
    if (!twinItem) {
        const spot = findPlacementSpot(model.width, model.height, items, model);
        twinItem = { 
            id: crypto.randomUUID(), 
            type: ItemType.IMAGE, 
            x: spot.x, 
            y: spot.y, 
            width: model.width, 
            height: model.height, 
            rotation: model.rotation, 
            content: '', 
            status: 'loading', 
            links: [model.id],
            prompt: `Digital Twin for ${model.content || 'Model'}`
        };
        handleUpdateItem(model.id, { twinItemId: twinItem.id });
        setItems(prev => [...prev, twinItem!]);
    }

    handleUpdateItem(twinItem.id, { status: 'loading', spatialConfig: model.spatialConfig });
    
    try {
        const styleSuffix = STYLES[1].promptSuffix;
        const url = await generateImage(model.prompt || "Industrial design", styleSuffix, model.aspectRatio || '1:1', 50, '1K', model.spatialConfig, undefined, true, true, snapshot);
        const { width, height } = await getImageDimensions(url);
        handleUpdateItem(twinItem.id, { content: url, status: 'generated', height: (height * twinItem.width) / width });
    } catch (e) {
        handleUpdateItem(twinItem.id, { status: 'error' });
    }
  }, [items, handleUpdateItem, findPlacementSpot, getImageDimensions]);

  useEffect(() => {
    if (selectedItem?.type === ItemType.MODEL && selectedItem.twinEnabled) {
        if (twinTimerRef.current) window.clearTimeout(twinTimerRef.current);
        twinTimerRef.current = window.setTimeout(() => {
            handleDigitalTwinSync(selectedItem.id);
        }, 1200);
    }
    return () => { if (twinTimerRef.current) window.clearTimeout(twinTimerRef.current); };
  }, [selectedItem?.spatialConfig, selectedItem?.partCMFMap, selectedItem?.explodeFactor, selectedItem?.hiddenPartIds]);

  const handleFrameAction = useCallback(async (frameId: string, action: 'merge' | 'expand' | 'crop') => {
    const frame = items.find(i => i.id === frameId);
    if (!frame || frame.type !== ItemType.FRAME) return;
    const children = items.filter(it => it.id !== frame.id && it.type === ItemType.IMAGE && it.content && (it.x + it.width/2) >= frame.x && (it.x + it.width/2) <= frame.x + frame.width && (it.y + it.height/2) >= frame.y && (it.y + it.height/2) <= frame.y + frame.height);
    if (action === 'merge') {
        if (children.length === 0) { alert("画框内没有可融合的图像。"); return; }
        const refs = children.map((c, nid) => ({ label: `Subject ${nid + 1}`, base64: c.content }));
        const prompt = frame.prompt || "Seamless scene integration with consistent lighting and shadows.";
        const ratio = getClosestAspectRatio(frame.width, frame.height);
        const nid = crypto.randomUUID();
        const placeholder: CanvasItem = { id: nid, type: ItemType.IMAGE, x: frame.x, y: frame.y, width: frame.width, height: frame.height, rotation: 0, content: '', status: 'loading', prompt, links: children.map(c => c.id) };
        const nextItems = [...items, placeholder];
        setItems(nextItems); commit(nextItems); setSelection([nid]);
        try {
            const url = await generateWithReferences(prompt, refs, ratio, STYLES[1].promptSuffix, 0.8, '1K');
            setItems(prev => prev.map(i => i.id === nid ? { ...i, content: url, status: 'generated' } : i));
        } catch (e) { setItems(prev => prev.map(i => i.id === nid ? { ...i, status: 'error' } : i)); }
    } else if (action === 'expand') {
        if (children.length === 0) { alert("请在画框内放置至少一张参考图进行扩展。"); return; }
        const main = children[0];
        const ratio = getClosestAspectRatio(frame.width, frame.height);
        handleGenerate(main.id, "Expand the background seamlessly to fit the framing. Maintain core product structure.", { ratio });
    } else if (action === 'crop') {
        if (children.length === 0) return;
        const target = children[0];
        const nextItems = items.map(it => it.id === target.id ? { ...it, x: frame.x, y: frame.y, width: frame.width, height: frame.height } : it).filter(it => it.id !== frame.id);
        setItems(nextItems); commit(nextItems); setSelection([target.id]);
    }
  }, [items, commit, handleGenerate, setItems]);

  const handleCaptureRegion = useCallback(async (region: Rect, action: 'chat' | 'canvas' | 'translate', capturedImage?: string | null, annotations?: any[]) => {
    const overlappingItems = items.filter(i => i.x < region.x + region.width && i.x + i.width > region.x && i.y < region.y + region.height && i.y + i.height > region.y);
    const finalData = capturedImage || (overlappingItems.length > 0 ? overlappingItems[0].content : null);
    if (!finalData) { alert("无法捕获到有效的图像内容。请重试。"); return; }
    if (action === 'chat' && chatRef.current) chatRef.current.addExternalAttachment('screenshot', finalData);
    else if (action === 'translate' && chatRef.current) { chatRef.current.addExternalAttachment('screenshot', finalData); alert("已截图并发送至 Gemini。请直接在对话框输入：'翻译图中的文字'。"); }
    else if (action === 'canvas') {
        const spot = findPlacementSpot(512, 512, items);
        const screenshotItem: CanvasItem = { id: crypto.randomUUID(), type: ItemType.IMAGE, x: spot.x, y: spot.y, width: 512, height: 512, rotation: 0, content: finalData, status: 'generated', prompt: "Screenshot Fragment" };
        const next = [...items, screenshotItem];
        setItems(next);
        handleGenerate(screenshotItem.id, "Visual variation of this screen fragment");
    }
    setTool('select');
  }, [items, findPlacementSpot, handleGenerate, setItems]);

  const handleApplyEdit = useCallback(async (prompt: string) => {
    if (!selectedItem || !canvasRef.current) return;
    const maskData = await canvasRef.current.getMaskData();
    if (!maskData) { alert("请先涂抹需要修改的区域"); return; }
    
    const targetW = selectedItem.width;
    const targetH = selectedItem.height;
    const spot = findPlacementSpot(targetW, targetH, items, selectedItem);
    
    const nid = crypto.randomUUID();
    const usePro = true;
    const engineName = usePro ? 'Gemini 3 Pro' : 'Flash 2.5';
    
    const placeholder: CanvasItem = { 
        ...selectedItem, 
        id: nid, 
        x: spot.x, 
        y: spot.y, 
        content: '', 
        status: 'loading', 
        prompt: prompt, 
        links: [selectedItem.id], 
        engine: engineName 
    };
    
    const nextItems = [...items, placeholder];
    setItems(nextItems); commit(nextItems); setSelection([nid]);
    try {
      const url = await editImage(selectedItem.content, prompt, selectedItem.aspectRatio || '1:1', maskData.mask, usePro);
      const { width, height } = await getImageDimensions(url);
      setItems(prev => prev.map(i => i.id === nid ? { ...i, content: url, status: 'generated', height: (height * i.width) / width, aspectRatio: getClosestAspectRatio(width, height) } : i));
    } catch (e) { setItems(prev => prev.map(i => i.id === nid ? { ...i, status: 'error' } : i)); }
  }, [selectedItem, items, commit, getImageDimensions, setItems, findPlacementSpot]);

  const handleJSONAnalysis = useCallback(async (id: string) => {
    const item = items.find(i => i.id === id); if (!item || !item.content) return;
    setIsAnalyzingJSON(true);
    try { const result = await detectImageJSONSegments(item.content); if (result.segments) setSegments(result.segments); } 
    catch (e) { console.error("JSON Analysis failed", e); } finally { setIsAnalyzingJSON(false); }
  }, [items]);

  const handleUpdatePoint = useCallback((itemId: string, pointId: string, updates: Partial<IdentifiedPoint>) => {
    setItems(prev => prev.map(it => it.id === itemId ? { ...it, identifiedPoints: it.identifiedPoints?.map(p => p.id === pointId ? { ...p, ...updates } : p) } : it));
  }, [setItems]);

  const handleClearAllPoints = useCallback((itemId: string) => {
    if (window.confirm("确定要清空该图片的所有特征点吗？")) { 
        const nextItems = items.map(it => it.id === itemId ? { ...it, identifiedPoints: [] } : it);
        setItems(nextItems); commit(nextItems);
    }
  }, [items, commit, setItems]);

  const handleCommitPointChanges = useCallback(async (itemId: string) => {
    const item = items.find(i => i.id === itemId); if (!item || !item.content) return;
    const points = item.identifiedPoints || [];
    const paired = points.filter(p => p.pairingId);
    if (paired.length > 0) { handleGenerate(itemId, `[ACTION:TRANSPLANT] Precise design transplant using mapped keypoints.`); return; }
    const modified = points.filter(p => p.modifiedDescription || p.isRemoving);
    if (modified.length > 0) {
      const restructureInstructions = modified.map(p => {
        if (p.isRemoving) return `- Anchor Point [${p.label}] at Normalized Coordinate [y=${Math.round(p.y)}, x=${Math.round(p.x)}]: MANDATORY REMOVAL. Heal surrounding surface topology naturally.`;
        return `- Anchor Point [${p.label}] at Normalized Coordinate [y=${Math.round(p.y)}, x=${Math.round(p.x)}]: OVERRIDE with "${p.modifiedDescription}". Recalculate material and geometric detail.`;
      }).join('\n');
      const finalPrompt = `[SEMANTIC RESTRUCTURE PROTOCOL]:\nMANDATE: Prioritize the following semantic overrides over the existing image pixel values at the specified anchor locations.\nINSTRUCTIONS:\n${restructureInstructions}\nTECHNICAL SPEC: Maintain 100% silhouette consistency. Execute pixel-level semantic replacement.`;
      handleGenerate(itemId, finalPrompt, { artisticLevel: 80, usePro: true }); 
    }
  }, [items, handleGenerate]);

  const handleAutoAlignPoints = useCallback(async (sourceId: string, targetId: string) => {
    const sourceItem = items.find(i => i.id === sourceId);
    const targetItem = items.find(i => i.id === targetId);
    if (!sourceItem?.content || !targetItem?.content) return;
    try {
      const alignment = await autoAlignPoints(
        sourceItem.content, 
        sourceItem.identifiedPoints || [], 
        targetItem.content, 
        targetItem.identifiedPoints || []
      );
      setItems(prev => prev.map(it => { 
        if (it.id === targetId) { 
          const nextPoints = it.identifiedPoints?.map(p => { 
            const match = alignment.find(a => a.targetId === p.id); 
            return match ? { ...p, pairingId: match.sourceId, pairingSourceItemId: sourceId } : p; 
          }); 
          return { ...it, identifiedPoints: nextPoints }; 
        } 
        return it; 
      }));
    } catch (e) { console.error("Auto align failed", e); }
  }, [items, setItems]);

  const handleFloatingAction = async (id: string, action: string) => {
    if (action === 'open_playstyles') { window.dispatchEvent(new Event('open_playstyles')); return; }
    
    const currentSelectedItems = items.filter(i => selection.includes(i.id)); 
    const firstItem = currentSelectedItems[0]; 
    if (!firstItem) {
      if (action === 'topology_variation' || action === 'expression' || action === 'extract_recipe') {
        alert("请先选择一张图片或模型");
      }
      return;
    }
    
    if (action.startsWith('expr:')) { handleGenerate(firstItem.id, `Change to ${action.split(':')[1]}`); setExpressionState({ itemId: '', isOpen: false }); return; }
    if (action.startsWith('topology:')) { 
      const strategies = action.split(':')[1].split(',') as TopologyStrategy[]; 
      handleGenerate(firstItem.id, `[TOPOLOGY: ${strategies.join(', ')}]`, { topologyStrategies: strategies, usePro: true }); 
      setTopologyState({ itemId: '', isOpen: false }); 
      return; 
    }
    if (action.startsWith('evolve_with_level:')) { const level = parseInt(action.split(':')[1]); setCurrentEvolutionLevel(level); handleGenerate(firstItem.id, `__EVOLUTION__|${level}${isCncMode ? '|CNC' : ''}`); setExpressionState({ itemId: '', isOpen: false }); return; }
    if (action.startsWith('prompt:')) { const prompt = action.substring(7); handleGenerate(firstItem.id, prompt); return; }

    if (action === 'twin_render_manual') { handleDigitalTwinSync(firstItem.id); return; }
    if (action === 'world_sim_video') {
        const snapshot = captureModelSnapshot(firstItem.id);
        if (!snapshot) return;
        const nid = crypto.randomUUID();
        const spot = findPlacementSpot(910, 512, items, firstItem);
        const placeholder: CanvasItem = { id: nid, type: ItemType.VIDEO, x: spot.x, y: spot.y, width: 910, height: 512, rotation: 0, content: '', status: 'loading', links: [firstItem.id], prompt: firstItem.worldSimPrompt };
        setItems(prev => [...prev, placeholder]);
        try {
            const videoUrl = await generateVideo(firstItem.worldSimPrompt || "Product demonstration", snapshot);
            handleUpdateItem(nid, { content: videoUrl, status: 'generated' });
        } catch (e) { handleUpdateItem(nid, { status: 'error' }); }
        return;
    }

    if (action.startsWith('model_cmd:')) {
        const fullCmd = action.split(':')[1].trim();
        const targetId = firstItem.id;
        const modelParts = firstItem.partList || [];
        
        try {
            const result = await parseModelSemanticCommand(fullCmd, modelParts);
            const updates: Partial<CanvasItem> = {};
            const findMatchedParts = (targets: string[]) => {
                const matched: string[] = [];
                targets.forEach(t => {
                    const normalizedT = t.toLowerCase().replace(/[^a-z0-9]/g, '');
                    modelParts.forEach(p => {
                        const normalizedP = p.toLowerCase().replace(/[^a-z0-9]/g, '');
                        if (normalizedP.includes(normalizedT) || normalizedT.includes(normalizedP)) matched.push(p);
                    });
                });
                return Array.from(new Set(matched));
            };

            if (result.action === 'paint' && result.targets) {
                const currentCMF = firstItem.partCMFMap || {};
                const newCMF = { ...currentCMF };
                const matchedParts = findMatchedParts(result.targets);
                matchedParts.forEach(p => { newCMF[p] = { ...newCMF[p], color: result.params?.color, metalness: result.params?.metalness, roughness: result.params?.roughness, emissiveIntensity: result.params?.emissiveIntensity || 0 }; });
                updates.partCMFMap = newCMF; updates.highlightedPartIds = matchedParts;
            } else if (result.action === 'highlight' && result.targets) {
                updates.highlightedPartIds = findMatchedParts(result.targets);
                if (result.targets.some(t => t.includes('所有') || t.includes('all'))) updates.highlightedPartIds = [...modelParts];
            } else if (result.action === 'hide' || fullCmd.includes('隐藏')) {
                const matchedParts = result.targets ? findMatchedParts(result.targets) : findMatchedParts([fullCmd.split('零件')[1]?.trim() || '']);
                const currentHidden = firstItem.hiddenPartIds || [];
                updates.hiddenPartIds = Array.from(new Set([...currentHidden, ...matchedParts]));
            } else if (result.action === 'explode') {
                updates.explodeFactor = Math.min(1.0, Math.max(0, (result.params?.explodeFactor || 0.5)));
            } else if (result.action === 'view' && result.params?.spatialConfig) {
                updates.spatialConfig = { ...firstItem.spatialConfig, ...result.params.spatialConfig } as SpatialConfig;
                updates.cameraMode = 'orthographic';
            } else if (result.action === 'reset') {
                updates.partCMFMap = {}; updates.highlightedPartIds = []; updates.hiddenPartIds = []; updates.explodeFactor = 0; updates.viewAngle = 'perspective';
            }

            setItems(currentItems => {
                const nextItems = currentItems.map(it => it.id === targetId ? { ...it, ...updates } : it);
                commit(nextItems); 
                return nextItems;
            });
            if (firstItem.twinEnabled) {
                setTimeout(() => handleDigitalTwinSync(targetId), 500);
            }
        } catch (e) {
            if (fullCmd.toLowerCase().includes('爆炸') || fullCmd.toLowerCase().includes('explode')) {
                const matches = fullCmd.match(/\d+/);
                const val = matches ? Math.min(100, Math.max(0, parseInt(matches[0]))) / 100 : 0.5;
                setItems(currentItems => { 
                    const nextItems = currentItems.map(it => it.id === targetId ? { ...it, explodeFactor: val } : it); 
                    commit(nextItems); 
                    return nextItems; 
                });
                if (firstItem.twinEnabled) setTimeout(() => handleDigitalTwinSync(targetId), 500);
            }
        }
        return;
    }

    switch(action) {
      case 'maximized_3d': {
          setMaximizedModelId(maximizedModelId === firstItem.id ? null : firstItem.id);
          break;
      }
      case 'generate_bom': {
          if (firstItem.type !== ItemType.MODEL) return;
          const parts = firstItem.partList || [];
          if (parts.length === 0) { alert("零件列表加载中，请稍后..."); return; }
          try {
              const bomData = await generateBOMData(parts);
              const bomJSON = JSON.stringify(bomData);
              const spot = findPlacementSpot(600, 400, items, firstItem);
              const bomItem: CanvasItem = { id: crypto.randomUUID(), type: ItemType.TEXT, x: spot.x, y: spot.y, width: 600, height: 400, rotation: 0, content: bomJSON, status: 'generated', links: [firstItem.id] };
              const next = [...items, bomItem]; setItems(next); commit(next); setSelection([bomItem.id]);
          } catch (e) { alert("BOM 生成失败"); }
          break;
      }
      case 'redo': {
        if (lastGenerationRef.current) { const { id: gid, prompt: gprompt, settings: gsettings, refs: grefs } = lastGenerationRef.current; handleGenerate(gid, gprompt, gsettings, grefs); } 
        else if (firstItem.prompt) handleGenerate(firstItem.id, firstItem.prompt);
        break;
      }
      case 'extract_recipe': {
          const imageItems = currentSelectedItems.filter(it => it.type === ItemType.IMAGE && it.content);
          if (imageItems.length < 1) { alert("请至少选择一张图片来提取食谱。"); return; }
          setIsExtractingRecipe(true);
          try { const images = imageItems.map(it => it.content); const logic = await extractDesignRecipe(images, 0); setRecipePanelData({ images, instruction: logic }); } 
          catch (e) { alert("食谱提取失败，请重试。"); } finally { setIsExtractingRecipe(false); }
          break;
      }
      case 'open_playstyles': window.dispatchEvent(new Event('open_playstyles')); break;
      case 'evolve': handleGenerate(firstItem.id, `__EVOLUTION__|${currentEvolutionLevel}${isCncMode ? '|CNC' : ''}`); setExpressionState({ itemId: '', isOpen: false }); break;
      case 'expression': setExpressionState({ itemId: firstItem.id, isOpen: true }); break;
      case 'topology_variation': setTopologyState({ itemId: firstItem.id, isOpen: true }); break;
      case 'variation': handleGenerate(firstItem.id, '[TOPOLOGY: VARIATION]'); break;
      case 'smart_eraser':
        setEditMode(true);
        setIsSmartEraserMode(true);
        setEditTool('brush'); // We use brush to draw the mask for erasing
        setBrushSize(30);
        break;
      case 'upscale': handleGenerate(firstItem.id, 'UPSCALE TO 4K', { resolution: '4K', usePro: true }); break;
      case 'edit': 
        setEditMode(true); 
        setIsSmartEraserMode(false);
        setIsPropertiesPanelOpen(true); 
        setPropertyPanelView({ view: 'edit_area', ts: Date.now() }); 
        break;
      case 'delete': handleDeleteItems(selection); break;
      case 'copy': handleCopy(firstItem.id); break;
      case 'download': handleDownloadAsset(firstItem.id); break;
      case 'part_knolling': {
          if (firstItem.type !== ItemType.MODEL) return;
          const snapshot = captureModelSnapshot(firstItem.id);
          const partsStr = firstItem.partList?.join(', ') || "internal mechanical parts, sensors, and structural components";
          const knollingPrompt = `Professional industrial design knolling photography. Neatly arranged individual components of a ${firstItem.content || 'product'}: ${partsStr}. Consistent studio lighting, top-down orthographic view, components laid out in a perfect grid on a clean white technical background. Material semantics consistent with the master product. High precision CMF.`;
          handleGenerate(firstItem.id, knollingPrompt, { ratio: '16:9' }, snapshot ? [snapshot] : []);
          break;
      }
      case 'auto_staging': {
          if (firstItem.type !== ItemType.MODEL || !firstItem.modelUrl) return;
          const gap = 40, size = firstItem.width, startX = firstItem.x, startY = firstItem.y;
          const stagingConfigs: { angle: any, x: number, y: number, spatial: SpatialConfig }[] = [
            { angle: 'top', x: startX + size + gap, y: startY, spatial: { azimuth: 0, elevation: 89, distance: 12, fov: 45 } },
            { angle: 'front', x: startX, y: startY + size + gap, spatial: { azimuth: 0, elevation: 0, distance: 12, fov: 45 } },
            { angle: 'side', x: startX + size + gap, y: startY + size + gap, spatial: { azimuth: 90, elevation: 0, distance: 12, fov: 45 } },
          ];
          const newItems = stagingConfigs.map(cfg => ({ ...firstItem, id: crypto.randomUUID(), x: cfg.x, y: cfg.y, viewAngle: cfg.angle, cameraMode: 'orthographic' as const, spatialConfig: cfg.spatial, explodeFactor: firstItem.explodeFactor || 0 })) as CanvasItem[];
          const nextItems = [...items, ...newItems]; setItems(nextItems); commit(nextItems); setSelection([firstItem.id, ...newItems.map(n => n.id)]);
          break;
      }
    }
  };

  const handleCloudSave = useCallback(async () => {
    try {
        const processedItems = await Promise.all(items.map(async (it) => { if (it.type === ItemType.IMAGE && it.content.startsWith('data:')) { const compressed = await compressImageForSync(it.content); return { ...it, content: compressed }; } return it; }));
        const recipes = await getAllRecipes(), playstyles = await getAllPlaystyles();
        const pkg: ProjectPackage = { version: "1.1", timestamp: Date.now(), items: processedItems, view, recipes, playstyles };
        await uploadProjectToCloud(pkg); alert("✅ 云备份成功！（包含画布、食谱及玩法库）");
    } catch (e: any) { alert(e.message || "云保存失败"); }
  }, [items, view]);

  const handleCloudLoad = useCallback(async () => {
    try { 
        const pkg = await downloadProjectFromCloud(); resetHistory(pkg.items); 
        if (pkg.view) setView(pkg.view); 
        if (pkg.recipes) { for (const r of pkg.recipes) await saveRecipe(r); setRecipeRefreshTrigger(prev => prev + 1); }
        if (pkg.playstyles) { for (const ps of pkg.playstyles) await savePlaystyle(ps); setPlaystyleRefreshTrigger(prev => prev + 1); }
        setSelection([]); setTimeout(() => zoomToFit(), 100); 
    } catch (e: any) { throw e; }
  }, [resetHistory, setView, zoomToFit]);

  const handleExportProject = useCallback(async () => {
    const recipes = await getAllRecipes(), playstyles = await getAllPlaystyles();
    const pkg: ProjectPackage = { version: "1.1", timestamp: Date.now(), items, view, recipes, playstyles };
    const blob = new Blob([JSON.stringify(pkg)], { type: 'application/json' }), url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = `Infinite_Imagination_Full_${Date.now()}.json`; a.click(); URL.revokeObjectURL(url);
  }, [items, view]);

  const handleImportProject = useCallback((file: File) => {
    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const pkg = JSON.parse(e.target?.result as string) as ProjectPackage;
        if (pkg.items && Array.isArray(pkg.items)) { 
            resetHistory(pkg.items); if (pkg.view) setView(pkg.view); 
            if (pkg.recipes) { for (const r of pkg.recipes) await saveRecipe(r); setRecipeRefreshTrigger(prev => prev + 1); }
            if (pkg.playstyles) { for (const ps of pkg.playstyles) await savePlaystyle(ps); setPlaystyleRefreshTrigger(prev => prev + 1); }
            setSelection([]); setEditMode(false); 
        } else alert("无效的存档文件格式。");
      } catch (err) { alert("导入失败，请检查 JSON 格式。"); }
    };
    reader.readAsText(file);
  }, [resetHistory, setView]);

  const handleExportRecipes = async () => {
    const recipes = await getAllRecipes();
    const blob = new Blob([JSON.stringify(recipes)], { type: 'application/json' }), url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = `Design_Recipes_${Date.now()}.json`; a.click(); URL.revokeObjectURL(url);
  };

  const handleImportRecipes = async (file: File) => {
    const reader = new FileReader();
    reader.onload = async (e) => {
        try {
            const parsed = JSON.parse(e.target?.result as string), data = Array.isArray(parsed) ? parsed : [parsed];
            for (const r of data) {
                const instructionText = r.instruction || r.prompt || "";
                if (r.name && instructionText) {
                    await saveRecipe({ 
                        ...r, 
                        instruction: instructionText,
                        id: r.id || crypto.randomUUID(), 
                        createdAt: r.createdAt || Date.now() 
                    });
                }
            } 
            setRecipeRefreshTrigger(prev => prev + 1); 
            alert(`✅ 成功导入 ${data.length} 个设计食谱！`);
        } catch (err) { alert("食谱导入失败，请检查文件格式。"); }
    };
    reader.readAsText(file);
  };

  const handleSpatialNavigate = useCallback((direction: string) => {
    const activeId = quickLookItem?.id || (selection.length === 1 ? selection[0] : null);
    if (!activeId) return;
    const current = items.find(i => i.id === activeId); if (!current) return;
    const candidates = items.filter(i => { if (i.id === activeId || i.type === ItemType.FRAME || !i.content) return false; const cx = i.x + i.width/2, cy = i.y + i.height/2, curX = current.x + current.width/2, curY = current.y + current.height/2; if (direction === 'ArrowRight') return cx > curX + 10; if (direction === 'ArrowLeft') return cx < curX - 10; if (direction === 'ArrowUp') return cy < curY - 10; if (direction === 'ArrowDown') return cy > curY + 10; return false; });
    const next = candidates.sort((a, b) => { const curX = current.x + current.width/2, curY = current.y + current.height/2, da = Math.hypot((a.x + a.width/2) - curX, (a.y + a.height/2) - curY), db = Math.hypot((b.x + b.width/2) - curX, (b.y + b.height/2) - curY); return da - db; })[0];
    if (next) { if (quickLookItem) setQuickLookItem(next); else { setSelection([next.id]); centerOnItem(next); } }
  }, [items, quickLookItem, selection, centerOnItem]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement; if (target.tagName?.toUpperCase() === 'INPUT' || target.tagName?.toUpperCase() === 'TEXTAREA' || target.isContentEditable) return;
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') { e.preventDefault(); if (e.shiftKey) redo(); else undo(); return; }
      if (e.key === 'Delete' || e.key === 'Backspace') { if (selection.length > 0) handleDeleteItems(selection); }
      if (e.key === ' ') { e.preventDefault(); if (quickLookItem) setQuickLookItem(null); else if (selectedItem) setQuickLookItem(selectedItem); }
      if (e.key === 'Escape') { if (maximizedModelId) setMaximizedModelId(null); else if (quickLookItem) setQuickLookItem(null); else if (editMode) { setEditMode(false); setIsSmartEraserMode(false); setPropertyPanelView({ view: 'main', ts: Date.now() }); } else if (isPickingPoint) setIsPickingPoint(false); setExpressionState({ itemId: '', isOpen: false }); setTopologyState({ itemId: '', isOpen: false }); setTool('select'); }
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key)) { e.preventDefault(); if (quickLookItem || selection.length === 1) { handleSpatialNavigate(e.key); } else if (selection.length > 0) { const step = e.shiftKey ? 10 : 1, updates = selection.map(id => { const item = items.find(i => i.id === id); if (!item) return null; let nx = item.x, ny = item.y; if (e.key === 'ArrowUp') ny -= step; if (e.key === 'ArrowDown') ny += step; if (e.key === 'ArrowLeft') nx -= step; if (e.key === 'ArrowRight') nx += step; return { id, updates: { x: nx, y: ny } }; }).filter(Boolean) as { id: string, updates: Partial<CanvasItem> }[]; if (updates.length > 0) { handleUpdateItems(updates); commit(items.map(it => { const upd = updates.find(u => u.id === it.id); return upd ? { ...it, ...upd.updates } : it; })); } } }
      if (e.key.toLowerCase() === 'v') setTool('select');
      if (e.key.toLowerCase() === 'h') setTool('hand');
      if (e.key.toLowerCase() === 'r') setTool('point');
      if (e.key.toLowerCase() === 'c') setTool('capture');
      if (e.key.toLowerCase() === 'g') setShowGrid(prev => !prev);
      if (e.key.toLowerCase() === 't') setTool('text');
    };
    window.addEventListener('paste', handlePaste); window.addEventListener('keydown', handleKeyDown); 
    return () => { window.removeEventListener('keydown', handleKeyDown); window.removeEventListener('paste', handlePaste); };
  }, [selection, items, redo, undo, commit, editMode, quickLookItem, selectedItem, handleSpatialNavigate, isPickingPoint, handlePaste, maximizedModelId]);

  const startRecording = async (resolution: string) => {
    try {
      const stream = await navigator.mediaDevices.getDisplayMedia({ video: { cursor: "always" } as any, audio: false }); streamRef.current = stream;
      const mediaRecorder = new MediaRecorder(stream); mediaRecorderRef.current = mediaRecorder;
      mediaRecorder.ondataavailable = (event) => { if (event.data.size > 0) recordedChunksRef.current.push(event.data); };
      mediaRecorder.onstop = () => { const blob = new Blob(recordedChunksRef.current, { type: 'video/webm' }), url = URL.createObjectURL(blob), a = document.createElement('a'); a.href = url; a.download = `无限想象-${Date.now()}.webm`; a.click(); setRecordingStatus('idle'); setRecordingTime(0); if (timerRef.current) window.clearInterval(timerRef.current); };
      mediaRecorder.start(); setRecordingStatus('recording'); timerRef.current = window.setInterval(() => setRecordingTime(prev => prev + 1), 1000);
    } catch (err) {}
  };
  const stopRecording = () => { mediaRecorderRef.current?.stop(); streamRef.current?.getTracks().forEach(track => track.stop()); };

  const handleSaveRecipe = async (name: string, instruction: string) => {
    if (!recipePanelData) return;
    const newRecipe: DesignRecipe = { id: crypto.randomUUID(), name, instruction, exampleImages: recipePanelData.images, createdAt: Date.now() };
    await saveRecipe(newRecipe); setRecipePanelData(null); setRecipeRefreshTrigger(prev => prev + 1);
    alert(`✅ 食谱 "${name}" 已保存！`);
  };

  const handleContextMenuAction = (action: string, itemId?: string) => {
      const selected = items.filter(i => selection.includes(i.id));
      if (action === 'frame_selection' && selected.length > 0) {
          const minX = Math.min(...selected.map(i => i.x)), minY = Math.min(...selected.map(i => i.y)), maxX = Math.max(...selected.map(i => i.x + i.width)), maxY = Math.max(...selected.map(i => i.x + i.width)), padding = 40;
          const newFrame: CanvasItem = { id: crypto.randomUUID(), type: ItemType.FRAME, x: minX - padding, y: minY - padding, width: (maxX - minX) + padding * 2, height: (maxY - minY) + padding * 2, rotation: 0, content: '新组合画框', status: 'empty' };
          const nextItems = [...items, newFrame]; setItems(nextItems); commit(nextItems); setSelection([newFrame.id]);
      } else if (action === 'gridify' && selected.length > 0) {
          const sorted = [...selected].sort((a, b) => a.y - b.y || a.x - b.x), cols = Math.ceil(Math.sqrt(sorted.length)), gap = 40, startX = Math.min(...selected.map(i => i.x)), startY = Math.min(...selected.map(i => i.y)), itemW = 512, itemH = 512;
          const updates = sorted.map((it, nid) => { const r = Math.floor(nid / cols), c = nid % cols; return { id: it.id, updates: { x: startX + c * (itemW + gap), y: startY + r * (itemH + gap), width: itemW, height: itemH } }; });
          handleUpdateItems(updates); commit(items.map(it => { const u = updates.find(up => u.id === it.id); return u ? { ...it, ...u.updates } : it; }));
      } else if (action === 'delete') handleDeleteItems(selection);
      else if (action === 'copy') handleCopy(null);
      else if (action === 'send_to_gemini') { const item = items.find(i => i.id === itemId); if (item?.content) chatRef.current?.addExternalAttachment(item.id, item.content); }
      else if (action === 'send_to_prompt') { const item = items.find(i => i.id === itemId); if (item?.content) setExternalRefImage(item.content); }
      setContextMenu(null);
  };

  const executeCaptureAction = async (action: 'chat' | 'canvas' | 'translate') => {
      if (!captureRect) return;
      let finalImg = capturedImage;
      if (!finalImg) finalImg = await grabScreenPixels(captureRect, view.scale, view.x, view.y);
      handleCaptureRegion(captureRect, action, finalImg);
      resetCapture();
  };

  const maximizedModel = maximizedModelId ? items.find(i => i.id === maximizedModelId) : null;

  return (
    <div className="w-screen h-screen bg-[#f4f4f5] dark:bg-[#09090b] overflow-hidden flex flex-col font-sans relative" onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); }} onDrop={(e) => { e.preventDefault(); e.stopPropagation(); const files = Array.from(e.dataTransfer.files || []); if (files.length > 0) files.forEach(f => handleFile(f as File)); else { const url = e.dataTransfer.getData('text/plain'); if (url) handleFile(url); } }}>
      <TopBar onExport={handleExportProject} onImport={handleImportProject} onCloudExport={handleCloudSave} onCloudImport={handleCloudLoad} />
      <LeftToolbar activeTool={tool} setTool={setTool} onUpload={() => fileInputRef.current?.click()} onToggleLayers={() => setShowLayers(!showLayers)} showLayers={showLayers} onToggleHistory={() => setShowHistory(!showHistory)} showHistory={showHistory} onAddFrame={() => { const spot = findPlacementSpot(800, 600, items); const f: CanvasItem = { id: crypto.randomUUID(), type: ItemType.FRAME, x: spot.x, y: spot.y, width: 800, height: 600, rotation: 0, content: 'New Frame', status: 'empty' }; const nextItems = [...items, f]; setItems(nextItems); commit(nextItems); setSelection([f.id]); }} recordingStatus={recordingStatus} onStartRecording={startRecording} onStopRecording={stopRecording} onPauseRecording={() => {}} onResumeRecording={() => {}} recordingTime={recordingTime} onAction={(action) => handleFloatingAction(selection.length === 1 ? selection[0] : '', action)} />
      <LayersPanel isOpen={showLayers} items={items} selection={selection.length > 0 ? selection[0] : null} onSelectItem={(id) => { setSelection([id]); const item = items.find(i => i.id === id); if (item) centerOnItem(item); }} onUpdateItem={handleUpdateItem} />
      <HistoryPanel isOpen={showHistory} onClose={() => setShowHistory(false)} onRestore={(snap) => { resetHistory(snap.items); setSelection([]); }} />
      
      <div className="w-full h-full relative">
        <Canvas ref={canvasRef} items={items} selection={selection} tool={tool} view={view} setView={setView} setSelection={setSelection} addItem={it => { const nextItems = [...items, it]; setItems(nextItems); commit(nextItems); }} updateItem={handleUpdateItem} updateItems={handleUpdateItems} onContextMenu={(e, id) => { if (tool === 'point' || tool === 'capture') return; const sid = id || (selection.length === 1 ? selection[0] : undefined); setContextMenu({ isOpen: true, x: e.clientX, y: e.clientY, itemId: sid }); }} onDelete={id => handleDeleteItems([id])} editMode={editMode} editTool={editTool} brushSize={brushSize} brushColor={brushColor} setBrushColor={setBrushColor} brushOpacity={brushOpacity} setBrushOpacity={setBrushOpacity} segments={segments} onApplyEdit={handleApplyEdit} isSmartEraserMode={isSmartEraserMode} onSmartEraserEnd={() => { handleApplyEdit('Remove the masked object and repair the background seamlessly'); setEditMode(false); setIsSmartEraserMode(false); }} setBrushSize={setBrushSize} onSelectItem={(id) => { const item = items.find(it => id === it.id); if (item && (item.type === ItemType.IMAGE || item.type === ItemType.VIDEO || item.type === ItemType.MODEL) && (item.content || item.modelUrl)) { if (isPickingPoint && pickingTargetId === item.id) return; if (tool === 'point' || tool === 'capture') return; setQuickLookItem(item); } }} onPointPicked={handlePickPoint} isPickingPoint={isPickingPoint && !!pickingTargetId} onPointTagClick={(it, pt) => chatRef.current?.addPointReference(it.id, it.content || '', pt.label, [pt.y, pt.x])} onPointRemoved={(it, pt) => chatRef.current?.requestObjectRemoval(it.id, it.content || '', pt.label, [pt.y, pt.x])} showPointLabels={showPointLabels} onDeletePointLocal={(iid, pid) => { const nextItems = items.map(it => it.id === iid ? { ...it, identifiedPoints: it.identifiedPoints?.filter(p => p.id !== pid) } : it); setItems(nextItems); commit(nextItems); }} onMovePoint={(iid, pid, ny, nx) => setItems(prev => prev.map(item => item.id === iid ? { ...item, identifiedPoints: item.identifiedPoints?.map(p => p.id === pid ? { ...p, y: ny, x: nx } : p) } : item))} onMovePointEnd={(iid, pid, from, to) => { const item = items.find(i => i.id === iid); if (item?.content) { const point = item.identifiedPoints?.find(p => p.id === pid); if (point) chatRef.current?.appendMovementDescription(iid, item.content, point.label, from, to); } }} isTextMode={editSubMode === 'text'} showGrid={showGrid} onZoomToFit={zoomToFit} onCaptureRegion={handleCaptureRegion} onFloatingAction={handleFloatingAction} expressionState={expressionState} setExpressionState={setExpressionState} topologyState={topologyState} setTopologyState={setTopologyState} currentEvolutionLevel={currentEvolutionLevel} captureState={captureState} onExitToolMode={() => { setTool('select'); setEditMode(false); setIsSmartEraserMode(false); }} activePartId={activePartId} onPartSelect={setActivePartId} onCameraChange={(id, s) => handleUpdateItem(id, { spatialConfig: s })} onLoadParts={(id, p) => handleUpdateItem(id, { partList: p })} setEditTool={setEditTool} setEditMode={setEditMode} />
        
        {/* Maximized Model Viewport Overlay */}
        {maximizedModel && maximizedModelId && (
            <div className="fixed inset-0 z-[100] bg-[#09090b] animate-in fade-in duration-500 overflow-hidden">
                <div className="absolute top-8 left-8 z-[110] flex items-center gap-6 pointer-events-none">
                    <div className="flex flex-col">
                        <div className="flex items-center gap-3">
                            <MaximizeIcon className="w-5 h-5 text-indigo-500" />
                            <span className="text-[14px] font-black text-white uppercase tracking-[0.4em] drop-shadow-lg">Industrial Focus Mode</span>
                        </div>
                        <span className="text-[10px] text-zinc-500 font-bold uppercase tracking-widest mt-1">Live AI Twin Model rendering</span>
                    </div>
                </div>
                
                <ModelViewport 
                    url={maximizedModel.modelUrl!} 
                    viewAngle={maximizedModel.viewAngle} 
                    explodeFactor={maximizedModel.explodeFactor} 
                    knollingFactor={maximizedModel.knollingFactor}
                    activePartId={activePartId}
                    colorSeed={maximizedModel.colorSeed}
                    partColorMap={maximizedModel.partColorMap}
                    highlightedPartIds={maximizedModel.highlightedPartIds || []}
                    hiddenPartIds={maximizedModel.hiddenPartIds || []}
                    partCMFMap={maximizedModel.partCMFMap}
                    wireframeMode={maximizedModel.wireframeMode}
                    showExplodeTrails={maximizedModel.showExplodeTrails}
                    onPartSelect={setActivePartId}
                    onCameraChange={(s) => handleUpdateItem(maximizedModelId, { spatialConfig: s })}
                    onLoadParts={(p) => handleUpdateItem(maximizedModelId, { partList: p })}
                    width={window.innerWidth}
                    height={window.innerHeight}
                    spatialConfig={maximizedModel.spatialConfig}
                    cameraMode={maximizedModel.cameraMode}
                />
                
                <button 
                    onClick={() => setMaximizedModelId(null)}
                    className="fixed bottom-10 left-1/2 -translate-x-1/2 z-[120] bg-white text-black px-8 py-3.5 rounded-full font-black uppercase text-[11px] tracking-[0.3em] shadow-3xl hover:scale-105 active:scale-95 transition-all flex items-center gap-3"
                >
                    <MinimizeIcon className="w-4 h-4" /> 退出聚焦视图 (ESC)
                </button>
            </div>
        )}
      </div>

      {isCapturing && captureRect && ( <div className="fixed inset-0 z-[2000] pointer-events-none"> <div className="absolute border-2 border-indigo-500 bg-indigo-500/5 shadow-[0_0_0_9999px_rgba(0,0,0,0.4)]" style={{ left: captureRect.x * view.scale + view.x, top: captureRect.y * view.scale + view.y, width: captureRect.width * view.scale, height: captureRect.height * view.scale }} /> </div> )}
      {showCaptureMenu && captureRect && ( <div className="fixed z-[2010] p-1.5 bg-[#09090b]/95 backdrop-blur-xl border border-white/10 rounded-[20px] shadow-3xl pointer-events-auto flex flex-col gap-1.5" style={{ left: (captureRect.x + captureRect.width) * view.scale + view.x + 10, top: (captureRect.y + captureRect.height) * view.scale + view.y, transform: 'translateY(-50%)' }}> {isGrabbingStream ? ( <div className="w-10 h-32 flex flex-col items-center justify-center gap-4 bg-white/5 rounded-xl animate-pulse"> <RefreshIcon className="w-5 h-5 text-indigo-400 animate-spin" /> <span className="text-[8px] font-black text-indigo-400 uppercase vertical-text">Capture</span> </div> ) : ( <> <div className="flex flex-col gap-1"> <button onClick={() => executeCaptureAction('chat')} className="w-10 h-10 flex items-center justify-center bg-[#5546fe] text-white rounded-xl hover:bg-indigo-500 transition-all" title="发送到 Gemini"><MessageCircleIcon className="w-5 h-5" /></button> <button onClick={() => executeCaptureAction('translate')} className="w-10 h-10 flex items-center justify-center text-zinc-400 hover:text-white hover:bg-white/10 rounded-xl transition-all" title="智能翻译 (全屏捕获)"><LanguagesIcon className="w-5 h-5" /></button> <button onClick={() => executeCaptureAction('canvas')} className="w-10 h-10 flex items-center justify-center text-zinc-400 hover:text-white hover:bg-white/10 rounded-xl transition-all" title="生成局部变体"><SparklesIcon className="w-5 h-5" /></button> </div> <div className="h-px bg-white/10 mx-2" /> <div className="flex flex-col gap-1"> <button onClick={() => setActiveAnnoTool('number')} className={`w-10 h-10 flex items-center justify-center rounded-xl transition-all ${activeAnnoTool === 'number' ? 'bg-red-500 text-white' : 'text-zinc-500 hover:bg-white/5'}`} title="序号标注"><span className="text-[11px] font-black">①</span></button> <button onClick={() => setActiveAnnoTool('arrow')} className={`w-10 h-10 flex items-center justify-center rounded-xl transition-all ${activeAnnoTool === 'arrow' ? 'bg-indigo-500 text-white' : 'text-zinc-500 hover:bg-white/5'}`} title="箭头标注"><ArrowIcon className="w-5 h-5" /></button> </div> <div className="h-px bg-white/10 mx-2" /> <button onClick={resetCapture} className="w-10 h-10 flex items-center justify-center text-zinc-500 hover:text-red-500 hover:bg-red-500/10 rounded-xl transition-all" title="取消截图"><XIcon className="w-5 h-5" /></button> </> )} </div> )}
      
      {!maximizedModelId && (
        <div className="fixed bottom-6 left-6 z-50 flex items-center gap-2 pointer-events-auto"> <div className="bg-[#0c0c0e]/90 backdrop-blur-2xl border border-white/10 p-1 rounded-2xl flex items-center shadow-2xl"> <button onClick={() => setView(v => ({ ...v, scale: Math.max(0.01, v.scale / 1.2) }))} className="w-10 h-10 flex items-center justify-center text-zinc-400 hover:text-white transition-all hover:bg-white/5 rounded-xl"> <MinusIcon className="w-4 h-4" /> </button> <div className="px-3 min-w-[60px] text-center"> <span className="text-[10px] font-black font-mono text-white">{Math.round(view.scale * 100)}%</span> </div> <button onClick={() => setView(v => ({ ...v, scale: Math.min(50, v.scale * 1.2) }))} className="w-10 h-10 flex items-center justify-center text-zinc-400 hover:text-white transition-all hover:bg-white/5 rounded-xl"> <PlusIcon className="w-4 h-4" /> </button> <div className="w-px h-6 bg-white/5 mx-1" /> <button onClick={zoomToFit} className="w-10 h-10 flex items-center justify-center text-zinc-400 hover:text-white transition-all hover:bg-white/5 rounded-xl" title="适配屏幕"> <MaximizeIcon className="w-4 h-4" /> </button> <button onClick={() => setShowGrid(!showGrid)} className={`w-10 h-10 flex items-center justify-center transition-all rounded-xl ${showGrid ? 'text-indigo-400 bg-indigo-500/10' : 'text-zinc-500 hover:text-white hover:bg-white/5'}`} title="网格开关 (G)"> <LayoutGridIcon className="w-4 h-4" /> </button> </div> </div>
      )}

      <div className={`fixed bottom-10 left-1/2 -translate-x-1/2 z-[70] pointer-events-none flex flex-col items-center gap-4 transition-all duration-500 ${isChatPanelExpanded || maximizedModelId ? 'translate-y-full opacity-0 pointer-events-none scale-90' : 'translate-y-0 opacity-100 pointer-events-auto scale-100'}`}> <BottomBar key={`${recipeRefreshTrigger}-${playstyleRefreshTrigger}`} lastGenerated={null} externalRef={externalRefImage} onExternalRefConsumed={() => setExternalRefImage(null)} onGenerate={(p, style, ratio, refs, count, level, res, recipeId, usePro) => handleGenerate('', p, { style, ratio, imageCount: count, artisticLevel: level, resolution: res, recipeId, usePro }, refs)} onExportRecipes={handleExportRecipes} onImportRecipes={handleImportRecipes} /> </div>
      
      <div className={`fixed right-4 top-4 bottom-4 flex flex-col items-end transition-all duration-500 ease-in-out z-[200] ${isPropertiesPanelOpen ? 'w-80' : 'w-16'}`}> {!isPropertiesPanelOpen && <button onClick={() => setIsPropertiesPanelOpen(true)} className="w-14 h-14 rounded-full flex items-center justify-center transition-all shadow-2xl border bg-[#09090b] border-zinc-800 text-indigo-400 hover:scale-110"><SlidersIcon className="w-6 h-6" /></button>} <div className={`flex-1 w-full overflow-hidden transition-all duration-500 origin-right ${isPropertiesPanelOpen ? 'scale-100 opacity-100' : 'scale-90 opacity-0 pointer-events-none'}`}> <div className="relative h-full"> {isPropertiesPanelOpen && <button onClick={() => { setIsPropertiesPanelOpen(false); setEditMode(false); setIsSmartEraserMode(false); setPropertyPanelView({ view: 'main', ts: Date.now() }); }} className="absolute top-4 right-4 z-[210] w-9 h-9 rounded-xl flex items-center justify-center bg-white/10 hover:bg-white/20 text-white transition-all border border-white/10 shadow-lg"><XIcon className="w-4 h-4" /></button>} <PropertiesPanel selectedItem={selectedItem} selectedItems={selectedItems} onUpdateItem={handleUpdateItem} onGenerate={handleGenerate} onDelete={nid => handleDeleteItems([nid])} onAutoPrompt={nid => analyzeImageForPrompt(items.find(it => it.id === nid)?.content || '').then(p => handleUpdateItem(nid, { prompt: p }))} onSendToPrompt={nid => { const item = items.find(i => i.id === nid); if (item?.content) setExternalRefImage(item.content); }} onSendToGemini={nid => { const item = items.find(i => i.id === nid); if (item?.content) chatRef.current?.addExternalAttachment(item.id, item.content); }} onSyncPointsToGemini={(nid) => { const item = items.find(i => i.id === nid); if (item && item.content) chatRef.current?.addBulkPointReferences(item.id, item.content, item.identifiedPoints?.map(p => ({ label: p.label, point: [p.y, p.x] })) || []); }} onEnterEditMode={() => { setEditMode(true); setIsSmartEraserMode(false); }} onExitEditMode={() => { setEditMode(false); setIsSmartEraserMode(false); setSegments([]); setPropertyPanelView({ view: 'main', ts: Date.now() }); }} initialView={propertyPanelView} onFrameAction={handleFrameAction} editTool={editTool} setEditTool={setEditTool} brushSize={brushSize} setBrushSize={setBrushSize} onApplyEdit={handleApplyEdit} onClearMask={() => canvasRef.current?.clearMask()} onJSONAnalysis={handleJSONAnalysis} isAnalyzingJSON={isAnalyzingJSON} onStartPickPoint={(nid, temp) => handleGenerate(nid, '__START_PICK_POINT__', { artisticLevel: temp })} isPickingPoint={isPickingPoint} currentEvolutionLevel={currentEvolutionLevel} isCncMode={isCncMode} setIsCncMode={setIsCncMode} onUpdatePoint={handleUpdatePoint} onClearAllPoints={handleClearAllPoints} onCommitPointChanges={handleCommitPointChanges} onAutoAlign={handleAutoAlignPoints} onClosePanel={() => { setIsPropertiesPanelOpen(false); setEditMode(false); setIsSmartEraserMode(false); setPropertyPanelView({ view: 'main', ts: Date.now() }); }} onFloatingAction={handleFloatingAction} /> </div> </div> </div>
      
      {contextMenu && ( <ContextMenu x={contextMenu.x} y={contextMenu.y} selectedItem={items.find(i => i.id === contextMenu.itemId) || null} onSelect={action => handleContextMenuAction(action, contextMenu.itemId)} onClose={() => setContextMenu(null)} isMulti={selection.length > 1} /> )}
      <GeminiChatPanel ref={chatRef} onAddToCanvas={handleAddToCanvas} onReceiveSegments={(segs) => { setSegments(segs); setEditMode(true); }} onExpandChange={setIsChatPanelExpanded} />
      <input type="file" ref={fileInputRef} onChange={(e) => { const files = Array.from(e.target.files || []) as File[]; files.forEach(file => handleFile(file)); }} multiple className="hidden" accept="image/*,video/*,.webm,.obj" />
      {quickLookItem && ( <div className="fixed inset-0 z-[1000] bg-black/95 backdrop-blur-2xl flex flex-col animate-in fade-in duration-300 pointer-events-auto"> <div className="absolute inset-0 z-0" onClick={() => setQuickLookItem(null)} /> <div className="h-16 flex items-center justify-between px-8 border-b border-white/5 relative z-10" onClick={e => e.stopPropagation()}> <div className="flex items-center gap-4"> <EyeIcon className="w-5 h-5 text-indigo-400" /> <span className="text-[12px] font-black text-white uppercase tracking-[0.3em]">沉浸式预览模式</span> </div> <div className="flex items-center gap-2"> <button onClick={() => handleSpatialNavigate('ArrowLeft')} className="p-3 text-zinc-400 hover:text-white rounded-xl hover:bg-white/5 transition-all"><ChevronLeftIcon className="w-5 h-5" /></button> <button onClick={() => handleSpatialNavigate('ArrowRight')} className="p-3 text-zinc-400 hover:text-white rounded-xl hover:bg-white/5 transition-all"><ChevronRightIcon className="w-5 h-5" /></button> <div className="w-px h-6 bg-white/10 mx-2" /> <button onClick={() => setQuickLookItem(null)} className="p-3 text-zinc-400 hover:text-white rounded-xl hover:bg-white/5 transition-all"><XIcon className="w-6 h-6" /></button> </div> </div> <div className="flex-1 flex items-center justify-center p-12 overflow-hidden relative z-10" onClick={e => e.stopPropagation()}> {quickLookItem.type === ItemType.IMAGE ? ( <img src={quickLookItem.content} className="max-w-full max-h-full object-contain shadow-[0_40px_100px_rgba(0,0,0,0.8)] rounded-2xl" /> ) : quickLookItem.type === ItemType.MODEL && quickLookItem.modelUrl ? ( <div className="w-full h-full max-w-4xl aspect-square rounded-3xl overflow-hidden shadow-3xl bg-[#111113]"> <ModelViewport url={quickLookItem.modelUrl} viewAngle={quickLookItem.viewAngle} cameraMode={quickLookItem.cameraMode} explodeFactor={quickLookItem.explodeFactor} activePartId={activePartId} highlightedPartIds={quickLookItem.highlightedPartIds} hiddenPartIds={quickLookItem.hiddenPartIds || []} onPartSelect={setActivePartId} onCameraChange={(s) => handleUpdateItem(quickLookItem.id, { spatialConfig: s })} width={1000} height={1000} spatialConfig={quickLookItem.spatialConfig} partCMFMap={quickLookItem.partCMFMap} wireframeMode={quickLookItem.wireframeMode} showExplodeTrails={quickLookItem.showExplodeTrails} /> </div> ) : ( <video src={quickLookItem.content} controls autoPlay className="max-w-full max-h-full rounded-2xl shadow-2xl" /> )} </div> <div className="p-10 text-center bg-gradient-to-t from-black to-transparent relative z-10" onClick={e => e.stopPropagation()}> <p className="text-zinc-500 text-[10px] font-black uppercase tracking-[0.4em]">ESC TO CLOSE • ARROWS TO NAVIGATE</p> </div> </div> )}
      {recipePanelData && ( <DesignRecipePanel initialInstruction={recipePanelData.instruction} exampleImages={recipePanelData.images} onSave={handleSaveRecipe} onClose={() => setRecipePanelData(null)} /> )}
      {isExtractingRecipe && ( <div className="fixed inset-0 z-[1000] bg-black/60 backdrop-blur-md flex flex-col items-center justify-center gap-6 animate-in fade-in duration-500"> <div className="relative"> <div className="w-24 h-24 rounded-full border-2 border-indigo-500/20 border-t-indigo-500 animate-spin" /> <div className="absolute inset-0 flex items-center justify-center"> <FlaskIcon className="w-8 h-8 text-indigo-400 animate-pulse" /> </div> </div> <div className="space-y-2 text-center"> <h2 className="text-white font-black text-lg uppercase tracking-[0.4em]">基因解构中</h2> <p className="text-zinc-400 text-sm font-bold uppercase tracking-widest">AI 正在深度解析选定样本的审美配方...</p> </div> </div> )}
    </div>
  );
};
export default App;
