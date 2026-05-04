
/**
 * ReCreate.ai - Firebase 工业级云同步服务模块
 * 
 * 功能说明：
 * 1. 结构同步：保存画布上所有画框、位置、Prompt。
 * 2. 图像备份：将压缩后的 Base64 图像作为结构的一部分持久化。
 * 3. 跨域诊断：针对浏览器常见的 CORS 拦截提供直接解决方案。
 */

import { initializeApp, getApp, getApps } from "firebase/app";
import { getStorage, ref, uploadBytes, getBlob } from "firebase/storage";
import { ProjectPackage } from "../types";

// --- 1. 配置信息 (与 GCP 控制台保持一致) ---
const firebaseConfig = {
  apiKey: "AIzaSyCI79hGu6_g-6GJ02DE-3_03ejVg0CD3-U",
  authDomain: "gen-lang-client-0834491635.firebaseapp.com",
  projectId: "gen-lang-client-0834491635",
  storageBucket: "gen-lang-client-0834491635.firebasestorage.app",
  messagingSenderId: "264623743650",
  appId: "1:264623743650:web:67272903c63faba9e9edfb"
};

// --- 2. 单例初始化 (防止重复创建 App 实例) ---
const initFirebase = () => {
    try {
        return getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();
    } catch (e) {
        console.error("Firebase 初始化失败:", e);
        return null;
    }
};

const app = initFirebase();
const storage = getStorage(app!);
const CLOUD_STORAGE_PATH = "projects/industrial_canvas_master.json";

// --- 3. 核心功能集 ---

/**
 * 【云保存】
 * 将项目数据包装成 Blob 并推送到 Firebase Storage。
 * @param pkg 项目完整包（含 items 和 view）
 */
export const uploadProjectToCloud = async (pkg: ProjectPackage): Promise<void> => {
  console.log("🚀 [云保存] 正在准备同步数据...");
  
  try {
      const jsonString = JSON.stringify(pkg);
      const sizeMb = (jsonString.length / 1024 / 1024).toFixed(2);
      
      // 体积预警
      if (parseFloat(sizeMb) > 15) {
          throw new Error(`存档体积过大 (${sizeMb}MB)，请删除部分无用图片后重试。`);
      }

      const storageRef = ref(storage, CLOUD_STORAGE_PATH);
      const blob = new Blob([jsonString], { type: 'application/json' });
      
      console.log(`📤 [云保存] 正在上传文件... (${sizeMb} MB)`);
      await uploadBytes(storageRef, blob);
      console.log("✅ [云保存] 云端存储已成功覆盖。");
      
  } catch (error: any) {
    console.error("❌ [云保存] 失败:", error);
    
    // 权限错误诊断
    if (error.code === 'storage/unauthorized') {
        throw new Error("同步失败：Firebase 存储权限不足。请在控制台设置 Rules 为 allow read, write: if true;");
    }
    
    throw new Error(`保存失败: ${error.message || "未知网络异常"}`);
  }
};

/**
 * 【云恢复】
 * 从云端拉取 JSON 并解析回画布对象。
 */
export const downloadProjectFromCloud = async (): Promise<ProjectPackage> => {
  console.log("📡 [云恢复] 正在建立远程连接...");
  
  const storageRef = ref(storage, CLOUD_STORAGE_PATH);
  
  try {
    // getBlob 是浏览器端最稳健的流式下载方式
    const blob = await getBlob(storageRef);
    const text = await blob.text();
    const pkg = JSON.parse(text);
    
    // 数据完整性校验
    if (!pkg || !Array.isArray(pkg.items)) {
        throw new Error("云端文件格式无效：缺少必要的 items 结构。");
    }

    console.log(`✅ [云恢复] 成功拉取 ${pkg.items.length} 个元素。`);
    return pkg as ProjectPackage;

  } catch (error: any) {
    console.error("❌ [云恢复] 详细错误报告:", error);
    
    // 情况 A: 文件不存在
    if (error.code === 'storage/object-not-found') {
        throw new Error("云端尚无存档。请先在‘文件管理’中点击‘备份到云’。");
    }
    
    // 情况 B: 跨域拦截 (CORS) - 这是最常见的问题
    // 如果 catch 到 TypeError 或 FirebaseError 且无 code，通常就是 CORS
    if (error.name === 'FirebaseError' || error.message?.includes('CORS') || error instanceof TypeError) {
        const corsHelp = `
【关键修复：CORS 拦截】
浏览器拒绝了云端下载请求。请执行以下步骤：
1. 安装 Google Cloud SDK (gsutil)。
2. 创建 cors.json 文件，内容为: [{"origin": ["*"], "method": ["GET"], "maxAgeSeconds": 3600}]
3. 运行: gsutil cors set cors.json gs://${firebaseConfig.storageBucket}
        `;
        console.warn(corsHelp);
        throw new Error("同步失败：由于跨域(CORS)策略，浏览器拒绝拉取云端数据。请查看控制台修复指引。");
    }
    
    throw new Error(`恢复失败: ${error.message || "请求被服务器拒绝"}`);
  }
};
