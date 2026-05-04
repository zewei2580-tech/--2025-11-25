
import React, { useRef, useState } from 'react';
import { DownloadIcon, UploadIcon, FileIcon, CloudUploadIcon, CloudDownloadIcon, RefreshIcon, PlusIcon, ChevronDownIcon } from './Icons';

interface TopBarProps {
  onExport: () => void;
  onImport: (file: File) => void;
  onCloudExport: () => Promise<void>;
  onCloudImport: () => Promise<void>;
}

const TopBar: React.FC<TopBarProps> = ({ onExport, onImport, onCloudExport, onCloudImport }) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isCloudSyncing, setIsCloudSyncing] = useState(false);
  const [syncStatus, setSyncStatus] = useState<'idle' | 'saving' | 'loading'>('idle');

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) onImport(file);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleCloudAction = async (action: 'upload' | 'download') => {
      if (isCloudSyncing) return;
      
      setIsCloudSyncing(true);
      setSyncStatus(action === 'upload' ? 'saving' : 'loading');
      
      try {
          if (action === 'upload') {
              await onCloudExport();
          } else {
              await onCloudImport();
          }
      } catch (e: any) {
          console.error("TopBar Cloud Error:", e);
          if (e.message.includes('Object-not-found') || e.message.includes('尚无存档')) {
              alert("💡 云端目前是空的。\n\n请先点击蓝色按钮【备份到云】，建立您的第一个云端存档。");
          } else {
              alert(`${e.message || '同步失败，请检查网络或配置'}`);
          }
      } finally {
          setIsCloudSyncing(false);
          setSyncStatus('idle');
      }
  };

  return (
    <div className="fixed top-6 left-1/2 -translate-x-1/2 z-[60] flex items-center bg-[#0c0c0e]/85 backdrop-blur-3xl border border-white/10 p-1.5 rounded-full shadow-[0_32px_64px_rgba(0,0,0,0.5)] pointer-events-auto select-none min-w-fit">
      
      {/* 品牌区 */}
      <div className="flex items-center gap-3 px-5 py-2 border-r border-white/5">
         <div className="w-8 h-8 rounded-full bg-indigo-600 flex items-center justify-center shadow-[0_0_20px_rgba(79,70,229,0.5)]">
            <FileIcon className="w-4 h-4 text-white" />
         </div>
         <div className="flex items-baseline gap-2">
            <span className="text-white font-black text-[14px] uppercase tracking-[0.2em] whitespace-nowrap">无限想象</span>
         </div>
      </div>

      <div className="flex items-center gap-1 px-2">
        {/* 云端备份 */}
        <div className="flex items-center gap-1.5">
            <button 
              onClick={() => handleCloudAction('upload')}
              disabled={isCloudSyncing}
              className={`flex items-center gap-2.5 px-5 py-2.5 rounded-full transition-all active:scale-95 shadow-lg ${syncStatus === 'saving' ? 'bg-indigo-600 text-white' : 'bg-indigo-600/10 text-indigo-400 border border-indigo-500/20 hover:bg-indigo-600/20'}`}
            >
              {syncStatus === 'saving' ? <RefreshIcon className="w-3.5 h-3.5 animate-spin" /> : <CloudUploadIcon className="w-3.5 h-3.5" />}
              <span className="text-[10px] font-black uppercase tracking-[0.15em] whitespace-nowrap">备份到云</span>
            </button>

            <button 
              onClick={() => handleCloudAction('download')}
              disabled={isCloudSyncing}
              className={`flex items-center gap-2.5 px-5 py-2.5 rounded-full transition-all active:scale-95 ${syncStatus === 'loading' ? 'bg-white text-black' : 'bg-white/5 text-zinc-400 hover:bg-white/10 hover:text-white'}`}
            >
              {syncStatus === 'loading' ? <RefreshIcon className="w-3.5 h-3.5 animate-spin" /> : <CloudDownloadIcon className="w-3.5 h-3.5" />}
              <span className="text-[10px] font-black uppercase tracking-[0.15em] whitespace-nowrap">同步云端</span>
            </button>
        </div>
      </div>

      <input type="file" ref={fileInputRef} onChange={handleFileChange} className="hidden" accept=".json" />
    </div>
  );
};

export default TopBar;
