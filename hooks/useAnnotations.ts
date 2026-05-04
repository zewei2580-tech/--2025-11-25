
import { useState, useCallback } from 'react';
import { Point } from '../types';

export interface Annotation {
  id: string;
  type: 'arrow' | 'text' | 'number' | 'rectangle' | 'circle' | 'brush';
  points: Point[];
  text?: string;
  color: string;
  size: number;
}

export const useAnnotations = () => {
  const [annotations, setAnnotations] = useState<Annotation[]>([]);
  const [activeTool, setActiveTool] = useState<'none' | 'arrow' | 'text' | 'number' | 'eraser' | 'rectangle' | 'circle' | 'brush'>('none');
  const [color, setColor] = useState('#ef4444');
  const [isDrawing, setIsDrawing] = useState(false);
  const [activeId, setActiveId] = useState<string | null>(null);

  const addAnnotation = useCallback((type: Annotation['type'], pos: Point, initialText?: string) => {
    const id = crypto.randomUUID();
    const newAnno: Annotation = {
      id,
      type,
      points: type === 'brush' ? [pos] : [pos, pos],
      color,
      size: type === 'brush' || type === 'arrow' ? 4 : 24,
      text: initialText
    };
    setAnnotations(prev => [...prev, newAnno]);
    if (type !== 'number' && type !== 'text') {
        setActiveId(id);
        setIsDrawing(true);
    }
    return id;
  }, [color]);

  const updateCurrentAnnotation = useCallback((pos: Point) => {
    if (!activeId || !isDrawing) return;
    setAnnotations(prev => prev.map(a => 
      a.id === activeId 
        ? (a.type === 'brush' ? { ...a, points: [...a.points, pos] } : { ...a, points: [a.points[0], pos] })
        : a
    ));
  }, [activeId, isDrawing]);

  const stopDrawing = useCallback(() => {
    setIsDrawing(false);
    setActiveId(null);
  }, []);

  const clearAnnotations = useCallback(() => {
    setAnnotations([]);
    setActiveTool('none');
  }, []);

  const undoLast = useCallback(() => {
    setAnnotations(prev => prev.slice(0, -1));
  }, []);

  return {
    annotations,
    setAnnotations,
    activeTool,
    setActiveTool,
    color,
    setColor,
    isDrawing,
    addAnnotation,
    updateCurrentAnnotation,
    stopDrawing,
    clearAnnotations,
    undoLast
  };
};
