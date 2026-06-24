import React, { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X, Undo2, Eraser, Pen, Check, Save } from 'lucide-react';

interface FullscreenImageEditorProps {
  imageUrl: string;
  initialAnnotatedDataUrl?: string;
  onSave: (annotatedDataUrl: string) => void;
  onClose: () => void;
}

const COLORS = [
  { id: 'red', value: '#ef4444' },
  { id: 'yellow', value: '#eab308' },
  { id: 'green', value: '#22c55e' },
  { id: 'blue', value: '#3b82f6' },
  { id: 'purple', value: '#a855f7' },
  { id: 'white', value: '#ffffff' },
  { id: 'black', value: '#000000' },
];

export default function FullscreenImageEditor({
  imageUrl,
  initialAnnotatedDataUrl,
  onSave,
  onClose
}: FullscreenImageEditorProps) {
  const [isDrawing, setIsDrawing] = useState(false);
  const [color, setColor] = useState('#ef4444');
  const [isEraser, setIsEraser] = useState(false);
  const [history, setHistory] = useState<ImageData[]>([]);
  const [imageLoaded, setImageLoaded] = useState(false);
  
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const imageRef = useRef<HTMLImageElement>(null);
  
  // Initialize canvas when image loads
  useEffect(() => {
    if (imageLoaded && canvasRef.current && imageRef.current) {
      canvasRef.current.width = imageRef.current.clientWidth;
      canvasRef.current.height = imageRef.current.clientHeight;
      
      // Save initial blank state
      saveState();

      // If there's an existing annotation, we would load it here.
      // For simplicity, we assume we're drawing fresh or the existing annotation is rendered below.
      // Note: If initialAnnotatedDataUrl exists, we can draw it on the canvas.
      if (initialAnnotatedDataUrl) {
        const img = new Image();
        img.onload = () => {
          if (canvasRef.current) {
            const ctx = canvasRef.current.getContext('2d');
            if (ctx) {
              ctx.drawImage(img, 0, 0, canvasRef.current.width, canvasRef.current.height);
              saveState(); // Update history with loaded image
            }
          }
        };
        img.src = initialAnnotatedDataUrl;
      }
    }
  }, [imageLoaded, initialAnnotatedDataUrl]);

  const saveState = () => {
    if (!canvasRef.current) return;
    const ctx = canvasRef.current.getContext('2d');
    if (!ctx) return;
    const imageData = ctx.getImageData(0, 0, canvasRef.current.width, canvasRef.current.height);
    setHistory(prev => [...prev, imageData]);
  };

  const handleUndo = () => {
    if (history.length <= 1) return; // Cannot undo past the initial blank state
    
    const newHistory = [...history];
    newHistory.pop(); // Remove current state
    const previousState = newHistory[newHistory.length - 1];
    
    setHistory(newHistory);
    
    if (canvasRef.current) {
      const ctx = canvasRef.current.getContext('2d');
      if (ctx) {
        ctx.putImageData(previousState, 0, 0);
      }
    }
  };

  const startDrawing = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    setIsDrawing(true);
    draw(e);
  };

  const stopDrawing = () => {
    if (isDrawing) {
      saveState(); // Save state after a stroke completes
    }
    setIsDrawing(false);
    const canvas = canvasRef.current;
    if (canvas) {
      const ctx = canvas.getContext('2d');
      if (ctx) ctx.beginPath();
    }
  };

  const draw = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    if (!isDrawing) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let clientX, clientY;
    if ('touches' in e) {
      clientX = e.touches[0].clientX;
      clientY = e.touches[0].clientY;
    } else {
      clientX = e.clientX;
      clientY = e.clientY;
    }

    const rect = canvas.getBoundingClientRect();
    
    // Calculate the scale between the canvas logical size and its display size
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;

    const x = (clientX - rect.left) * scaleX;
    const y = (clientY - rect.top) * scaleY;

    ctx.lineWidth = isEraser ? 20 : 3;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    
    if (isEraser) {
      ctx.globalCompositeOperation = 'destination-out';
      ctx.strokeStyle = 'rgba(0,0,0,1)';
    } else {
      ctx.globalCompositeOperation = 'source-over';
      ctx.strokeStyle = color;
    }

    ctx.lineTo(x, y);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(x, y);
  };

  const handleSave = () => {
    if (!canvasRef.current || !imageRef.current) return;
    
    // Create a composite image of the base image + annotations
    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = canvasRef.current.width;
    tempCanvas.height = canvasRef.current.height;
    const tCtx = tempCanvas.getContext('2d');
    
    if (tCtx) {
      // Fill with white background in case image has transparency before converting to JPEG
      tCtx.fillStyle = '#ffffff';
      tCtx.fillRect(0, 0, tempCanvas.width, tempCanvas.height);
      tCtx.drawImage(imageRef.current, 0, 0, tempCanvas.width, tempCanvas.height);
      tCtx.drawImage(canvasRef.current, 0, 0);
      const dataUrl = tempCanvas.toDataURL('image/jpeg', 0.5); // 50% quality JPEG drastically reduces size
      onSave(dataUrl);
    }
  };

  return createPortal(
    <div className="fixed inset-0 z-[9999] bg-black/95 flex flex-col animate-fade-in" style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0 }}>
      {/* Top Toolbar */}
      <div className="flex items-center justify-between p-4 bg-zinc-950/80 border-b border-zinc-800/50 backdrop-blur-sm">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-1.5 bg-zinc-900/50 p-1 rounded-lg border border-zinc-800/50">
            <button
              onClick={() => setIsEraser(false)}
              className={`p-2 rounded-md transition-all ${!isEraser ? 'bg-zinc-800 text-white' : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/50'}`}
              title="Caneta"
            >
              <Pen size={18} />
            </button>
            <button
              onClick={() => setIsEraser(true)}
              className={`p-2 rounded-md transition-all ${isEraser ? 'bg-zinc-800 text-white' : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/50'}`}
              title="Borracha"
            >
              <Eraser size={18} />
            </button>
          </div>

          <div className="h-6 w-px bg-zinc-800" />

          {/* Color Picker */}
          <div className="flex items-center gap-1.5">
            {COLORS.map(c => (
              <button
                key={c.id}
                onClick={() => {
                  setColor(c.value);
                  setIsEraser(false);
                }}
                className={`w-6 h-6 rounded-full border-2 transition-all ${color === c.value && !isEraser ? 'border-white scale-110' : 'border-transparent hover:scale-110'}`}
                style={{ backgroundColor: c.value }}
                title={`Cor ${c.id}`}
              />
            ))}
          </div>

          <div className="h-6 w-px bg-zinc-800" />

          <button
            onClick={handleUndo}
            disabled={history.length <= 1}
            className="p-2 text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900 rounded-md transition-all disabled:opacity-30 disabled:cursor-not-allowed flex items-center gap-1.5 text-xs font-medium"
            title="Desfazer"
          >
            <Undo2 size={18} />
            <span className="hidden sm:inline">Desfazer</span>
          </button>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={onClose}
            className="p-2 text-zinc-400 hover:text-white hover:bg-zinc-900 rounded-full transition-colors"
            title="Fechar"
          >
            <X size={20} />
          </button>
          <button onClick={handleSave} className="flex items-center gap-1.5 px-4 py-2 text-sm font-bold uppercase tracking-wider rounded-md border border-blue-500/50 bg-blue-500/10 hover:bg-blue-500/20 text-blue-400 transition-colors">
            <Save size={16} /> Salvar Anotações
          </button>
        </div>
      </div>

      {/* Canvas Area */}
      <div className="flex-1 overflow-hidden flex items-center justify-center p-4 relative select-none">
        <div className="relative max-w-full max-h-full inline-flex justify-center items-center">
          <img 
            ref={imageRef}
            src={imageUrl} 
            alt="Tela cheia" 
            className="max-w-full max-h-[calc(100vh-100px)] object-contain pointer-events-none shadow-2xl"
            onLoad={() => setImageLoaded(true)}
          />
          {imageLoaded && (
            <canvas
              ref={canvasRef}
              onMouseDown={startDrawing}
              onMouseUp={stopDrawing}
              onMouseLeave={stopDrawing}
              onMouseMove={draw}
              onTouchStart={startDrawing}
              onTouchEnd={stopDrawing}
              onTouchMove={draw}
              className={`absolute inset-0 z-10 touch-none ${isEraser ? 'cursor-cell' : 'cursor-crosshair'}`}
              style={{ width: '100%', height: '100%' }}
            />
          )}
        </div>
      </div>
    </div>,
    document.body
  );
}
