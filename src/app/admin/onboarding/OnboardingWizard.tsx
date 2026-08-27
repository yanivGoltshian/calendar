'use client';

import { useActionState, useEffect, useRef, useState } from 'react';
import type { SaveState } from '../settings/parse';
import { t } from '@/i18n';
import { Button } from '@/components/ui';
import BookingLinkShare from '@/components/booking/BookingLinkShare';
import { ImageUploadField, type ImageUploadLabels } from '../settings/ImageUploadField';
import { saveServices, saveHours, saveBranding, savePremiumLanding } from './actions';
import {
  buildDefaultSectionToggles,
  BRAND_PRESETS,
  resolveInitialPremiumPhase,
  seedPremiumDraft,
  nextPremiumStep,
  prevPremiumStep,
  premiumPipStatus,
  premiumStepName,
  premiumStepIndex,
  isPremiumWinStep,
  PREMIUM_WIZARD_TOTAL,
  PREMIUM_WIN_STEP,
  type BrandPreset,
  type PremiumWizardStep,
  type PremiumWizardStepName,
} from './premium';
import {
  landingDefaults,
  MAX_BENEFITS,
  MAX_HERO_IMAGES,
  MAX_GALLERY_IMAGES,
  MAX_HOT_DEALS_IMAGES,
  type LandingContent,
  type LandingHotDeals,
  type LandingLaunchOffer,
  type LandingSocialLinks,
  type LandingSectionKey,
  type LandingBenefit,
} from '@/lib/publicPageStyle';

/** תת-קבוצה סריאליזבילית של שירות, לרינדור שורות ההחלפה בצעד השירותים. */
export type WizardService = {
  id: string;
  name: string;
  durationMin: number;
  priceAgorot: number;
  hidden: boolean;
};

type HoursPresetKey = 'sun-thu' | 'every-day' | 'custom';

/**
 * שלב הפרימיום האופציונלי (אחרי המיתוג):
 * 'gate' שער הבחירה, 'editor' עורך העמוד המלא, 'summary' מסך הסיכום.
 */
type PremiumPhase = 'gate' | 'editor' | 'summary';

type Props = {
  businessName: string;
  brandColor: string;
  logoUrl: string;
  services: WizardService[];
  serviceExample: string;
  bookingUrl: string;
  bookingQr: string;
  // ── פרימיום: פרטי העסק והתוכן ההתחלתי לעמוד הנחיתה ──
  businessType: string;
  businessAddress: string;
  slug: string;
  premiumInitial: LandingContent | null;
  /**
   * כניסה ישירה לתת-שלב הפרימיום (deep-link ‎?edit=premium‎). כאשר 'editor',
   * האשף נפתח ישר בעורך עמוד הפרימיום — למשל מיד אחרי «כניסה כבעל העסק» — במקום
   * לפתוח בשלושת הצעדים הקלאסיים. undefined ⇐ הזרימה הרגילה ללא שינוי.
   */
  initialPremiumPhase?: 'editor';
};

const initialSaveState: SaveState = { ok: false };

/** ששת גווני המותג המוצעים (תואם למוקאפ המאושר). */
/** גווני מותג ראשיים אצורים (פיקס) — קובעים brandColor בלבד; שאר גווני --biz-* נגזרים אוטומטית. */
const PRIMARY_SWATCHES = [
  '#1c1512', '#12b886', '#7c3aed', '#e11d48', '#f59e0b', '#0ea5e9',
  '#b0855f', '#d98ca3', '#3f9d8a', '#3b82c4', '#9b3b57', '#2fa9a2',
];

function errorText(state: SaveState): string | null {
  if (!state.error) return null;
  if (state.error === 'no_business') return t.admin.onboarding.errorNoBusiness;
  return t.admin.onboarding.errorGeneric;
}

/** ₪ → אגורות (מספר שלם), עם הגנה מפני קלט לא-מספרי. */
function shekelToAgorot(raw: string): number {
  const n = Number(raw.replace(',', '.'));
  return Number.isFinite(n) && n > 0 ? Math.round(n * 100) : 0;
}

/**
 * משבצת טקסט הניתנת לעריכה במקום (WYSIWYG): לחיצה פותחת שדה קלט, יציאה שומרת.
 * Enter שומר (בשורה יחידה), Escape מבטל, והקיטום נאכף לפי המגבלה של המקטע.
 */
function InlineText(props: {
  value: string;
  onCommit: (v: string) => void;
  limit: number;
  editLabel: string;
  placeholder?: string;
  multiline?: boolean;
  block?: boolean;
  dir?: 'rtl' | 'ltr';
  className?: string;
  style?: React.CSSProperties;
}) {
  const {
    value,
    onCommit,
    limit,
    editLabel,
    placeholder,
    multiline = false,
    block = false,
    dir = 'rtl',
    className,
    style,
  } = props;
  const [editing, setEditing] = useState(false);
  const [temp, setTemp] = useState(value);
  const start = () => {
    setTemp(value);
    setEditing(true);
  };
  const commit = () => {
    setEditing(false);
    const next = temp.slice(0, limit);
    if (next !== value) onCommit(next);
  };
  const cancel = () => {
    setTemp(value);
    setEditing(false);
  };
  const editCls =
    'w-full rounded-lg border border-black/10 bg-white px-2 py-1 text-[#1b1715] shadow-sm outline-none focus:ring-2 focus:ring-emerald-400';
  if (editing) {
    const commitOnEnter = (e: React.KeyboardEvent) => {
      if (e.key === 'Enter' && !multiline) {
        e.preventDefault();
        commit();
      } else if (e.key === 'Escape') {
        cancel();
      }
    };
    if (multiline) {
      return (
        <textarea
          autoFocus
          rows={3}
          value={temp}
          maxLength={limit}
          dir={dir}
          onChange={(e) => setTemp(e.target.value)}
          onBlur={commit}
          onKeyDown={commitOnEnter}
          className={editCls}
          style={{ font: 'inherit', ...style }}
        />
      );
    }
    return (
      <input
        autoFocus
        type="text"
        value={temp}
        maxLength={limit}
        dir={dir}
        onChange={(e) => setTemp(e.target.value)}
        onBlur={commit}
        onKeyDown={commitOnEnter}
        className={editCls}
        style={{ font: 'inherit', ...style }}
      />
    );
  }
  const isEmpty = value.trim() === '';
  const shownText = isEmpty ? placeholder ?? editLabel : value;
  const inner = (
    <>
      <span className={isEmpty ? 'opacity-60' : undefined}>{shownText}</span>
      <span aria-hidden className="mr-1 text-[0.75em] opacity-40 transition group-hover/inline:opacity-90">
        {'\u270E'}
      </span>
    </>
  );
  const commonProps = {
    role: 'button' as const,
    tabIndex: 0,
    title: editLabel,
    'aria-label': editLabel,
    dir,
    onClick: start,
    onKeyDown: (e: React.KeyboardEvent) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        start();
      }
    },
    style,
  };
  if (block) {
    return (
      <div {...commonProps} className={`group/inline cursor-text ${className ?? ''}`}>
        {inner}
      </div>
    );
  }
  return (
    <span {...commonProps} className={`group/inline inline-block cursor-text ${className ?? ''}`}>
      {inner}
    </span>
  );
}

/**
 * משבצת מדיה עם העלאה במקום: מציגה את התמונה או ממלא הרקע, וכפתור צף להעלאה או החלפה.
 * הקובץ נשלח ל-/api/upload/media, וכתובת ה-URL שחוזרת נכתבת לטיוטה דרך onUploaded.
 * שגיאה בעברית מהשרת מוצגת מתחת למסגרת. הרכיב מנהל מצב העלאה ושגיאה בעצמו.
 */
function MediaSlot(props: {
  url?: string;
  accept: string;
  labels: { upload: string; replace: string; uploading: string; error: string };
  onUploaded: (url: string) => void;
  frameClassName: string;
  tone?: 'light' | 'dark';
  children: React.ReactNode;
}) {
  const { url, accept, labels, onUploaded, frameClassName, tone = 'dark', children } = props;
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onFile = async (file: File | null | undefined) => {
    if (!file) return;
    setError(null);
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append('file', file);
      const res = await fetch('/api/upload/media', { method: 'POST', body: fd });
      const data = (await res.json().catch(() => null)) as { url?: string; error?: string } | null;
      if (!res.ok || !data?.url) {
        setError(data?.error ?? labels.error);
        return;
      }
      onUploaded(data.url);
    } catch {
      setError(labels.error);
    } finally {
      setUploading(false);
    }
  };

  const btnTone =
    tone === 'dark'
      ? 'bg-black/60 text-white hover:bg-black/75'
      : 'bg-white/90 text-[#4a4038] hover:bg-white';
  const label = uploading ? labels.uploading : url ? labels.replace : labels.upload;

  return (
    <div>
      <div className={frameClassName}>
        {children}
        <div className="absolute inset-x-0 bottom-0 flex justify-center p-2">
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            disabled={uploading}
            className={`rounded-full px-3 py-1 text-[11px] font-semibold shadow-sm backdrop-blur transition disabled:opacity-60 ${btnTone}`}
          >
            {label}
          </button>
        </div>
        <input
          ref={inputRef}
          type="file"
          accept={accept}
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            e.target.value = '';
            void onFile(f);
          }}
        />
      </div>
      {error ? <p className="mt-1 text-center text-[10px] text-[#d05b52]">{error}</p> : null}
    </div>
  );
}

// ── פורט המוקאפ המאושר (premium-builder.html): CSS + ספרייט אייקונים של אשף הפרימיום ──
// כרום קבוע נייבי/זהב/קרם (מאושר ע"י יניב); צבע פר-עסק רק בכרטיסי התצוגה המקדימה.
// אין font-family בשום מחלקה כדי שהיבו הגלובלי יורש. RTL, mobile-first.
const PW_CSS = `
.pw-root{--sand:#faf8f5;--surface:#fff;--ink:#2a2119;--muted:#7c6650;--border:#e8dfd4;--navy:#24406e;--navy-strong:#16233a;--navy-900:#0a182d;--navy-50:#eef3fa;--navy-100:#d9e2f1;--gold:#c08c3c;--gold-300:#e4bf6f;--gold-600:#b5873a;--emerald:#0ea86f;--emerald-50:#e9f7f0;--emerald-100:#c9ecdb;color:var(--ink);}
.pw-phone-wrap{display:flex;justify-content:center;padding:18px 14px 40px;background:radial-gradient(120% 90% at 50% -10%,#fff 0%,var(--sand) 55%,#f4efe9 100%);}
.pw-phone{position:relative;width:100%;max-width:400px;height:760px;max-height:86vh;display:flex;flex-direction:column;background:var(--surface);border:1px solid var(--border);border-radius:34px;overflow:hidden;box-shadow:0 24px 60px -28px rgba(16,35,58,.5);}
.pw-appbar{display:flex;align-items:center;justify-content:space-between;gap:8px;padding:12px 16px;background:var(--navy-900);color:#fff;flex:0 0 auto;}
.pw-back{background:transparent;border:0;color:#cdd8ec;font-size:13px;font-weight:600;cursor:pointer;padding:4px 2px;}
.pw-back:hover{color:#fff;}
.pw-brandchip{display:inline-flex;align-items:center;gap:6px;background:rgba(255,255,255,.1);border:1px solid rgba(255,255,255,.16);color:#fff;font-size:12px;font-weight:700;padding:5px 10px;border-radius:999px;}
.pw-dot{width:8px;height:8px;border-radius:50%;background:var(--gold-300);display:inline-block;}
.pw-wiz-head{flex:0 0 auto;padding:14px 18px 10px;background:linear-gradient(180deg,var(--navy),var(--navy-strong));color:#fff;}
.pw-row1{display:flex;align-items:center;justify-content:space-between;gap:8px;}
.pw-kicker{font-size:11px;font-weight:800;letter-spacing:.08em;text-transform:uppercase;color:var(--gold-300);}
.pw-counter{font-size:12px;font-weight:700;color:#e7eefb;}
.pw-pips{display:flex;gap:6px;margin-top:10px;}
.pw-pip{flex:1;height:5px;border-radius:999px;border:0;padding:0;cursor:pointer;background:rgba(255,255,255,.22);transition:background .2s;}
.pw-pip-done{background:var(--gold);}
.pw-pip-cur{background:#fff;}
.pw-body{flex:1 1 auto;overflow-y:auto;padding:18px 18px 8px;-webkit-overflow-scrolling:touch;}
.pw-step{animation:pwFade .28s ease;}
@keyframes pwFade{from{opacity:0;transform:translateY(6px);}to{opacity:1;transform:none;}}
.pw-eyebrow{display:inline-block;font-size:11px;font-weight:800;letter-spacing:.07em;text-transform:uppercase;color:var(--gold-600);}
.pw-h2{margin:4px 0 0;font-size:21px;font-weight:800;color:var(--ink);}
.pw-lede{margin:6px 0 0;font-size:13px;line-height:1.55;color:var(--muted);}
.pw-chip-note{display:inline-block;margin-top:12px;background:#fdf3df;color:var(--gold-600);border:1px solid #f0dcae;font-size:11.5px;font-weight:700;padding:6px 11px;border-radius:999px;}
.pw-chip-note.pw-navy{background:var(--navy-50);color:var(--navy);border-color:var(--navy-100);}
.pw-block-label{margin:16px 0 8px;font-size:12px;font-weight:800;color:var(--navy-strong);}
.pw-hint{margin-top:6px;font-size:11px;color:var(--muted);}
.pw-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:8px;}
.pw-tile{position:relative;aspect-ratio:1/1;border-radius:14px;overflow:hidden;border:1px solid var(--border);background:var(--navy-50);}
.pw-tile-img{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;}
.pw-tile-add{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;color:var(--navy);opacity:.5;}
.pw-tile-add svg{width:26px;height:26px;}
.pw-field{margin-top:14px;}
.pw-label{display:block;font-size:12.5px;font-weight:700;color:var(--navy-strong);margin-bottom:6px;}
.pw-inp{display:flex;align-items:center;gap:8px;background:var(--surface);border:1px solid var(--border);border-radius:13px;padding:0 12px;transition:border-color .15s,box-shadow .15s;}
.pw-inp:focus-within{border-color:var(--navy);box-shadow:0 0 0 3px var(--navy-50);}
.pw-inp input,.pw-inp textarea{flex:1;border:0;outline:0;background:transparent;color:var(--ink);font-size:14px;padding:11px 0;resize:none;}
.pw-inp textarea{padding:10px 0;line-height:1.5;}
.pw-inp .pw-ltr{direction:ltr;text-align:left;}
.pw-sic{display:inline-flex;color:var(--muted);flex:0 0 auto;}
.pw-sic svg{width:18px;height:18px;}
.pw-label-row{display:flex;align-items:center;gap:8px;margin-bottom:6px;flex-wrap:wrap;}
.pw-label-row .pw-label{margin:0;}
.pw-label-ic{display:inline-flex;}
.pw-label-ic svg{width:20px;height:20px;}
.pw-badge{display:inline-flex;align-items:center;gap:4px;background:var(--emerald-50);color:#0b7a52;border:1px solid var(--emerald-100);font-size:10.5px;font-weight:700;padding:3px 8px;border-radius:999px;}
.pw-badge-star{width:12px;height:12px;color:var(--gold-600);}
.pw-info{margin-inline-start:auto;width:22px;height:22px;border-radius:50%;border:1px solid var(--border);background:var(--surface);color:var(--muted);font-size:12px;font-weight:800;line-height:1;cursor:pointer;font-style:italic;}
.pw-info-open{background:var(--navy);color:#fff;border-color:var(--navy);}
.pw-help{margin-bottom:8px;background:var(--navy-50);border:1px solid var(--navy-100);color:var(--navy-strong);font-size:12px;line-height:1.55;padding:9px 11px;border-radius:11px;}
.pw-choice{display:grid;grid-template-columns:repeat(3,1fr);gap:8px;}
.pw-ci{display:flex;flex-direction:column;align-items:center;gap:6px;padding:12px 6px;border-radius:14px;border:1px solid var(--border);background:var(--surface);color:var(--muted);font-size:11.5px;font-weight:700;cursor:pointer;transition:all .15s;}
.pw-ci-ic{width:22px;height:22px;}
.pw-ci-active{border-color:var(--navy);background:var(--navy-50);color:var(--navy-strong);box-shadow:0 0 0 3px var(--navy-50);}
.pw-media-zone{margin-top:12px;display:flex;flex-direction:column;gap:10px;}
.pw-media-zone .pw-tile{aspect-ratio:16/9;}
.pw-hidden-file{display:none;}
.pw-drop{display:flex;flex-direction:column;align-items:center;gap:3px;padding:16px;border-radius:14px;border:1.5px dashed var(--navy-100);background:var(--navy-50);color:var(--navy);cursor:pointer;text-align:center;}
.pw-drop:disabled{opacity:.6;cursor:default;}
.pw-drop-ic svg{width:24px;height:24px;}
.pw-drop-t{font-size:13px;font-weight:800;color:var(--navy-strong);}
.pw-drop-s{font-size:11px;color:var(--muted);}
.pw-err{margin-top:6px;font-size:12px;color:#b3453b;font-weight:600;}
.pw-err-form{padding:0 18px;}
.pw-hero-prev{margin-top:14px;}
.pw-cover{position:relative;overflow:hidden;border-radius:18px;padding:22px 18px 20px;color:#fff;min-height:150px;box-shadow:0 12px 30px -18px rgba(16,35,58,.6);}
.pw-cover-img{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;z-index:0;}
.pw-cover>*{position:relative;z-index:1;}
.pw-cover::after{content:'';position:absolute;inset:0;z-index:0;background:linear-gradient(180deg,rgba(10,24,45,.15),rgba(10,24,45,.55));}
.pw-media-flag{position:relative;z-index:1;display:inline-block;background:rgba(255,255,255,.16);border:1px solid rgba(255,255,255,.28);font-size:10.5px;font-weight:700;padding:4px 9px;border-radius:999px;}
.pw-cover-lbl{display:block;margin-top:14px;font-size:11px;font-weight:700;letter-spacing:.06em;text-transform:uppercase;opacity:.85;}
.pw-cover-h3{margin:4px 0 0;font-size:22px;font-weight:800;}
.pw-cover-p{margin:6px 0 0;font-size:13px;line-height:1.5;opacity:.92;}
.pw-why-card{display:flex;gap:10px;margin-top:12px;}
.pw-num{flex:0 0 auto;width:28px;height:28px;border-radius:50%;background:var(--navy);color:#fff;font-size:13px;font-weight:800;display:flex;align-items:center;justify-content:center;margin-top:2px;}
.pw-why-fields{flex:1;display:flex;flex-direction:column;gap:8px;}
.pw-tin,.pw-sin{width:100%;border:1px solid var(--border);border-radius:12px;background:var(--surface);color:var(--ink);font-size:14px;padding:10px 12px;outline:0;}
.pw-tin{font-weight:700;}
.pw-sin{resize:none;line-height:1.5;}
.pw-tin:focus,.pw-sin:focus{border-color:var(--navy);box-shadow:0 0 0 3px var(--navy-50);}
.pw-win{position:relative;text-align:center;}
.pw-win-center{position:relative;z-index:2;}
.pw-success{width:64px;height:64px;margin:6px auto 0;border-radius:50%;background:var(--emerald);color:#fff;display:flex;align-items:center;justify-content:center;box-shadow:0 12px 26px -10px rgba(14,168,111,.7);}
.pw-success svg{width:32px;height:32px;}
.pw-win .pw-eyebrow{margin-top:12px;}
.pw-win-title{margin-top:4px;}
.pw-subtitle{margin:8px auto 0;max-width:320px;font-size:13px;line-height:1.55;color:var(--muted);}
.pw-confetti{position:absolute;inset:0 0 auto;height:200px;overflow:hidden;z-index:1;pointer-events:none;}
.pw-cf{position:absolute;top:-12px;width:8px;height:12px;border-radius:2px;opacity:.9;animation:pwCf 2.4s linear infinite;}
.pw-cf-0{background:var(--gold);}
.pw-cf-1{background:var(--navy);}
.pw-cf-2{background:var(--emerald);}
.pw-cf-3{background:var(--gold-300);}
@keyframes pwCf{0%{transform:translateY(0) rotate(0);opacity:.95;}100%{transform:translateY(210px) rotate(320deg);opacity:0;}}
.pw-preview{position:relative;z-index:2;margin:16px auto 0;max-width:300px;border-radius:20px;overflow:hidden;border:1px solid var(--border);background:var(--surface);box-shadow:0 18px 40px -24px rgba(16,35,58,.55);text-align:right;}
.pv-hero{padding:20px 16px 18px;color:#fff;text-align:center;}
.pv-logo{width:42px;height:42px;margin:0 auto;border-radius:50%;background:#fff;font-size:20px;font-weight:800;display:flex;align-items:center;justify-content:center;}
.pv-hero h3{margin:10px 0 0;font-size:17px;font-weight:800;}
.pv-hero p{margin:5px 0 0;font-size:11.5px;line-height:1.5;opacity:.92;}
.pv-cta{display:inline-block;margin-top:12px;font-size:11.5px;font-weight:800;padding:6px 16px;border-radius:999px;}
.pv-sec{padding:14px 16px;border-top:1px solid var(--border);}
.pv-eyebrow{font-size:9.5px;font-weight:800;letter-spacing:.07em;text-transform:uppercase;color:var(--gold-600);}
.pv-title{margin-top:3px;font-size:14px;font-weight:800;color:var(--ink);}
.pv-why{margin-top:8px;display:flex;flex-direction:column;gap:6px;}
.pv-why-c{display:flex;align-items:center;gap:7px;font-size:12px;font-weight:600;color:var(--ink);border:1px solid var(--border);border-radius:10px;padding:7px 9px;}
.pv-k{font-weight:800;}
.pv-gal{margin-top:8px;display:grid;grid-template-columns:repeat(4,1fr);gap:5px;}
.pv-g{width:100%;aspect-ratio:1/1;object-fit:cover;border-radius:8px;}
.pv-social{margin-top:8px;display:flex;gap:8px;}
.pv-si{width:34px;height:34px;border-radius:11px;overflow:hidden;display:flex;align-items:center;justify-content:center;border:1px solid var(--border);}
.pv-si svg{width:34px;height:34px;}
.pw-foot{flex:0 0 auto;display:flex;align-items:center;gap:10px;padding:12px 16px;border-top:1px solid var(--border);background:var(--surface);}
.pw-foot-back{background:transparent;border:0;color:var(--muted);font-size:13px;font-weight:700;cursor:pointer;padding:8px 4px;}
.pw-foot-back:hover{color:var(--ink);}
.pw-skip{margin-inline-start:auto;background:transparent;border:0;color:var(--muted);font-size:13px;font-weight:700;cursor:pointer;padding:10px 12px;}
.pw-skip:hover{color:var(--ink);}
.pw-next{background:var(--navy);color:#fff;border:0;font-size:14px;font-weight:800;padding:11px 26px;border-radius:13px;cursor:pointer;box-shadow:0 10px 22px -12px rgba(36,64,110,.8);}
.pw-next:hover{background:var(--navy-strong);}
.pw-publish{flex:1;background:linear-gradient(180deg,var(--gold-300),var(--gold));color:var(--navy-900);border:0;font-size:15px;font-weight:800;padding:13px;border-radius:14px;cursor:pointer;box-shadow:0 12px 26px -12px rgba(192,140,60,.8);}
.pw-publish:disabled{opacity:.6;cursor:default;}
.pw-ghost{background:transparent;border:0;color:var(--muted);font-size:13px;font-weight:700;cursor:pointer;padding:10px 12px;}
.pw-ghost:hover{color:var(--ink);}
`;

// ספרייט אייקונים אינליין (17 סמלים + גרדיאנט אינסטגרם), מרונדר פעם אחת, מוסתר.
function PwSprite() {
  return (
    <svg width={0} height={0} style={{ position: 'absolute' }} aria-hidden focusable="false">
      <defs>
        <linearGradient id="ig-grad" x1="0" y1="1" x2="1" y2="0">
          <stop offset="0" stopColor="#feda75" />
          <stop offset=".45" stopColor="#fa7e1e" />
          <stop offset=".7" stopColor="#d62976" />
          <stop offset="1" stopColor="#962fbf" />
        </linearGradient>
      </defs>
      <symbol id="i-google" viewBox="0 0 24 24">
        <path fill="#FFC107" d="M21.35 11.1H12v3.83h5.4A5.4 5.4 0 0 1 6.6 12 5.4 5.4 0 0 1 12 6.6c1.38 0 2.63.53 3.57 1.4l2.7-2.7A9 9 0 1 0 12 21a8.7 8.7 0 0 0 9-9c0-.6-.06-1.2-.16-1.9Z" />
        <path fill="#FF3D00" d="m3.15 7.35 3.15 2.31A5.4 5.4 0 0 1 12 6.6c1.38 0 2.63.53 3.57 1.4l2.7-2.7A9 9 0 0 0 3.15 7.35Z" />
        <path fill="#4CAF50" d="M12 21a9 9 0 0 0 6.07-2.35l-2.8-2.37A5.36 5.36 0 0 1 6.62 13.5l-3.13 2.41A9 9 0 0 0 12 21Z" />
        <path fill="#1976D2" d="M21.35 11.1H12v3.83h5.4a5.43 5.43 0 0 1-1.87 2.55l2.8 2.37A8.86 8.86 0 0 0 21 12c0-.6-.06-1.2-.16-1.9Z" />
      </symbol>
      <symbol id="i-instagram" viewBox="0 0 24 24">
        <rect x="2" y="2" width="20" height="20" rx="6" fill="url(#ig-grad)" />
        <circle cx="12" cy="12" r="4.4" fill="none" stroke="#fff" strokeWidth="1.8" />
        <circle cx="17.2" cy="6.8" r="1.2" fill="#fff" />
      </symbol>
      <symbol id="i-facebook" viewBox="0 0 24 24">
        <rect x="2" y="2" width="20" height="20" rx="6" fill="#1877F2" />
        <path fill="#fff" d="M13.6 21v-6.5h2.2l.4-2.6h-2.6v-1.6c0-.75.26-1.26 1.36-1.26H16.3V6.7c-.3-.04-1.06-.13-1.95-.13-1.93 0-3.25 1.18-3.25 3.34v1.86H8.8v2.6h2.3V21Z" />
      </symbol>
      <symbol id="i-tiktok" viewBox="0 0 24 24">
        <rect x="2" y="2" width="20" height="20" rx="6" fill="#111" />
        <path fill="#fff" d="M16.5 8.6a3.4 3.4 0 0 1-2.05-.9v4.9a3.9 3.9 0 1 1-3.9-3.9c.2 0 .4.02.6.05v2a1.9 1.9 0 1 0 1.3 1.8V5.5h1.9a3.4 3.4 0 0 0 2.15 2.55Z" />
      </symbol>
      <symbol id="i-whatsapp" viewBox="0 0 24 24">
        <rect x="2" y="2" width="20" height="20" rx="6" fill="#25D366" />
        <path fill="#fff" d="M12 6.4a5.6 5.6 0 0 0-4.77 8.53L6.4 17.6l2.74-.82A5.6 5.6 0 1 0 12 6.4Zm3.28 7.9c-.14.4-.82.77-1.13.8-.29.03-.65.16-2.2-.46-1.86-.75-3.03-2.66-3.12-2.78-.09-.12-.74-.99-.74-1.88s.47-1.34.63-1.52a.66.66 0 0 1 .48-.23h.35c.11 0 .27-.04.42.32.14.36.5 1.24.54 1.33.04.09.07.2.01.32-.28.57-.58.55-.42.83.6 1.03 1.2 1.39 2.11 1.84.16.08.25.07.35-.04.1-.11.4-.47.5-.63.11-.16.22-.13.37-.08.15.05 .95.45 1.11.53.16.08.27.12.31.19.04.07.04.4-.1.8Z" />
      </symbol>
      <symbol id="i-star" viewBox="0 0 24 24">
        <path fill="currentColor" d="m12 3 2.6 5.3 5.9.85-4.25 4.15 1 5.85L12 16.9l-5.25 2.75 1-5.85L3.5 9.15l5.9-.85Z" />
      </symbol>
      <symbol id="i-image" viewBox="0 0 24 24">
        <rect x="3" y="4" width="18" height="16" rx="2.5" fill="none" stroke="currentColor" strokeWidth="1.7" />
        <circle cx="8.5" cy="9.5" r="1.6" fill="currentColor" />
        <path d="M4 17l4.5-4.5 3.5 3.5 3-3L20 16.5" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
      </symbol>
      <symbol id="i-video" viewBox="0 0 24 24">
        <rect x="3" y="6" width="12" height="12" rx="2.5" fill="none" stroke="currentColor" strokeWidth="1.7" />
        <path d="M15 10l6-3v10l-6-3Z" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" />
      </symbol>
      <symbol id="i-imgvid" viewBox="0 0 24 24">
        <rect x="3" y="5" width="13" height="10" rx="2" fill="none" stroke="currentColor" strokeWidth="1.7" />
        <path d="M9 19h9a2 2 0 0 0 2-2v-6" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
        <path d="M8.5 8.5l3 1.7-3 1.7Z" fill="currentColor" />
      </symbol>
      <symbol id="i-palette" viewBox="0 0 24 24">
        <path d="M12 3a9 9 0 0 0 0 18c1 0 1.5-.8 1.5-1.5 0-.4-.2-.7-.4-1-.2-.3-.4-.6-.4-1 0-.8.7-1.5 1.5-1.5H16a5 5 0 0 0 5-5c0-4.4-4-8-9-8Z" fill="none" stroke="currentColor" strokeWidth="1.7" />
        <circle cx="7.5" cy="11" r="1.2" fill="currentColor" />
        <circle cx="10.5" cy="7.5" r="1.2" fill="currentColor" />
        <circle cx="14.5" cy="7.5" r="1.2" fill="currentColor" />
      </symbol>
      <symbol id="i-pin" viewBox="0 0 24 24">
        <path d="M12 21s6-5.3 6-10a6 6 0 1 0-12 0c0 4.7 6 10 6 10Z" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" />
        <circle cx="12" cy="11" r="2.2" fill="none" stroke="currentColor" strokeWidth="1.7" />
      </symbol>
      <symbol id="i-phone" viewBox="0 0 24 24">
        <path d="M6.5 4h3l1.3 3.2-1.9 1.4a11 11 0 0 0 4.9 4.9l1.4-1.9L18 12.5v3a1.5 1.5 0 0 1-1.6 1.5A12.5 12.5 0 0 1 5 5.6 1.5 1.5 0 0 1 6.5 4Z" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" />
      </symbol>
      <symbol id="i-upload" viewBox="0 0 24 24">
        <path d="M12 15V4m0 0L8 8m4-4 4 4" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M5 15v3a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-3" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
      </symbol>
      <symbol id="i-plus" viewBox="0 0 24 24">
        <path d="M12 5v14M5 12h14" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      </symbol>
      <symbol id="i-edit" viewBox="0 0 24 24">
        <path d="M4 20h4L18.5 9.5a2 2 0 0 0 0-2.8l-1.2-1.2a2 2 0 0 0-2.8 0L4 16v4Z" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" />
      </symbol>
      <symbol id="i-trash" viewBox="0 0 24 24">
        <path d="M5 7h14M10 7V5h4v2m-6 0v12a2 2 0 0 0 2 2h4a2 2 0 0 0 2-2V7" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
      </symbol>
      <symbol id="i-check" viewBox="0 0 24 24">
        <path d="M20 6 9 17l-5-5" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" />
      </symbol>
    </svg>
  );
}

export default function OnboardingWizard({
  businessName,
  brandColor,
  logoUrl,
  services,
  serviceExample,
  bookingUrl,
  bookingQr,
  businessType,
  businessAddress,
  slug,
  premiumInitial,
  initialPremiumPhase,
}: Props) {
  const o = t.admin.onboarding;
  const [step, setStep] = useState(0); // 0=services 1=hours 2=branding
  const [done, setDone] = useState(false);

  // ── מצב שלב הפרימיום (אופציונלי, מופעל אחרי המיתוג) ──
  // premiumPhase=null ⇐ שלב הפרימיום עדיין מחוץ לתמונה (שלושת הצעדים הרגילים).
  // בכניסה ישירה (deep-link ‎?edit=premium‎) נפתח מיד ב-'editor' דרך העוזר הטהור.
  const [premiumPhase, setPremiumPhase] = useState<PremiumPhase | null>(() =>
    resolveInitialPremiumPhase(initialPremiumPhase),
  );
  // טיוטת התוכן היא מקור האמת היחיד; נשלחת כשדה JSON יחיד בכל שמירה.
  // נזרעת מהתוכן הקיים כבר בטעינה, כך שהעורך עובד עצמאית גם בכניסה ישירה.
  const [premiumDraft, setPremiumDraft] = useState<LandingContent>(() => seedPremiumDraft(premiumInitial));
  // יעד המעבר אחרי שמירה מוצלחת, נקבע ב-onClick לפני שליחת הטופס.
  const nextTargetRef = useRef<PremiumPhase | 'done'>('gate');

  // ── אשף הפרימיום (פורט המוקאפ המאושר): 5 שלבים בתוך מסגרת טלפון, שכבת UI מעל אותו state ──
  // premiumStep: 1..5 שלבי עריכה, 6 מסך הסיום. heroBg: מקור רקע ראש-העמוד. googleHelpOpen: אקורדיון עזרה.
  const [premiumStep, setPremiumStep] = useState<PremiumWizardStep>(1);
  const [heroBg, setHeroBg] = useState<'imgvid' | 'image' | 'color'>(() => {
    if (premiumDraft.heroVideoUrl) return 'imgvid';
    if ((premiumDraft.heroImages ?? []).some(Boolean)) return 'image';
    return 'color';
  });
  const [googleHelpOpen, setGoogleHelpOpen] = useState(false);

  // מצב מקומי לצעד השירותים: אילו שירותים פעילים + טופס "הוספת שירות משלך".
  const [active, setActive] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(services.map((s) => [s.id, !s.hidden])),
  );
  const [addingService, setAddingService] = useState(false);

  // טיוטת שירות חדש + רשימת השירותים שהבעלים כבר הוסיף (אפשר להוסיף כמה).
  const [draftName, setDraftName] = useState('');
  const [draftDuration, setDraftDuration] = useState('30');
  const [draftPrice, setDraftPrice] = useState('');
  const [newServices, setNewServices] = useState<
    { name: string; durationMin: number; priceAgorot: number }[]
  >([]);

  // מצב מקומי לצעד המיתוג: צבע חי לתצוגה המקדימה + בחירת תבנית שעות.
  const [color, setColor] = useState(brandColor || '#1c1512');
  const [preset, setPreset] = useState<HoursPresetKey>('sun-thu');
  // בחירת ימים ושעות ידנית, מוצגת כשנבחר "מותאם אישית" (ראשון–חמישי פתוחים כברירת מחדל).
  const [customDays, setCustomDays] = useState(() =>
    [0, 1, 2, 3, 4, 5, 6].map((weekday) => ({
      weekday,
      open: weekday <= 4,
      start: '09:00',
      end: '17:00',
    })),
  );

  // העלאת סרטון ראש-העמוד מהמכשיר (בנוסף לקישור יוטיוב/וימאו).
  const [uploadingVideo, setUploadingVideo] = useState(false);
  const [videoUploadError, setVideoUploadError] = useState<string | null>(null);
  const heroVideoInputRef = useRef<HTMLInputElement | null>(null);

  const [servicesState, servicesFormAction, servicesPending] = useActionState(
    saveServices,
    initialSaveState,
  );
  const [hoursState, hoursFormAction, hoursPending] = useActionState(saveHours, initialSaveState);
  const [brandingState, brandingFormAction, brandingPending] = useActionState(
    saveBranding,
    initialSaveState,
  );
  const [premiumState, premiumFormAction, premiumPending] = useActionState(
    savePremiumLanding,
    initialSaveState,
  );

  useEffect(() => {
    if (servicesState.ok) setStep(1);
  }, [servicesState]);
  useEffect(() => {
    if (hoursState.ok) setStep(2);
  }, [hoursState]);
  // אחרי המיתוג: במקום סיום מיידי, מציגים את שער הפרימיום האופציונלי.
  useEffect(() => {
    if (brandingState.ok) setPremiumPhase('gate');
  }, [brandingState]);
  // אחרי שמירת פרימיום מוצלחת: מעבר ליעד שנקבע (תת-שלב הבא / סיכום / סיום).
  useEffect(() => {
    if (!premiumState.ok) return;
    const target = nextTargetRef.current;
    if (target === 'done') setDone(true);
    else setPremiumPhase(target);
  }, [premiumState]);

  const activeCount = Object.values(active).filter(Boolean).length;
  const draftPending = draftName.trim() !== '' ? 1 : 0;
  const totalSelected = activeCount + newServices.length + draftPending;

  function addDraftService() {
    const name = draftName.trim();
    if (name === '') return;
    const parsedDuration = Number.parseInt(draftDuration, 10);
    setNewServices((prev) => [
      ...prev,
      {
        name,
        durationMin: Number.isFinite(parsedDuration) && parsedDuration > 0 ? parsedDuration : 30,
        priceAgorot: shekelToAgorot(draftPrice),
      },
    ]);
    setDraftName('');
    setDraftDuration('30');
    setDraftPrice('');
  }

  function removeNewService(idx: number) {
    setNewServices((prev) => prev.filter((_, i) => i !== idx));
  }

  function updateCustomDay(
    weekday: number,
    patch: Partial<{ open: boolean; start: string; end: string }>,
  ) {
    setCustomDays((prev) => prev.map((d) => (d.weekday === weekday ? { ...d, ...patch } : d)));
  }

  const imageLabels: ImageUploadLabels = {
    choose: t.admin.settings.profile.image.choose,
    change: t.admin.settings.profile.image.change,
    remove: t.admin.settings.profile.image.remove,
    cropTitle: t.admin.settings.profile.image.cropTitle,
    zoom: t.admin.settings.profile.image.zoom,
    adjust: t.admin.settings.profile.image.adjust,
    done: t.admin.settings.profile.image.done,
    cancel: t.admin.settings.profile.image.cancel,
    dragHint: t.admin.settings.profile.image.logoDragHint,
    empty: t.admin.settings.profile.image.logoEmpty,
    tooLarge: t.admin.settings.profile.image.tooLarge,
  };

  // ── מסך סיום "אתם באוויר" (טרמינלי) ──────────────────────────────
  if (done) {
    const su = o.success;
    const whatsappText = encodeURIComponent(
      `${o.goLive.share.shareText.replace('{name}', businessName)} ${bookingUrl}`,
    );
    return (
      <section
        dir="rtl"
        className="rounded-3xl border border-emerald-200 bg-gradient-to-b from-emerald-50 to-white p-6 text-center shadow-sm sm:p-8"
      >
        <span
          aria-hidden="true"
          className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-emerald-500 text-white shadow-lg"
        >
          <svg
            viewBox="0 0 24 24"
            className="h-8 w-8"
            fill="none"
            stroke="currentColor"
            strokeWidth="3"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M4 12.5l5 5L20 6" />
          </svg>
        </span>
        <h2 className="mt-4 text-2xl font-bold text-[#1b1715]">{su.title}</h2>
        <p className="mx-auto mt-2 max-w-md text-sm text-[#6e655f]">
          {su.subtitle.replace('{name}', businessName)}
        </p>

        <div className="mt-6 rounded-2xl border border-[#e7ddcd] bg-white p-4 text-start sm:p-5">
          <BookingLinkShare url={bookingUrl} qrSvg={bookingQr} businessName={businessName} />
        </div>

        <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:justify-center">
          <a
            href={`https://wa.me/?text=${whatsappText}`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center justify-center gap-2 rounded-xl border border-emerald-300 bg-white px-5 py-3 text-sm font-semibold text-emerald-700 transition hover:bg-emerald-50"
          >
            <span aria-hidden="true">💬</span>
            {o.goLive.share.nativeShare} · WhatsApp
          </a>
          <Button href="/admin" className="justify-center">
            {su.cta}
          </Button>
        </div>
      </section>
    );
  }

  // ── שלב הפרימיום האופציונלי: מוצג אחרי המיתוג ולפני שובו של האשף הרגיל ──
  // (premiumPhase!==null בלבד; שלושת הצעדים הרגילים אינם מושפעים.)
  if (premiumPhase !== null) return renderPremium();

  /**
   * רינדור שער הפרימיום, שלושת תתי-השלבים הדילוגיים, ומסך הסיכום.
   * הפונקציה מוגדרת כ-declaration ולכן זמינה בעת הקריאה בשמירה למעלה.
   */
  function renderPremium() {
    const p = o.premium;
    const inputCls = 'w-full rounded-xl border border-[#d6c8b4] bg-white px-3 py-2.5 text-sm';
    const labelCls = 'mb-1 block text-sm font-medium text-[#4a4038]';
    const err = errorText(premiumState);

    // עדכון נקודתי של הטיוטה (מקור האמת היחיד לתוכן הפרימיום).
    const patchDraft = (patch: Partial<LandingContent>) =>
      setPremiumDraft((prev) => ({ ...prev, ...patch }));

    // העלאת קובץ וידאו מהמכשיר: אימות סוג/גודל בצד הלקוח, שליחה לנתיב המאובטח,
    // ובהצלחה שמירת כתובת ה-blob הציבורית כ-heroVideoUrl.
    const MAX_HERO_VIDEO_BYTES = 30 * 1024 * 1024;
    const handleHeroVideoFile = async (file: File | null | undefined) => {
      if (!file) return;
      setVideoUploadError(null);
      if (file.type !== 'video/mp4' && file.type !== 'video/webm') {
        setVideoUploadError(p.steps.hero.videoBadType);
        return;
      }
      if (file.size > MAX_HERO_VIDEO_BYTES) {
        setVideoUploadError(p.steps.hero.videoTooLarge);
        return;
      }
      setUploadingVideo(true);
      try {
        const fd = new FormData();
        fd.append('file', file);
        const res = await fetch('/api/upload/hero-video', { method: 'POST', body: fd });
        const data = (await res.json().catch(() => null)) as { url?: string; error?: string } | null;
        if (!res.ok || !data?.url) {
          setVideoUploadError(data?.error ?? 'אירעה תקלה בהעלאה. אפשר לנסות שוב.');
          return;
        }
        patchDraft({ heroVideoUrl: data.url });
      } catch {
        setVideoUploadError('אירעה תקלה בהעלאה. אפשר לנסות שוב.');
      } finally {
        setUploadingVideo(false);
      }
    };

    // שדה טקסט/מרובה-שורות מבוקר, ללא name (נשמר לטיוטה, לא נכנס לשליחת הטופס).
    const textField = (opts: {
      id: string;
      label: string;
      value: string;
      onChange: (v: string) => void;
      placeholder?: string;
      textarea?: boolean;
      rows?: number;
      dir?: 'rtl' | 'ltr';
      type?: string;
    }) => (
      <div>
        <label htmlFor={opts.id} className={labelCls}>
          {opts.label}
        </label>
        {opts.textarea ? (
          <textarea
            id={opts.id}
            value={opts.value}
            rows={opts.rows ?? 3}
            onChange={(e) => opts.onChange(e.target.value)}
            placeholder={opts.placeholder}
            dir={opts.dir}
            className={inputCls}
          />
        ) : (
          <input
            id={opts.id}
            type={opts.type ?? 'text'}
            value={opts.value}
            onChange={(e) => opts.onChange(e.target.value)}
            placeholder={opts.placeholder}
            dir={opts.dir}
            className={inputCls}
          />
        )}
      </div>
    );

    // עדכון קישור רשת חברתית בטיוטה. מוגדר כאן כדי להיות זמין גם בשער וגם בתת-שלב המיקום.
    const setSocial = (key: keyof LandingSocialLinks, v: string) =>
      setPremiumDraft((prev) => ({
        ...prev,
        socialLinks: { ...(prev.socialLinks ?? {}), [key]: v },
      }));

    // ── שער הבחירה: שאלה מפורשת עם המשך/דילוג ──
    if (premiumPhase === 'gate') {
      const g = p.gate;
      return (
        <div dir="rtl">
          <section className="rounded-3xl border border-emerald-200 bg-gradient-to-b from-emerald-50 to-white p-6 text-center shadow-sm sm:p-8">
            <span
              aria-hidden="true"
              className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-emerald-500 text-3xl shadow-lg"
            >
              ✨
            </span>
            <p className="mt-4 text-sm font-medium text-emerald-600">{g.eyebrow}</p>
            <h2 className="mt-1 text-2xl font-bold text-[#1b1715]">{g.title}</h2>
            <p className="mx-auto mt-2 max-w-md text-sm text-[#6e655f]">{g.subtitle}</p>
            {/* רשתות חברתיות (אופציונלי): קישורים אלה מדליקים את כפתורי הרשתות ומחזקים את העמוד. */}
            <div className="mx-auto mt-6 max-w-md rounded-2xl border border-[#e7ddcd] bg-[#f7f2ea] p-4 text-right sm:p-5">
              <p className="text-sm font-semibold text-[#4a4038]">{g.social.title}</p>
              <p className="mt-1 text-xs text-[#6e655f]">{g.social.lead}</p>
              <div className="mt-3 space-y-3">
                <div>
                  <label htmlFor="gate-social-ig" className={labelCls}>{g.social.instagramLabel}</label>
                  <input
                    id="gate-social-ig"
                    type="text"
                    dir="ltr"
                    value={premiumDraft.socialLinks?.instagram ?? ''}
                    onChange={(e) => setSocial('instagram', e.target.value)}
                    placeholder={g.social.instagramPlaceholder}
                    className={inputCls}
                  />
                  <p className="mt-1 text-xs text-[#b3a690]">{g.social.instagramHint}</p>
                </div>
                <div>
                  <label htmlFor="gate-social-tt" className={labelCls}>{g.social.tiktokLabel}</label>
                  <input
                    id="gate-social-tt"
                    type="text"
                    dir="ltr"
                    value={premiumDraft.socialLinks?.tiktok ?? ''}
                    onChange={(e) => setSocial('tiktok', e.target.value)}
                    placeholder={g.social.tiktokPlaceholder}
                    className={inputCls}
                  />
                  <p className="mt-1 text-xs text-[#b3a690]">{g.social.tiktokHint}</p>
                </div>
                <div>
                  <label htmlFor="gate-social-fb" className={labelCls}>{g.social.facebookLabel}</label>
                  <input
                    id="gate-social-fb"
                    type="text"
                    dir="ltr"
                    value={premiumDraft.socialLinks?.facebook ?? ''}
                    onChange={(e) => setSocial('facebook', e.target.value)}
                    placeholder={g.social.facebookPlaceholder}
                    className={inputCls}
                  />
                  <p className="mt-1 text-xs text-[#b3a690]">{g.social.facebookHint}</p>
                </div>
              </div>
            </div>
            <div className="mt-6 flex flex-col items-center gap-3">
              {/* המשך: שומר טיוטה ריקה ומעביר לתת-השלב הראשון */}
              <form action={premiumFormAction} className="w-full sm:w-auto">
                <input type="hidden" name="premiumDraft" value={JSON.stringify(premiumDraft)} />
                <button
                  type="submit"
                  disabled={premiumPending}
                  onClick={() => {
                    nextTargetRef.current = 'editor';
                  }}
                  className="w-full rounded-xl bg-[#1b1715] px-6 py-2.5 font-semibold text-white transition hover:bg-[#2a2320] disabled:opacity-60 sm:w-auto"
                >
                  {premiumPending ? p.nav.saving : g.build}
                </button>
              </form>
              {/* דילוג: סיום מיידי אל מסך שיתוף קישור ההזמנות */}
              <button
                type="button"
                onClick={() => setDone(true)}
                className="text-sm font-medium text-[#8f8478] transition hover:text-[#4a4038]"
              >
                {g.skip}
              </button>
            </div>
            {err && <p className="mt-3 text-sm text-rose-600">{err}</p>}
          </section>
        </div>
      );
    }

    // ── מסך הסיכום: תצוגה מקדימה + סיום ──
    if (premiumPhase === 'summary') {
      const s = p.summary;
      return (
        <div dir="rtl">
          <section className="rounded-3xl border border-emerald-200 bg-gradient-to-b from-emerald-50 to-white p-6 text-center shadow-sm sm:p-8">
            <span
              aria-hidden="true"
              className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-emerald-500 text-3xl shadow-lg"
            >
              ✨
            </span>
            <p className="mt-4 text-sm font-medium text-emerald-600">{s.eyebrow}</p>
            <h2 className="mt-1 text-2xl font-bold text-[#1b1715]">{s.title}</h2>
            <p className="mx-auto mt-2 max-w-md text-sm text-[#6e655f]">
              {s.subtitle.replace('{name}', businessName)}
            </p>
            <div className="mt-6 flex flex-col items-center gap-3">
              <a
                href={`/b/${slug}`}
                target="_blank"
                rel="noopener noreferrer"
                className="w-full rounded-xl border border-[#d6c8b4] px-6 py-2.5 text-center font-semibold text-[#4a4038] transition hover:bg-[#f7f2ea] sm:w-auto"
              >
                {s.previewCta}
              </a>
              <form action={premiumFormAction} className="w-full sm:w-auto">
                <input type="hidden" name="premiumDraft" value={JSON.stringify(premiumDraft)} />
                <button
                  type="submit"
                  disabled={premiumPending}
                  onClick={() => {
                    nextTargetRef.current = 'done';
                  }}
                  className="w-full rounded-xl bg-[#1b1715] px-6 py-2.5 font-semibold text-white transition hover:bg-[#2a2320] disabled:opacity-60 sm:w-auto"
                >
                  {premiumPending ? p.nav.saving : s.finishCta}
                </button>
              </form>
            </div>
            <p className="mt-4 text-xs text-[#b3a690]">{s.editHint}</p>
            {err && <p className="mt-3 text-sm text-rose-600">{err}</p>}
          </section>
        </div>
      );
    }

    // ── עורך העמוד המלא (WYSIWYG): מרנדר את טיוטת הפרימיום כפי שתופיע בעמוד הציבורי,
    // וכל משבצת טקסט ניתנת לעריכה במקום. משבצות התמונה והווידאו לקריאה בלבד בשלב זה.
    if (premiumPhase !== 'editor') return null;
    const ed = p.editor;

    // ── אוספים נגזרים לרינדור ──
    const heroImages = premiumDraft.heroImages ?? [];
    const hotDeals: LandingHotDeals = premiumDraft.hotDeals ?? { images: [] };
    const hotDealsImages = hotDeals.images ?? [];
    const galleryImages = premiumDraft.galleryImageUrls ?? [];
    const launchOffer: LandingLaunchOffer | undefined = premiumDraft.launchOffer;
    const social: LandingSocialLinks = premiumDraft.socialLinks ?? {};
    const instagramPosts = premiumDraft.instagramPostUrls ?? [];
    const socialVideos = premiumDraft.socialVideoUrls ?? [];
    const sections = premiumDraft.sections ?? buildDefaultSectionToggles(businessType);
    const def = landingDefaults(businessType);
    const benefits = premiumDraft.benefits?.length ? premiumDraft.benefits : def.benefits;

    // פלטת צבעים לתצוגה נאמנה לעמוד החי, עם נפילה עדינה לברירת מחדל.
    const th = premiumDraft.theme;
    const c = {
      brand: th?.brand ?? '#7c5cff',
      brandDark: th?.brandDark ?? '#2a2350',
      gold: th?.gold ?? '#d9b45b',
      goldText: th?.goldText ?? '#5a4a1e',
      cream: th?.cream ?? '#faf6ef',
      ink: th?.ink ?? '#1b1715',
      accent: th?.accent ?? '#e7d9c2',
    };

    // מגבלות אורך, משקפות את LIMITS ב-publicPageStyle לאכיפת קיטום עדין בזמן העריכה.
    const LIM = {
      heroEyebrow: 60,
      heroHeadline: 140,
      heroSubtext: 400,
      about: 900,
      announcement: 200,
      ctaLabel: 40,
      hotDealsEyebrow: 60,
      hotDealsTitle: 140,
      hotDealsText: 220,
      hotDealsCta: 40,
      benefitTitle: 60,
      benefitText: 220,
    };

    // ── עוזרי עריכה, עדכונים פונקציונליים בטוחים ──
    const patchHotDeals = (patch: Partial<LandingHotDeals>) =>
      setPremiumDraft((prev) => {
        const cur = prev.hotDeals ?? { images: [] };
        return { ...prev, hotDeals: { ...cur, ...patch } };
      });
    const patchLaunchOffer = (patch: Partial<LandingLaunchOffer>) =>
      setPremiumDraft((prev) => {
        const cur = prev.launchOffer ?? { text: '', endsAt: '' };
        return { ...prev, launchOffer: { ...cur, ...patch } };
      });
    const setSection = (key: LandingSectionKey, on: boolean) =>
      setPremiumDraft((prev) => ({
        ...prev,
        sections: { ...(prev.sections ?? buildDefaultSectionToggles(businessType)), [key]: on },
      }));
    const setInstaPost = (i: number, url: string) =>
      setPremiumDraft((prev) => {
        const next = [...(prev.instagramPostUrls ?? [])];
        while (next.length <= i) next.push('');
        next[i] = url;
        return { ...prev, instagramPostUrls: next };
      });
    const addInstaPost = () =>
      setPremiumDraft((prev) => {
        const cur = prev.instagramPostUrls ?? [];
        if (cur.length >= 6) return prev;
        return { ...prev, instagramPostUrls: [...cur, ''] };
      });
    const setSocialVideo = (i: number, url: string) =>
      setPremiumDraft((prev) => {
        const next = [...(prev.socialVideoUrls ?? [])];
        while (next.length <= i) next.push('');
        next[i] = url;
        return { ...prev, socialVideoUrls: next };
      });
    const addSocialVideo = () =>
      setPremiumDraft((prev) => {
        const cur = prev.socialVideoUrls ?? [];
        if (cur.length >= 6) return prev;
        return { ...prev, socialVideoUrls: [...cur, ''] };
      });
    // יתרונות, עד שלושה, מתממשים מברירת המחדל בעריכה ראשונה.
    const setBenefit = (i: number, patch: Partial<LandingBenefit>) =>
      setPremiumDraft((prev) => {
        const base = prev.benefits?.length ? prev.benefits : def.benefits;
        const next = base.slice(0, MAX_BENEFITS).map((b, idx) => (idx === i ? { ...b, ...patch } : b));
        return { ...prev, benefits: next };
      });
    // מגדירי מדיה: כותבים כתובת שהוחזרה מההעלאה לשדה הנכון, עם שמירה על התקרות.
    const setHeroImage = (i: number, url: string) =>
      setPremiumDraft((prev) => {
        const next = [...(prev.heroImages ?? [])];
        while (next.length <= i) next.push('');
        next[i] = url;
        return { ...prev, heroImages: next.slice(0, MAX_HERO_IMAGES) };
      });
    const setGalleryImage = (i: number, url: string) =>
      setPremiumDraft((prev) => {
        const next = [...(prev.galleryImageUrls ?? [])];
        while (next.length <= i) next.push('');
        next[i] = url;
        return { ...prev, galleryImageUrls: next.slice(0, MAX_GALLERY_IMAGES) };
      });
    const setHotDealImage = (i: number, url: string) =>
      setPremiumDraft((prev) => {
        const cur: LandingHotDeals = prev.hotDeals ?? { images: [] };
        const next = [...(cur.images ?? [])];
        while (next.length <= i) next.push('');
        next[i] = url;
        return { ...prev, hotDeals: { ...cur, images: next.slice(0, MAX_HOT_DEALS_IMAGES) } };
      });
    // תוויות אחידות לכל משבצות התמונה בעורך.
    const mediaImageLabels = {
      upload: ed.uploadLabel,
      replace: ed.replaceLabel,
      uploading: ed.uploading,
      error: ed.uploadError,
    };
    const IMAGE_ACCEPT = 'image/jpeg,image/png,image/webp';

    const wz = ed.wizard;

    // ── ניווט האשף (פורט המוקאפ): המשך/דלג/חזרה + קפיצה לשלב מהפיפ/מסך הסיום ──
    const wizNext = () => setPremiumStep((s) => nextPremiumStep(s));
    const wizSkip = () => setPremiumStep((s) => nextPremiumStep(s));
    const wizBack = () => {
      if (premiumStep === 1) {
        setPremiumPhase('gate');
        return;
      }
      setPremiumStep((s) => prevPremiumStep(s));
    };
    const goStepName = (name: PremiumWizardStepName) => setPremiumStep(premiumStepIndex(name));

    const isWin = isPremiumWinStep(premiumStep);
    const counterText = isWin
      ? wz.allDone
      : wz.stepCounter.replace('{current}', String(premiumStep)).replace('{total}', String(PREMIUM_WIZARD_TOTAL));
    const kickerText = isWin ? wz.winKicker : wz.kicker;
    const initial = (businessName || '●').trim().charAt(0) || '●';

    // שדה טופס בסגנון האשף (label + מסגרת קלט + אייקון/רמז אופציונליים).
    const pwField = (opts: {
      label: string;
      value: string;
      onChange?: (v: string) => void;
      placeholder?: string;
      textarea?: boolean;
      rows?: number;
      dir?: 'rtl' | 'ltr';
      icon?: string;
      ltr?: boolean;
      readOnly?: boolean;
      hint?: string;
    }) => (
      <div className="pw-field">
        <label className="pw-label">{opts.label}</label>
        <div className="pw-inp">
          {opts.icon ? (
            <span className="pw-sic" aria-hidden>
              <svg>
                <use href={`#${opts.icon}`} />
              </svg>
            </span>
          ) : null}
          {opts.textarea ? (
            <textarea
              rows={opts.rows ?? 2}
              value={opts.value}
              placeholder={opts.placeholder}
              dir={opts.dir}
              readOnly={opts.readOnly}
              onChange={(e) => opts.onChange?.(e.target.value)}
            />
          ) : (
            <input
              className={opts.ltr ? 'pw-ltr' : undefined}
              value={opts.value}
              placeholder={opts.placeholder}
              dir={opts.dir}
              readOnly={opts.readOnly}
              onChange={(e) => opts.onChange?.(e.target.value)}
            />
          )}
        </div>
        {opts.hint ? <div className="pw-hint">{opts.hint}</div> : null}
      </div>
    );

    // משבצת מדיה בסגנון האשף (מסגרת אחידה + כפתור העלאה צף מ-MediaSlot).
    const mediaTile = (url: string | undefined, onUploaded: (u: string) => void, key: number) => (
      <MediaSlot
        key={key}
        url={url}
        accept={IMAGE_ACCEPT}
        labels={mediaImageLabels}
        onUploaded={onUploaded}
        frameClassName="pw-tile"
      >
        {url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={url} alt="" className="pw-tile-img" />
        ) : (
          <span className="pw-tile-add" aria-hidden>
            <svg>
              <use href="#i-plus" />
            </svg>
          </span>
        )}
      </MediaSlot>
    );

    const galleryCount = Math.min((galleryImages.filter(Boolean).length || 0) + 1, MAX_GALLERY_IMAGES);
    const hotDealsCount = Math.min((hotDealsImages.filter(Boolean).length || 0) + 1, MAX_HOT_DEALS_IMAGES);

    return (
      <div dir="rtl" className="pw-root">
        <style>{PW_CSS}</style>
        <PwSprite />

        <div className="pw-phone-wrap">
          <form action={premiumFormAction} className="pw-phone">
            {/* ── appbar ── */}
            <div className="pw-appbar">
              <button type="button" className="pw-back" onClick={() => setPremiumPhase('gate')}>
                {'\u2039 '}
                {wz.appbarBack}
              </button>
              <span className="pw-brandchip">
                <span className="pw-dot" aria-hidden />
                {businessName}
              </span>
            </div>

            {/* ── כותרת האשף: kicker + מונה + פיפים ── */}
            <div className="pw-wiz-head">
              <div className="pw-row1">
                <span className="pw-kicker">{kickerText}</span>
                <span className="pw-counter">{counterText}</span>
              </div>
              <div className="pw-pips" role="tablist" aria-label={wz.kicker}>
                {Array.from({ length: PREMIUM_WIZARD_TOTAL }).map((_, idx) => {
                  const n = (idx + 1) as PremiumWizardStep;
                  const status = premiumPipStatus(n, premiumStep);
                  return (
                    <button
                      key={n}
                      type="button"
                      className={`pw-pip pw-pip-${status}`}
                      aria-current={status === 'cur' ? 'step' : undefined}
                      onClick={() => setPremiumStep(n)}
                    />
                  );
                })}
              </div>
            </div>

            {/* ── גוף האשף: השלב הפעיל בלבד ── */}
            <div className="pw-body">
              {/* שלב 1 · גלריית עבודות */}
              {premiumStep === 1 && (
                <section className="pw-step">
                  <span className="pw-eyebrow">{wz.gallery.eyebrow}</span>
                  <h2 className="pw-h2">{wz.gallery.title}</h2>
                  <p className="pw-lede">{wz.gallery.lede}</p>
                  <span className="pw-chip-note">{wz.gallery.chipNote}</span>
                  <div className="pw-block-label">{wz.gallery.blockLabel}</div>
                  <div className="pw-grid">
                    {Array.from({ length: galleryCount }).map((_, i) =>
                      mediaTile(galleryImages[i], (url) => setGalleryImage(i, url), i),
                    )}
                  </div>
                  <p className="pw-hint">{ed.imageLimits}</p>
                </section>
              )}

              {/* שלב 2 · רשתות חברתיות */}
              {premiumStep === 2 && (
                <section className="pw-step">
                  <span className="pw-eyebrow">{wz.social.eyebrow}</span>
                  <h2 className="pw-h2">{wz.social.title}</h2>
                  <p className="pw-lede">{wz.social.lede}</p>
                  <span className="pw-chip-note pw-navy">{wz.social.chipNote}</span>

                  {/* גוגל · עם תג ביקורות ואקורדיון עזרה */}
                  <div className="pw-field">
                    <div className="pw-label-row">
                      <span className="pw-label-ic" aria-hidden>
                        <svg viewBox="0 0 24 24">
                          <use href="#i-google" />
                        </svg>
                      </span>
                      <label className="pw-label">{wz.social.googleLabel}</label>
                      <span className="pw-badge">
                        <svg className="pw-badge-star" aria-hidden>
                          <use href="#i-star" />
                        </svg>
                        {wz.social.googleBadge}
                      </span>
                      <button
                        type="button"
                        className={`pw-info${googleHelpOpen ? ' pw-info-open' : ''}`}
                        aria-expanded={googleHelpOpen}
                        aria-label={wz.social.helpToggle}
                        onClick={() => setGoogleHelpOpen((v) => !v)}
                      >
                        i
                      </button>
                    </div>
                    {googleHelpOpen ? <div className="pw-help">{wz.social.googleHelp}</div> : null}
                    <div className="pw-inp">
                      <input
                        className="pw-ltr"
                        dir="ltr"
                        value={premiumDraft.googleReviewsUrl ?? ''}
                        placeholder={wz.social.googlePlaceholder}
                        onChange={(e) => patchDraft({ googleReviewsUrl: e.target.value })}
                      />
                    </div>
                    <div className="pw-hint">{wz.social.googleHint}</div>
                  </div>

                  {pwField({
                    label: wz.social.instagramLabel,
                    value: social.instagram ?? '',
                    onChange: (v) => setSocial('instagram', v),
                    placeholder: wz.social.instagramPlaceholder,
                    icon: 'i-instagram',
                    ltr: true,
                    dir: 'ltr',
                  })}
                  {pwField({
                    label: wz.social.facebookLabel,
                    value: social.facebook ?? '',
                    onChange: (v) => setSocial('facebook', v),
                    placeholder: wz.social.facebookPlaceholder,
                    icon: 'i-facebook',
                    ltr: true,
                    dir: 'ltr',
                  })}
                  {pwField({
                    label: wz.social.tiktokLabel,
                    value: social.tiktok ?? '',
                    onChange: (v) => setSocial('tiktok', v),
                    placeholder: wz.social.tiktokPlaceholder,
                    icon: 'i-tiktok',
                    ltr: true,
                    dir: 'ltr',
                  })}
                  {pwField({
                    label: wz.social.whatsappLabel,
                    value: social.whatsapp ?? '',
                    onChange: (v) => setSocial('whatsapp', v),
                    placeholder: wz.social.whatsappPlaceholder,
                    icon: 'i-whatsapp',
                    ltr: true,
                    dir: 'ltr',
                    hint: wz.social.whatsappHint,
                  })}
                </section>
              )}

              {/* שלב 3 · מבצעים חמים */}
              {premiumStep === 3 && (
                <section className="pw-step">
                  <span className="pw-eyebrow">{wz.deals.eyebrow}</span>
                  <h2 className="pw-h2">{wz.deals.title}</h2>
                  <p className="pw-lede">{wz.deals.lede}</p>
                  <div className="pw-block-label">{wz.deals.blockLabel}</div>
                  <div className="pw-grid">
                    {Array.from({ length: hotDealsCount }).map((_, i) =>
                      mediaTile(hotDealsImages[i], (url) => setHotDealImage(i, url), i),
                    )}
                  </div>
                  {pwField({
                    label: wz.deals.titleLabel,
                    value: hotDeals.title ?? '',
                    onChange: (v) => patchHotDeals({ title: v }),
                    placeholder: wz.deals.titlePlaceholder,
                  })}
                  {pwField({
                    label: wz.deals.textLabel,
                    value: hotDeals.text ?? '',
                    onChange: (v) => patchHotDeals({ text: v }),
                    placeholder: wz.deals.textPlaceholder,
                    textarea: true,
                    rows: 2,
                  })}
                  <span className="pw-chip-note">{wz.deals.chipNote}</span>
                </section>
              )}

              {/* שלב 4 · ראש העמוד + פרטי קשר */}
              {premiumStep === 4 && (
                <section className="pw-step">
                  <span className="pw-eyebrow">{wz.about.eyebrow}</span>
                  <h2 className="pw-h2">{wz.about.title}</h2>
                  <p className="pw-lede">{wz.about.lede}</p>

                  <div className="pw-block-label">{wz.about.bgLabel}</div>
                  <div className="pw-choice">
                    {[
                      { key: 'imgvid' as const, label: wz.about.bgImgvid, icon: 'i-imgvid' },
                      { key: 'image' as const, label: wz.about.bgImage, icon: 'i-image' },
                      { key: 'color' as const, label: wz.about.bgColor, icon: 'i-palette' },
                    ].map((ch) => (
                      <button
                        key={ch.key}
                        type="button"
                        className={`pw-ci${heroBg === ch.key ? ' pw-ci-active' : ''}`}
                        onClick={() => setHeroBg(ch.key)}
                      >
                        <svg className="pw-ci-ic" aria-hidden>
                          <use href={`#${ch.icon}`} />
                        </svg>
                        <span>{ch.label}</span>
                      </button>
                    ))}
                  </div>

                  {heroBg !== 'color' ? (
                    <div className="pw-media-zone">
                      {mediaTile(heroImages[0], (url) => setHeroImage(0, url), 0)}
                      {heroBg === 'imgvid' ? (
                        <div className="pw-vid">
                          <input
                            ref={heroVideoInputRef}
                            type="file"
                            accept="video/mp4,video/webm"
                            className="pw-hidden-file"
                            onChange={(e) => {
                              const f = e.target.files?.[0];
                              e.target.value = '';
                              void handleHeroVideoFile(f);
                            }}
                          />
                          <button
                            type="button"
                            className="pw-drop"
                            onClick={() => heroVideoInputRef.current?.click()}
                            disabled={uploadingVideo}
                          >
                            <span className="pw-drop-ic" aria-hidden>
                              <svg>
                                <use href="#i-video" />
                              </svg>
                            </span>
                            <span className="pw-drop-t">
                              {uploadingVideo ? p.steps.hero.uploadingVideo : wz.about.dropVideoTitle}
                            </span>
                            <span className="pw-drop-s">{wz.about.dropVideoSub}</span>
                          </button>
                          {videoUploadError ? <div className="pw-err">{videoUploadError}</div> : null}
                          {premiumDraft.heroVideoUrl ? (
                            <div className="pw-hint pw-ltr" dir="ltr">
                              {premiumDraft.heroVideoUrl}
                            </div>
                          ) : null}
                        </div>
                      ) : null}
                    </div>
                  ) : null}

                  {/* תצוגה מקדימה חיה של כרטיס העסק */}
                  <div className="pw-hero-prev">
                    <div
                      className="pw-cover"
                      style={{
                        background: heroImages[0]
                          ? undefined
                          : `linear-gradient(150deg, ${c.brandDark}, ${c.brand})`,
                      }}
                    >
                      {heroImages[0] ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={heroImages[0]} alt="" className="pw-cover-img" />
                      ) : null}
                      <span className="pw-media-flag">
                        {heroBg === 'color'
                          ? wz.about.flagColor
                          : heroBg === 'image'
                            ? wz.about.flagImage
                            : wz.about.flagImgvid}
                      </span>
                      <span className="pw-cover-lbl">{wz.about.coverLabel}</span>
                      <h3 className="pw-cover-h3">
                        {premiumDraft.heroHeadline?.trim() ? premiumDraft.heroHeadline : businessName}
                      </h3>
                      <p className="pw-cover-p">
                        {premiumDraft.heroSubtext?.trim() ? premiumDraft.heroSubtext : def.heroSubtext}
                      </p>
                    </div>
                  </div>
                  <span className="pw-chip-note pw-navy">{wz.about.mediaHint}</span>

                  {pwField({
                    label: wz.about.headlineLabel,
                    value: premiumDraft.heroHeadline ?? '',
                    onChange: (v) => patchDraft({ heroHeadline: v }),
                    placeholder: def.heroHeadline,
                  })}
                  {pwField({
                    label: wz.about.subtitleLabel,
                    value: premiumDraft.heroSubtext ?? '',
                    onChange: (v) => patchDraft({ heroSubtext: v }),
                    placeholder: def.heroSubtext,
                  })}

                  <div className="pw-block-label">{wz.about.contactLabel}</div>
                  {businessAddress?.trim()
                    ? pwField({
                        label: wz.about.addressLabel,
                        value: businessAddress,
                        readOnly: true,
                        icon: 'i-pin',
                        hint: wz.about.addressHint,
                      })
                    : pwField({
                        label: wz.about.addressLabel,
                        value: '',
                        readOnly: true,
                        icon: 'i-pin',
                        placeholder: wz.about.addressEmpty,
                      })}
                  {pwField({
                    label: wz.about.phoneLabel,
                    value: social.whatsapp ?? '',
                    onChange: (v) => setSocial('whatsapp', v),
                    placeholder: wz.about.phonePlaceholder,
                    icon: 'i-phone',
                    ltr: true,
                    dir: 'ltr',
                  })}
                </section>
              )}

              {/* שלב 5 · למה לבחור בנו */}
              {premiumStep === 5 && (
                <section className="pw-step">
                  <span className="pw-eyebrow">{wz.why.eyebrow}</span>
                  <h2 className="pw-h2">{wz.why.title}</h2>
                  <p className="pw-lede">{wz.why.lede}</p>
                  {Array.from({ length: MAX_BENEFITS }).map((_, i) => {
                    const b = benefits[i] ?? { title: '', text: '' };
                    return (
                      <div className="pw-why-card" key={i}>
                        <div className="pw-num">{i + 1}</div>
                        <div className="pw-why-fields">
                          <input
                            className="pw-tin"
                            value={b.title ?? ''}
                            placeholder={ed.benefitTitlePlaceholder}
                            onChange={(e) => setBenefit(i, { title: e.target.value })}
                          />
                          <textarea
                            className="pw-sin"
                            rows={2}
                            value={b.text ?? ''}
                            placeholder={ed.benefitTextPlaceholder}
                            onChange={(e) => setBenefit(i, { text: e.target.value })}
                          />
                        </div>
                      </div>
                    );
                  })}
                  <span className="pw-chip-note">{wz.why.chipNote}</span>
                </section>
              )}

              {/* מסך סיום · העמוד מוכן */}
              {isWin && (
                <section className="pw-step pw-win">
                  <div className="pw-confetti" aria-hidden>
                    {Array.from({ length: 14 }).map((_, i) => (
                      <span key={i} className={`pw-cf pw-cf-${i % 4}`} style={{ left: `${(i * 7 + 4) % 96}%`, animationDelay: `${(i % 7) * 0.18}s` }} />
                    ))}
                  </div>
                  <div className="pw-win-center">
                    <div className="pw-success" aria-hidden>
                      <svg viewBox="0 0 24 24" fill="none">
                        <path d="M20 6 9 17l-5-5" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    </div>
                    <div className="pw-eyebrow">{wz.win.eyebrow}</div>
                    <h2 className="pw-h2 pw-win-title">{wz.win.title}</h2>
                    <p className="pw-subtitle">{wz.win.subtitle.replace('{name}', businessName)}</p>
                  </div>

                  <div className="pw-preview">
                    <div className="pv">
                      {/* הירו */}
                      <div
                        className="pv-hero"
                        style={{ background: `linear-gradient(150deg, ${c.brandDark}, ${c.brand})` }}
                      >
                        <div className="pv-logo" style={{ color: c.brandDark }}>
                          {initial}
                        </div>
                        <h3>{premiumDraft.heroHeadline?.trim() ? premiumDraft.heroHeadline : businessName}</h3>
                        <p>{premiumDraft.heroSubtext?.trim() ? premiumDraft.heroSubtext : def.heroSubtext}</p>
                        <span className="pv-cta" style={{ background: c.gold, color: c.ink }}>
                          {wz.win.pvCta}
                        </span>
                      </div>

                      {/* למה לבחור בנו */}
                      <div className="pv-sec">
                        <div className="pv-eyebrow">{wz.win.pvWhyEyebrow}</div>
                        <div className="pv-title">{wz.why.title}</div>
                        <div className="pv-why">
                          {benefits.slice(0, MAX_BENEFITS).map((b, i) => (
                            <div className="pv-why-c" key={i} style={{ borderColor: c.accent }}>
                              <span className="pv-k" style={{ color: c.brand }}>
                                ✓
                              </span>
                              <b>{b.title}</b>
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* גלריה */}
                      {galleryImages.filter(Boolean).length > 0 ? (
                        <div className="pv-sec">
                          <div className="pv-eyebrow">{wz.win.pvGalleryEyebrow}</div>
                          <div className="pv-title">{wz.win.pvGalleryTitle}</div>
                          <div className="pv-gal">
                            {galleryImages.filter(Boolean).slice(0, 4).map((u, i) => (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img key={i} src={u} alt="" className="pv-g" />
                            ))}
                          </div>
                        </div>
                      ) : null}

                      {/* רשתות */}
                      <div className="pv-sec">
                        <div className="pv-eyebrow">{wz.win.pvSocialEyebrow}</div>
                        <div className="pv-social">
                          {social.whatsapp ? (
                            <span className="pv-si">
                              <svg>
                                <use href="#i-whatsapp" />
                              </svg>
                            </span>
                          ) : null}
                          {social.instagram ? (
                            <span className="pv-si">
                              <svg>
                                <use href="#i-instagram" />
                              </svg>
                            </span>
                          ) : null}
                          {social.facebook ? (
                            <span className="pv-si">
                              <svg>
                                <use href="#i-facebook" />
                              </svg>
                            </span>
                          ) : null}
                          {social.tiktok ? (
                            <span className="pv-si">
                              <svg>
                                <use href="#i-tiktok" />
                              </svg>
                            </span>
                          ) : null}
                        </div>
                      </div>
                    </div>
                  </div>
                </section>
              )}
            </div>

            {/* שדה JSON יחיד שנושא את כל הטיוטה לפעולת השרת */}
            <input type="hidden" name="premiumDraft" value={JSON.stringify(premiumDraft)} />
            {err && <p className="pw-err pw-err-form">{err}</p>}

            {/* ── תחתית · ניווט ── */}
            <div className="pw-foot">
              {isWin ? (
                <>
                  <button
                    type="submit"
                    className="pw-publish"
                    onClick={() => {
                      nextTargetRef.current = 'summary';
                    }}
                    disabled={premiumPending}
                  >
                    {premiumPending ? p.nav.saving : wz.win.publish}
                  </button>
                  <button
                    type="button"
                    className="pw-ghost"
                    onClick={() => setPremiumStep(PREMIUM_WIZARD_TOTAL as PremiumWizardStep)}
                    disabled={premiumPending}
                  >
                    {'\u2039 '}
                    {wz.win.backToEdit}
                  </button>
                </>
              ) : (
                <>
                  <button type="button" className="pw-foot-back" onClick={wizBack}>
                    {'\u2039 '}
                    {wz.back}
                  </button>
                  <button type="button" className="pw-skip" onClick={wizSkip}>
                    {wz.skip}
                  </button>
                  <button type="button" className="pw-next" onClick={wizNext}>
                    {wz.next}
                  </button>
                </>
              )}
            </div>
          </form>
        </div>
      </div>
    );
  }

  const stepKeys = ['services', 'hours', 'branding'] as const;
  const stepKey = stepKeys[step];
  const progress = o.progress.replace('{current}', String(step + 1)).replace('{total}', '4');

  function backButton() {
    if (step === 0) return null;
    return (
      <button
        type="button"
        onClick={() => setStep((n) => Math.max(0, n - 1))}
        className="rounded-xl border border-[#d6c8b4] px-5 py-2.5 font-semibold text-[#4a4038] transition hover:bg-[#f7f2ea]"
      >
        {o.back}
      </button>
    );
  }

  return (
    <div dir="rtl">
      <div className="mb-5">
        <p className="text-sm font-medium text-emerald-600">{o[stepKey].eyebrow}</p>
        <h2 className="mt-1 text-xl font-bold text-[#1b1715]">{o[stepKey].title}</h2>
        <p className="mt-1 text-sm text-[#8f8478]">{o[stepKey].subtitle}</p>
        <p className="mt-2 text-xs font-medium text-[#b3a690]">{progress}</p>
      </div>

      <div className="rounded-3xl border border-[#e7ddcd] bg-white p-5 shadow-sm sm:p-6">
        {/* ── צעד שירותים ─────────────────────────────── */}
        {step === 0 ? (
          <form action={servicesFormAction} className="space-y-4">
            <ul className="space-y-2.5">
              {services.map((s) => {
                const on = active[s.id] ?? false;
                const priceLabel =
                  s.priceAgorot > 0
                    ? `₪${(s.priceAgorot / 100).toLocaleString('he-IL')}`
                    : o.services.free;
                return (
                  <li key={s.id}>
                    <label
                      className={
                        'flex cursor-pointer items-center justify-between gap-3 rounded-2xl border p-3.5 transition-colors ' +
                        (on
                          ? 'border-emerald-300 bg-emerald-50'
                          : 'border-[#e7ddcd] bg-white hover:border-[#d6c8b4]')
                      }
                    >
                      <span className="min-w-0">
                        <span className="block truncate font-semibold text-[#2a2320]">
                          {s.name}
                        </span>
                        <span className="mt-0.5 block text-xs text-[#8f8478]">
                          {s.durationMin} {o.services.minutesSuffix} · {priceLabel}
                        </span>
                      </span>
                      <input
                        type="checkbox"
                        checked={on}
                        onChange={(e) =>
                          setActive((prev) => ({ ...prev, [s.id]: e.target.checked }))
                        }
                        className="h-5 w-5 shrink-0 accent-emerald-500"
                      />
                    </label>
                    {/* מצב ההחלפה נשלח לשרת כשדה מוסתר לכל שירות */}
                    <input type="hidden" name={`svc:${s.id}`} value={on ? 'on' : 'off'} />
                  </li>
                );
              })}
            </ul>

            {newServices.length > 0 ? (
              <ul className="space-y-2">
                {newServices.map((svc, idx) => (
                  <li
                    key={idx}
                    className="flex items-center justify-between gap-3 rounded-2xl border border-emerald-300 bg-emerald-50 p-3.5"
                  >
                    <span className="min-w-0">
                      <span className="block truncate font-semibold text-[#2a2320]">{svc.name}</span>
                      <span className="mt-0.5 block text-xs text-[#8f8478]">
                        {svc.durationMin} {o.services.minutesSuffix} ·{' '}
                        {svc.priceAgorot > 0
                          ? `₪${(svc.priceAgorot / 100).toLocaleString('he-IL')}`
                          : o.services.free}
                      </span>
                    </span>
                    <button
                      type="button"
                      onClick={() => removeNewService(idx)}
                      className="shrink-0 text-sm font-medium text-[#8f8478] hover:text-red-600"
                    >
                      {o.services.removeAdded}
                    </button>
                  </li>
                ))}
              </ul>
            ) : null}

            {/* רשימת השירותים החדשים נשלחת לשרת כ-JSON */}
            <input type="hidden" name="newServices" value={JSON.stringify(newServices)} />

            {addingService ? (
              <div className="space-y-3 rounded-2xl border border-dashed border-[#d6c8b4] bg-[#f7f2ea] p-4">
                <div>
                  <label className="mb-1 block text-sm font-medium text-[#4a4038]">
                    {o.services.newNameLabel}
                  </label>
                  <input
                    name="newName"
                    type="text"
                    value={draftName}
                    onChange={(e) => setDraftName(e.target.value)}
                    placeholder={o.services.newNamePlaceholder.replace('{example}', serviceExample)}
                    className="w-full rounded-xl border border-[#d6c8b4] bg-white px-3 py-2.5 text-sm"
                  />
                </div>
                <div className="flex gap-3">
                  <div className="flex-1">
                    <label className="mb-1 block text-sm font-medium text-[#4a4038]">
                      {o.services.newDurationLabel}
                    </label>
                    <input
                      name="newDuration"
                      type="number"
                      inputMode="numeric"
                      min={5}
                      step={5}
                      value={draftDuration}
                      onChange={(e) => setDraftDuration(e.target.value)}
                      className="w-full rounded-xl border border-[#d6c8b4] bg-white px-3 py-2.5 text-sm"
                    />
                  </div>
                  <div className="flex-1">
                    <label className="mb-1 block text-sm font-medium text-[#4a4038]">
                      {o.services.newPriceLabel}
                    </label>
                    <input
                      name="newPrice"
                      type="number"
                      inputMode="decimal"
                      min={0}
                      step={1}
                      placeholder="0"
                      value={draftPrice}
                      onChange={(e) => setDraftPrice(e.target.value)}
                      className="w-full rounded-xl border border-[#d6c8b4] bg-white px-3 py-2.5 text-sm"
                    />
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={addDraftService}
                    disabled={draftName.trim() === ''}
                    className="rounded-xl bg-emerald-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-emerald-700 disabled:opacity-50"
                  >
                    {o.services.addCta}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setAddingService(false);
                      setDraftName('');
                      setDraftDuration('30');
                      setDraftPrice('');
                    }}
                    className="text-sm font-medium text-[#8f8478] hover:text-[#4a4038]"
                  >
                    {o.services.cancelAdd}
                  </button>
                </div>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setAddingService(true)}
                className="w-full rounded-2xl border border-dashed border-[#d6c8b4] py-3 text-sm font-semibold text-[#8f8478] transition hover:border-emerald-300 hover:text-emerald-600"
              >
                + {o.services.addOwn}
              </button>
            )}

            {totalSelected === 0 && !addingService ? (
              <p className="text-sm text-amber-600">{o.services.emptyWarning}</p>
            ) : null}
            {errorText(servicesState) ? (
              <p className="text-sm text-red-600">{errorText(servicesState)}</p>
            ) : null}

            <div className="flex items-center justify-end pt-1">
              <button
                type="submit"
                disabled={servicesPending || totalSelected === 0}
                className="rounded-xl bg-[#1b1715] px-6 py-2.5 font-semibold text-white transition hover:bg-[#2a2320] disabled:opacity-60"
              >
                {servicesPending
                  ? o.saving
                  : totalSelected === 1
                    ? o.services.continueCtaSingle
                    : o.services.continueCta.replace('{n}', String(totalSelected))}
              </button>
            </div>
          </form>
        ) : null}

        {/* ── צעד שעות פעילות ─────────────────────────── */}
        {step === 1 ? (
          <form action={hoursFormAction} className="space-y-4">
            <div className="space-y-2.5">
              {(Object.keys(o.hours.presets) as HoursPresetKey[]).map((key) => {
                const p = o.hours.presets[key];
                const on = preset === key;
                return (
                  <label
                    key={key}
                    className={
                      'flex cursor-pointer items-center gap-3 rounded-2xl border p-4 transition-colors ' +
                      (on
                        ? 'border-emerald-400 bg-emerald-50'
                        : 'border-[#e7ddcd] bg-white hover:border-[#d6c8b4]')
                    }
                  >
                    <input
                      type="radio"
                      name="preset"
                      value={key}
                      checked={on}
                      onChange={() => setPreset(key)}
                      className="h-5 w-5 shrink-0 accent-emerald-500"
                    />
                    <span className="min-w-0">
                      <span className="block font-semibold text-[#2a2320]">{p.label}</span>
                      <span className="mt-0.5 block text-xs text-[#8f8478]">{p.hint}</span>
                    </span>
                  </label>
                );
              })}
            </div>

            {preset === 'custom' ? (
              <div className="space-y-2 rounded-2xl border border-dashed border-[#d6c8b4] bg-[#f7f2ea] p-4">
                <p className="text-sm font-medium text-[#4a4038]">{o.hours.custom.title}</p>
                {customDays.map((day) => (
                  <div key={day.weekday} className="flex flex-wrap items-center gap-3">
                    <label className="flex min-w-[4.5rem] items-center gap-2">
                      <input
                        type="checkbox"
                        checked={day.open}
                        onChange={(e) => updateCustomDay(day.weekday, { open: e.target.checked })}
                        className="h-4 w-4 accent-emerald-500"
                      />
                      <span className="text-sm font-medium text-[#4a4038]">
                        {o.hours.custom.days[day.weekday]}
                      </span>
                    </label>
                    {day.open ? (
                      <div className="flex items-center gap-2">
                        <input
                          type="time"
                          value={day.start}
                          onChange={(e) => updateCustomDay(day.weekday, { start: e.target.value })}
                          className="rounded-lg border border-[#d6c8b4] bg-white px-2 py-1.5 text-sm"
                        />
                        <span className="text-[#b3a690]">–</span>
                        <input
                          type="time"
                          value={day.end}
                          onChange={(e) => updateCustomDay(day.weekday, { end: e.target.value })}
                          className="rounded-lg border border-[#d6c8b4] bg-white px-2 py-1.5 text-sm"
                        />
                      </div>
                    ) : (
                      <span className="text-sm text-[#b3a690]">{o.hours.custom.closed}</span>
                    )}
                  </div>
                ))}
                <input type="hidden" name="customHours" value={JSON.stringify(customDays)} />
              </div>
            ) : null}

            <p className="rounded-2xl bg-[#f7f2ea] px-3 py-2.5 text-xs leading-relaxed text-[#8f8478]">
              {o.hours.staffNote}
            </p>
            <p className="text-xs text-[#b3a690]">{o.hours.tuneLater}</p>
            {errorText(hoursState) ? (
              <p className="text-sm text-red-600">{errorText(hoursState)}</p>
            ) : null}
            <div className="flex items-center justify-between pt-1">
              {backButton()}
              <button
                type="submit"
                disabled={hoursPending}
                className="rounded-xl bg-[#1b1715] px-6 py-2.5 font-semibold text-white transition hover:bg-[#2a2320] disabled:opacity-60"
              >
                {hoursPending ? o.saving : o.hours.continueCta}
              </button>
            </div>
          </form>
        ) : null}

        {/* ── צעד מיתוג + תצוגה חיה ────────────────────── */}
        {step === 2 ? (
          <form action={brandingFormAction} className="space-y-5">
            <div>
              <span className="mb-1.5 block text-sm font-medium text-[#4a4038]">
                {o.branding.logoLabel}
              </span>
              <ImageUploadField
                name="logoUrl"
                defaultValue={logoUrl}
                targetAspect={1}
                rounded
                maxWidth={512}
                maxHeight={512}
                mime="image/png"
                labels={imageLabels}
              />
            </div>

            <div className="space-y-4">
              {/* גלריית פלטות מותג אצורות: כרטיס קובע brandColor + theme לעמוד הפרימיום */}
              <div>
                <span className="mb-1.5 block text-sm font-medium text-[#4a4038]">
                  {o.premium.palette.presetsTitle}
                </span>
                <p className="mb-2 text-xs text-[#b3a690]">{o.premium.palette.presetsHint}</p>
                <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3">
                  {BRAND_PRESETS.map((preset) => {
                    const on =
                      (premiumDraft.theme?.brand ?? '').toLowerCase() ===
                      preset.theme.brand.toLowerCase();
                    const dots = [
                      preset.theme.brand,
                      preset.theme.brandDark,
                      preset.theme.gold,
                      preset.theme.accent,
                      preset.theme.cream,
                    ];
                    return (
                      <button
                        key={preset.id}
                        type="button"
                        aria-pressed={on}
                        onClick={() => {
                          setColor(preset.theme.brand);
                          setPremiumDraft((prev) => ({ ...prev, theme: preset.theme }));
                        }}
                        className={
                          'flex flex-col gap-2 rounded-2xl border p-3 text-right transition ' +
                          (on
                            ? 'border-[#1b1715] ring-2 ring-[#1b1715] ring-offset-1'
                            : 'border-[#e7ddcd] hover:border-[#b3a690]')
                        }
                      >
                        <span className="flex gap-1" aria-hidden="true">
                          {dots.map((c, di) => (
                            <span
                              key={di}
                              className="h-5 w-5 rounded-full ring-1 ring-black/5"
                              style={{ backgroundColor: c }}
                            />
                          ))}
                        </span>
                        <span className="text-xs font-medium text-[#4a4038]">{preset.name}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* מסלול "צבע ראשי": גוונים קבועים אצורים; שאר --biz-* נגזרים אוטומטית */}
              <div>
                <span className="mb-1.5 block text-sm font-medium text-[#4a4038]">
                  {o.premium.palette.primaryTitle}
                </span>
                <p className="mb-2 text-xs text-[#b3a690]">{o.premium.palette.primaryHint}</p>
                <div className="flex flex-wrap gap-2.5">
                  {PRIMARY_SWATCHES.map((swatch) => {
                    const on = color.toLowerCase() === swatch.toLowerCase();
                    return (
                      <button
                        key={swatch}
                        type="button"
                        aria-label={swatch}
                        aria-pressed={on}
                        onClick={() => setColor(swatch)}
                        style={{ backgroundColor: swatch }}
                        className={
                          'h-10 w-10 rounded-full ring-offset-2 transition ' +
                          (on
                            ? 'ring-2 ring-[#1b1715]'
                            : 'ring-1 ring-[#e7ddcd] hover:ring-[#b3a690]')
                        }
                      />
                    );
                  })}
                </div>
              </div>
              <input type="hidden" name="brandColor" value={color} />
            </div>

            {/* תצוגה חיה של עמוד ההזמנות — נצבעת מיד לפי הצבע שנבחר */}
            <div>
              <p className="mb-2 text-xs font-medium text-[#b3a690]">{o.branding.previewTitle}</p>
              <div className="overflow-hidden rounded-2xl border border-[#e7ddcd] shadow-sm">
                <div className="h-16" style={{ backgroundColor: color }} />
                <div className="-mt-8 px-4 pb-4">
                  <div className="flex items-end gap-3">
                    <span
                      className="flex h-16 w-16 items-center justify-center overflow-hidden rounded-2xl border-4 border-white bg-white text-xl font-bold text-[#4a4038] shadow"
                      style={{ color }}
                    >
                      {logoUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={logoUrl} alt="" className="h-full w-full object-cover" />
                      ) : (
                        businessName.trim().charAt(0) || '★'
                      )}
                    </span>
                    <span className="pb-1 font-bold text-[#2a2320]">{businessName}</span>
                  </div>
                  <div className="mt-3 flex items-center justify-between rounded-xl border border-[#efe6d8] bg-[#f7f2ea] px-3 py-2 text-xs text-[#8f8478]">
                    <span>{o.branding.previewServiceSample}</span>
                    <span
                      className="rounded-lg px-3 py-1.5 text-xs font-semibold text-white"
                      style={{ backgroundColor: color }}
                    >
                      {o.branding.previewBook}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {errorText(brandingState) ? (
              <p className="text-sm text-red-600">{errorText(brandingState)}</p>
            ) : null}

            <div className="flex items-center justify-between pt-1">
              {backButton()}
              <div className="flex items-center gap-3">
                <button
                  type="submit"
                  disabled={brandingPending}
                  className="text-sm font-medium text-[#8f8478] hover:text-[#4a4038] disabled:opacity-60"
                >
                  {o.branding.skip}
                </button>
                <button
                  type="submit"
                  disabled={brandingPending}
                  className="rounded-xl bg-[#1b1715] px-6 py-2.5 font-semibold text-white transition hover:bg-[#2a2320] disabled:opacity-60"
                >
                  {brandingPending ? o.branding.finishing : o.branding.finishCta}
                </button>
              </div>
            </div>
          </form>
        ) : null}
      </div>
    </div>
  );
}
