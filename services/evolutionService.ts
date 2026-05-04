
/**
 * 智能演化阶段接口定义
 */
export interface EvolutionStage {
  id: string;
  label: string;
  min: number;
  max: number;
  description: string;
  directive: string;
}

/**
 * 视角约束核心协议 (CORE PROTOCOL)
 * 强化版：明确要求保持绝对透视与空间取向，严禁旋转偏移。
 */
const CORE_PROTOCOL = "CORE PROTOCOL: Maintain the ABSOLUTE camera perspective and spatial orientation of the reference image. The evolved object MUST occupy the exact same 3D bounding box. DO NOT rotate the object. DO NOT rotate, shift, or re-orient the camera. All new features must be carved INTO the existing volume boundaries.";

/**
 * CNC 机械加工专用协议
 */
const CNC_PROTOCOL = `CNC MACHINING MANDATE: 
- PRIMARY LOGIC: Subtractive machining. Prioritize bold negative volume cuts (Subtractive Sculpting).
- GEOMETRIC ECHO: Implement rhythmic repetition of shapes (slots, fins, chamfers) to establish subconscious order. 
- BEVEL LOGIC: Use large-angle chamfers and clean-cut bevels to define transitions. 
- ALIGNMENT: Absolute parallelism and concentricity. All features must follow a logical spatial grid.`;

/**
 * 严格负向约束 (黑名单)
 */
const CNC_NEGATIVE_MANDATE = "STRICT PROHIBITION: randomness, chaos, asymmetrical layouts, mismatched shapes, organic mess, cluttered or non-functional details, disorganized patterns. ZERO TOLERANCE for perspective drift.";

/**
 * 工业设计演化阶梯定义 (ID Evolution Ladder)
 */
export const EVOLUTION_STAGES: EvolutionStage[] = [
  {
    id: 'polish',
    label: '曲面打磨 (Polish)',
    min: 0,
    max: 25,
    description: '优化曲面至 Class-A 标准，消除 AI 生成噪点。',
    directive: 'Focus on Class-A surfacing: ensure smooth, tensioned surfaces with G2 Curvature Continuity at all transitions. Remove AI visual noise.'
  },
  {
    id: 'detailing',
    label: '特征刻画 (Detailing)',
    min: 26,
    max: 60,
    description: '锐化特征线，通过负形切削建立几何秩序。',
    directive: 'Refine primary volumes with precise subtractive sculpting. Refine all primary feature lines using variable section chamfers. Focus on geometric flow and weight-reduction pockets.'
  },
  {
    id: 'reconstruction',
    label: '结构重组 (Recon)',
    min: 61,
    max: 85,
    description: '基于原始体量尝试重构，优化功能布局。',
    directive: 'Advanced Volumetric Manipulation: Confidently redefine major surface volumes using Subtractive Cut logic while respecting original 3D massing.'
  },
  {
    id: 'radical',
    label: '激进演化 (Radical)',
    min: 86,
    max: 100,
    description: '跨越设计范式的重塑，探索未来科技美学。',
    directive: 'Industrial Paradigm Evolution: Re-imagine the design entirely using future-tech aesthetic logic and vanishing creases.'
  }
];

/**
 * 根据演化强度获取对应的阶段数据
 */
export const getEvolutionStage = (level: number): EvolutionStage => {
    return EVOLUTION_STAGES.find(s => level >= s.min && level <= s.max) || EVOLUTION_STAGES[0];
};

/**
 * 生成最终发给图像生成模型的演化指令串
 */
export const getEvolutionDirective = (level: number, basePrompt: string, isCncMode: boolean = false): string => {
  const stage = getEvolutionStage(level);
  
  let finalDirective = stage.directive;
  
  // 如果开启了 CNC 模式，增强指令集的逻辑严密性
  if (isCncMode) {
    finalDirective = `${CNC_PROTOCOL}\n${stage.directive}\n${CNC_NEGATIVE_MANDATE}`;
  }

  return `ID EVOLUTION MANDATE (Target Level: ${level}% - Phase: ${stage.label}):
${finalDirective}
${CORE_PROTOCOL}
Contextual Product Context: ${basePrompt}.
Style Context: High-end industrial design product photography, premium studio lighting, material precision.`;
};
