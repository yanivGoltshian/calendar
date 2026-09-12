'use client';

import { useRef, useState } from 'react';
import type { Business } from '@prisma/client';
import { t } from '@/i18n';
import {
  MESSAGE_KEYS,
  DEFAULT_BRAND,
  getTemplateDef,
  type MessageChannel,
  type MessageKey,
} from '@/server/messages/registry';
import { substitute } from '@/server/messages/substitute';
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
  previewVars,
}: {
  msgKey: MessageKey;
  channel: MessageChannel;
  defaultSubject?: string;
  defaultBody: string;
  variablesLine: string;
  override?: { subject: string | null; body: string };
  previewVars: Record<string, string>;
}) {
  const s = t.admin.settings.messageTemplates;
  const subjectRef = useRef<HTMLInputElement | null>(null);
  const bodyRef = useRef<HTMLTextAreaElement | null>(null);
  const prefix = `tmpl.${msgKey}.${channel}`;
  const [subject, setSubject] = useState(override?.subject ?? defaultSubject ?? '');
  const [body, setBody] = useState(override?.body ?? defaultBody);

  // שחזור לברירת-המחדל: מאפס את השדות לערכי המרשם ומדליק input כדי לסמן שינוי.
  function reset() {
    setSubject(defaultSubject ?? '');
    setBody(defaultBody);
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
    <div className="rounded-lg border border-[#eae0d1] p-3" data-testid={`message-template-${msgKey}-${channel}`}>
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

      <div className="rounded-lg bg-[#f7f2ea] p-3" data-testid="message-preview">
        <p className="mb-2 text-xs font-semibold text-[#82643C]">{s.preview}</p>
        {channel === 'email' && defaultSubject !== undefined ? (
          <p className="mb-2 font-semibold text-[#1b1715]">{substitute(subject, previewVars)}</p>
        ) : null}
        <p className="whitespace-pre-wrap break-words text-sm text-[#4a4038]">{substitute(body, previewVars)}</p>
      </div>
      <p className={hintClass}>{s.previewHint}</p>
      <details className="mt-3">
        <summary className="cursor-pointer text-sm font-medium text-[#82643C]">{s.editTemplate}</summary>
        <div className="mt-3">
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
                onChange={event => setSubject(event.target.value)}
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
            onChange={event => setBody(event.target.value)}
            className={inputClass}
            dir="rtl"
          />
          <p className={hintClass}>
            <span className="font-medium">{s.variablesLabel}</span> {variablesLine}
          </p>
        </div>
      </details>
    </div>
  );
}

export function MessageTemplatesFields({
  overrides,
  business,
}: {
  overrides: TemplateOverrides;
  business: Pick<Business, 'name' | 'phone' | 'address'>;
}) {
  const s = t.admin.settings.messageTemplates;
  return (
    <div className="space-y-5">
      {MESSAGE_KEYS.map((key) => {
        const def = getTemplateDef(key);
        const variablesLine = def.variables
          .map((v) => `${v.label} {{${v.name}}}`)
          .join(' · ');
        const previewVars = {
          ...Object.fromEntries(def.variables.map(variable => [variable.name, `[${variable.label}]`])),
          brand: DEFAULT_BRAND,
          businessName: business.name,
          businessPhone: business.phone ?? '',
          businessAddress: business.address ?? '',
        };
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
                  defaultSubject={cdef.subject}
                  defaultBody={cdef.body}
                  variablesLine={variablesLine}
                  override={overrides[`${key}.${channel}`]}
                  previewVars={previewVars}
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
