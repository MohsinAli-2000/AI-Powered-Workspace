'use client';

import React, { useState, useRef, useEffect } from 'react';
import { apiClient, ApiError } from '@/lib/api-client';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/toast';
import { formatBytes } from '@/lib/utils';
import { UploadCloud, File, AlertCircle, X, ImageIcon } from 'lucide-react';

interface DocumentUploadZoneProps {
  projectId: string;
  onUploadSuccess: () => void;
}

const ALLOWED_EXTENSIONS = [
  '.pdf',
  '.docx',
  '.xlsx',
  '.txt',
  '.pptx',
  '.png',
  '.jpg',
  '.jpeg',
  '.jfif',
  '.webp',
  '.bmp',
  '.tiff',
  '.tif',
  '.gif',
];
const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB

export const DocumentUploadZone: React.FC<DocumentUploadZoneProps> = ({
  projectId,
  onUploadSuccess,
}) => {
  const { showToast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [isDragging, setIsDragging] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);

  useEffect(() => {
    if (selectedFile && selectedFile.type.startsWith('image/')) {
      const url = URL.createObjectURL(selectedFile);
      setPreviewUrl(url);
      return () => URL.revokeObjectURL(url);
    }
    setPreviewUrl(null);
  }, [selectedFile]);

  const validateFile = (file: File): boolean => {
    setValidationError(null);

    const ext = '.' + file.name.split('.').pop()?.toLowerCase();
    if (!ALLOWED_EXTENSIONS.includes(ext)) {
      setValidationError(
        `Unsupported file type "${ext}". Allowed types: ${ALLOWED_EXTENSIONS.join(', ')}`
      );
      return false;
    }

    if (file.size > MAX_FILE_SIZE) {
      setValidationError(
        `File exceeds maximum limit of 50MB (${formatBytes(file.size)}).`
      );
      return false;
    }

    return true;
  };

  const handleFilesSelected = (files: FileList | null) => {
    if (!files || files.length === 0) return;
    const file = files[0];
    if (validateFile(file)) {
      setSelectedFile(file);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    handleFilesSelected(e.dataTransfer.files);
  };

  const handleUpload = async () => {
    if (!selectedFile) return;
    setIsUploading(true);
    setValidationError(null);

    const formData = new FormData();
    formData.append('file', selectedFile);

    try {
      await apiClient(`/projects/${projectId}/documents`, {
        method: 'POST',
        body: formData,
      });

      const isImage = selectedFile.type.startsWith('image/') || /\.(png|jpe?g|webp|jfif|bmp|gif|tiff?)$/i.test(selectedFile.name);
      showToast(
        isImage
          ? `Image "${selectedFile.name}" uploaded. AI Vision & OCR extraction queued.`
          : `Document "${selectedFile.name}" uploaded. Processing queued.`,
        'success'
      );
      setSelectedFile(null);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
      onUploadSuccess();
    } catch (err: unknown) {
      if (err instanceof ApiError && err.status === 409) {
        showToast(
          `Document duplicate detected: An identical file already exists in this project.`,
          'info'
        );
        setSelectedFile(null);
      } else if (err instanceof ApiError) {
        setValidationError(err.message);
      } else {
        setValidationError('Upload failed. Please check your network connection.');
      }
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div id="project-upload-zone" className="space-y-3">
      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={() => !selectedFile && fileInputRef.current?.click()}
        className={`relative rounded-2xl border-2 border-dashed p-6 transition-all duration-200 text-center flex flex-col items-center justify-center cursor-pointer ${
          isDragging
            ? 'border-indigo-500 bg-indigo-500/10 scale-[1.01]'
            : 'border-white/10 bg-slate-900/40 hover:border-indigo-500/40 hover:bg-slate-900/70'
        }`}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept=".pdf,.docx,.xlsx,.txt,.pptx,.png,.jpg,.jpeg,.webp,image/*"
          className="hidden"
          onChange={(e) => handleFilesSelected(e.target.files)}
        />

        {!selectedFile ? (
          <>
            <div className="w-12 h-12 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400 mb-3 shadow-lg shadow-indigo-500/10">
              <UploadCloud className="w-6 h-6" />
            </div>
            <h4 className="text-sm font-semibold text-slate-200">
              Drag & Drop your corporate documents & images here
            </h4>
            <p className="text-xs text-slate-400 mt-1">
              or click to browse from your device
            </p>
            <div className="flex items-center gap-2 mt-3 text-[11px] text-slate-400 font-mono">
              <span>PDF, DOCX, XLSX, TXT, PPTX, PNG, JPG, WEBP</span>
              <span>•</span>
              <span>Max 50MB</span>
            </div>
            <p className="text-[11px] text-indigo-300/80 mt-1.5 flex items-center justify-center gap-1">
              <span>✨ AI Vision OCR automatically extracts text, tables & diagrams from images</span>
            </p>
          </>
        ) : (
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full flex items-center justify-between p-3.5 rounded-xl bg-slate-800/80 border border-white/10"
          >
            <div className="flex items-center gap-3 text-left truncate">
              {previewUrl ? (
                <div className="w-10 h-10 rounded-lg border border-white/10 overflow-hidden shrink-0 bg-slate-900 shadow-sm">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={previewUrl}
                    alt={selectedFile.name}
                    className="w-full h-full object-cover"
                  />
                </div>
              ) : (
                <div className="w-9 h-9 rounded-lg bg-indigo-500/20 text-indigo-300 flex items-center justify-center shrink-0">
                  <File className="w-4 h-4" />
                </div>
              )}
              <div className="truncate">
                <p className="text-xs font-semibold text-white truncate">{selectedFile.name}</p>
                <p className="text-[11px] text-slate-400 font-mono">{formatBytes(selectedFile.size)}</p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Button
                size="sm"
                onClick={handleUpload}
                isLoading={isUploading}
              >
                Upload & Process
              </Button>
              <button
                disabled={isUploading}
                onClick={() => {
                  setSelectedFile(null);
                  if (fileInputRef.current) fileInputRef.current.value = '';
                }}
                className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-700 transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>

      {validationError && (
        <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 flex items-start gap-2.5 text-xs text-rose-300">
          <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
          <span>{validationError}</span>
        </div>
      )}
    </div>
  );
};
