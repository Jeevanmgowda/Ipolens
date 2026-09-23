'use client';

import React, { useState } from 'react';
import { CsvImportResult, SupportedBroker } from '@/types/portfolio';
import { getSampleCsv } from '@/services/brokerParser';
import {
  UploadCloud,
  FileSpreadsheet,
  X,
  CheckCircle2,
  AlertTriangle,
  Download,
  ShieldCheck,
  Building2,
} from 'lucide-react';

interface CsvUploadModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export const CsvUploadModal: React.FC<CsvUploadModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
}) => {
  const [dragActive, setDragActive] = useState<boolean>(false);
  const [uploading, setUploading] = useState<boolean>(false);
  const [result, setResult] = useState<CsvImportResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleFileUpload = async (file: File) => {
    if (!file) return;
    setError(null);
    setResult(null);
    setUploading(true);

    try {
      const text = await file.text();
      const res = await fetch('/api/portfolio/upload', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ csvContent: text, fileName: file.name }),
      });

      const json = await res.json();
      if (json.success && json.data) {
        setResult(json.data);
        onSuccess();
      } else {
        setError(json.error || 'Failed to process CSV file.');
      }
    } catch (err: any) {
      setError(err.message || 'Error uploading file.');
    } finally {
      setUploading(false);
    }
  };

  const downloadTemplate = (broker: SupportedBroker) => {
    const csv = getSampleCsv(broker);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${broker}_holdings_sample.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm overflow-y-auto">
      <div className="relative w-full max-w-2xl rounded-2xl bg-[#0d1322] border border-white/10 p-6 shadow-2xl my-8">
        {/* Header */}
        <div className="flex items-start justify-between pb-4 border-b border-white/10">
          <div>
            <h3 className="text-base font-bold text-white flex items-center gap-2">
              <UploadCloud className="w-5 h-5 text-cyan-400" />
              Credential-Free Portfolio CSV / CAS Importer
            </h3>
            <p className="text-xs text-slate-400 mt-1">
              Import your demat holdings safely without sharing broker passwords or API keys.
            </p>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Security & Broker Badges */}
        <div className="mt-4 p-3 rounded-xl bg-cyan-500/10 border border-cyan-500/20 text-xs text-cyan-300 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 shrink-0 text-cyan-400" />
            <span>Zero Credential Risk: 100% client-parsed, automated ISIN matching & deduplication.</span>
          </div>
        </div>

        {/* Supported Brokers Info & Sample Download */}
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-2">
            <span className="text-slate-400">Supported:</span>
            <span className="px-2 py-0.5 rounded bg-slate-800 text-slate-200 font-medium">Zerodha Kite</span>
            <span className="px-2 py-0.5 rounded bg-slate-800 text-slate-200 font-medium">Groww</span>
            <span className="px-2 py-0.5 rounded bg-slate-800 text-slate-200 font-medium">5paisa</span>
            <span className="px-2 py-0.5 rounded bg-slate-800 text-slate-200 font-medium">NSDL/CDSL CAS</span>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-slate-400">Sample files:</span>
            <button
              onClick={() => downloadTemplate('zerodha')}
              className="text-cyan-400 hover:text-cyan-300 font-medium flex items-center gap-1 cursor-pointer"
            >
              <Download className="w-3 h-3" /> Zerodha
            </button>
            <button
              onClick={() => downloadTemplate('groww')}
              className="text-cyan-400 hover:text-cyan-300 font-medium flex items-center gap-1 cursor-pointer"
            >
              <Download className="w-3 h-3" /> Groww
            </button>
          </div>
        </div>

        {/* Drag & Drop Zone */}
        <div
          onDragOver={(e) => {
            e.preventDefault();
            setDragActive(true);
          }}
          onDragLeave={() => setDragActive(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragActive(false);
            if (e.dataTransfer.files && e.dataTransfer.files[0]) {
              handleFileUpload(e.dataTransfer.files[0]);
            }
          }}
          className={`mt-4 p-8 border-2 border-dashed rounded-2xl flex flex-col items-center justify-center text-center transition cursor-pointer ${
            dragActive
              ? 'border-cyan-400 bg-cyan-500/10'
              : 'border-white/15 bg-slate-950/60 hover:border-cyan-500/40'
          }`}
          onClick={() => {
            const input = document.getElementById('csv-file-input') as HTMLInputElement;
            if (input) input.click();
          }}
        >
          <input
            id="csv-file-input"
            type="file"
            accept=".csv"
            className="hidden"
            onChange={(e) => {
              if (e.target.files && e.target.files[0]) {
                handleFileUpload(e.target.files[0]);
              }
            }}
          />

          <FileSpreadsheet className="w-12 h-12 text-cyan-400 mb-3" />
          <p className="text-sm font-semibold text-white">
            {uploading ? 'Parsing & matching ISINs...' : 'Click or drag broker CSV here to import'}
          </p>
          <p className="text-xs text-slate-400 mt-1">
            Supports .csv exports directly downloaded from your broker portfolio page
          </p>
        </div>

        {/* Error Alert */}
        {error && (
          <div className="mt-4 p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-300 text-xs">
            {error}
          </div>
        )}

        {/* Import Results Summary */}
        {result && (
          <div className="mt-4 p-4 rounded-xl bg-slate-950 border border-white/10 space-y-2 text-xs">
            <div className="flex items-center justify-between">
              <span className="font-bold text-white flex items-center gap-1.5 text-emerald-400">
                <CheckCircle2 className="w-4 h-4" /> Import Complete ({result.brokerDetected.toUpperCase()})
              </span>
              <span className="font-mono text-slate-400">{result.fileName}</span>
            </div>

            <div className="grid grid-cols-3 gap-2 pt-2 border-t border-white/5 font-mono text-center">
              <div className="p-2 rounded bg-slate-900">
                <span className="text-[10px] text-slate-500 block">Valid Holdings</span>
                <span className="font-bold text-emerald-400 text-sm">{result.validHoldingsImported}</span>
              </div>
              <div className="p-2 rounded bg-slate-900">
                <span className="text-[10px] text-slate-500 block">Duplicates Skipped</span>
                <span className="font-bold text-cyan-400 text-sm">{result.duplicateRowsSkipped}</span>
              </div>
              <div className="p-2 rounded bg-slate-900">
                <span className="text-[10px] text-slate-500 block">Rejected Rows</span>
                <span className="font-bold text-rose-400 text-sm">{result.rejectedRowsCount}</span>
              </div>
            </div>

            {result.errors.length > 0 && (
              <div className="mt-2 text-[11px] text-rose-300">
                Skipped {result.errors.length} rows with format issues (e.g. Row {result.errors[0].rowNumber}: {result.errors[0].reason})
              </div>
            )}
          </div>
        )}

        {/* Footer */}
        <div className="mt-6 flex justify-end">
          <button
            onClick={onClose}
            className="px-5 py-2 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-black font-semibold text-xs cursor-pointer"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
};
