
import React, { useCallback, useMemo } from 'react';
import { ViewState } from '../types';

export const useCanvasMath = (view: ViewState, containerRef: React.RefObject<HTMLDivElement | null>) => {
  /**
   * 将屏幕像素坐标转换为画布内的逻辑坐标
   */
  const screenToCanvas = useCallback((sx: number, sy: number) => {
    if (!containerRef.current) return { x: sx, y: sy };
    const rect = containerRef.current.getBoundingClientRect();
    return {
      x: (sx - rect.left - view.x) / view.scale,
      y: (sy - rect.top - view.y) / view.scale
    };
  }, [view, containerRef]);

  /**
   * 计算基于当前缩放比例的 UI 元素尺寸
   * 确保控制点、边框在不同缩放级别下保持视觉一致性
   */
  const uiScales = useMemo(() => {
    const handleScale = Math.max(0.1, 1 / view.scale);
    return {
      handleScale,
      handleSize: 8 * handleScale, 
      borderWidth: 1.5 * handleScale,
      rotateHandleSize: 24 * handleScale, // 稍微缩小手柄
      rotateHandleOffset: -30 * handleScale, // 负值代表向上偏移
      rotateIconSize: 12 * handleScale, 
      snapThreshold: 10 // 吸附阈值（逻辑像素）
    };
  }, [view.scale]);

  return {
    screenToCanvas,
    ...uiScales
  };
};
