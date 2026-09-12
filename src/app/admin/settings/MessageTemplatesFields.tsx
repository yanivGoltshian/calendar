'use client';

import { useRef, useState } from 'react';
import { t } from '@/i18n';
import {
  MESSAGE_KEYS,
  getTemplateDef,
  type MessageChannel,
  type MessageKey,
} from '@/server/messages/registry';
import {
  fillBusinessTokens,
  previewTemplate,
  type BusinessTemplateContext,
} from '@/server/messages/businessTokens';
import { inputClass } from './fieldStyles';

/**
 * עורך תבניות ההודעות ללקוחות במסך ההגדרות. לכל מפתח × ערוץ נתמך מציג נושא
 * (מייל בלבד) וגוף ניתנים לעריכה, שורת המשתנים הזמינים, וכפתור שחזור לברירת-המחדל.
 * שמות השדות: `tmpl.<key>.<channel>.subject|body` — נקראים ע"י parseMessageTemplates.
 * רכיב לקוח בגלל כפתור השחזור; הערכים עצמם נשמרים דרך זרימת ה-save-all הרגילה.
 */

const labelClass = 'mb-1 block text-sm font-medium text-[#4a4038]';
const hintClass = 'mt-1 text-xs text-[#8f8478]';

/** מפה של דריסות קיימות לפי `${key}.${channel}` ⇐ {subject, body}. */
export type TemplateOverrides = Record<
  string,
  { subject: string | null; body: string }
>;

function ChannelEditor({
  msgKey,
  channel,
  defaultSubject,
  defaultBody,
  variablesLine,
  override,
  business,
}: {
  msgKey: MessageKey;
  channel: MessageChannel;
  defaultSubject?: string;
  defaultBody: string;
  variablesLine: string;
  override?: { subject: string | null; body: string };
  business: BusinessTemplateContext;
}) {
  const s = t.admin.settings.messageTemplates;
  const subjectRef = useRef<HTMLInputElement | null>(null);
  const bodyRef = useRef<HTMLTextAreaElement | null>(null);
  const prefix = `tmpl.${msgKey}.${channel}`;
  // תצוגה מקדימה חיה נטולת-סוגריים: פרטי-העסק האמיתיים + ערכי-הדגמה למשתני התור.
  const [preview, setPreview] = useState(() =>
    previewTemplate(override?.body ?? defaultBody, business),
  );

  // שחזור לברירת-המחדל: מאפס את השדות לערכי המרשם ומדליק input כדי לסמן שינוי.
  function reset() {
    if (subjectRef.current && defaultSubject !== undefined) {
      subjectRef.current.value = defaultSubject;
      subjectRef.current.dispatchEvent(new Event('input', { bubbles: true }));
    }
    if (bodyRef.current) {
      bodyRef.current.value = defaultBody;
      bodyRef.current.dispatchEvent(new Event('input', { bubbles: true }));
    }
  }

  return (
    <div className="rounded-lg border border-[#eae0d1] p-3">
      <div className="mb-2 flex items-center justify-between">
        <span className="text-sm font-semibold text-[#4a4038]">
          {channel === 'email' ? s.emailLabel : s.smsLabel}
        </span>
        <button
          type="button"
          onClick={reset}
          className="text-xs font-medium text-[#82643C] underline-offset-2 hover:text-[#C59D5F] hover:underline"
        >
          {s.reset}
        </button>
      </div>

      {channel === 'email' && defaultSubject !== undefined ? (
        <div className="mb-2">
          <label className={labelClass} htmlFor={`${prefix}.subject`}>
            {s.subjectLabel}
          </label>
          <input
            ref={subjectRef}
            id={`${prefix}.subject`}
            name={`${prefix}.subject`}
            type="text"
            defaultValue={override?.subject ?? defaultSubject}
            className={inputClass}
          />
        </div>
      ) : null}

      <label className={labelClass} htmlFor={`${prefix}.body`}>
        {s.bodyLabel}
      </label>
      <textarea
        ref={bodyRef}
        id={`${prefix}.body`}
        name={`${prefix}.body`}
        rows={channel === 'sms' ? 3 : 5}
        defaultValue={override?.body ?? defaultBody}
        onInput={(e) => setPreview(previewTemplate(e.currentTarget.value, business))}
        className={inputClass}
        dir="rtl"
      />
      <p className={hintClass}>
        <span className="font-medium">{s.variablesLabel}</span> {variablesLine}
      </p>

      <div className="mt-2">
        <div className="mb-1 flex items-center gap-2">
          <span className="text-xs font-medium text-[#4a4038]">{s.previewLabel}</span>
          <span className="rounded bg-[#f3ece0] px-1.5 py-0.5 text-[10px] text-[#8f8478]">
            {s.sampleBadge}
          </span>
        </div>
        <div
          dir="rtl"
          className="whitespace-pre-wrap rounded-md border border-[#eae0d1] bg-[#faf6ef] p-2 text-xs leading-relaxed text-[#4a4038]"
        >
          {preview}
        </div>
      </div>
    </div>
  );
}

export function MessageTemplatesFields({
  overrides,
  business,
}: {
  overrides: TemplateOverrides;
  business: BusinessTemplateContext;
}) {
  const s = t.admin.settings.messageTemplates;
  return (
    <div className="space-y-5">
      <p className="rounded-md bg-[#f7f2ea] p-2 text-xs leading-relaxed text-[#6f665b]">
        {s.autoFilledNote}
      </p>
      {MESSAGE_KEYS.map((key) => {
        const def = getTemplateDef(key);
        const variablesLine = def.variables
          .map((v) => `${v.label} {{${v.name}}}`)
          .join(' · ');
        const channels = (['email', 'sms'] as MessageChannel[]).filter(
          (c) => def.channels[c],
        );
        return (
          <div key={key} className="space-y-2">
            <div>
              <h3 className="text-sm font-bold text-[#1b1715]">{def.label}</h3>
              <p className="text-xs text-[#8f8478]">{def.description}</p>
            </div>
            {channels.map((channel) => {
              const cdef = def.channels[channel]!;
              return (
                <ChannelEditor
                  key={channel}
                  msgKey={key}
                  channel={channel}
                  defaultSubject={
                    cdef.subject ? fillBusinessTokens(cdef.subject, business) : undefined
                  }
                  defaultBody={fillBusinessTokens(cdef.body, business)}
                  variablesLine={variablesLine}
                  override={overrides[`${key}.${channel}`]}
                  business={business}
                />
              );
            })}
            {key === 'otp_login' ? (
              <p className={hintClass}>{s.otpNote}</p>
            ) : null}
            {def.channels.sms ? <p className={hintClass}>{s.smsNote}</p> : null}
          </div>
        );
      })}
    </div>
  );
}
