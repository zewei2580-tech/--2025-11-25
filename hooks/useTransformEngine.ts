
import { useState, useCallback } from 'react';
import { CanvasItem, ItemType, Point } from '../types';

interface TransformingState {
  type: 'resize' | 'rotate' | 'drag';
  handle?: string;
  startX: number;
  startY: number;
  initialItems: {
    id: string;
    x: number;
    y: number;
    w: number;
    h: number;
    r: number;
  }[];
}

interface SnapLine {
  x?: number;
  y?: number;
}

export const useTransformEngine = (
  items: CanvasItem[],
  updateItem: (id: string, updates: Partial<CanvasItem>) => void,
  snapThreshold: number
) => {
  const [transforming, setTransforming] = useState<TransformingState | null>(null);
  const [snapLines, setSnapLines] = useState<SnapLine[]>([]);

  const startTransform = useCallback((
    type: 'resize' | 'rotate' | 'drag',
    pos: Point,
    selectedIds: string[],
    handle?: string
  ) => {
    // 递归收集逻辑：如果选中了 Frame，则自动包含其内部物体
    let finalIds = [...selectedIds];
    if (type === 'drag') {
      selectedIds.forEach(id => {
        const item = items.find(i => i.id === id);
        if (item?.type === ItemType.FRAME) {
          const children = items.filter(it => 
            it.id !== item.id &&
            it.x >= item.x && it.x + it.width <= item.x + item.width &&
            it.y >= item.y && it.y + it.height <= item.y + item.height
          );
          children.forEach(c => {
            if (!finalIds.includes(c.id)) finalIds.push(c.id);
          });
        }
      });
    }

    const initialItems = finalIds.map(id => {
      const it = items.find(i => i.id === id);
      if (!it) return null;
      return { id: it.id, x: it.x, y: it.y, w: it.width, h: it.height, r: it.rotation || 0 };
    }).filter(Boolean) as any[];

    setTransforming({
      type,
      handle,
      startX: pos.x,
      startY: pos.y,
      initialItems
    });
  }, [items]);

  const updateTransform = useCallback((pos: Point) => {
    if (!transforming) return;

    if (transforming.type === 'drag') {
      let dx = pos.x - transforming.startX;
      let dy = pos.y - transforming.startY;
      const activeSnapLines: SnapLine[] = [];
      const primaryItem = transforming.initialItems[0];
      
      let nx = primaryItem.x + dx;
      let ny = primaryItem.y + dy;

      // 几何吸附算法
      items.forEach(other => {
        const isOtherInTransform = transforming.initialItems.some(i => i.id === other.id);
        if (isOtherInTransform) return;

        const otherEdgesX = [other.x, other.x + other.width, other.x + other.width / 2];
        const otherEdgesY = [other.y, other.y + other.height, other.y + other.height / 2];
        const itemEdgesX = [nx, nx + primaryItem.w, nx + primaryItem.w / 2];
        const itemEdgesY = [ny, ny + primaryItem.h, ny + primaryItem.h / 2];

        itemEdgesX.forEach((ix) => {
          otherEdgesX.forEach(ox => {
            if (Math.abs(ix - ox) < snapThreshold) {
              const diff = ox - ix;
              dx += diff;
              nx += diff;
              activeSnapLines.push({ x: ox });
            }
          });
        });

        itemEdgesY.forEach((iy) => {
          otherEdgesY.forEach(oy => {
            if (Math.abs(iy - oy) < snapThreshold) {
              const diff = oy - iy;
              dy += diff;
              ny += diff;
              activeSnapLines.push({ y: oy });
            }
          });
        });
      });

      setSnapLines(activeSnapLines);
      transforming.initialItems.forEach(init => {
        updateItem(init.id, { x: init.x + dx, y: init.y + dy });
      });

    } else if (transforming.type === 'resize') {
      const dx = pos.x - transforming.startX;
      const dy = pos.y - transforming.startY;
      const targetInit = transforming.initialItems[0];
      const item = items.find(i => i.id === targetInit.id)!;
      
      let newW = targetInit.w, newH = targetInit.h, newX = targetInit.x, newY = targetInit.y;
      const handle = transforming.handle!;

      if (handle.includes('right')) newW += dx;
      if (handle.includes('left')) { newW -= dx; newX += dx; }
      if (handle.includes('bottom')) newH += dy;
      if (handle.includes('top')) { newH -= dy; newY += dy; }

      // 等比例缩放逻辑
      if (item.type === ItemType.IMAGE || item.type === ItemType.VIDEO) {
        const aspect = targetInit.w / targetInit.h;
        if (Math.abs(dx) > Math.abs(dy)) newH = newW / aspect;
        else newW = newH * aspect;
      }

      updateItem(item.id, { width: Math.max(20, newW), height: Math.max(20, newH), x: newX, y: newY });

    } else if (transforming.type === 'rotate') {
      const targetInit = transforming.initialItems[0];
      const centerX = targetInit.x + targetInit.w / 2;
      const centerY = targetInit.y + targetInit.h / 2;
      // 计算旋转角度
      const angle = Math.atan2(pos.y - centerY, pos.x - centerX) * (180 / Math.PI) + 90;
      updateItem(targetInit.id, { rotation: angle });
    }
  }, [transforming, items, updateItem, snapThreshold]);

  const endTransform = useCallback(() => {
    setTransforming(null);
    setSnapLines([]);
  }, []);

  return {
    transforming,
    snapLines,
    startTransform,
    updateTransform,
    endTransform
  };
};
