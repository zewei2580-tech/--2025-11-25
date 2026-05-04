
import { useEffect, useRef } from 'react';
import { CanvasItem, ItemType } from '../types';
import { saveSnapshot, getAllSnapshots, ProjectSnapshot } from '../services/dbService';

export const useProjectPersistence = (
  items: CanvasItem[],
  onLoaded: (items: CanvasItem[]) => void
) => {
  const saveTimeoutRef = useRef<number | null>(null);
  const isInitialLoad = useRef<boolean>(true);

  // 1. 初始加载
  useEffect(() => {
    const initLoad = async () => {
      const snapshots = await getAllSnapshots();
      if (snapshots.length > 0) {
        onLoaded(snapshots[0].items);
      }
      isInitialLoad.current = false;
    };
    initLoad();
  }, []);

  // 2. 自动保存逻辑 (防抖 2s)
  useEffect(() => {
    if (isInitialLoad.current || items.length === 0) return;

    if (saveTimeoutRef.current) {
        window.clearTimeout(saveTimeoutRef.current);
    }

    saveTimeoutRef.current = window.setTimeout(async () => {
      // 查找最近一个有内容的资产作为快照缩略图
      const lastAsset = [...items].reverse().find(i => 
        (i.type === ItemType.IMAGE || i.type === ItemType.VIDEO) && i.content
      );

      const snapshot: ProjectSnapshot = {
        id: 'current_project', // 这里目前简化处理，后续可支持多项目
        name: lastAsset?.prompt?.slice(0, 30) || 'Canvas Project',
        items,
        thumbnail: (lastAsset?.type === ItemType.IMAGE ? lastAsset.content : ''),
        updatedAt: Date.now()
      };

      try {
        await saveSnapshot(snapshot);
        console.debug('Project auto-saved');
      } catch (err) {
        console.error('Failed to auto-save:', err);
      }
    }, 2000);

    return () => {
      if (saveTimeoutRef.current) window.clearTimeout(saveTimeoutRef.current);
    };
  }, [items]);

  return {
      isInitialLoad: isInitialLoad.current
  };
};
