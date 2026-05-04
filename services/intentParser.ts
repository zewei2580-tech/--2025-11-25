
import { GenerationSettings, InferenceSettings, ItemType, CanvasItem } from '../types';
import { getEvolutionDirective } from './evolutionService';

export interface GenerationTask {
  nid: string;
  prompt: string;
  infCfg?: InferenceSettings;
}

/**
 * 解析原始输入，将其转化为具体的生成任务队列
 */
export const parseGenerationIntent = (
  rawPrompt: string,
  contextItem: CanvasItem | null,
  globalSettings?: Partial<GenerationSettings>
): { tasks: GenerationTask[], isEvolution: boolean, level?: number } => {
  const isEvolution = rawPrompt.startsWith('__EVOLUTION__');
  const isInference = rawPrompt.startsWith('inference:');
  const imageCount = globalSettings?.imageCount || 1;
  
  let processedTasks: GenerationTask[] = [];
  let evolutionLevel: number | undefined;

  // 1. 处理推演模式 (Inference)
  if (isInference) {
    const [_, data] = rawPrompt.split(':');
    const [p, inf, countStr, recipeId, subType] = data.split('|');
    const influence = parseFloat(inf);
    const finalCount = Math.max(parseInt(countStr) || 1, imageCount);
    const subjectType = subType || 'industrial';

    if (finalCount > 1) {
      const baseInfluences = [0.95, 0.75, 0.55, 0.35];
      processedTasks = Array.from({ length: finalCount }).map((_, i) => ({
        nid: crypto.randomUUID(),
        prompt: p,
        infCfg: {
          prompt: p,
          influence: i < baseInfluences.length ? baseInfluences[i] : influence,
          style: globalSettings?.style || 'industrial',
          recipeId: recipeId || globalSettings?.recipeId,
          subjectType: subjectType as any
        }
      }));
    } else {
      processedTasks = [{
        nid: crypto.randomUUID(),
        prompt: p,
        infCfg: {
          prompt: p,
          influence,
          style: globalSettings?.style || 'industrial',
          recipeId: recipeId || globalSettings?.recipeId,
          subjectType: subjectType as any
        }
      }];
    }
    return { tasks: processedTasks, isEvolution: false };
  }

  // 2. 处理智能演化模式 (Evolution)
  if (isEvolution && contextItem) {
    const parts = rawPrompt.split('|');
    evolutionLevel = parseInt(parts[1]);
    const isCnc = parts.length > 2 && parts[2] === 'CNC';
    
    const baseDirective = getEvolutionDirective(
      evolutionLevel || 60, 
      contextItem.prompt || "industrial design", 
      isCnc
    );

    processedTasks = Array.from({ length: imageCount }).map((_, i) => ({
      nid: crypto.randomUUID(),
      prompt: i === 0 ? baseDirective : `${baseDirective} --variation ${i}`
    }));

    return {
      tasks: processedTasks,
      isEvolution: true,
      level: evolutionLevel
    };
  }

  // 3. 处理“分别生成”逻辑 - 强化锁定
  // 只有当提示词显式包含“分别”或“each”时才进行拆分，防止玩法模板中的逗号触发拆分。
  const separationKeywords = ["分别", "各自", "each", "separately"];
  const hasExplicitSeparationIntent = separationKeywords.some(kw => rawPrompt.toLowerCase().includes(kw));
  
  if (hasExplicitSeparationIntent) {
    let cleanPrompt = rawPrompt.replace(/^(?:我想|请|能不能|帮我|能否)?(?:分别生成|分别设计|分别|生成|设计|各自生成|各自设计|each|separately generate|generate separately)\s*/i, '');
    const subjects = cleanPrompt.split(/(?:\s*[，、]\s*|\s+和\s+|\s+以及\s+|\s+与\s+|\s+与及\s+)/i)
                                .map(s => s.trim())
                                .filter(s => s.length > 0);
    
    if (subjects.length > 1) {
      processedTasks = [];
      subjects.forEach(s => {
        for(let i=0; i<imageCount; i++) {
          processedTasks.push({ nid: crypto.randomUUID(), prompt: s + (i > 0 ? ` --variation ${i}` : '') });
        }
      });
      return { tasks: processedTasks, isEvolution: false };
    }
  }

  // 4. 普通生成模式
  processedTasks = Array.from({ length: imageCount }).map((_, i) => ({
    nid: crypto.randomUUID(),
    prompt: i === 0 ? rawPrompt : `${rawPrompt} --variation ${i}`
  }));

  return {
    tasks: processedTasks,
    isEvolution: false
  };
};
