'use client';

import React, { useState, useEffect } from 'react';
import QRCode from 'qrcode';
import { ExternalLink, Copy, Check, QrCode } from 'lucide-react';

interface QRCodeDisplayProps {
  value: string;
  size?: number;
  label?: string;
  sublabel?: string;
  showLink?: boolean;
}

export function QRCodeDisplay({
  value,
  size = 140,
  label = 'FairPlay Verification QR',
  sublabel = 'Scan to audit on independent device',
  showLink = true
}: QRCodeDisplayProps) {
  const [dataUrl, setDataUrl] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    let isMounted = true;
    QRCode.toDataURL(value, {
      width: size * 2,
      margin: 1,
      color: {
        dark: '#030712',
        light: '#ffffff'
      },
      errorCorrectionLevel: 'M'
    })
      .then((url) => {
        if (isMounted) setDataUrl(url);
      })
      .catch((err) => {
        console.warn('QR Code generation error:', err);
      });

    return () => {
      isMounted = false;
    };
  }, [value, size]);

  const handleCopy = () => {
    if (!navigator.clipboard) return;
    navigator.clipboard.writeText(value);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="flex flex-col items-center justify-center p-3 rounded-2xl bg-zinc-950/80 border border-white/10 text-center space-y-2.5">
      {/* QR Code Container with Scanner Frame */}
      <div className="relative p-2 rounded-xl bg-white shadow-xl flex items-center justify-center overflow-hidden">
        {dataUrl ? (
          <img
            src={dataUrl}
            alt={label}
            width={size}
            height={size}
            className="rounded-lg rendering-pixelated"
          />
        ) : (
          <div
            style={{ width: size, height: size }}
            className="flex items-center justify-center bg-zinc-100 text-zinc-400"
          >
            <QrCode className="w-8 h-8 animate-pulse" />
          </div>
        )}

        {/* Subtle holographic corner markers */}
        <div className="absolute top-1 left-1 w-2.5 h-2.5 border-t-2 border-l-2 border-emerald-500 rounded-tl" />
        <div className="absolute top-1 right-1 w-2.5 h-2.5 border-t-2 border-r-2 border-emerald-500 rounded-tr" />
        <div className="absolute bottom-1 left-1 w-2.5 h-2.5 border-b-2 border-l-2 border-emerald-500 rounded-bl" />
        <div className="absolute bottom-1 right-1 w-2.5 h-2.5 border-b-2 border-r-2 border-emerald-500 rounded-br" />
      </div>

      <div className="space-y-0.5">
        <span className="text-[11px] font-mono font-bold text-emerald-400 block tracking-wider uppercase">
          {label}
        </span>
        <span className="text-[10px] text-zinc-400 block">{sublabel}</span>
      </div>

      {showLink && (
        <div className="flex items-center gap-1.5 pt-1">
          <button
            type="button"
            onClick={handleCopy}
            className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-300 hover:text-white text-[10px] font-mono transition-colors border border-white/5"
            title="Copy verification URL"
          >
            {copied ? (
              <>
                <Check className="w-3 h-3 text-emerald-400" />
                <span className="text-emerald-400">Copied!</span>
              </>
            ) : (
              <>
                <Copy className="w-3 h-3" />
                <span>Copy URL</span>
              </>
            )}
          </button>

          <a
            href={value}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-violet-600/30 hover:bg-violet-600/50 text-violet-300 hover:text-white text-[10px] font-mono transition-colors border border-violet-500/20"
            title="Open verification page in new tab"
          >
            <ExternalLink className="w-3 h-3" />
            <span>Open</span>
          </a>
        </div>
      )}
    </div>
  );
}
