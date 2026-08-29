'use client';

import { useActionState, useEffect, useRef, useState } from 'react';
import { t } from '@/i18n';
import { createCampaignAction, type CreateCampaignState } from './actions';
import type { CampaignSegment } from '@/server/repos/marketing';
import {
  ALL_CAMPAIGN_CHANNELS,
  allowedCampaignChannels,
  type CampaignChannel,
} from '@/server/campaigns/channels';

type Props = {
  /** ספירת נמענים לכל פילוח — לתצוגה מקדימה. */
  counts: Record<CampaignSegment, number>;
  /** האם העסק בדרגת אקסלוסיב — קובע אם ערוץ המסרון בתשלום מוצג בטופס. */
  isExclusive: boolean;
};

const initialState: CreateCampaignState = { ok: false };

const inputClass =
  'w-full rounded-lg border border-[#d6c8b4] px-3 py-2 text-[#1b1715] outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500';

const SEGMENTS: CampaignSegment[] = ['all', 'active', 'with_appointments'];

export default function CampaignForm({ counts, isExclusive }: Props) {
  const m = t.admin.marketingModule;
  // הערוצים הניתנים לבחירה לפי הדרגה: וואטסאפ מוסתר תמיד, מסרון רק באקסלוסיב, מייל תמיד.
  const visibleChannels = allowedCampaignChannels(ALL_CAMPAIGN_CHANNELS, { isExclusive });
  const [state, formAction, pending] = useActionState(createCampaignAction, initialState);
  const [segment, setSegment] = useState<CampaignSegment>('all');
  const [channels, setChannels] = useState<Set<CampaignChannel>>(() => new Set(visibleChannels));
  const [scheduleMode, setScheduleMode] = useState<'now' | 'later'>('now');
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state.ok) {
      formRef.current?.reset();
      setSegment('all');
      setChannels(new Set(visibleChannels));
      setScheduleMode('now');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state]);

  const toggleChannel = (channel: CampaignChannel) => {
    setChannels((prev) => {
      const next = new Set(prev);
      if (next.has(channel)) next.delete(channel);
      else next.add(channel);
      return next;
    });
  };

  const errorText =
    state.error === 'name'
      ? m.errorName
      : state.error === 'body'
        ? m.errorBody
        : state.error === 'channel'
          ? m.errorChannel
          : state.error === 'schedule'
            ? m.errorSchedule
            : state.error
              ? m.errorGeneric
              : null;

  const successText = state.ok ? (state.scheduled ? m.successScheduled : m.successCreated) : null;

  return (
    <section className="mt-8 rounded-xl border border-[#e7ddcd] bg-white p-5 shadow-sm">
      <h2 className="mb-4 text-lg font-bold text-[#1b1715]">{m.newCampaignTitle}</h2>

      <form ref={formRef} action={formAction} className="space-y-4">
        <div>
          <label className="mb-1 block text-sm font-medium text-[#4a4038]">{m.nameLabel}</label>
          <input
            name="name"
            required
            maxLength={120}
            placeholder={m.namePlaceholder}
            className={inputClass}
          />
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium text-[#4a4038]">{m.bodyLabel}</label>
          <textarea
            name="body"
            required
            rows={4}
            maxLength={1000}
            placeholder={m.bodyPlaceholder}
            className={inputClass}
          />
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium text-[#4a4038]">{m.segmentLabel}</label>
          <select
            name="segment"
            value={segment}
            onChange={(e) => setSegment(e.target.value as CampaignSegment)}
            className={inputClass}
          >
            {SEGMENTS.map((seg) => (
              <option key={seg} value={seg}>
                {m.segments[seg]}
              </option>
            ))}
          </select>
          <p className="mt-1 text-sm text-[#8f8478]">
            {m.recipientsPreview}: <span className="font-semibold text-[#4a4038]">{counts[segment]}</span>
          </p>
        </div>

        <fieldset>
          <legend className="mb-1 block text-sm font-medium text-[#4a4038]">{m.channelsFieldLabel}</legend>
          <div className="flex flex-wrap gap-4">
            {visibleChannels.map((channel) => (
              <label key={channel} className="flex items-center gap-2 text-sm text-[#4a4038]">
                <input
                  type="checkbox"
                  name="channels"
                  value={channel}
                  checked={channels.has(channel)}
                  onChange={() => toggleChannel(channel)}
                  className="h-4 w-4 rounded border-[#d6c8b4] text-brand-600 focus:ring-brand-500"
                />
                {m.channels[channel]}
              </label>
            ))}
          </div>
          <p className="mt-1 text-sm text-[#8f8478]">{m.channelsHint}</p>
        </fieldset>

        <fieldset>
          <legend className="mb-1 block text-sm font-medium text-[#4a4038]">{m.scheduleLabel}</legend>
          <div className="space-y-2">
            <label className="flex items-center gap-2 text-sm text-[#4a4038]">
              <input
                type="radio"
                name="scheduleMode"
                value="now"
                checked={scheduleMode === 'now'}
                onChange={() => setScheduleMode('now')}
                className="h-4 w-4 border-[#d6c8b4] text-brand-600 focus:ring-brand-500"
              />
              {m.scheduleNow}
            </label>
            <label className="flex items-center gap-2 text-sm text-[#4a4038]">
              <input
                type="radio"
                name="scheduleMode"
                value="later"
                checked={scheduleMode === 'later'}
                onChange={() => setScheduleMode('later')}
                className="h-4 w-4 border-[#d6c8b4] text-brand-600 focus:ring-brand-500"
              />
              {m.scheduleLater}
            </label>
          </div>
          {scheduleMode === 'later' ? (
            <div className="mt-2">
              <label className="mb-1 block text-sm font-medium text-[#4a4038]">{m.scheduleAtLabel}</label>
              <input
                type="datetime-local"
                name="scheduledAt"
                required
                className={inputClass}
              />
              <p className="mt-1 text-sm text-[#8f8478]">{m.scheduleTzHint}</p>
            </div>
          ) : null}
        </fieldset>

        {errorText ? <p className="text-sm text-red-600">{errorText}</p> : null}
        {successText ? <p className="text-sm text-green-600">{successText}</p> : null}

        <button
          type="submit"
          disabled={pending}
          className="w-full rounded-lg bg-brand-600 py-2.5 font-semibold text-white transition hover:bg-brand-700 disabled:opacity-60"
        >
          {pending ? t.common.loading : m.submitCreate}
        </button>
      </form>
    </section>
  );
}
