import React, { useState, useEffect, useRef } from 'react';
import * as pdfjsLib from 'pdfjs-dist';
import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';
import { ArrowLeft, Download, Type, Eraser, ZoomIn, ZoomOut, ChevronLeft, ChevronRight, Settings } from 'lucide-react';
import PdfPage from './PdfPage';

// Initialize PDF.js worker
pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.mjs`;

export type Tool = 'cursor' | 'text' | 'whiteout';

export interface EditAction {
  id: string;
  pageNum: number;
  type: Tool;
  x: number;
  y: number;
  width?: number;
  height?: number;
  text?: string;
  font?: string;
  fontSize?: number;
  color?: string;
}

interface PdfEditorProps {
  file: File;
  onClear: () => void;
}

export default function PdfEditor({ file, onClear }: PdfEditorProps) {
  const [numPages, setNumPages] = useState<number | null>(null);
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [pdfProxy, setPdfProxy] = useState<pdfjsLib.PDFDocumentProxy | null>(null);
  const [scale, setScale] = useState(1.5);
  const [tool, setTool] = useState<Tool>('cursor');
  const [edits, setEdits] = useState<EditAction[]>([]);
  
  // Styling state
  const [fontSize, setFontSize] = useState(14);
  const [fontFamily, setFontFamily] = useState<StandardFonts>(StandardFonts.Helvetica);
  const [textColor, setTextColor] = useState('#000000');

  useEffect(() => {
    const loadPdf = async () => {
      const arrayBuffer = await file.arrayBuffer();
      const loadingTask = pdfjsLib.getDocument({ data: arrayBuffer });
      const pdf = await loadingTask.promise;
      setPdfProxy(pdf);
      setNumPages(pdf.numPages);
    };
    loadPdf();
  }, [file]);

  const handleExport = async () => {
    if (!file) return;
    try {
      const arrayBuffer = await file.arrayBuffer();
      const pdfDoc = await PDFDocument.load(arrayBuffer);
      
      const pages = pdfDoc.getPages();
      
      for (const edit of edits) {
        const pageIndex = edit.pageNum - 1;
        const page = pages[pageIndex];
        const { height } = page.getSize();
        
        if (edit.type === 'whiteout' && edit.width && edit.height) {
          page.drawRectangle({
            x: edit.x,
            y: height - edit.y - edit.height, // PDF coordinate system originates from bottom-left
            width: edit.width,
            height: edit.height,
            color: rgb(1, 1, 1), // White
          });
        } else if (edit.type === 'text' && edit.text && edit.fontSize) {
          // Embed the font
          const customFont = await pdfDoc.embedFont(edit.font as StandardFonts);
          
          const hex = edit.color?.replace('#', '') || '000000';
          const r = parseInt(hex.substring(0, 2), 16) / 255;
          const g = parseInt(hex.substring(2, 4), 16) / 255;
          const b = parseInt(hex.substring(4, 6), 16) / 255;

          // Adjust Y to match baseline (approximate)
          // pdf.js canvas vs PDF-lib: PDF-lib draws text upwards from y.
          // Canvas draws text downwards from top-left.
          page.drawText(edit.text, {
            x: edit.x,
            y: height - edit.y - edit.fontSize, 
            size: edit.fontSize,
            font: customFont,
            color: rgb(r, g, b),
          });
        }
      }

      const pdfBytes = await pdfDoc.save();
      const blob = new Blob([pdfBytes], { type: 'application/pdf' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `edited_${file.name}`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      console.error("Error exporting PDF", e);
      alert("Error exporting PDF. Please check the console.");
    }
  };

  const handleAddEdit = (edit: EditAction) => {
    setEdits((prev) => [...prev, edit]);
  };

  const handleUpdateEdit = (id: string, updates: Partial<EditAction>) => {
    setEdits(prev => prev.map(e => e.id === id ? { ...e, ...updates } : e));
  };
  
  const handleDeleteEdit = (id: string) => {
    setEdits(prev => prev.filter(e => e.id !== id));
  };

  return (
    <div className="h-screen w-full bg-slate-100 flex flex-col font-sans text-slate-900 overflow-hidden">
      {/* Top Navigation Bar */}
      <header className="h-14 bg-white border-b border-slate-200 flex items-center justify-between px-6 z-30 shrink-0">
        <div className="flex items-center gap-3">
          <button onClick={onClear} className="w-8 h-8 flex items-center justify-center hover:bg-slate-100 rounded-lg text-slate-500 transition-colors">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center text-white font-bold text-lg hidden sm:flex">P</div>
          <span className="font-semibold text-lg tracking-tight hidden sm:inline">SeamlessPDF Editor</span>
          <div className="ml-4 px-2 py-0.5 bg-blue-50 text-blue-600 text-xs font-bold rounded uppercase tracking-wider hidden md:block">Pro</div>
        </div>

        <div className="flex items-center justify-center flex-1 mx-4">
          <span className="text-sm font-medium text-slate-500 truncate max-w-[200px] lg:max-w-md">{file.name}</span>
        </div>

        <div className="flex items-center gap-4">
          <div className="flex items-center gap-1 bg-slate-100 rounded-md p-1 hidden sm:flex">
            <button onClick={() => setScale(s => Math.max(0.5, s - 0.25))} className="px-2 py-1 text-slate-600 hover:bg-white rounded hover:shadow-sm text-xs font-medium">
              <ZoomOut className="w-4 h-4"/>
            </button>
            <span className="px-2 py-1 text-xs font-medium text-slate-600 w-12 text-center">{Math.round(scale * 100)}%</span>
            <button onClick={() => setScale(s => Math.min(3, s + 0.25))} className="px-2 py-1 text-slate-600 hover:bg-white rounded hover:shadow-sm text-xs font-medium">
              <ZoomIn className="w-4 h-4"/>
            </button>
          </div>
          <button 
            onClick={handleExport}
            className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-5 py-2 rounded-lg text-sm font-semibold shadow-sm transition-colors"
          >
            <Download className="w-4 h-4" />
            <span className="hidden sm:inline">Export PDF</span>
          </button>
        </div>
      </header>

      {/* Main Content Area */}
      <div className="flex flex-1 overflow-hidden">
        {/* Editing Workspace */}
        <main className="flex-1 bg-slate-200 relative flex flex-col p-8 overflow-hidden pt-20">
          
          {/* Floating Toolbar */}
          <div className="absolute top-6 left-1/2 -translate-x-1/2 bg-slate-900 text-white px-4 py-2 rounded-full flex items-center gap-6 shadow-2xl z-20 border border-white/10">
            <ToolbarButton 
              active={tool === 'cursor'} 
              onClick={() => setTool('cursor')} 
              label="Selection"
              indicator={<div className={`w-3 h-3 rounded-full ${tool === 'cursor' ? 'bg-blue-400' : 'bg-white/20'}`}></div>}
            />
            <ToolbarButton 
              active={tool === 'text'} 
              onClick={() => setTool('text')} 
              label="Add Text"
              indicator={<div className={`w-3 h-3 rounded-sm ${tool === 'text' ? 'bg-blue-400' : 'border border-white/30'}`}></div>}
            />
            <ToolbarButton 
              active={tool === 'whiteout'} 
              onClick={() => setTool('whiteout')} 
              label="Whiteout"
              indicator={<div className={`w-3 h-3 rounded ${tool === 'whiteout' ? 'bg-blue-400' : 'bg-white/20'}`}></div>}
            />
            
            <div className="w-px h-4 bg-white/20 hidden lg:block"></div>
            
            <div className={`flex flex-wrap items-center gap-3 transition-opacity ${tool === 'text' ? 'opacity-100' : 'opacity-40 pointer-events-none'}`}>
              <select 
                value={fontFamily} 
                onChange={(e) => setFontFamily(e.target.value as StandardFonts)}
                className="text-xs bg-slate-800 text-white border border-white/10 rounded px-2 py-1 outline-none appearance-none"
                disabled={tool !== 'text'}
              >
                <option value={StandardFonts.Helvetica}>Helvetica</option>
                <option value={StandardFonts.TimesRoman}>Times Roman</option>
                <option value={StandardFonts.Courier}>Courier</option>
              </select>
              
              <div className="flex items-center gap-1 bg-slate-800 border border-white/10 rounded px-2 py-1">
                <input 
                  type="number" 
                  value={fontSize} 
                  onChange={(e) => setFontSize(parseInt(e.target.value))}
                  className="w-10 text-xs bg-transparent text-white outline-none text-right"
                  min="6" max="72"
                  disabled={tool !== 'text'}
                />
                <span className="text-[10px] text-white/50 pt-[1px]">pt</span>
              </div>
              
              <input 
                type="color" 
                value={textColor} 
                onChange={(e) => setTextColor(e.target.value)}
                className="w-6 h-6 rounded cursor-pointer p-0 border-0 bg-transparent disabled:opacity-50"
                disabled={tool !== 'text'}
                title="Text Color"
              />
            </div>
          </div>

          <div className="flex-1 overflow-auto flex justify-center pb-24 items-start rounded-xl no-scrollbar">
            {pdfProxy && (
              <PdfPage 
                pdfProxy={pdfProxy} 
                pageNum={currentPage} 
                scale={scale} 
                tool={tool}
                activeFont={fontFamily}
                activeFontSize={fontSize}
                activeColor={textColor}
                edits={edits.filter(e => e.pageNum === currentPage)}
                onAddEdit={handleAddEdit}
                onUpdateEdit={handleUpdateEdit}
                onDeleteEdit={handleDeleteEdit}
              />
            )}
          </div>
          
          {/* Bottom Pagination */}
          {numPages && numPages > 1 && (
            <div className="absolute bottom-6 left-1/2 -translate-x-1/2 bg-white px-4 py-2 rounded-full shadow-[0_0_20px_rgba(0,0,0,0.05)] border border-slate-200 flex items-center gap-4 z-20">
              <button 
                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                className="p-1 rounded-full hover:bg-slate-100 disabled:opacity-40 text-slate-500 transition-colors"
                title="Previous Page"
              >
                <ChevronLeft className="w-5 h-5" />
              </button>
              <span className="text-sm font-bold text-slate-700 min-w-[70px] text-center">
                {currentPage} / {numPages}
              </span>
              <button 
                onClick={() => setCurrentPage(p => Math.min(numPages, p + 1))}
                disabled={currentPage === numPages}
                className="p-1 rounded-full hover:bg-slate-100 disabled:opacity-40 text-slate-500 transition-colors"
                title="Next Page"
              >
                <ChevronRight className="w-5 h-5" />
              </button>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}

function ToolbarButton({ indicator, active, onClick, label }: { indicator: React.ReactNode, active: boolean, onClick: () => void, label: string }) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-2 text-xs font-bold transition-all ${
        active 
          ? 'text-blue-400' 
          : 'text-white opacity-70 hover:opacity-100'
      }`}
    >
      {indicator} <span className="hidden sm:inline">{label}</span>
    </button>
  );
}
