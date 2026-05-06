import React, { useRef, useEffect, useState, MouseEvent } from 'react';
import * as pdfjsLib from 'pdfjs-dist';
import { Tool, EditAction } from './PdfEditor';
import { StandardFonts } from 'pdf-lib';

interface PdfPageProps {
  pdfProxy: pdfjsLib.PDFDocumentProxy;
  pageNum: number;
  scale: number;
  tool: Tool;
  activeFont: StandardFonts;
  activeFontSize: number;
  activeColor: string;
  edits: EditAction[];
  onAddEdit: (edit: EditAction) => void;
  onUpdateEdit: (id: string, updates: Partial<EditAction>) => void;
  onDeleteEdit: (id: string) => void;
}

export default function PdfPage({ 
  pdfProxy, 
  pageNum, 
  scale, 
  tool,
  activeFont,
  activeFontSize,
  activeColor,
  edits,
  onAddEdit,
  onUpdateEdit,
  onDeleteEdit
}: PdfPageProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 });
  const [isDrawing, setIsDrawing] = useState(false);
  const [currentDraw, setCurrentDraw] = useState<{ startX: number, startY: number, endX: number, endY: number } | null>(null);

  // Render the PDF page to canvas
  useEffect(() => {
    let renderTask: pdfjsLib.RenderTask | null = null;
    let isMounted = true;

    const renderPage = async () => {
      try {
        const page = await pdfProxy.getPage(pageNum);
        const viewport = page.getViewport({ scale });
        
        if (!isMounted) return;

        setDimensions({ width: viewport.width, height: viewport.height });

        const canvas = canvasRef.current;
        if (!canvas) return;

        const context = canvas.getContext('2d');
        if (!context) return;

        canvas.height = viewport.height;
        canvas.width = viewport.width;

        const renderContext = {
          canvasContext: context,
          viewport: viewport,
        };

        renderTask = page.render(renderContext);
        await renderTask.promise;
      } catch (err) {
        if (err instanceof pdfjsLib.RenderingCancelledException) {
          // Task cancelled, safe to ignore
        } else {
          console.error('Error rendering page:', err);
        }
      }
    };

    renderPage();

    return () => {
      isMounted = false;
      if (renderTask) {
        renderTask.cancel();
      }
    };
  }, [pdfProxy, pageNum, scale]);

  // Map StandardFonts enum to CSS font families
  const getCssFontFamily = (font: string) => {
    switch(font) {
      case StandardFonts.TimesRoman: return 'Times New Roman, serif';
      case StandardFonts.Courier: return 'Courier New, monospace';
      case StandardFonts.Helvetica:
      default: return 'Arial, Helvetica, sans-serif';
    }
  };

  // Convert client coordinates to PDF coordinate space
  const getCoordinates = (e: MouseEvent<HTMLDivElement>) => {
    if (!containerRef.current) return { x: 0, y: 0 };
    const rect = containerRef.current.getBoundingClientRect();
    // Raw pixel coordinates relative to the rendered canvas
    const rawX = e.clientX - rect.left;
    const rawY = e.clientY - rect.top;
    
    // Convert to unscaled PDF coordinates
    return {
      x: rawX / scale,
      y: rawY / scale
    };
  };

  const handlePointerDown = (e: MouseEvent<HTMLDivElement>) => {
    if (tool === 'cursor') return;

    const { x, y } = getCoordinates(e);

    if (tool === 'whiteout') {
      setIsDrawing(true);
      setCurrentDraw({ startX: x, startY: y, endX: x, endY: y });
    } else if (tool === 'text') {
      // Create new text block
      const newId = Math.random().toString(36).substr(2, 9);
      onAddEdit({
        id: newId,
        pageNum,
        type: 'text',
        x,
        y,
        text: '',
        font: activeFont,
        fontSize: activeFontSize,
        color: activeColor,
      });
      // We will automatically focus it because of autoFocus in the input
    }
  };

  const handlePointerMove = (e: MouseEvent<HTMLDivElement>) => {
    if (!isDrawing || tool !== 'whiteout' || !currentDraw) return;
    const { x, y } = getCoordinates(e);
    setCurrentDraw(prev => prev ? { ...prev, endX: x, endY: y } : null);
  };

  const handlePointerUp = () => {
    if (isDrawing && tool === 'whiteout' && currentDraw) {
      const { startX, startY, endX, endY } = currentDraw;
      const width = Math.abs(endX - startX);
      const height = Math.abs(endY - startY);
      
      // Only create if there's actual area
      if (width > 2 && height > 2) {
        onAddEdit({
          id: Math.random().toString(36).substr(2, 9),
          pageNum,
          type: 'whiteout',
          x: Math.min(startX, endX),
          y: Math.min(startY, endY),
          width,
          height,
        });
      }
    }
    setIsDrawing(false);
    setCurrentDraw(null);
  };

  return (
    <div 
      ref={containerRef}
      className={`relative shadow-[0_0_50px_rgba(0,0,0,0.1)] bg-white transition-shadow ${tool === 'text' ? 'cursor-text' : tool === 'whiteout' ? 'cursor-crosshair' : 'cursor-default'}`}
      style={{ width: dimensions.width, height: dimensions.height }}
      onMouseDown={handlePointerDown}
      onMouseMove={handlePointerMove}
      onMouseUp={handlePointerUp}
      onMouseLeave={handlePointerUp}
    >
      <canvas 
        ref={canvasRef} 
        className="block absolute top-0 left-0 pointer-events-none"
      />

      {/* Render saved edits */}
      {edits.map(edit => {
        if (edit.type === 'whiteout') {
          return (
            <div
              key={edit.id}
              className="absolute bg-white z-10"
              style={{
                left: edit.x * scale,
                top: edit.y * scale,
                width: (edit.width || 0) * scale,
                height: (edit.height || 0) * scale,
                border: tool === 'cursor' ? '1px dashed #cbd5e1' : 'none'
              }}
              onClick={(e) => {
                if (tool === 'cursor') {
                  e.stopPropagation();
                  onDeleteEdit(edit.id);
                }
              }}
              title={tool === 'cursor' ? "Click to delete whiteout" : ""}
            />
          );
        }

        if (edit.type === 'text') {
          return (
            <input
              key={edit.id}
              autoFocus
              className="absolute bg-transparent outline-none border-none z-20 m-0 p-0 leading-none"
              style={{
                left: edit.x * scale,
                top: edit.y * scale,
                fontSize: `${(edit.fontSize || 14) * scale}px`,
                fontFamily: getCssFontFamily(edit.font || ''),
                color: edit.color,
                minWidth: '50px',
                // Add a faint border when empty or selected in cursor mode
                borderBottom: tool === 'cursor' || !edit.text ? '1px dashed #94a3b8' : 'none'
              }}
              value={edit.text || ''}
              onChange={(e) => onUpdateEdit(edit.id, { text: e.target.value })}
              onMouseDown={(e) => e.stopPropagation()}
              onClick={(e) => {
                if (tool === 'cursor') {
                  e.stopPropagation();
                  // Optionally could delete if empty, or double click to delete
                }
              }}
              onKeyDown={(e) => {
                if (e.key === 'Backspace' && edit.text === '' && tool === 'cursor') {
                  onDeleteEdit(edit.id);
                }
              }}
              placeholder="Type..."
            />
          );
        }
        return null;
      })}

      {/* Render active drawing for whiteout */}
      {isDrawing && currentDraw && tool === 'whiteout' && (
        <div
          className="absolute border border-blue-500 bg-white/80 z-30 pointer-events-none"
          style={{
            left: Math.min(currentDraw.startX, currentDraw.endX) * scale,
            top: Math.min(currentDraw.startY, currentDraw.endY) * scale,
            width: Math.abs(currentDraw.endX - currentDraw.startX) * scale,
            height: Math.abs(currentDraw.endY - currentDraw.startY) * scale,
          }}
        />
      )}
    </div>
  );
}
