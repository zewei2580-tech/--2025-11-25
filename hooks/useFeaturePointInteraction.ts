
import { useState, useRef, useCallback } from 'react';
import { CanvasItem, IdentifiedPoint } from '../types';

interface PointDraggingState {
  itemId: string;
  pointId: string;
  startPoint: [number, number]; // [y, x]
}

export const useFeaturePointInteraction = (
  onMovePoint?: (itemId: string, pointId: string, ny: number, nx: number) => void,
  onMovePointEnd?: (itemId: string, pointId: string, from: [number, number], to: [number, number]) => void
) => {
  const [dragging, setDragging] = useState<PointDraggingState | null>(null);
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const hoverTimeoutRef = useRef<number | null>(null);

  const setHoveredWithDelay = useCallback((id: string | null) => {
    if (hoverTimeoutRef.current) window.clearTimeout(hoverTimeoutRef.current);
    if (id === null) {
      hoverTimeoutRef.current = window.setTimeout(() => setHoveredId(null), 300);
    } else {
      setHoveredId(id);
    }
  }, []);

  const handleStartDrag = useCallback((itemId: string, point: IdentifiedPoint) => {
    setDragging({
      itemId,
      pointId: point.id,
      startPoint: [point.y, point.x]
    });
  }, []);

  const handleDragUpdate = useCallback((pos: {x: number, y: number}, items: CanvasItem[]) => {
    if (!dragging) return;
    const item = items.find(i => i.id === dragging.itemId);
    if (item) {
      const nx = Math.min(1000, Math.max(0, ((pos.x - item.x) / item.width) * 1000));
      const ny = Math.min(1000, Math.max(0, ((pos.y - item.y) / item.height) * 1000));
      onMovePoint?.(item.id, dragging.pointId, ny, nx);
    }
  }, [dragging, onMovePoint]);

  const handleDragEnd = useCallback((pos: {x: number, y: number}, items: CanvasItem[]) => {
    if (!dragging) return;
    const item = items.find(i => i.id === dragging.itemId);
    if (item) {
        const nx = Math.min(1000, Math.max(0, ((pos.x - item.x) / item.width) * 1000));
        const ny = Math.min(1000, Math.max(0, ((pos.y - item.y) / item.height) * 1000));
        if (Math.abs(dragging.startPoint[0] - ny) > 1 || Math.abs(dragging.startPoint[1] - nx) > 1) {
            onMovePointEnd?.(item.id, dragging.pointId, dragging.startPoint, [ny, nx]);
        }
    }
    setDragging(null);
  }, [dragging, onMovePointEnd]);

  return {
    draggingPoint: dragging,
    hoveredPointId: hoveredId,
    setHoveredPointWithDelay: setHoveredWithDelay,
    handleStartDrag,
    handleDragUpdate,
    handleDragEnd,
    hoverTimeoutRef
  };
};
