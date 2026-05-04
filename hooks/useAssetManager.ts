
import React, { useCallback, useRef } from 'react';
import { CanvasItem, ItemType, ViewState } from '../types';
import { getClosestGeminiRatio } from '../services/geminiService';

interface AssetManagerProps {
  view: ViewState;
  items: CanvasItem[];
  setItems: React.Dispatch<React.SetStateAction<CanvasItem[]>>;
  setSelection: (ids: string[]) => void;
}

export const useAssetManager = ({ view, items, setItems, setSelection }: AssetManagerProps) => {
  const pasteCountRef = useRef(0);
  const lastPasteTimeRef = useRef(0);

  /**
   * 获取图像原始尺寸
   */
  const getImageDimensions = (src: string): Promise<{ width: number; height: number }> => {
    return new Promise((resolve) => {
      const img = new Image();
      img.onload = () => resolve({ width: img.naturalWidth, height: img.naturalHeight });
      img.onerror = () => resolve({ width: 512, height: 512 });
      img.src = src;
    });
  };

  /**
   * 获取视频原始尺寸
   */
  const getVideoDimensions = (src: string): Promise<{ width: number; height: number }> => {
    return new Promise((resolve) => {
      const video = document.createElement('video');
      video.onloadedmetadata = () => resolve({ width: video.videoWidth, height: video.videoHeight });
      video.onerror = () => resolve({ width: 640, height: 360 });
      video.src = src;
    });
  };

  /**
   * 自动计算最佳摆放位置，避免重叠
   */
  const findPlacementSpot = useCallback((width: number, height: number, itemsList: CanvasItem[], relativeTo?: CanvasItem, offsetIdx: number = 0) => {
    const spacing = 80; 
    if (itemsList.length === 0) { 
        return { 
            x: (window.innerWidth / 2 - view.x) / view.scale - width / 2, 
            y: (window.innerHeight / 2 - view.y) / view.scale - height / 2 
        }; 
    }
    const ref = relativeTo || itemsList[itemsList.length - 1];
    let startX = ref.x + ref.width + spacing;
    let startY = ref.y;
    
    const isOccupied = (tx: number, ty: number) => { 
        return itemsList.some(it => { 
            const overlapX = tx < it.x + it.width + 10 && tx + width + 10 > it.x; 
            const overlapY = ty < it.y + it.height + 10 && ty + height + 10 > it.y; 
            return overlapX && overlapY; 
        }); 
    };

    let curX = startX + (offsetIdx * (width / 4)); 
    let curY = startY; 
    let attempts = 0;
    while (isOccupied(curX, curY) && attempts < 50) { curX += spacing; attempts++; }
    if (attempts >= 50) { 
        curX = ref.x; 
        curY = ref.y + ref.height + spacing; 
        attempts = 0; 
        while (isOccupied(curX, curY) && attempts < 50) { curY += spacing; attempts++; } 
    }
    return { x: curX, y: curY };
  }, [view.x, view.y, view.scale]);

  /**
   * 处理各种进入画布的文件 (图片/视频/3D模型)
   */
  const handleFile = useCallback(async (file: File | string, x?: number, y?: number) => {
    if (file instanceof File && file.name.toLowerCase().endsWith('.obj')) {
        const reader = new FileReader();
        reader.onload = async (event) => {
            const content = event.target?.result as string;
            const blob = new Blob([content], { type: 'text/plain' });
            const url = URL.createObjectURL(blob);
            const displaySize = 512;
            const spot = findPlacementSpot(displaySize, displaySize, items);
            const newItem: CanvasItem = {
                id: crypto.randomUUID(),
                type: ItemType.MODEL,
                x: spot.x,
                y: spot.y,
                width: displaySize,
                height: displaySize,
                rotation: 0,
                content: file.name,
                modelUrl: url,
                status: 'generated',
                explodeFactor: 0,
                viewAngle: 'perspective'
            };
            setItems(prev => [...prev, newItem]);
            setSelection([newItem.id]);
        };
        reader.readAsText(file);
        return;
    }

    const processData = async (content: string, name: string, isVideo: boolean) => {
        const { width, height } = isVideo ? await getVideoDimensions(content) : await getImageDimensions(content);
        const displayWidth = 500; 
        const displayHeight = (height * displayWidth) / width;
        const aspectRatio = getClosestGeminiRatio(width, height);
        
        setItems(prev => {
            let targetPos;
            if (x !== undefined && y !== undefined) { 
                targetPos = { x: (x - view.x) / view.scale - displayWidth / 2, y: (y - view.y) / view.scale - displayHeight / 2 }; 
            } else { 
                targetPos = findPlacementSpot(displayWidth, displayHeight, prev); 
            }
            const newItem: CanvasItem = { 
                id: crypto.randomUUID(), 
                type: isVideo ? ItemType.VIDEO : ItemType.IMAGE, 
                x: targetPos.x, 
                y: targetPos.y, 
                width: displayWidth, 
                height: displayHeight, 
                rotation: 0, 
                content: content, 
                status: 'generated', 
                prompt: name,
                aspectRatio: aspectRatio
            };
            setSelection([newItem.id]); 
            return [...prev, newItem];
        });
    };

    if (typeof file === 'string') {
        if (file.startsWith('data:image')) {
            await processData(file, 'Pasted Image', false);
        }
        return;
    }

    const reader = new FileReader();
    reader.onload = async (event) => {
        const content = event.target?.result as string;
        const isVideo = file.type.startsWith('video/') || file.name.endsWith('.webm');
        await processData(content, file.name, isVideo);
    };
    reader.readAsDataURL(file);
  }, [view.x, view.y, view.scale, findPlacementSpot, setItems, setSelection, items]);

  /**
   * 处理粘贴逻辑
   */
  const handlePaste = useCallback(async (e: ClipboardEvent) => {
    const itemsToPaste: DataTransferItem[] = Array.from(e.clipboardData?.items || []);
    
    // 1. 优先尝试解析复杂对象（本项目导出的 JSON）
    const internalData = e.clipboardData?.getData('application/json/recreate-items');
    if (internalData) {
        try {
            const parsed = JSON.parse(internalData) as CanvasItem[];
            if (parsed.length > 0) {
                e.preventDefault();
                const offset = 24;
                const newItems = parsed.map(it => ({ ...it, id: crypto.randomUUID(), x: it.x + offset, y: it.y + offset }));
                setItems(prev => [...prev, ...newItems]);
                setSelection(newItems.map(it => it.id));
                return;
            }
        } catch (err) {}
    }

    // 2. 尝试解析文件（图片/视频/3D模型）
    let hasHandledFile = false;
    for (const item of itemsToPaste) {
        if (item.type.indexOf("image") !== -1 || item.type.indexOf("video") !== -1) {
            const file = item.getAsFile();
            if (file) {
                e.preventDefault();
                handleFile(file);
                hasHandledFile = true;
            }
        }
    }

    // 3. 如果没有文件，尝试解析纯文本（可能是 Base64 或 URL）
    if (!hasHandledFile) {
        const text = e.clipboardData?.getData('text/plain') || '';
        if (text.startsWith('data:image')) {
            e.preventDefault();
            handleFile(text);
        }
    }
  }, [handleFile, setItems, setSelection]);

  return {
    handleFile,
    handlePaste,
    findPlacementSpot,
    getImageDimensions,
    getVideoDimensions
  };
};
