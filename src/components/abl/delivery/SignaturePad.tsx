import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from "react";

export type SignaturePadHandle = {
  clear: () => void;
  isEmpty: () => boolean;
  toDataURL: () => string | null;
};

export const SignaturePad = forwardRef<SignaturePadHandle, { className?: string }>(
  function SignaturePad({ className = "" }, ref) {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const drawingRef = useRef(false);
    const emptyRef = useRef(true);
    const [, force] = useState(0);

    useEffect(() => {
      const c = canvasRef.current;
      if (!c) return;
      const dpr = window.devicePixelRatio || 1;
      const rect = c.getBoundingClientRect();
      c.width = Math.floor(rect.width * dpr);
      c.height = Math.floor(rect.height * dpr);
      const ctx = c.getContext("2d");
      if (!ctx) return;
      ctx.scale(dpr, dpr);
      ctx.lineWidth = 2.5;
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      ctx.strokeStyle = "#0F2540";
    }, []);

    useImperativeHandle(ref, () => ({
      clear() {
        const c = canvasRef.current;
        if (!c) return;
        const ctx = c.getContext("2d");
        if (!ctx) return;
        ctx.save();
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.clearRect(0, 0, c.width, c.height);
        ctx.restore();
        emptyRef.current = true;
        force((n) => n + 1);
      },
      isEmpty() { return emptyRef.current; },
      toDataURL() {
        if (emptyRef.current) return null;
        return canvasRef.current?.toDataURL("image/png") ?? null;
      },
    }));

    const start = (e: React.PointerEvent<HTMLCanvasElement>) => {
      const c = canvasRef.current; if (!c) return;
      c.setPointerCapture(e.pointerId);
      const rect = c.getBoundingClientRect();
      const ctx = c.getContext("2d"); if (!ctx) return;
      ctx.beginPath();
      ctx.moveTo(e.clientX - rect.left, e.clientY - rect.top);
      drawingRef.current = true;
    };
    const move = (e: React.PointerEvent<HTMLCanvasElement>) => {
      if (!drawingRef.current) return;
      const c = canvasRef.current; if (!c) return;
      const rect = c.getBoundingClientRect();
      const ctx = c.getContext("2d"); if (!ctx) return;
      ctx.lineTo(e.clientX - rect.left, e.clientY - rect.top);
      ctx.stroke();
      if (emptyRef.current) { emptyRef.current = false; force((n) => n + 1); }
    };
    const end = () => { drawingRef.current = false; };

    return (
      <canvas
        ref={canvasRef}
        onPointerDown={start}
        onPointerMove={move}
        onPointerUp={end}
        onPointerCancel={end}
        onPointerLeave={end}
        className={`block h-[150px] w-full touch-none rounded-2xl border-[1.5px] border-dashed border-[#CBD5E1] bg-white ${className}`}
      />
    );
  },
);
