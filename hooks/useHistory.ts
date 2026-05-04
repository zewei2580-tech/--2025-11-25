
import { useState, useCallback, useRef } from 'react';
import { CanvasItem } from '../types';

export const useHistory = (initialItems: CanvasItem[]) => {
  const [past, setPast] = useState<CanvasItem[][]>([]);
  const [present, setPresent] = useState<CanvasItem[]>(initialItems);
  const [future, setFuture] = useState<CanvasItem[][]>([]);

  // 使用 ref 记录上一次提交的时间，防止短时间内产生过多历史记录
  const lastCommitTime = useRef<number>(0);

  const canUndo = past.length > 0;
  const canRedo = future.length > 0;

  /**
   * 提交新状态到历史栈
   * 优化：移除对 present 的依赖，使用内部状态更新逻辑防止异步闭包覆盖问题
   */
  const commit = useCallback((newItems: CanvasItem[]) => {
    const now = Date.now();
    
    setPresent(currentPresent => {
      // 深度比较，如果数据没变则跳过
      if (JSON.stringify(newItems) === JSON.stringify(currentPresent)) return currentPresent;
      
      // 记录当前状态到过去，清空未来
      setPast(prevPast => [...prevPast, currentPresent]);
      setFuture([]);
      lastCommitTime.current = now;
      
      return newItems;
    });
  }, []);

  /**
   * 撤销
   */
  const undo = useCallback(() => {
    if (!canUndo) return present;
    const previous = past[past.length - 1];
    const newPast = past.slice(0, past.length - 1);
    
    setFuture(prev => [present, ...prev]);
    setPresent(previous);
    setPast(newPast);
    return previous;
  }, [canUndo, past, present]);

  /**
   * 重做
   */
  const redo = useCallback(() => {
    if (!canRedo) return present;
    const next = future[0];
    const newFuture = future.slice(1);
    
    setPast(prev => [...prev, present]);
    setPresent(next);
    setFuture(newFuture);
    return next;
  }, [canRedo, future, present]);

  /**
   * 重置历史
   */
  const resetHistory = useCallback((newItems: CanvasItem[]) => {
    setPast([]);
    setPresent(newItems);
    setFuture([]);
  }, []);

  return {
    items: present,
    setItems: setPresent,
    commit,
    undo,
    redo,
    canUndo,
    canRedo,
    resetHistory
  };
};
