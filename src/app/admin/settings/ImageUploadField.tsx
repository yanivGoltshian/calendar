'use client';

import { useEffect, useRef, useState } from 'react';
import { clamp, computeCropRect, outputSize } from '@/lib/imageCrop';
import { encodeUnderLimit } from '@/lib/imageEncode';
import { imageUrl, MAX_SOURCE_IMAGE_BYTES } from '@/lib/media';

export interface ImageUploadLabels {
  choose: string;
  change: string;
  remove: string;
  cropTitle: string;
  zoom: string;
  adjust: string;
  done: string;
  cancel: string;
  dragHint: string;
  empty: string;
  tooLarge: string;
}

type BakeResult = { dataUrl: string } | { error: string } | null;

/**
 * העלאת תמונה מהמחשב + חיתוך/התאמה לצורה שמוצגת באתר.
 * The canvas is a local preview only. Completing the crop uploads once and
 * persists a bounded storage URL, never the local base64 representation.
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
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [zoom, setZoom] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });

  const imgRef = useRef<HTMLImageElement | null>(null);
  const srcUrlRef = useRef<string | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const hiddenRef = useRef<HTMLInputElement | null>(null);
  const prevValueRef = useRef<string>(defaultValue ?? '');
  const didMountRef = useRef(false);
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

  // כל שינוי ערך אחרי הטעינה הראשונית מפעיל אירוע input על השדה הנסתר, כדי
  // שהטופס העוטף יזהה שינוי (שדות נסתרים ש-React מעדכן אינם משדרים אירוע לבד).
  useEffect(() => {
    if (!didMountRef.current) {
      didMountRef.current = true;
      return;
    }
    hiddenRef.current?.dispatchEvent(new Event('input', { bubbles: true }));
  }, [value]);

  useEffect(() => {
    const form = hiddenRef.current?.form;
    const preventPrematureSave = (event: Event) => {
      if (editing || uploading) {
        event.preventDefault();
        event.stopPropagation();
        setError('יש לסיים או לבטל את התאמת התמונה לפני שמירה.');
      }
    };
    form?.addEventListener('submit', preventPrematureSave, true);
    return () => form?.removeEventListener('submit', preventPrematureSave, true);
  }, [editing, uploading]);

  /** מקבע את החיתוך הנוכחי ל-data URL תחת תקרת הגודל, או מחזיר שגיאה. */
  function bake(z: number, off: { x: number; y: number }): BakeResult {
    const img = imgRef.current;
    if (!img) return null;
    const out = outputSize({ targetAspect, maxWidth, maxHeight });
    const canvas = document.createElement('canvas');
    canvas.width = out.width;
    canvas.height = out.height;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;
    const crop = computeCropRect({
      naturalWidth: img.naturalWidth,
      naturalHeight: img.naturalHeight,
      targetAspect,
      zoom: z,
      offsetX: off.x,
      offsetY: off.y,
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
    const res = encodeUnderLimit({
      encode: (q) => canvas.toDataURL(mime, q),
      compressible: mime === 'image/jpeg',
    });
    if (!res.ok) return { error: labels.tooLarge };
    return { dataUrl: res.dataUrl };
  }

  function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type) || file.size > MAX_SOURCE_IMAGE_BYTES) {
      setError(labels.tooLarge);
      return;
    }
    prevValueRef.current = value;
    revokeSrc();
    const url = URL.createObjectURL(file);
    srcUrlRef.current = url;
    const img = new Image();
    img.onload = () => {
      if (img.naturalWidth * img.naturalHeight > 20_000_000) {
        setError(labels.tooLarge);
        revokeSrc();
        return;
      }
      imgRef.current = img;
      setZoom(1);
      setOffset({ x: 0, y: 0 });
      setError(null);
      setEditing(true);
    };
    img.onerror = () => { setError('הקובץ אינו תמונה תקינה. אפשר לבחור קובץ אחר.'); revokeSrc(); };
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

  /** Legacy data stays local; remote adjustments use the same-origin image route. */
  function adjust() {
    if (!value) return;
    prevValueRef.current = value;
    revokeSrc();
    const img = new Image();
    img.onload = () => {
      imgRef.current = img;
      setZoom(1);
      setOffset({ x: 0, y: 0 });
      setError(null);
      setEditing(true);
    };
    img.onerror = () => setError('לא ניתן לטעון את התמונה להתאמה. אפשר לבחור קובץ חדש.');
    img.src = value.startsWith('data:') ? value : imageUrl(value, 1600);
  }

  /** The persisted value changes only after the final crop upload succeeds. */
  async function done() {
    if (uploading) return;
    const r = bake(zoom, offset);
    if (r && 'error' in r) {
      setError(r.error);
      return;
    }
    if (!r || !('dataUrl' in r)) return;
    setUploading(true);
    setError(null);
    try {
      const blob = await (await fetch(r.dataUrl)).blob();
      const form = new FormData();
      form.set('file', blob, 'crop.jpg');
      const response = await fetch('/api/upload/media', { method: 'POST', body: form });
      const result = await response.json();
      if (!response.ok || typeof result.url !== 'string') throw new Error(result.error || 'ההעלאה נכשלה.');
      setValue(result.url);
      setEditing(false);
      revokeSrc();
      imgRef.current = null;
    } catch (error) {
      setError(error instanceof Error ? error.message : 'ההעלאה נכשלה.');
    } finally { setUploading(false); }
  }

  /** ביטול: החזרת הערך שהיה לפני פתיחת המכוון וסגירתו. */
  function cancel() {
    if (uploading) return;
    setValue(prevValueRef.current);
    setEditing(false);
    setError(null);
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
      <input ref={hiddenRef} type="hidden" name={name} value={value} />
      <input
        ref={fileInputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        onChange={onFile}
        className="hidden"
      />

      {!editing && (
        <div className="flex flex-wrap items-center gap-3">
          {value ? (
            <span
              className={`relative block overflow-hidden border border-[#e7ddcd] bg-[#f7f2ea] ${previewBox} ${previewWidth}`}
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
              className={`flex items-center justify-center border border-dashed border-[#d6c8b4] bg-[#f7f2ea] text-xs text-[#b3a690] ${previewBox} ${previewWidth}`}
              style={{ aspectRatio: String(targetAspect) }}
            >
              {labels.empty}
            </span>
          )}
          {!editing && error ? <p role="alert" className="mt-2 text-sm text-red-700">{error}</p> : null}

          <div className="flex flex-col gap-2">
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="rounded-lg border border-[#d6c8b4] px-3 py-1.5 text-sm font-medium text-[#4a4038] hover:bg-[#f7f2ea]"
            >
              {value ? labels.change : labels.choose}
            </button>
            {value && (
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={adjust}
                  className="text-xs font-medium text-brand-600 hover:text-brand-700"
                >
                  {labels.adjust}
                </button>
                <button
                  type="button"
                  onClick={remove}
                  className="text-xs font-medium text-red-500 hover:text-red-600"
                >
                  {labels.remove}
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {editing && (
        <div className="rounded-xl border border-[#e7ddcd] bg-[#f7f2ea] p-3">
          <p className="mb-2 text-sm font-medium text-[#4a4038]">
            {labels.cropTitle}
          </p>
          <div className="flex justify-center">
            <canvas
              ref={canvasRef}
              onPointerDown={onPointerDown}
              onPointerMove={onPointerMove}
              onPointerUp={onPointerUp}
              onPointerCancel={onPointerUp}
              className={`max-w-full cursor-move touch-none border border-[#d6c8b4] bg-white ${previewBox}`}
            />
          </div>
          <p className="mt-2 text-center text-xs text-[#8f8478]">
            {labels.dragHint}
          </p>

          <label className="mt-3 flex items-center gap-2 text-xs text-[#6e655f]">
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

          {error && (
            <p className="mt-3 text-center text-xs font-medium text-red-600">
              {error}
            </p>
          )}

          <div className="mt-3 flex justify-end gap-2">
            <button
              type="button"
              onClick={cancel}
              disabled={uploading}
              className="rounded-lg border border-[#d6c8b4] px-3 py-1.5 text-sm text-[#6e655f] hover:bg-white"
            >
              {labels.cancel}
            </button>
            <button
              type="button"
              onClick={done}
              disabled={uploading}
              className="rounded-lg bg-brand-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-brand-700"
            >
              {uploading ? 'מעלה…' : labels.done}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
