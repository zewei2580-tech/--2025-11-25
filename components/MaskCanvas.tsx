import { useRef, useEffect, useState, useImperativeHandle, forwardRef } from 'react';
import React from 'react';
import { EditToolType } from '../types';

interface MaskCanvasProps {
  width: number;
  height: number;
  imageSrc: string;
  tool: EditToolType;
  brushColor?: string;
  brushSize?: number;
  brushOpacity?: number;
  isTextMode?: boolean;
  onDrawEnd?: () => void;
}

export interface MaskCanvasRef {
  getSelectionMask: () => Promise<string | null>;
  getMaskedImage: () => Promise<string | null>;
  clearMask: () => void;
  undo: () => void;
  redo: () => void;
}

const MaskCanvas = forwardRef<MaskCanvasRef, MaskCanvasProps>(({ 
  width, height, imageSrc, tool, brushColor = '#ef4444', brushSize = 12, brushOpacity = 1, isTextMode, onDrawEnd 
}, ref) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [startPos, setStartPos] = useState<{ x: number, y: number } | null>(null);
  const [history, setHistory] = useState<ImageData[]>([]);
  const [redoHistory, setRedoHistory] = useState<ImageData[]>([]);
  const [pendingTextPos, setPendingTextPos] = useState<{ x: number, y: number } | null>(null);
  const [textInput, setTextInput] = useState('');
  const [mousePos, setMousePos] = useState<{ x: number, y: number } | null>(null);
  const textInputRef = useRef<HTMLInputElement>(null);

  // 内部像素尺寸缓存，用于坐标映射
  const internalSizeRef = useRef({ w: 1024, h: 1024 });

  useEffect(() => {
    const canvas = canvasRef.current;
    if (canvas && width > 0 && height > 0) {
      // 工业级掩码对齐逻辑：根据 Item 的比例计算内部像素分辨率
      const maxDim = 1024;
      let w = maxDim;
      let h = (height / width) * maxDim;
      
      if (height > width) {
        h = maxDim;
        w = (width / height) * maxDim;
      }

      canvas.width = w;
      canvas.height = h;
      internalSizeRef.current = { w, h };

      const ctx = canvas.getContext('2d', { willReadFrequently: true });
      if (ctx) {
        ctx.lineJoin = 'round';
        ctx.lineCap = 'round';
      }
    }
  }, [width, height]);

  const saveHistory = () => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (ctx && canvas) {
      const currentData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      setHistory(prev => [...prev, currentData].slice(-20));
      setRedoHistory([]);
    }
  };

  useImperativeHandle(ref, () => ({
    undo: () => {
      const canvas = canvasRef.current;
      const ctx = canvas?.getContext('2d');
      if (!ctx || !canvas) return;

      setHistory(prev => {
        if (prev.length === 0) {
          const currentData = ctx.getImageData(0, 0, canvas.width, canvas.height);
          setRedoHistory(r => [...r, currentData]);
          ctx.clearRect(0, 0, canvas.width, canvas.height);
          return [];
        }
        const newHistory = [...prev];
        const prevState = newHistory.pop();
        const currentData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        setRedoHistory(r => [...r, currentData]);
        if (prevState) {
          ctx.putImageData(prevState, 0, 0);
        } else {
          ctx.clearRect(0, 0, canvas.width, canvas.height);
        }
        return newHistory;
      });
    },
    redo: () => {
      const canvas = canvasRef.current;
      const ctx = canvas?.getContext('2d');
      if (!ctx || !canvas) return;

      setRedoHistory(prev => {
        if (prev.length === 0) return prev;
        const newRedoHistory = [...prev];
        const nextState = newRedoHistory.pop();
        if (nextState) {
          // Save current state to history before redoing
          const currentData = ctx.getImageData(0, 0, canvas.width, canvas.height);
          setHistory(h => [...h, currentData]);
          ctx.putImageData(nextState, 0, 0);
        }
        return newRedoHistory;
      });
    },
    clearMask: () => {
      const canvas = canvasRef.current;
      const ctx = canvas?.getContext('2d');
      if (ctx && canvas) ctx.clearRect(0, 0, canvas.width, canvas.height);
      setHistory([]);
    },
    getSelectionMask: async () => {
      const maskCanvas = canvasRef.current;
      if (!maskCanvas) return null;
      
      const { w, h } = internalSizeRef.current;
      const outputCanvas = document.createElement('canvas');
      outputCanvas.width = w;
      outputCanvas.height = h;
      const outCtx = outputCanvas.getContext('2d');
      if (!outCtx) return null;

      // 1. 严格填充纯黑背景（保护区）
      outCtx.fillStyle = '#000000';
      outCtx.fillRect(0, 0, w, h);

      // 2. 将涂鸦内容映射为纯白（重绘区）
      // 采用更可靠的像素操作确保白色区域没有任何色彩偏差
      const tempCanvas = document.createElement('canvas');
      tempCanvas.width = w;
      tempCanvas.height = h;
      const tempCtx = tempCanvas.getContext('2d');
      if (tempCtx) {
          tempCtx.drawImage(maskCanvas, 0, 0);
          const imageData = tempCtx.getImageData(0, 0, w, h);
          const data = imageData.data;
          for (let i = 0; i < data.length; i += 4) {
              // 如果像素不是完全透明，就强制转为纯白
              if (data[i + 3] > 0) {
                  data[i] = 255;
                  data[i + 1] = 255;
                  data[i + 2] = 255;
                  data[i + 3] = 255;
              }
          }
          tempCtx.putImageData(imageData, 0, 0);
          outCtx.drawImage(tempCanvas, 0, 0);
      }

      return outputCanvas.toDataURL('image/png');
    },
    getMaskedImage: async () => {
        const maskCanvas = canvasRef.current;
        if (!maskCanvas) return null;
        
        const { w, h } = internalSizeRef.current;
        return new Promise((resolve) => {
            const img = new Image();
            img.crossOrigin = "anonymous";
            img.onload = () => {
                const outputCanvas = document.createElement('canvas');
                outputCanvas.width = w;
                outputCanvas.height = h;
                const outCtx = outputCanvas.getContext('2d');
                if (!outCtx) { resolve(null); return; }

                outCtx.drawImage(img, 0, 0, w, h);
                outCtx.globalCompositeOperation = 'destination-in';
                outCtx.drawImage(maskCanvas, 0, 0);
                resolve(outputCanvas.toDataURL('image/png'));
            };
            img.onerror = () => resolve(null);
            img.src = imageSrc;
        });
    }
  }));

  const getPos = (e: React.MouseEvent) => {
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return { x: 0, y: 0 };
    const { w, h } = internalSizeRef.current;
    return {
      x: (e.clientX - rect.left) * (w / rect.width),
      y: (e.clientY - rect.top) * (h / rect.height)
    };
  };

  const drawTextTag = (ctx: CanvasRenderingContext2D, text: string, x: number, y: number) => {
    const fontSize = 56;
    ctx.font = `bold ${fontSize}px Inter, sans-serif`;
    
    ctx.save();
    ctx.fillStyle = 'white';
    ctx.shadowColor = 'rgba(0,0,0,1)';
    ctx.shadowBlur = 12;
    ctx.beginPath();
    ctx.arc(x, y, 8, 0, Math.PI * 2);
    ctx.fill();

    ctx.textBaseline = 'middle';
    ctx.textAlign = 'center';
    ctx.strokeStyle = 'rgba(0,0,0,0.9)';
    ctx.lineWidth = 10;
    ctx.strokeText(text, x, y - (fontSize + 10));
    ctx.fillStyle = 'white';
    ctx.fillText(text, x, y - (fontSize + 10));
    ctx.restore();
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    if (e.button !== 0) return;
    const p = getPos(e);

    if (isTextMode) {
      setPendingTextPos(p);
      setTextInput('');
      setTimeout(() => textInputRef.current?.focus(), 50);
      return;
    }

    saveHistory();
    setIsDrawing(true);
    setStartPos(p);
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!ctx) return;

    const { w } = internalSizeRef.current;
    ctx.globalCompositeOperation = tool === 'eraser' ? 'destination-out' : 'source-over';
    ctx.globalAlpha = brushOpacity;
    ctx.strokeStyle = brushColor;
    ctx.fillStyle = brushColor;
    ctx.lineWidth = brushSize * (w / (width || 1));
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    ctx.beginPath();
    ctx.moveTo(p.x, p.y);
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    const p = getPos(e);
    setMousePos(p);
    
    if (!isDrawing || isTextMode || !startPos) return;
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!ctx) return;

    if (tool === 'line' || tool === 'circle' || tool === 'rect' || tool === 'bezier') {
      // Restore previous state before drawing the shape
      if (history.length > 0) {
        ctx.putImageData(history[history.length - 1], 0, 0);
      } else {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
      }
      
      ctx.beginPath();
      if (tool === 'line') {
        ctx.moveTo(startPos.x, startPos.y);
        ctx.lineTo(p.x, p.y);
        ctx.stroke();
      } else if (tool === 'circle') {
        const radius = Math.sqrt(Math.pow(p.x - startPos.x, 2) + Math.pow(p.y - startPos.y, 2));
        ctx.arc(startPos.x, startPos.y, radius, 0, 2 * Math.PI);
        ctx.stroke();
      } else if (tool === 'rect') {
        ctx.rect(startPos.x, startPos.y, p.x - startPos.x, p.y - startPos.y);
        ctx.stroke();
      } else if (tool === 'bezier') {
        ctx.moveTo(startPos.x, startPos.y);
        const midX = (startPos.x + p.x) / 2;
        const midY = startPos.y;
        ctx.quadraticCurveTo(midX, midY, p.x, p.y);
        ctx.stroke();
      }
    } else {
      // brush, eraser, lasso, pen
      ctx.lineTo(p.x, p.y);
      ctx.stroke();
    }
  };

  const handleMouseUp = () => {
    if (isDrawing) {
      const canvas = canvasRef.current;
      const ctx = canvas?.getContext('2d');
      if (ctx) {
        if (tool === 'lasso') {
          ctx.closePath();
          ctx.fill();
        } else if (tool !== 'line' && tool !== 'circle' && tool !== 'rect') {
          ctx.closePath();
        }
      }
      setIsDrawing(false);
      setStartPos(null);
      if (onDrawEnd) onDrawEnd();
    }
  };

  const handleFinishTextInput = () => {
    if (pendingTextPos && textInput.trim()) {
      saveHistory();
      const canvas = canvasRef.current;
      const ctx = canvas?.getContext('2d');
      if (ctx) {
        ctx.globalCompositeOperation = 'source-over';
        drawTextTag(ctx, textInput.trim(), pendingTextPos.x, pendingTextPos.y);
      }
    }
    setPendingTextPos(null);
  };

  return (
    <div className="absolute inset-0 z-50 pointer-events-none overflow-hidden" onMouseLeave={() => setMousePos(null)}>
      <canvas 
        ref={canvasRef} 
        onMouseDown={handleMouseDown} 
        onMouseMove={handleMouseMove} 
        onMouseUp={handleMouseUp} 
        className={`absolute inset-0 pointer-events-auto ${isTextMode ? 'cursor-crosshair bg-white/5' : 'cursor-none touch-none'}`} 
        style={{ width: '100%', height: '100%' }}
      />
      
      {!isTextMode && mousePos && (
        <div 
            className="absolute border border-white/50 bg-white/20 rounded-full pointer-events-none z-[60] shadow-[0_0_10px_rgba(0,0,0,0.5)]"
            style={{ 
                left: `${(mousePos.x / internalSizeRef.current.w) * 100}%`, 
                top: `${(mousePos.y / internalSizeRef.current.h) * 100}%`,
                width: `${(brushSize * (internalSizeRef.current.w / (width || 1)) / internalSizeRef.current.w) * 100}%`,
                height: `${(brushSize * (internalSizeRef.current.w / (width || 1)) / internalSizeRef.current.h) * 100}%`,
                transform: 'translate(-50%, -50%)',
                borderColor: tool === 'eraser' ? '#ffffff80' : `${brushColor}80`,
                backgroundColor: tool === 'eraser' ? '#ffffff20' : `${brushColor}20`
            }}
        />
      )}

      {pendingTextPos && (
        <div 
          className="absolute z-[100] pointer-events-auto"
          style={{ 
            left: `${(pendingTextPos.x / internalSizeRef.current.w) * 100}%`, 
            top: `${(pendingTextPos.y / internalSizeRef.current.h) * 100}%`,
            transform: 'translate(-50%, -120%)'
          }}
        >
          <div className="bg-zinc-900 border border-indigo-500 rounded-xl p-3 shadow-2xl flex items-center gap-3 min-w-[200px] animate-in slide-in-from-bottom-2">
            <input 
              ref={textInputRef}
              type="text"
              value={textInput}
              onChange={(e) => setTextInput(e.target.value)}
              onBlur={handleFinishTextInput}
              onKeyDown={(e) => e.key === 'Enter' && handleFinishTextInput()}
              className="bg-zinc-800 border-none rounded-lg px-3 py-1.5 text-xs text-white outline-none focus:ring-1 focus:ring-indigo-500 flex-1"
              placeholder="输入修改指令..."
            />
            <button onClick={handleFinishTextInput} className="bg-indigo-600 text-white px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest">确认</button>
          </div>
        </div>
      )}
    </div>
  );
});

export default MaskCanvas;