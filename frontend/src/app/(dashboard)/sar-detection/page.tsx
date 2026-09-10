'use client';

import React, { useState, useRef, useCallback } from 'react';
import {
  UploadCloud,
  FileImage,
  AlertTriangle,
  CheckCircle2,
  AlertCircle,
  Loader2,
  RefreshCw,
  Eye,
  Info,
  Sliders,
  Layers,
  Sparkles,
} from 'lucide-react';
import { analyzeSARImage } from '@/services/sarService';
import type { SARAnalysisResult } from '@/types/sar';

export default function SARDetectionPage() {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [imageDims, setImageDims] = useState<{ width: number; height: number } | null>(null);
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const [threshold, setThreshold] = useState<number>(0.5);

  const [analyzing, setAnalyzing] = useState<boolean>(false);
  const [result, setResult] = useState<SARAnalysisResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [activeVisualTab, setActiveVisualTab] = useState<'all' | 'overlay' | 'prob' | 'mask'>('all');

  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = useCallback((file: File) => {
    setError(null);
    setResult(null);

    // Validate type
    const validExts = ['image/png', 'image/jpeg', 'image/jpg', 'image/tiff'];
    if (!validExts.includes(file.type) && !file.name.match(/\.(png|jpg|jpeg|tif|tiff)$/i)) {
      setError('Please upload a valid SAR/satellite image file (PNG, JPG, JPEG, TIF, TIFF).');
      return;
    }

    // Validate size (25MB max)
    if (file.size > 25 * 1024 * 1024) {
      setError('Image file exceeds the 25 MB limit.');
      return;
    }

    setSelectedFile(file);

    // Generate local preview URL & read dimensions
    const url = URL.createObjectURL(file);
    setPreviewUrl(url);

    const img = new Image();
    img.onload = () => {
      setImageDims({ width: img.naturalWidth, height: img.naturalHeight });
    };
    img.src = url;
  }, []);

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
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFileSelect(e.dataTransfer.files[0]);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      handleFileSelect(e.target.files[0]);
    }
  };

  const handleAnalyze = async () => {
    if (!selectedFile || analyzing) return;

    setAnalyzing(true);
    setError(null);

    try {
      const data = await analyzeSARImage(selectedFile, threshold);
      setResult(data);
    } catch (err: any) {
      console.error('[SARDetection] Analysis error:', err);
      setError(err?.message || 'SAR image analysis failed. Please verify the backend connection.');
    } finally {
      setAnalyzing(false);
    }
  };

  const handleReset = () => {
    setSelectedFile(null);
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPreviewUrl(null);
    setImageDims(null);
    setResult(null);
    setError(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const isSpillDetected = result?.status === 'OIL-LIKE SPILL DETECTED';

  return (
    <div style={{ padding: '1.5rem', maxWidth: '1400px', margin: '0 auto' }}>
      {/* Page Header */}
      <div style={{ marginBottom: '2rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.5rem' }}>
          <div
            style={{
              padding: '0.5rem',
              borderRadius: '8px',
              background: 'rgba(56, 189, 248, 0.15)',
              border: '1px solid rgba(56, 189, 248, 0.3)',
              color: '#38bdf8',
            }}
          >
            <Sparkles size={22} />
          </div>
          <h1 style={{ fontSize: '1.75rem', fontWeight: 700, color: '#f8fafc', margin: 0 }}>
            SAR Oil Spill Detection
          </h1>
        </div>
        <p style={{ color: '#94a3b8', fontSize: '0.95rem', margin: 0 }}>
          Upload a SAR/satellite image and analyze it using our trained MiT-B2 + U-Net model.
        </p>
      </div>

      {/* Main Content Grid: Left Upload, Right Analysis/Results */}
      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(350px, 460px) 1fr', gap: '2rem' }}>
        {/* Upload Column */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          {/* Upload Dropzone Card */}
          <div
            style={{
              background: 'rgba(15, 23, 42, 0.75)',
              border: '1px solid rgba(51, 65, 85, 0.7)',
              borderRadius: '12px',
              padding: '1.5rem',
              backdropFilter: 'blur(12px)',
            }}
          >
            <h3 style={{ fontSize: '1.1rem', fontWeight: 600, color: '#e2e8f0', marginBottom: '1rem' }}>
              Image Upload
            </h3>

            {/* Hidden Input */}
            <input
              ref={fileInputRef}
              type="file"
              accept=".png,.jpg,.jpeg,.tif,.tiff"
              onChange={handleInputChange}
              style={{ display: 'none' }}
            />

            {!selectedFile ? (
              <div
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
                style={{
                  border: `2px dashed ${isDragging ? '#38bdf8' : 'rgba(100, 116, 139, 0.5)'}`,
                  borderRadius: '10px',
                  padding: '3rem 1.5rem',
                  textAlign: 'center',
                  cursor: 'pointer',
                  background: isDragging ? 'rgba(56, 189, 248, 0.05)' : 'rgba(30, 41, 59, 0.4)',
                  transition: 'all 0.2s ease',
                }}
              >
                <UploadCloud
                  size={44}
                  style={{ color: isDragging ? '#38bdf8' : '#64748b', margin: '0 auto 1rem' }}
                />
                <div style={{ color: '#e2e8f0', fontWeight: 600, marginBottom: '0.25rem' }}>
                  Drag & Drop SAR Image here
                </div>
                <div style={{ color: '#94a3b8', fontSize: '0.85rem', marginBottom: '1.25rem' }}>
                  Supports PNG, JPG, JPEG, TIF, TIFF (Max 25MB)
                </div>
                <button
                  type="button"
                  style={{
                    background: 'linear-gradient(135deg, #0284c7 0%, #0369a1 100%)',
                    color: '#ffffff',
                    border: 'none',
                    borderRadius: '6px',
                    padding: '0.6rem 1.25rem',
                    fontSize: '0.9rem',
                    fontWeight: 500,
                    cursor: 'pointer',
                    boxShadow: '0 4px 12px rgba(2, 132, 199, 0.3)',
                  }}
                >
                  Choose Image
                </button>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                {/* Image Preview Container */}
                <div
                  style={{
                    position: 'relative',
                    borderRadius: '8px',
                    overflow: 'hidden',
                    background: '#020617',
                    border: '1px solid rgba(51, 65, 85, 0.8)',
                    height: '240px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  {previewUrl && (
                    <img
                      src={previewUrl}
                      alt="SAR preview"
                      style={{
                        maxWidth: '100%',
                        maxHeight: '100%',
                        objectFit: 'contain',
                      }}
                    />
                  )}
                </div>

                {/* File Metadata Details */}
                <div
                  style={{
                    background: 'rgba(30, 41, 59, 0.6)',
                    borderRadius: '8px',
                    padding: '0.85rem',
                    border: '1px solid rgba(51, 65, 85, 0.5)',
                    fontSize: '0.85rem',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '0.4rem',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: '#94a3b8' }}>Filename:</span>
                    <span style={{ color: '#e2e8f0', fontWeight: 500, maxWidth: '200px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {selectedFile.name}
                    </span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: '#94a3b8' }}>Dimensions:</span>
                    <span style={{ color: '#e2e8f0', fontWeight: 500 }}>
                      {imageDims ? `${imageDims.width} × ${imageDims.height} px` : 'Reading...'}
                    </span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: '#94a3b8' }}>File Size:</span>
                    <span style={{ color: '#e2e8f0', fontWeight: 500 }}>
                      {(selectedFile.size / (1024 * 1024)).toFixed(2)} MB
                    </span>
                  </div>
                </div>

                {/* Action Buttons */}
                <div style={{ display: 'flex', gap: '0.75rem', marginTop: '0.5rem' }}>
                  <button
                    type="button"
                    onClick={handleAnalyze}
                    disabled={analyzing}
                    style={{
                      flex: 1,
                      background: analyzing
                        ? 'rgba(2, 132, 199, 0.5)'
                        : 'linear-gradient(135deg, #0284c7 0%, #0369a1 100%)',
                      color: '#ffffff',
                      border: 'none',
                      borderRadius: '8px',
                      padding: '0.75rem 1rem',
                      fontWeight: 600,
                      fontSize: '0.95rem',
                      cursor: analyzing ? 'not-allowed' : 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '0.5rem',
                      boxShadow: '0 4px 14px rgba(2, 132, 199, 0.35)',
                      transition: 'all 0.2s ease',
                    }}
                  >
                    {analyzing ? (
                      <>
                        <Loader2 size={18} className="spin" style={{ animation: 'spin 1s linear infinite' }} />
                        <span>Analyzing SAR image...</span>
                      </>
                    ) : (
                      <>
                        <Eye size={18} />
                        <span>ANALYZE IMAGE</span>
                      </>
                    )}
                  </button>

                  <button
                    type="button"
                    onClick={handleReset}
                    disabled={analyzing}
                    style={{
                      background: 'rgba(30, 41, 59, 0.8)',
                      color: '#94a3b8',
                      border: '1px solid rgba(71, 85, 105, 0.6)',
                      borderRadius: '8px',
                      padding: '0.75rem 1rem',
                      cursor: analyzing ? 'not-allowed' : 'pointer',
                    }}
                    title="Clear selected image"
                  >
                    <RefreshCw size={18} />
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Model Information Box */}
          <div
            style={{
              background: 'rgba(15, 23, 42, 0.6)',
              border: '1px solid rgba(51, 65, 85, 0.5)',
              borderRadius: '12px',
              padding: '1.25rem',
              fontSize: '0.85rem',
              color: '#94a3b8',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#cbd5e1', fontWeight: 600, marginBottom: '0.5rem' }}>
              <Layers size={16} />
              <span>Model Architecture</span>
            </div>
            <div>Encoder: <strong>MiT-B2 (nvidia/mit-b2)</strong></div>
            <div style={{ marginTop: '0.2rem' }}>Decoder: <strong>Custom 4-stage U-Net (Skip Connections)</strong></div>
            <div style={{ marginTop: '0.2rem' }}>Input Resolution: <strong>256 × 256 px</strong></div>
            <div style={{ marginTop: '0.2rem' }}>Operational Threshold: <strong>0.50</strong></div>
          </div>
        </div>

        {/* Results & Visual Analysis Column */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          {error && (
            <div
              style={{
                background: 'rgba(239, 68, 68, 0.1)',
                border: '1px solid rgba(239, 68, 68, 0.4)',
                borderRadius: '10px',
                padding: '1rem',
                color: '#f87171',
                display: 'flex',
                alignItems: 'center',
                gap: '0.75rem',
              }}
            >
              <AlertCircle size={20} style={{ flexShrink: 0 }} />
              <div>{error}</div>
            </div>
          )}

          {!result && !analyzing && (
            <div
              style={{
                background: 'rgba(15, 23, 42, 0.5)',
                border: '1px dashed rgba(51, 65, 85, 0.6)',
                borderRadius: '12px',
                padding: '4rem 2rem',
                textAlign: 'center',
                color: '#64748b',
              }}
            >
              <FileImage size={48} style={{ margin: '0 auto 1rem', opacity: 0.5 }} />
              <h3 style={{ fontSize: '1.1rem', color: '#cbd5e1', fontWeight: 600, marginBottom: '0.5rem' }}>
                No Analysis Performed Yet
              </h3>
              <p style={{ maxWidth: '440px', margin: '0 auto', fontSize: '0.9rem' }}>
                Select an image on the left and click <strong>ANALYZE IMAGE</strong> to execute segmentation inference and view metrics.
              </p>
            </div>
          )}

          {analyzing && (
            <div
              style={{
                background: 'rgba(15, 23, 42, 0.7)',
                border: '1px solid rgba(56, 189, 248, 0.3)',
                borderRadius: '12px',
                padding: '4rem 2rem',
                textAlign: 'center',
                color: '#e2e8f0',
              }}
            >
              <Loader2 size={44} className="spin" style={{ margin: '0 auto 1rem', color: '#38bdf8', animation: 'spin 1s linear infinite' }} />
              <h3 style={{ fontSize: '1.2rem', fontWeight: 600, marginBottom: '0.5rem' }}>
                Analyzing SAR Image
              </h3>
              <p style={{ color: '#94a3b8', fontSize: '0.9rem' }}>
                Executing MiT-B2 feature extraction, U-Net decoding, and spatial analysis...
              </p>
            </div>
          )}

          {result && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
              {/* Primary Status Banner */}
              <div
                style={{
                  background: isSpillDetected
                    ? 'linear-gradient(135deg, rgba(239, 68, 68, 0.18) 0%, rgba(185, 28, 28, 0.08) 100%)'
                    : 'linear-gradient(135deg, rgba(34, 197, 94, 0.18) 0%, rgba(21, 128, 61, 0.08) 100%)',
                  border: `1px solid ${isSpillDetected ? 'rgba(239, 68, 68, 0.5)' : 'rgba(34, 197, 94, 0.5)'}`,
                  borderRadius: '12px',
                  padding: '1.25rem 1.5rem',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  boxShadow: isSpillDetected
                    ? '0 0 20px rgba(239, 68, 68, 0.15)'
                    : '0 0 20px rgba(34, 197, 94, 0.15)',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                  {isSpillDetected ? (
                    <div
                      style={{
                        padding: '0.6rem',
                        borderRadius: '50%',
                        background: 'rgba(239, 68, 68, 0.25)',
                        color: '#ef4444',
                      }}
                    >
                      <AlertTriangle size={24} />
                    </div>
                  ) : (
                    <div
                      style={{
                        padding: '0.6rem',
                        borderRadius: '50%',
                        background: 'rgba(34, 197, 94, 0.25)',
                        color: '#22c55e',
                      }}
                    >
                      <CheckCircle2 size={24} />
                    </div>
                  )}
                  <div>
                    <div style={{ fontSize: '0.8rem', textTransform: 'uppercase', letterSpacing: '0.05em', color: '#94a3b8', fontWeight: 600 }}>
                      Classification Verdict
                    </div>
                    <div
                      style={{
                        fontSize: '1.4rem',
                        fontWeight: 700,
                        color: isSpillDetected ? '#f87171' : '#4ade80',
                      }}
                    >
                      {isSpillDetected ? '🔴 OIL-LIKE SPILL DETECTED' : '🟢 NO SIGNIFICANT OIL-LIKE REGION DETECTED'}
                    </div>
                  </div>
                </div>

                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: '0.8rem', color: '#94a3b8' }}>Inference Latency</div>
                  <div style={{ fontSize: '1.1rem', fontWeight: 600, color: '#f1f5f9' }}>
                    {result.inference_time_ms} ms
                  </div>
                </div>
              </div>

              {/* Metrics Grid */}
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
                  gap: '1rem',
                }}
              >
                <div
                  style={{
                    background: 'rgba(15, 23, 42, 0.75)',
                    border: '1px solid rgba(51, 65, 85, 0.7)',
                    borderRadius: '10px',
                    padding: '1rem',
                  }}
                >
                  <div style={{ color: '#94a3b8', fontSize: '0.8rem', marginBottom: '0.25rem' }}>
                    Oil-like Area
                  </div>
                  <div style={{ fontSize: '1.5rem', fontWeight: 700, color: isSpillDetected ? '#f87171' : '#f1f5f9' }}>
                    {result.oil_area_percent.toFixed(2)}%
                  </div>
                  <div style={{ color: '#64748b', fontSize: '0.75rem', marginTop: '0.25rem' }}>
                    Threshold: ≥ {result.min_oil_area_percent}%
                  </div>
                </div>

                <div
                  style={{
                    background: 'rgba(15, 23, 42, 0.75)',
                    border: '1px solid rgba(51, 65, 85, 0.7)',
                    borderRadius: '10px',
                    padding: '1rem',
                  }}
                >
                  <div style={{ color: '#94a3b8', fontSize: '0.8rem', marginBottom: '0.25rem' }}>
                    Detected-region Confidence
                  </div>
                  <div style={{ fontSize: '1.5rem', fontWeight: 700, color: '#38bdf8' }}>
                    {result.detected_region_confidence.toFixed(2)}%
                  </div>
                  <div style={{ color: '#64748b', fontSize: '0.75rem', marginTop: '0.25rem' }}>
                    Mean prob in predicted mask
                  </div>
                </div>

                <div
                  style={{
                    background: 'rgba(15, 23, 42, 0.75)',
                    border: '1px solid rgba(51, 65, 85, 0.7)',
                    borderRadius: '10px',
                    padding: '1rem',
                  }}
                >
                  <div style={{ color: '#94a3b8', fontSize: '0.8rem', marginBottom: '0.25rem' }}>
                    Mean Pixel Probability
                  </div>
                  <div style={{ fontSize: '1.5rem', fontWeight: 700, color: '#cbd5e1' }}>
                    {result.mean_pixel_probability.toFixed(2)}%
                  </div>
                  <div style={{ color: '#64748b', fontSize: '0.75rem', marginTop: '0.25rem' }}>
                    Image-wide average
                  </div>
                </div>

                <div
                  style={{
                    background: 'rgba(15, 23, 42, 0.75)',
                    border: '1px solid rgba(51, 65, 85, 0.7)',
                    borderRadius: '10px',
                    padding: '1rem',
                  }}
                >
                  <div style={{ color: '#94a3b8', fontSize: '0.8rem', marginBottom: '0.25rem' }}>
                    Maximum Probability
                  </div>
                  <div style={{ fontSize: '1.5rem', fontWeight: 700, color: '#cbd5e1' }}>
                    {result.max_pixel_probability.toFixed(2)}%
                  </div>
                  <div style={{ color: '#64748b', fontSize: '0.75rem', marginTop: '0.25rem' }}>
                    Highest sigmoid score
                  </div>
                </div>

                <div
                  style={{
                    background: 'rgba(15, 23, 42, 0.75)',
                    border: '1px solid rgba(51, 65, 85, 0.7)',
                    borderRadius: '10px',
                    padding: '1rem',
                  }}
                >
                  <div style={{ color: '#94a3b8', fontSize: '0.8rem', marginBottom: '0.25rem' }}>
                    Detected Regions
                  </div>
                  <div style={{ fontSize: '1.5rem', fontWeight: 700, color: '#cbd5e1' }}>
                    {result.detected_region_count}
                  </div>
                  <div style={{ color: '#64748b', fontSize: '0.75rem', marginTop: '0.25rem' }}>
                    Connected components
                  </div>
                </div>

                <div
                  style={{
                    background: 'rgba(15, 23, 42, 0.75)',
                    border: '1px solid rgba(51, 65, 85, 0.7)',
                    borderRadius: '10px',
                    padding: '1rem',
                  }}
                >
                  <div style={{ color: '#94a3b8', fontSize: '0.8rem', marginBottom: '0.25rem' }}>
                    Largest Region
                  </div>
                  <div style={{ fontSize: '1.5rem', fontWeight: 700, color: '#cbd5e1' }}>
                    {result.largest_region_percent.toFixed(2)}%
                  </div>
                  <div style={{ color: '#64748b', fontSize: '0.75rem', marginTop: '0.25rem' }}>
                    Of total analyzed area
                  </div>
                </div>
              </div>

              {/* Physical Area Notice */}
              <div
                style={{
                  background: 'rgba(30, 41, 59, 0.5)',
                  border: '1px solid rgba(51, 65, 85, 0.6)',
                  borderRadius: '8px',
                  padding: '0.75rem 1rem',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.6rem',
                  fontSize: '0.85rem',
                  color: '#94a3b8',
                }}
              >
                <Info size={16} style={{ color: '#38bdf8', flexShrink: 0 }} />
                <span>{result.physical_area_note}</span>
              </div>

              {/* Visual Analysis Gallery */}
              <div
                style={{
                  background: 'rgba(15, 23, 42, 0.75)',
                  border: '1px solid rgba(51, 65, 85, 0.7)',
                  borderRadius: '12px',
                  padding: '1.5rem',
                }}
              >
                <h3 style={{ fontSize: '1.1rem', fontWeight: 600, color: '#e2e8f0', marginBottom: '1.25rem' }}>
                  Visual Analysis
                </h3>

                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
                    gap: '1.25rem',
                  }}
                >
                  {/* 1. Original */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                    <div style={{ fontSize: '0.85rem', fontWeight: 600, color: '#cbd5e1' }}>
                      Original Image
                    </div>
                    <div
                      style={{
                        borderRadius: '8px',
                        overflow: 'hidden',
                        background: '#020617',
                        border: '1px solid rgba(51, 65, 85, 0.8)',
                        aspectRatio: '1/1',
                      }}
                    >
                      <img
                        src={result.visualizations.original_image}
                        alt="Original SAR"
                        style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                      />
                    </div>
                  </div>

                  {/* 2. Probability Heatmap */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                    <div style={{ fontSize: '0.85rem', fontWeight: 600, color: '#cbd5e1' }}>
                      Probability Map (Heatmap)
                    </div>
                    <div
                      style={{
                        borderRadius: '8px',
                        overflow: 'hidden',
                        background: '#020617',
                        border: '1px solid rgba(51, 65, 85, 0.8)',
                        aspectRatio: '1/1',
                      }}
                    >
                      <img
                        src={result.visualizations.probability_map}
                        alt="Probability Heatmap"
                        style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                      />
                    </div>
                  </div>

                  {/* 3. Binary Mask */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                    <div style={{ fontSize: '0.85rem', fontWeight: 600, color: '#cbd5e1' }}>
                      Segmentation Mask
                    </div>
                    <div
                      style={{
                        borderRadius: '8px',
                        overflow: 'hidden',
                        background: '#020617',
                        border: '1px solid rgba(51, 65, 85, 0.8)',
                        aspectRatio: '1/1',
                      }}
                    >
                      <img
                        src={result.visualizations.binary_mask}
                        alt="Binary Mask"
                        style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                      />
                    </div>
                  </div>

                  {/* 4. Overlay */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                    <div style={{ fontSize: '0.85rem', fontWeight: 600, color: '#cbd5e1' }}>
                      Overlay (Detected Oil Regions)
                    </div>
                    <div
                      style={{
                        borderRadius: '8px',
                        overflow: 'hidden',
                        background: '#020617',
                        border: '1px solid rgba(51, 65, 85, 0.8)',
                        aspectRatio: '1/1',
                      }}
                    >
                      <img
                        src={result.visualizations.overlay}
                        alt="Segmentation Overlay"
                        style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* Disclaimer */}
              <div
                style={{
                  background: 'rgba(15, 23, 42, 0.6)',
                  border: '1px solid rgba(71, 85, 105, 0.5)',
                  borderRadius: '10px',
                  padding: '1rem 1.25rem',
                  fontSize: '0.85rem',
                  color: '#94a3b8',
                  lineHeight: '1.5',
                }}
              >
                <div style={{ fontWeight: 600, color: '#cbd5e1', marginBottom: '0.25rem' }}>
                  Scientific & Operational Disclaimer:
                </div>
                <div>{result.disclaimer}</div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
