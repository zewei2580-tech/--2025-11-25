
import { GoogleGenAI, Type } from "@google/genai";
import { SpatialConfig, InferenceSettings, PartCMF, TopologyStrategy } from "../types";

declare global {
  interface Window {
    aistudio?: {
      hasSelectedApiKey: () => Promise<boolean>;
      openSelectKey: () => Promise<void>;
    };
  }
}

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));
const VALID_ASPECT_RATIOS = ['1:1', '3:4', '4:3', '9:16', '16:9'];

const PERSPECTIVE_LOCK = `[PERSPECTIVE LOCK PROTOCOL]: 
1. Maintain the EXACT 3D camera orientation, elevation, and azimuth of the reference image. 
2. The object must remain in the same spatial bounding box. 
3. DO NOT introduce any rotation, camera shift, or perspective changes. 
4. DO NOT change the environment background.`;

const INDUSTRIAL_PRECISION_MANDATE = `[INDUSTRIAL DESIGN PRECISION MANDATE]:
- AVOID: Floating parts, intersecting non-logical solids, excessive decorative detailing.
- ENFORCE: Functional parting lines, ergonomic surface transitions, and manufacturable geometry.
- MATERIAL: Consistent high-end CMF semantics.
- TOPOLOGY: Focus on internal geometric logic.`;

const WORLD_MODEL_TWIN_MANDATE = `[WORLD MODEL DIGITAL TWIN PROTOCOL - STRICT STRUCTURE RETENTION]:
- INPUT_0 (Reference Image): This is the current 3D viewport snapshot.
- MANDATE: Maintain 100% geometric alignment with the silhouette and contours of Input_0.
- TASK: Translate this low-fidelity 3D view into a photorealistic industrial design proposal.
- DO NOT: Add new parts or change the camera angle.
- DO: Add realistic material textures (CMF), studio lighting, plausible shadows, and environment reflections.
- QUALITY: Class-A surfacing and G2 continuity must be visually simulated.`;

const TOPOLOGY_MAP: Record<TopologyStrategy, string> = {
  split: "FORCIBLY fragment the object into logical segments, introducing clean parting lines and assembly gaps.",
  cut: "AGGRESSIVELY carve out precise Boolean cut-outs and negative volumes from the primary mass.",
  bend: "Deform the primary volume along curvilinear paths, creating ergonomic sweeping surfaces.",
  twist: "Apply complex rotational torsion to structural elements to create dynamic visual tension.",
  pattern: "Implement rhythmic procedural repetition of features across the surface shell with mathematical precision.",
  shell: "Hollow out the structure to reveal wall thickness and modular internal ribbing.",
  boolean: "Execute a complex intersection of primitives to create new functional voids and volumes.",
  stack: "Reconstruct the volume as a vertical hierarchy of distinct, stacked layers.",
  interweave: "Intertwine the structural skeleton and surface skin in a complex weaving logic.",
  texture: "Overwrite smooth surfaces with intricate topographical micro-textures and grain patterns.",
  penetrate: "Force distinct masses to intersect and pass through each other in a clean, logical manner.",
  fragment: "Break the continuity of primary feature lines with rhythmic interruptions and rhythmic extensions.",
  accumulate: "Cluster and stack components in a semi-ordered volumetric arrangement.",
  fold: "Apply metal-sheet folding logic to all major surface planes, creating sharp, logical bends.",
  edge_break: "Introduce sudden, aggressive sharp breaks on smooth surfaces to catch light dramatically.",
  nested_space: "Expose internal component layers through strategic gaps in the outer shell.",
  conflict: "Create dynamic tension by having opposing feature lines move against each other aggressively.",
  fade_surface: "Apply advanced vanishing surface logic where curvature smoothly transitions to zero radius.",
  vanishing_crease: "Inject aggressive vanishing creases (Trapezoid fades) that smoothly transition from sharp edges to zero-curvature surfaces.",
  variable_chamfer: "Implement dynamic variable-radius chamfers that rhythmically transition along primary parting lines.",
  geometric_echo: "Apply geometric echo logic, creating rhythmic repetitions of formal motifs to establish structural resonance.",
  parametric_skin: "Implement a high-precision geometric parametric shell using mathematical Voronoi or tessellation logic. The structure must have physical depth and follow surface curvature with absolute precision.",
  parting_line: "Execute functional parting line design. Carve precise Class-A assembly gaps (shadow gaps) with defined radius transitions and manufacturing-ready seams between joined components.",
  symmetry: "Enforce ABSOLUTE BILATERAL SYNERGY and mathematical symmetry across the central axis. Correct any asymmetrical noise in the reference geometry.",
  geometric_lines: "Inject aggressive geometric feature motifs (V-shape, L-shape, X-shape, Trapezoid, and Lightning-bolt paths) as primary structural transitions. These must be integrated as deep physical topology, not just surface textures.",
  engraved_detail: "Carve deep, high-precision technical panel lines and functional recessed grooves. Maintain manufacturing-ready precision for all engraved features.",
  layered_nesting: "Re-architect the volume with nested component layers, staggered volumetric offsets, and exposed internal structural strata.",
  hard_surface: "Aggressively bevel all primary masses into sharp, multi-faceted hard-surface planes with defined vertices and low-poly aesthetic precision.",
  geometric_grille: "Introduce mathematical rhythmic ventilation grilles and repetitive structural array patterns into the object's skin."
};

const MASKED_INPAINTING_PROTOCOL = `[SPATIAL MASKING PROTOCOL - STRICT PIXEL ALIGNMENT]:
1. INPUT_0: SOURCE_IMAGE.
2. INPUT_1: BINARY_MASK (Pure Black and White).
3. MANDATE: You are performing a local modification. The WHITE areas in INPUT_1 represent the ONLY regions where you are permitted to generate new content or alter pixels.
4. PROTECTION: All pixels corresponding to the BLACK regions of INPUT_1 must remain 100% mathematically and visually untouched. No blending, no edge bleeding outside the white zone.
5. CONTEXT: Use the surrounding SOURCE_IMAGE context to ensure seamless lighting, shadow casting, and material continuity.
6. TASK: In-paint the white region based on: `;

const normalizeAspectRatio = (ratio?: string): string => {
  if (!ratio) return '1:1';
  if (VALID_ASPECT_RATIOS.includes(ratio)) return ratio;
  try {
    const [w, h] = ratio.split(':').map(Number);
    if (isNaN(w) || isNaN(h)) return '1:1';
    const numericRatio = w / h;
    const targets = [{ id: '1:1', val: 1 }, { id: '4:3', val: 4/3 }, { id: '3:4', val: 3/4 }, { id: '16:9', val: 16/9 }, { id: '9:16', val: 9/16 }];
    return targets.reduce((prev, curr) => Math.abs(curr.val - numericRatio) < Math.abs(prev.val - numericRatio) ? curr : prev).id;
  } catch (e) { return '1:1'; }
};

export const getClosestGeminiRatio = (width: number, height: number): string => {
    const ratio = width / height;
    const targets = [{ id: '1:1', val: 1 }, { id: '4:3', val: 4/3 }, { id: '3:4', val: 3/4 }, { id: '16:9', val: 16/9 }, { id: '9:16', val: 9/16 }];
    return targets.reduce((prev, curr) => Math.abs(curr.val - ratio) < Math.abs(prev.val - ratio) ? curr : prev).id;
};

const ensureApiKey = async () => { if (typeof window.aistudio !== 'undefined') { const hasKey = await window.aistudio.hasSelectedApiKey(); if (!hasKey) await window.aistudio.openSelectKey(); } };

async function retryWithBackoff<T>(operation: () => Promise<T>, retries = 3, delay = 2000): Promise<T> {
  try { return await operation(); } catch (error: any) {
    let errorStr = (typeof error === 'string' ? error : error.message || JSON.stringify(error)).toLowerCase();
    if (errorStr.includes('requested entity was not found')) { if (typeof window.aistudio !== 'undefined') await window.aistudio.openSelectKey(); }
    if (isRetryableError(errorStr) && retries > 0) { await sleep(delay); return retryWithBackoff(operation, retries - 1, delay * 2); }
    throw error;
  }
}

const isRetryableError = (s: string) => s.includes('overloaded') || s.includes('unavailable') || s.includes('429') || s.includes('500') || s.includes('503');

const getAI = () => new GoogleGenAI({ apiKey: process.env.API_KEY });

const getSpatialInstructions = (spatial?: SpatialConfig): string => {
    if (!spatial) return "";
    let viewDesc = ""; const ele = spatial.elevation; const azi = spatial.azimuth;
    if (ele > 80) viewDesc += "Absolute direct top-down plan view, ";
    else if (ele > 40) viewDesc += "High-angle perspective, ";
    else if (ele < -15) viewDesc += "Dramatic low-angle hero shot, ";
    else viewDesc += "Standard eye-level studio shot, ";
    const normalizedAzi = ((azi % 360) + 360) % 360;
    if (normalizedAzi > 345 || normalizedAzi < 15) viewDesc += "absolute front view. ";
    else if (normalizedAzi >= 15 && normalizedAzi < 75) viewDesc += "front-right 3/4 profile. ";
    else if (normalizedAzi >= 75 && normalizedAzi < 105) viewDesc += "exact right-side profile. ";
    else if (normalizedAzi >= 165 && normalizedAzi < 195) viewDesc += "absolute back view. ";
    else viewDesc += "3/4 profile view. ";
    return `SPATIAL MANDATE: Camera {Elevation: ${Math.round(ele)}°, Azimuth: ${Math.round(normalizedAzi)}°}. ${viewDesc}`;
};

export const recommendTopology = async (imageBase64: string): Promise<TopologyStrategy[]> => {
    return retryWithBackoff(async () => {
        const ai = getAI();
        const data = imageBase64.split(',')[1] || imageBase64;
        const mimeType = imageBase64.split(';')[0].split(':')[1] || 'image/jpeg';
        
        const response = await ai.models.generateContent({
            model: 'gemini-3-flash-preview',
            contents: [{
                parts: [
                    { inlineData: { data, mimeType } },
                    { text: `Analyze the geometry of this object. Select exactly 3 topology strategies from the list that would create the most aesthetically pleasing industrial design variations.
                    Available strategies: split, cut, bend, twist, pattern, shell, boolean, stack, interweave, texture, penetrate, fragment, accumulate, fold, edge_break, nested_space, conflict, fade_surface, vanishing_crease, variable_chamfer, geometric_echo, parametric_skin, parting_line, symmetry, geometric_lines, engraved_detail, layered_nesting, hard_surface, geometric_grille.
                    Return ONLY a JSON array of the 3 strategy IDs.` }
                ]
            }],
            config: { 
                responseMimeType: "application/json",
                responseSchema: {
                    type: Type.ARRAY,
                    items: { type: Type.STRING }
                }
            }
        });
        return JSON.parse(response.text) as TopologyStrategy[];
    });
};

export const parseModelSemanticCommand = async (command: string, partList: string[]): Promise<any> => {
    return retryWithBackoff(async () => {
        const ai = getAI();
        const prompt = `You are an AI OS for a 3D Industrial Design viewport. 
        User Intent: "${command}". 
        Available Model Components: ${partList.slice(0, 50).join(', ')}.
        
        INSTRUCTIONS:
        1. Action 'paint': Change color/material. targets should be part names.
        2. Action 'highlight': Emphasize parts visually.
        3. Action 'explode': Set explodeFactor (0 to 1).
        4. Action 'view': Change camera. Provide spatialConfig (azimuth, elevation, distance).
        5. Action 'reset': Revert all CMF and view changes.
        
        Map the user's natural language to the most relevant component names provided. 
        Return a valid JSON object.`;

        const response = await ai.models.generateContent({
            model: 'gemini-3-flash-preview',
            contents: [{ text: prompt }],
            config: { 
                responseMimeType: "application/json",
                responseSchema: {
                    type: Type.OBJECT,
                    properties: {
                        action: { 
                            type: Type.STRING, 
                            description: "The intended operation: 'paint', 'highlight', 'explode', 'view', 'reset'" 
                        },
                        targets: { 
                            type: Type.ARRAY, 
                            items: { type: Type.STRING },
                            description: "List of component names to act upon"
                        },
                        params: {
                            type: Type.OBJECT,
                            properties: {
                                color: { type: Type.STRING, description: "HEX color code for paint action" },
                                metalness: { type: Type.NUMBER, description: "0 to 1" },
                                roughness: { type: Type.NUMBER, description: "0 to 1" },
                                explodeFactor: { type: Type.NUMBER, description: "0 to 1 for explode action" },
                                spatialConfig: {
                                    type: Type.OBJECT,
                                    properties: {
                                        azimuth: { type: Type.NUMBER },
                                        elevation: { type: Type.NUMBER },
                                        distance: { type: Type.NUMBER }
                                    }
                                }
                            }
                        },
                        feedback: { 
                            type: Type.STRING, 
                            description: "A short professional confirmation message in Chinese" 
                        }
                    },
                    required: ["action", "feedback"]
                }
            }
        });
        return JSON.parse(response.text);
    });
};

export const generateInteractionSuggestions = async (modelName: string): Promise<string[]> => {
    return retryWithBackoff(async () => {
        const ai = getAI();
        const prompt = `You are a creative industrial design assistant. 
        The user is interacting with a 3D model: "${modelName}".
        Generate 5 creative, short, and actionable interaction commands in Chinese. 
        Categories: 
        - Animation (e.g., 展开爆炸图, 打开盖子)
        - Material (e.g., 切换到磨砂铝, 设为半透明材质)
        - Environment (e.g., 放置在阳光充足的办公室, 黑色极简背景)
        
        Return ONLY a JSON array of 5 strings.`;

        const response = await ai.models.generateContent({
            model: 'gemini-3-flash-preview',
            contents: [{ text: prompt }],
            config: { 
                responseMimeType: "application/json",
                responseSchema: {
                    type: Type.ARRAY,
                    items: { type: Type.STRING }
                }
            }
        });
        return JSON.parse(response.text);
    });
};

export const generateBOMData = async (partList: string[]): Promise<any> => {
    return retryWithBackoff(async () => {
        const ai = getAI();
        const prompt = `Translate and organize these raw 3D component names into a professional semantic BOM (Bill of Materials). 
        Raw Names: ${partList.slice(0, 40).join(', ')}.
        Return a JSON list of objects with: { id: string, name: string, description: string, material: string }. 
        Language: Chinese.`;

        const response = await ai.models.generateContent({
            model: 'gemini-3-flash-preview',
            contents: [{ text: prompt }],
            config: { 
                responseMimeType: "application/json",
                responseSchema: {
                    type: Type.OBJECT,
                    properties: {
                        id: { type: Type.STRING },
                        name: { type: Type.STRING },
                        description: { type: Type.STRING },
                        material: { type: Type.STRING }
                    },
                    required: ["id", "name", "description", "material"]
                }
            }
        });
        return JSON.parse(response.text);
    });
};

export const generateVideo = async (prompt: string, startImageBase64?: string): Promise<string> => {
    return retryWithBackoff(async () => {
        const ai = getAI();
        let operation;
        if (startImageBase64) {
            const data = startImageBase64.split(',')[1] || startImageBase64;
            const mimeType = startImageBase64.split(';')[0].split(':')[1] || 'image/png';
            operation = await ai.models.generateVideos({ 
                model: 'veo-3.1-fast-generate-preview', 
                prompt, 
                image: { imageBytes: data, mimeType },
                config: { numberOfVideos: 1, resolution: '720p', aspectRatio: '16:9' } 
            });
        } else {
            operation = await ai.models.generateVideos({ model: 'veo-3.1-fast-generate-preview', prompt, config: { numberOfVideos: 1, resolution: '720p', aspectRatio: '16:9' } });
        }
        
        while (!operation.done) { await new Promise(resolve => setTimeout(resolve, 5000)); operation = await ai.operations.getVideosOperation({ operation }); }
        const downloadLink = operation.response?.generatedVideos?.[0]?.video?.uri;
        return `${downloadLink}&key=${process.env.API_KEY}`;
    });
};

export const extractSubjectEssence = async (base64: string): Promise<string> => {
    return retryWithBackoff(async () => {
        const ai = getAI(); const data = base64.split(',')[1] || base64; const mimeType = base64.split(';')[0].split(':')[1] || 'image/jpeg';
        const response = await ai.models.generateContent({ model: 'gemini-3-flash-preview', contents: [{ parts: [{ inlineData: { data, mimeType } }, { text: "Describe this object's visual essence in 5 words." }] }] });
        return response.text?.trim() || "Modern design";
    });
};

export const chatWithGemini = async (prompt: string, history: { role: 'user' | 'model', parts: any[] }[] = [], useThinking: boolean = false, attachments: string[] = [], useSearch: boolean = false): Promise<string> => {
  return retryWithBackoff(async () => {
    const ai = getAI(); const model = useThinking ? 'gemini-3-pro-preview' : 'gemini-3-flash-preview';
    const config: any = { systemInstruction: "You are a professional visual designer." };
    if (useThinking) config.thinkingConfig = { thinkingBudget: 16384 }; if (useSearch) config.tools = [{ googleSearch: {} }];
    const currentParts: any[] = attachments.map(base64 => ({ inlineData: { data: base64.split(',')[1] || base64, mimeType: base64.split(';')[0].split(':')[1] || 'image/jpeg' } }));
    currentParts.push({ text: prompt });
    const response = await ai.models.generateContent({ model, contents: [...history, { role: 'user', parts: currentParts }], config });
    return response.text || "No response.";
  });
};

export const generateImage = async (prompt: string, styleSuffix: string, ratio: string, artisticScale: number = 50, resolution: string = '1K', spatial?: SpatialConfig, recipeInstruction?: string, usePro: boolean = false, isTwin: boolean = false, imageBase64?: string): Promise<string> => {
    return retryWithBackoff(async () => {
        if (usePro) await ensureApiKey(); 
        const ai = getAI(); 
        const model = usePro ? 'gemini-3-pro-image-preview' : 'gemini-2.5-flash-image';
        
        let finalPrompt = prompt;
        const parts: any[] = [];

        if (isTwin) {
            finalPrompt = `${WORLD_MODEL_TWIN_MANDATE}\nTARGET STYLE: ${prompt}\n${getSpatialInstructions(spatial)}\n${recipeInstruction || ''}. 1k resolution. Style: ${styleSuffix}.`;
            if (imageBase64) {
                const data = imageBase64.split(',')[1] || imageBase64;
                const mimeType = imageBase64.split(';')[0].split(':')[1] || 'image/png';
                parts.push({ inlineData: { data, mimeType } });
            }
        } else {
            finalPrompt = `${prompt}. ${getSpatialInstructions(spatial)} ${recipeInstruction || ''}. Style: ${styleSuffix}. 1k resolution.`;
        }

        parts.push({ text: finalPrompt });

        const config: any = { 
            imageConfig: { aspectRatio: normalizeAspectRatio(ratio) }
        };
        if (usePro) {
            config.imageConfig.imageSize = resolution;
            config.temperature = artisticScale / 50.0;
            config.seed = Math.floor(Math.random() * 2147483647);
        }

        const response = await ai.models.generateContent({ 
            model, 
            contents: [{ parts }], 
            config 
        });
        const part = response.candidates?.[0]?.content?.parts?.find(p => p.inlineData); if (part?.inlineData) return `data:${part.inlineData.mimeType};base64,${part.inlineData.data}`;
        throw new Error("Image failed.");
    });
};

export const generateTopologyVariation = async (imageBase64: string, ratio: string, styleSuffix: string, strategies: TopologyStrategy[] = [], usePro: boolean = false): Promise<string> => {
    return retryWithBackoff(async () => {
        if (usePro) await ensureApiKey(); 
        const ai = getAI(); 
        const model = usePro ? 'gemini-3-pro-image-preview' : 'gemini-2.5-flash-image';
        const data = imageBase64.split(',')[1] || imageBase64; 
        const mimeType = imageBase64.split(';')[0].split(':')[1] || 'image/jpeg';
        
        let strategyPrompt = "";
        if (strategies.length > 0) {
            strategyPrompt = "\n[CRITICAL VARIATION MANDATE]: You MUST PRIORITIZE the following topology changes over the existing pixels. FORCEFULLY REBUILD the internal structure while maintaining the silhouette skeleton.\n" + strategies.map(s => `- ${s.toUpperCase()}: ${TOPOLOGY_MAP[s]}`).join("\n");
        }

        const prompt = `Perform a high-precision industrial design topology variation on this object.
        ${PERSPECTIVE_LOCK}
        ${INDUSTRIAL_PRECISION_MANDATE}
        ${strategyPrompt}
        
        MANDATE: Preservation of global 3D massing is required, but INTERNAL surface topology must be AGGRESSIVELY RESTRUCTURED based on the commands above. Style: ${styleSuffix}.`;

        const config: any = { 
            imageConfig: { aspectRatio: normalizeAspectRatio(ratio) as any }
        };
        if (usePro) {
            config.seed = Math.floor(Math.random() * 2147483647);
        }

        const response = await ai.models.generateContent({ 
            model, 
            contents: [{ parts: [{ inlineData: { data, mimeType } }, { text: prompt }] }], 
            config
        });
        const part = response.candidates?.[0]?.content?.parts?.find(p => p.inlineData); if (part?.inlineData) return `data:${part.inlineData.mimeType};base64,${part.inlineData.data}`;
        throw new Error("Variation failed.");
    });
};

export const generateVisualPeel = async (imageBase64: string, ratio: string, usePro: boolean = false): Promise<string> => {
    return retryWithBackoff(async () => {
        if (usePro) await ensureApiKey(); 
        const ai = getAI(); 
        const model = usePro ? 'gemini-3-pro-image-preview' : 'gemini-2.5-flash-image';
        const data = imageBase64.split(',')[1] || imageBase64; 
        const mimeType = imageBase64.split(';')[0].split(':')[1] || 'image/jpeg';
        const prompt = "Industrial design visual peel. Render the core structural volume of this object, stripping away surface textures, colors, and branding. Use a neutral gray technical material. Maintain exact perspective and scale. Perspective Lock Protocol Active.";
        const config: any = { 
            imageConfig: { aspectRatio: normalizeAspectRatio(ratio) as any }
        };
        if (usePro) {
            config.seed = Math.floor(Math.random() * 2147483647);
        }

        const response = await ai.models.generateContent({ 
            model, 
            contents: [{ parts: [{ inlineData: { data, mimeType } }, { text: prompt }] }], 
            config
        });
        const part = response.candidates?.[0]?.content?.parts?.find(p => p.inlineData); 
        if (part?.inlineData) return `data:${part.inlineData.mimeType};base64,${part.inlineData.data}`;
        throw new Error("Visual Peel failed.");
    });
};

export const generateWithReferences = async (prompt: string, refs: {label: string, base64: string}[], ratio: string, styleSuffix: string, artisticScale: number = 50, resolution: string = '1K', spatial?: SpatialConfig, recipeInstruction?: string, inferenceConfig?: InferenceSettings, usePro: boolean = false): Promise<string> => {
    return retryWithBackoff(async () => {
        if (usePro) await ensureApiKey(); 
        const ai = getAI(); 
        const model = usePro ? 'gemini-3-pro-image-preview' : 'gemini-2.5-flash-image';
        const parts: any[] = refs.map(r => ({ inlineData: { data: r.base64.split(',')[1] || r.base64, mimeType: r.base64.split(';')[0].split(':')[1] || 'image/jpeg' } }));
        parts.push({ text: `${prompt}. ${getSpatialInstructions(spatial)}. ${recipeInstruction || ''}. 1k resolution.` });
        
        const config: any = { 
            imageConfig: { aspectRatio: normalizeAspectRatio(ratio) as any }
        };
        if (usePro) {
            config.imageConfig.imageSize = resolution;
            config.temperature = artisticScale / 50.0;
            config.seed = Math.floor(Math.random() * 2147483647);
        }

        const response = await ai.models.generateContent({ 
            model, 
            contents: [{ parts }], 
            config 
        });
        const part = response.candidates?.[0]?.content?.parts?.find(p => p.inlineData); if (part?.inlineData) return `data:${part.inlineData.mimeType};base64,${part.inlineData.data}`;
        throw new Error("Image failed.");
    });
};

export const editImage = async (sourceBase64: string, prompt: string, ratio: string, maskBase64?: string, usePro: boolean = false): Promise<string> => {
    return retryWithBackoff(async () => {
        if (usePro) await ensureApiKey();
        const ai = getAI(); 
        const model = usePro ? 'gemini-3-pro-image-preview' : 'gemini-2.5-flash-image';
        const parts: any[] = [
            { inlineData: { data: sourceBase64.split(',')[1] || sourceBase64, mimeType: sourceBase64.split(';')[0].split(':')[1] || 'image/jpeg' } }
        ];
        
        if (maskBase64) {
            parts.push({ inlineData: { data: maskBase64.split(',')[1] || maskBase64, mimeType: 'image/png' } });
            parts.push({ text: `${MASKED_INPAINTING_PROTOCOL}${prompt}. Use Input_1 as a strict pixel-by-pixel spatial instruction. Maintain 1k production quality.` });
        } else {
            parts.push({ text: `Modify the following image: ${prompt}.` });
        }

        const config: any = { 
            imageConfig: { aspectRatio: normalizeAspectRatio(ratio) }
        };
        if (usePro) {
            config.seed = Math.floor(Math.random() * 2147483647);
        }

        const response = await ai.models.generateContent({ 
            model, 
            contents: [{ parts }], 
            config
        });
        const part = response.candidates?.[0]?.content?.parts?.find(p => p.inlineData); if (part?.inlineData) return `data:${part.inlineData.mimeType};base64,${part.inlineData.data}`;
        throw new Error("Edit failed.");
    });
};

export const identifyPoint = async (base64: string, y: number, x: number, temperature: number = 0.8): Promise<string> => {
    return retryWithBackoff(async () => {
        const ai = getAI();
        const data = base64.split(',')[1] || base64;
        const mimeType = base64.split(';')[0].split(':')[1] || 'image/jpeg';
        
        const response = await ai.models.generateContent({
            model: 'gemini-3-flash-preview',
            contents: [{
                parts: [
                    { inlineData: { data, mimeType } },
                    { text: `你是一个专业的工业设计观察员。请描述图中归一化坐标 [y=${Math.round(y)}, x=${Math.round(x)}] 处的特征。
                    
                    【强制规范：极简语义标注】
                    - 严禁叙述性句子（严禁“这是一个...的...”）。
                    - 仅保留：[材质/颜色/状态] + [核心物体名称]。
                    - 示例：红色口袋、拉丝旋钮、散热格栅、侧边接缝。
                    - 长度：严格控制在 2-6 字以内。` }
                ]
            }],
            config: { temperature }
        });
        return response.text?.trim() || "特征点";
    });
};

export const detectAllPoints = async (base64: string, temperature: number = 0.8): Promise<{point: [number, number], label: string}[]> => {
    return retryWithBackoff(async () => {
        const ai = getAI();
        const data = base64.split(',')[1] || base64;
        const mimeType = base64.split(';')[0].split(':')[1] || 'image/jpeg';
        
        const response = await ai.models.generateContent({
            model: 'gemini-3-flash-preview',
            contents: [{
                parts: [
                    { inlineData: { data, mimeType } },
                    { text: `你是一个工业设计视觉解构专家。请识别图中关键的视觉特征锚点。
                    
                    【强制规范：极简语义标注】
                    1. label 必须极其简洁：[修饰语/材质/颜色] + [核心名称]。
                    2. 严禁叙述，字数控制在 2-6 字。
                    3. 坐标范围 0-1000。
                    4. 深度响应：
                       - 低深度 (${temperature.toFixed(1)} < 0.6)：仅返回约 8 个大部件核心点。
                       - 高深度 (${temperature.toFixed(1)} > 1.2)：返回 15 个以上点，包含螺丝、接缝、微型指示灯等极其细微的细节。
                    5. 返回 JSON 数组。` }
                ]
            }],
            config: { 
                responseMimeType: "application/json",
                temperature: temperature, 
                responseSchema: {
                    type: Type.ARRAY,
                    items: {
                        type: Type.OBJECT,
                        properties: {
                            point: { 
                                type: Type.ARRAY, 
                                items: { type: Type.NUMBER },
                                description: "[y, x] coordinates from 0-1000"
                            },
                            label: { 
                                type: Type.STRING,
                                description: "Extremely concise descriptive phrase in Chinese (2-6 chars)"
                            }
                        },
                        required: ["point", "label"]
                    }
                }
            }
        });
        const parsed = JSON.parse(response.text);
        if (!Array.isArray(parsed)) throw new Error("Invalid output format");
        return parsed;
    });
};

export const autoAlignPoints = async (sourceImg: string, sourcePoints: any[], targetImg: string, targetPoints: any[]): Promise<{sourceId: string, targetId: string}[]> => {
    return retryWithBackoff(async () => {
        const ai = getAI();
        const response = await ai.models.generateContent({
            model: 'gemini-3-flash-preview',
            contents: [{ role: 'user', parts: [{ inlineData: { data: sourceImg.split(',')[1] || sourceImg, mimeType: 'image/jpeg' } }, { text: "SOURCE" }, { inlineData: { data: targetImg.split(',')[1] || targetImg, mimeType: 'image/jpeg' } }, { text: `TARGET. Match points based on visual similarity. SourcePoints: ${JSON.stringify(sourcePoints)}. TargetPoints: ${JSON.stringify(targetPoints)}.` }] }],
            config: { responseMimeType: "application/json" }
        });
        return JSON.parse(response.text);
    });
};

export const detectImageJSONSegments = async (base64: string): Promise<any> => {
    return retryWithBackoff(async () => {
        const ai = getAI();
        const response = await ai.models.generateContent({ model: 'gemini-3-flash-preview', contents: [{ parts: [{ inlineData: { data: base64.split(',')[1] || base64, mimeType: 'image/jpeg' } }, { text: "Segment this image into JSON parts." }] }], config: { responseMimeType: "application/json" } });
        return JSON.parse(response.text);
    });
};

export const extractDesignRecipe = async (images: string[], baselineIndex?: number): Promise<string> => {
    return retryWithBackoff(async () => {
        const ai = getAI(); const parts = images.map(img => ({ inlineData: { data: img.split(',')[1] || img, mimeType: 'image/jpeg' } }));
        const response = await ai.models.generateContent({ model: 'gemini-3-flash-preview', contents: [{ parts: [...parts, { text: "Summarize the shared visual style formula across these images." }] }] });
        return response.text || "Failed.";
    });
};

export const analyzeImageForPrompt = async (base64: string): Promise<string> => {
    return retryWithBackoff(async () => {
        const ai = getAI();
        const response = await ai.models.generateContent({ model: 'gemini-3-flash-preview', contents: [{ parts: [{ inlineData: { data: base64.split(',')[1] || base64, mimeType: 'image/jpeg' } }, { text: "Suggest a generation prompt in Chinese." }] }] });
        return response.text || "";
    });
};

export const generatePlaystyleTemplate = async (topic: string): Promise<any> => {
    return retryWithBackoff(async () => {
        const ai = getAI();
        const response = await ai.models.generateContent({ model: 'gemini-3-flash-preview', contents: [{ text: `Create a template for: ${topic}. Use {{subject}} placeholder. Return JSON with name, description, template.` }], config: { responseMimeType: "application/json" } });
        return JSON.parse(response.text);
    });
};

export const discoverTrendingStyles = async (): Promise<any[]> => {
    return retryWithBackoff(async () => {
        const ai = getAI();
        const response = await ai.models.generateContent({ model: 'gemini-3-flash-preview', contents: [{ text: "Discover 5 trending visual styles. Return JSON array with name, description, template, category." }], config: { responseMimeType: "application/json" } });
        return JSON.parse(response.text);
    });
};

export const generatePromptSuggestions = async (imageBase64: string): Promise<Record<string, string[]>> => {
    return retryWithBackoff(async () => {
        const ai = getAI();
        const model = 'gemini-3-flash-preview';
        const data = imageBase64.split(',')[1] || imageBase64;
        const mimeType = imageBase64.split(';')[0].split(':')[1] || 'image/jpeg';
        
        const prompt = `Analyze this image and provide 4 creative, context-aware prompt suggestions for each of the following design actions:
1. modify (修改): suggestions to modify the shape, material, or style.
2. generate (生成): suggestions to generate new effects, lighting, or rendering styles.
3. add (添加): suggestions to add new features, details, or accessories.
4. remove (去除): suggestions to remove specific elements, background, or noise.
5. imagine (想象): suggestions to imagine the object in different environments, states, or use cases.

Return ONLY a valid JSON object with keys "modify", "generate", "add", "remove", "imagine", where each key maps to an array of 4 short string suggestions in Chinese. Do not include markdown formatting like \`\`\`json.`;

        const response = await ai.models.generateContent({
            model,
            contents: [{ parts: [{ inlineData: { data, mimeType } }, { text: prompt }] }],
            config: {
                responseMimeType: 'application/json'
            }
        });
        
        const text = response.text;
        if (!text) throw new Error("No response");
        return JSON.parse(text);
    });
};
