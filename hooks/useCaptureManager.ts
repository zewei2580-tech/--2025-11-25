
import { useState, useCallback, useRef } from 'react';
import { Point, Rect } from '../types';

export const useCaptureManager = () => {
  const [isCapturing, setIsCapturing] = useState(false);
  const [startPos, setStartPos] = useState<Point | null>(null);
  const [rect, setRect] = useState<Rect | null>(null);
  const [showMenu, setShowMenu] = useState(false);
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [isGrabbingStream, setIsGrabbingStream] = useState(false);

  const videoRef = useRef<HTMLVideoElement | null>(null);

  const beginCapture = useCallback((pos: Point) => {
    setIsCapturing(true);
    setShowMenu(false);
    setStartPos(pos);
    setRect(null);
    setCapturedImage(null);
  }, []);

  const updateCapture = useCallback((pos: Point) => {
    if (!isCapturing || !startPos) return;
    setRect({
      x: Math.min(startPos.x, pos.x),
      y: Math.min(startPos.y, pos.y),
      width: Math.abs(startPos.x - pos.x),
      height: Math.abs(startPos.y - pos.y)
    });
  }, [isCapturing, startPos]);

  /**
   * 真正的屏幕捕获逻辑：
   * 1. 弹出系统录屏请求
   * 2. 获取一帧画面
   * 3. 根据矩形区域裁剪
   */
  const grabScreenPixels = async (selection: Rect, viewScale: number, viewX: number, viewY: number) => {
    try {
      setIsGrabbingStream(true);
      const stream = await navigator.mediaDevices.getDisplayMedia({
        video: { displaySurface: "browser" },
        audio: false
      } as any);

      const video = document.createElement('video');
      video.srcObject = stream;
      await video.play();

      const canvas = document.createElement('canvas');
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const ctx = canvas.getContext('2d');
      if (!ctx) return null;
      ctx.drawImage(video, 0, 0);

      // 停止流
      stream.getTracks().forEach(t => t.stop());

      // 计算裁剪区域
      // 逻辑坐标转屏幕像素坐标 (注意：此逻辑假设浏览器缩放为 100%)
      const screenX = selection.x * viewScale + viewX;
      const screenY = selection.y * viewScale + viewY;
      const screenW = selection.width * viewScale;
      const screenH = selection.height * viewScale;

      const cropCanvas = document.createElement('canvas');
      cropCanvas.width = screenW;
      cropCanvas.height = screenH;
      const cropCtx = cropCanvas.getContext('2d');
      if (!cropCtx) return null;

      // 从全屏图中截取对应位置
      // 注意：getDisplayMedia 截取的是整个显示器或标签页
      // 这里简单化处理：如果是捕获当前标签页，坐标对应关系更直接
      cropCtx.drawImage(canvas, screenX, screenY, screenW, screenH, 0, 0, screenW, screenH);
      
      const base64 = cropCanvas.toDataURL('image/jpeg', 0.9);
      setCapturedImage(base64);
      return base64;
    } catch (e) {
      console.error("Screen capture failed:", e);
      return null;
    } finally {
      setIsGrabbingStream(false);
    }
  };

  const finishCapture = useCallback(async () => {
    setIsCapturing(false);
    if (rect && rect.width > 5 && rect.height > 5) {
      setShowMenu(true);
    } else {
      setRect(null);
    }
  }, [rect]);

  const resetCapture = useCallback(() => {
    setIsCapturing(false);
    setRect(null);
    setShowMenu(false);
    setStartPos(null);
    setCapturedImage(null);
  }, []);

  return {
    isCapturing,
    captureRect: rect,
    showCaptureMenu: showMenu,
    capturedImage,
    isGrabbingStream,
    beginCapture,
    updateCapture,
    finishCapture,
    resetCapture,
    grabScreenPixels,
    setCaptureRect: setRect,
    setShowCaptureMenu: setShowMenu
  };
};
