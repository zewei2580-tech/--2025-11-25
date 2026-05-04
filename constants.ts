export const CANVAS_BG_COLOR = '#f4f4f5';

export const STYLES = [
  { id: 'general', label: '通用创作', promptSuffix: 'High quality professional photography, balanced lighting, standard detail' },
  { 
    id: 'industrial', 
    label: '工业设计 (ID/CAD)', 
    promptSuffix: 'Professional industrial design product photography, studio lighting, Class-A surfacing, G2 curvature continuity, precise parting lines, zero-gap assembly, CMF detailing, high-end material semantics, sophisticated light transitions, subtractive cut logic, 1k resolution' 
  },
  { id: 'sketch', label: '草图手绘', promptSuffix: 'Professional industrial design sketch, clean lines, Copic markers, cross-hatching, white background, technical annotations' },
  { id: '3d_render', label: '3D 渲染', promptSuffix: 'Octane render, 1k, Unreal Engine 5 style, ray tracing, hyper-realistic, global illumination' },
  { id: 'minimalist', label: '极简主义', promptSuffix: 'Dieter Rams style, functionalist, minimalist design, neutral palette, pure geometric forms, 1k resolution' }
];

export const ASPECT_RATIOS = [
  { id: '1:1', label: '正方形', width: 512, height: 512 },
  { id: '16:9', label: '宽屏', width: 910, height: 512 },
  { id: '9:16', label: '竖屏', width: 512, height: 910 },
  { id: '4:3', label: '经典', width: 682, height: 512 },
  { id: '3:4', label: '纵向', width: 512, height: 682 }
];

export const CMF_LIBRARY = {
  "polished_chrome": { label: "抛光铬", color: "#ffffff", metalness: 1.0, roughness: 0.05 },
  "brushed_alum": { label: "拉丝铝", color: "#d1d5db", metalness: 0.9, roughness: 0.3 },
  "matte_black_plastic": { label: "磨砂黑塑料", color: "#1a1a1a", metalness: 0.1, roughness: 0.8 },
  "industrial_orange": { label: "工业橙", color: "#ff6b00", metalness: 0.0, roughness: 0.4 },
  "anodized_black": { label: "阳极氧化黑", color: "#0a0a0a", metalness: 0.7, roughness: 0.3 },
  "frosted_glass": { label: "磨砂玻璃", color: "#ffffff", opacity: 0.4, roughness: 0.2 },
  "carbon_fiber": { label: "碳纤维", color: "#111111", metalness: 0.4, roughness: 0.5 },
  "emissive_blue": { label: "发光蓝", color: "#3b82f6", emissiveIntensity: 2.0, metalness: 0.0, roughness: 0.1 }
};

export const PRESET_PLAYSTYLES = [
  {
    id: 'transparent_exploration',
    name: '透明探索版 (Mi-Style)',
    description: '展示内部精密的 PCB、散热管及机械构造',
    template: 'A high-tech transparent edition of {{subject}}, translucent matte shell, visible internal hardware parts, copper heatpipes, modular battery details, high-end CMF, 1k resolution',
    category: 'industrial',
    createdAt: 0
  },
  {
    id: 'exploded_view',
    name: '爆炸拆解图 (Exploded)',
    description: '工业级的零件拆解示意图，展现装配逻辑',
    template: 'Professional exploded view diagram of {{subject}}, components hovering in organized technical space, clean shadow, technical layout, precise parting lines, museum background, 1k',
    category: 'industrial',
    createdAt: 0
  },
  {
    id: 'three_view_blueprint',
    name: '标准化三视图 (3-Views)',
    description: '正交投影比例，包含正面、侧面、顶面',
    template: 'Orthographic three-view blueprint of {{subject}}, front view, side view, and top view precisely aligned, white vector lines on gray technical background, minimalist annotations, 1k',
    category: 'industrial',
    createdAt: 0
  },
  {
    id: 'sketch_to_final',
    name: '草图转 3D 渲染',
    description: '保留手绘结构，赋予极致的真实材质与布光',
    template: 'Photorealistic 3D Octane render evolved from sketch lines of {{subject}}, high-end materials, soft studio lighting, ultra-realistic surfaces, clean geometry, 1k resolution',
    category: 'industrial',
    createdAt: 0
  },
  {
    id: 'design_refinement',
    name: '设计修复与曲面优化',
    description: '自动修正低级错误，提升曲面张力与细节精度',
    template: 'Refined industrial design optimization of {{subject}}, perfect G2 continuity, optimized ergonomic surfaces, crisp parting lines, high-precision manufacturing details, 1k',
    category: 'industrial',
    createdAt: 0
  },
  {
    id: 'material_migration',
    name: '材质迁移 (CMF Transfer)',
    description: '保持形状 100% 不变，仅替换视觉材质与纹理',
    template: 'Strict geometry preservation of {{subject}}, only migrate material and texture from reference, high-end CMF change, premium finish, realistic light interaction, 1k',
    category: 'industrial',
    createdAt: 0
  },
  {
    id: 'cross_modal_hybrid',
    name: '跨模态风格混合',
    description: '例如：赛博朋克融合极简主义，创造新视觉 DNA',
    template: 'A visionary hybrid design of {{subject}}, merging minimalist industrial logic with organic cybernetic details, carbon fiber and warm wood finish, unique visual DNA, 1k',
    category: 'art',
    createdAt: 0
  },
  {
    id: 'ecommerce_angles_sheet',
    name: '多机位展示 Sheet',
    description: '一站式输出不同角度的产品电商图集',
    template: 'Professional product display sheet for {{subject}}, collage of 4 different camera angles, consistent high-end lighting, hero shot plus detail crops, white background, 1k',
    category: 'poster',
    createdAt: 0
  }
];