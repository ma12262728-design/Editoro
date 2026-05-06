import React, { useState, useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
import { FileUp, FileText } from 'lucide-react';
import PdfEditor from './components/PdfEditor';

export default function App() {
  const [pdfFile, setPdfFile] = useState<File | null>(null);

  const onDrop = useCallback((acceptedFiles: File[]) => {
    if (acceptedFiles && acceptedFiles.length > 0) {
      setPdfFile(acceptedFiles[0]);
    }
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'application/pdf': ['.pdf'],
    },
    multiple: false,
  });

  if (pdfFile) {
    return <PdfEditor file={pdfFile} onClear={() => setPdfFile(null)} />;
  }

  return (
    <div className="min-h-screen bg-slate-100 flex items-center justify-center p-4 font-sans text-slate-900">
      <div
        {...getRootProps()}
        className={`w-full max-w-xl mx-auto p-12 border-2 border-dashed rounded-2xl text-center cursor-pointer transition-all duration-300 ease-in-out ${
          isDragActive
            ? 'border-blue-500 bg-blue-50/50'
            : 'border-slate-300 bg-white hover:border-slate-400 hover:bg-slate-50'
        }`}
      >
        <input {...getInputProps()} />
        <div className="flex justify-center mb-6">
          <div className="h-20 w-20 bg-blue-50 text-blue-600 rounded-full flex items-center justify-center shadow-sm">
            <FileUp className="w-10 h-10" />
          </div>
        </div>
        <h2 className="text-2xl font-serif font-black text-slate-900 tracking-tighter mb-2">Upload your PDF</h2>
        <p className="text-slate-600 max-w-sm mx-auto mb-4 italic font-medium text-sm">
          {isDragActive
            ? "Drop the PDF here..."
            : "Drag and drop your PDF file here, or click to select a file."}
        </p>
        <div className="bg-blue-50 border border-blue-100 p-4 rounded-lg text-xs leading-relaxed text-blue-800 text-left">
          <strong>Pro Tip for Seamless Editing:</strong> To edit existing text without anyone noticing, use the <strong>Whiteout (Eraser)</strong> tool to cover the old text, then use the <strong>Add Text</strong> tool to write over it matching the font and size.
        </div>
      </div>
    </div>
  );
}
