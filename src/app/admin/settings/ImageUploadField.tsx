'use client';

import { useEffect, useRef, useState } from 'react';
import { clamp, computeCropRect, outputSize } from '@/lib/imageCrop';

export interface ImageUploadLabels {
  choose: string;
  change: string;
  remove: string;
  cropTitle: string;
  zoom: string;
  apply: string;
  cancel: string;
  dragHint: string;
  empty: string;
}

/**
 * העלאת תמונה מהמחשב + חיתוך/התאמה לצורה שמוצגת באתר.
 * לוגו = ריבוע (יחס 1), באנר = רחב (16/9). התוצאה נשמרת כ-data URL
 * בשדה המחרוזת הקיים (ללא אחסון ענן). עובד במגע/נייד ובכיווניות RTL.
 */
export function ImageUploadField({
  name,
  defaultValue,
  targetAspect,
  rounded,
  maxWidth,
  maxHeight,
  mime,
  labels,
}: {
  name: string;
  defaultValue: string;
  targetAspect: number;
  rounded: boolean;
  maxWidth: number;
  maxHeight: number;
  mime: 'image/png' | 'image/jpeg';
  labels: ImageUploadLabels;
}) {
  const [value, setValue] = useState<string>(defaultValue ?? '');
  const [editing, setEditing] = useState(false);
  const [zoom, setZoom] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });

  const imgRef = useRef<HTMLImageElement | null>(null);
  const srcUrlRef = useRef<string | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const dragRef = useRef<{ x: number; y: number; ox: number; oy: number } | null>(
    null,
  );

  function revokeSrc() {
    if (srcUrlRef.current) {
      URL.revokeObjectURL(srcUrlRef.current);
      srcUrlRef.current = null;
    }
  }

  // ניקוי כתובת ה-blob בעת הסרת הרכיב (מוטמע כדי לא לתלות בפונקציה חיצונית).
  useEffect(() => {
    return () => {
      if (srcUrlRef.current) {
        URL.revokeObjectURL(srcUrlRef.current);
        srcUrlRef.current = null;
      }
    };
  }, []);

  function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !file.type.startsWith('image/')) return;
    revokeSrc();
    const url = URL.createObjectURL(file);
    srcUrlRef.current = url;
    const img = new Image();
    img.onload = () => {
      imgRef.current = img;
      setZoom(1);
      setOffset({ x: 0, y: 0 });
      setEditing(true);
    };
    img.src = url;
    // מאפשר לבחור שוב את אותו קובץ בעתיד
    e.target.value = '';
  }

  // ציור תצוגה מקדימה חיה של תוצאת החיתוך בזמן זום/הזזה.
  useEffect(() => {
    if (!editing) return;
    const canvas = canvasRef.current;
    const img = imgRef.current;
    if (!canvas || !img) return;
    const out = outputSize({ targetAspect, maxWidth, maxHeight });
    const dpr = Math.min(typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1, 2);
    const displayW = Math.min(out.width, 320);
    const displayH = Math.round(displayW / targetAspect);
    canvas.width = Math.round(displayW * dpr);
    canvas.height = Math.round(displayH * dpr);
    canvas.style.width = `${displayW}px`;
    canvas.style.height = `${displayH}px`;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const crop = computeCropRect({
      naturalWidth: img.naturalWidth,
      naturalHeight: img.naturalHeight,
      targetAspect,
      zoom,
      offsetX: offset.x,
      offsetY: offset.y,
    });
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    if (mime === 'image/jpeg') {
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
    }
    ctx.drawImage(
      img,
      crop.sx,
      crop.sy,
      crop.sWidth,
      crop.sHeight,
      0,
      0,
      canvas.width,
      canvas.height,
    );
  }, [editing, zoom, offset, targetAspect, maxWidth, maxHeight, mime]);

  function onPointerDown(e: React.PointerEvent<HTMLCanvasElement>) {
    e.currentTarget.setPointerCapture(e.pointerId);
    dragRef.current = { x: e.clientX, y: e.clientY, ox: offset.x, oy: offset.y };
  }
  function onPointerMove(e: React.PointerEvent<HTMLCanvasElement>) {
    const drag = dragRef.current;
    if (!drag) return;
    const w = e.currentTarget.clientWidth || 1;
    const h = e.currentTarget.clientHeight || 1;
    const dx = ((e.clientX - drag.x) / w) * 2;
    const dy = ((e.clientY - drag.y) / h) * 2;
    // גרירה ימינה חושפת את הצד השמאלי ⇐ ההיסט יורד
    setOffset({
      x: clamp(drag.ox - dx, -1, 1),
      y: clamp(drag.oy - dy, -1, 1),
    });
  }
  function onPointerUp(e: React.PointerEvent<HTMLCanvasElement>) {
    dragRef.current = null;
    if (e.currentTarget.hasPointerCapture(e.pointerId)) {
      e.currentTarget.releasePointerCapture(e.pointerId);
    }
  }

  function apply() {
    const img = imgRef.current;
    if (!img) return;
    const out = outputSize({ targetAspect, maxWidth, maxHeight });
    const canvas = document.createElement('canvas');
    canvas.width = out.width;
    canvas.height = out.height;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const crop = computeCropRect({
      naturalWidth: img.naturalWidth,
      naturalHeight: img.naturalHeight,
      targetAspect,
      zoom,
      offsetX: offset.x,
      offsetY: offset.y,
    });
    if (mime === 'image/jpeg') {
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, out.width, out.height);
    }
    ctx.drawImage(
      img,
      crop.sx,
      crop.sy,
      crop.sWidth,
      crop.sHeight,
      0,
      0,
      out.width,
      out.height,
    );
    const dataUrl = canvas.toDataURL(
      mime,
      mime === 'image/jpeg' ? 0.85 : undefined,
    );
    setValue(dataUrl);
    setEditing(false);
    revokeSrc();
    imgRef.current = null;
  }

  function cancel() {
    setEditing(false);
    revokeSrc();
    imgRef.current = null;
  }

  function remove() {
    setValue('');
    if (fileInputRef.current) fileInputRef.current.value = '';
  }

  const previewBox = rounded ? 'rounded-2xl' : 'rounded-lg';
  const previewWidth = rounded ? 'w-24' : 'w-full max-w-xs';

  return (
    <div>
      <input type="hidden" name={name} value={value} />
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        onChange={onFile}
        className="hidden"
      />

      {!editing && (
        <div className="flex flex-wrap items-center gap-3">
          {value ? (
            <span
              className={`relative block overflow-hidden border border-slate-200 bg-slate-50 ${previewBox} ${previewWidth}`}
              style={{ aspectRatio: String(targetAspect) }}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={value}
                alt=""
                className="h-full w-full object-cover"
              />
            </span>
          ) : (
            <span
              className={`flex items-center justify-center border border-dashed border-slate-300 bg-slate-50 text-xs text-slate-400 ${previewBox} ${previewWidth}`}
              style={{ aspectRatio: String(targetAspect) }}
            >
              {labels.empty}
            </span>
          )}

          <div className="flex flex-col gap-2">
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              {value ? labels.change : labels.choose}
            </button>
            {value && (
              <button
                type="button"
                onClick={remove}
                className="text-xs font-medium text-red-500 hover:text-red-600"
              >
                {labels.remove}
              </button>
            )}
          </div>
        </div>
      )}

      {editing && (
        <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
          <p className="mb-2 text-sm font-medium text-slate-700">
            {labels.cropTitle}
          </p>
          <div className="flex justify-center">
            <canvas
              ref={canvasRef}
              onPointerDown={onPointerDown}
              onPointerMove={onPointerMove}
              onPointerUp={onPointerUp}
              onPointerCancel={onPointerUp}
              className={`max-w-full cursor-move touch-none border border-slate-300 bg-white ${previewBox}`}
            />
          </div>
          <p className="mt-2 text-center text-xs text-slate-500">
            {labels.dragHint}
          </p>

          <label className="mt-3 flex items-center gap-2 text-xs text-slate-600">
            <span className="shrink-0">{labels.zoom}</span>
            <input
              type="range"
              min={1}
              max={3}
              step={0.01}
              value={zoom}
              onChange={(e) => setZoom(Number(e.target.value))}
              className="w-full"
            />
          </label>

          <div className="mt-3 flex justify-end gap-2">
            <button
              type="button"
              onClick={cancel}
              className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm text-slate-600 hover:bg-white"
            >
              {labels.cancel}
            </button>
            <button
              type="button"
              onClick={apply}
              className="rounded-lg bg-brand-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-brand-700"
            >
              {labels.apply}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
