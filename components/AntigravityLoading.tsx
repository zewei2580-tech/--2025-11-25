
import React, { useRef, useEffect } from 'react';
import { Point } from '../types';

interface AntigravityLoadingProps {
  width: number;
  height: number;
  mousePos: Point; // 逻辑画布坐标
}

interface Node {
  x: number;
  y: number;
  ox: number;
  oy: number;
  vx: number;
  vy: number;
}

const AntigravityLoading: React.FC<AntigravityLoadingProps> = ({ width, height, mousePos }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const nodesRef = useRef<Node[]>([]);
  const frameRef = useRef<number>(0);

  // 初始化点阵
  useEffect(() => {
    const cols = 14;
    const rows = 14;
    const nodes: Node[] = [];
    for (let i = 0; i <= cols; i++) {
      for (let j = 0; j <= rows; j++) {
        const x = (i / cols) * width;
        const y = (j / rows) * height;
        nodes.push({ x, y, ox: x, oy: y, vx: 0, vy: 0 });
      }
    }
    nodesRef.current = nodes;
  }, [width, height]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const render = () => {
      ctx.clearRect(0, 0, width, height);
      
      const nodes = nodesRef.current;
      const spring = 0.08;
      const friction = 0.82;
      const mouseRadius = 100;
      const mouseStrength = 0.5;

      // 物理计算
      nodes.forEach(node => {
        const dxO = node.ox - node.x;
        const dyO = node.oy - node.y;
        node.vx += dxO * spring;
        node.vy += dyO * spring;

        const dxM = node.x - mousePos.x;
        const dyM = node.y - mousePos.y;
        const dist = Math.sqrt(dxM * dxM + dyM * dyM);
        
        if (dist < mouseRadius) {
          const force = (mouseRadius - dist) / mouseRadius;
          node.vx += (dxM / dist) * force * mouseStrength * 60;
          node.vy += (dyM / dist) * force * mouseStrength * 60;
        }

        node.vx *= friction;
        node.vy *= friction;
        node.x += node.vx;
        node.y += node.vy;
      });

      // 绘制网格线条 - 针对白底优化颜色
      ctx.beginPath();
      ctx.strokeStyle = 'rgba(99, 102, 241, 0.08)';
      ctx.lineWidth = 1;
      
      const cols = 14;
      const rows = 14;
      for (let i = 0; i <= cols; i++) {
        for (let j = 0; j <= rows; j++) {
          const idx = i * (rows + 1) + j;
          if (i < cols) {
            const nextIdx = (i + 1) * (rows + 1) + j;
            ctx.moveTo(nodes[idx].x, nodes[idx].y);
            ctx.lineTo(nodes[nextIdx].x, nodes[nextIdx].y);
          }
          if (j < rows) {
            const nextIdx = i * (rows + 1) + (j + 1);
            ctx.moveTo(nodes[idx].x, nodes[idx].y);
            ctx.lineTo(nodes[nextIdx].x, nodes[nextIdx].y);
          }
        }
      }
      ctx.stroke();

      // 绘制节点
      ctx.fillStyle = 'rgba(99, 102, 241, 0.3)';
      nodes.forEach((node, i) => {
        if (i % 4 === 0) {
           ctx.beginPath();
           ctx.arc(node.x, node.y, 1, 0, Math.PI * 2);
           ctx.fill();
        }
      });

      frameRef.current = requestAnimationFrame(render);
    };

    render();
    return () => cancelAnimationFrame(frameRef.current);
  }, [width, height, mousePos]);

  return (
    <div className="absolute inset-0 bg-white flex flex-col items-center justify-center pointer-events-none">
      <canvas 
        ref={canvasRef} 
        width={width} 
        height={height} 
        className="absolute inset-0"
      />
      
      {/* Gemini 风格四芒星 SVG */}
      <div className="relative z-10 flex flex-col items-center gap-6">
        <div className="relative w-16 h-16 animate-pulse">
           <svg viewBox="0 0 24 24" fill="none" className="w-full h-full text-indigo-600">
             <path 
                d="M12 0L14.5 9.5L24 12L14.5 14.5L12 24L9.5 14.5L0 12L9.5 9.5L12 0Z" 
                fill="currentColor"
                className="drop-shadow-[0_0_12px_rgba(79,70,229,0.4)]"
             />
           </svg>
        </div>

        {/* 动态进度条 */}
        <div className="w-32 h-1 bg-zinc-100 rounded-full overflow-hidden relative border border-zinc-200/50">
            <div className="absolute top-0 bottom-0 bg-indigo-600 w-1/3 rounded-full animate-[loading-sweep_1.5s_infinite_ease-in-out]" />
        </div>
        
        <span className="text-[10px] font-black text-indigo-600/60 uppercase tracking-[0.4em] animate-pulse">
          Syncretizing
        </span>
      </div>

      <style>{`
        @keyframes loading-sweep {
            0% { left: -40%; width: 30%; }
            50% { width: 50%; }
            100% { left: 110%; width: 20%; }
        }
      `}</style>
    </div>
  );
};

export default AntigravityLoading;
