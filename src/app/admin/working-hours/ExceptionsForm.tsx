'use client';

import { startTransition, useActionState, useEffect, useState } from 'react';
import { t } from '@/i18n';
import { HEBREW_MONTHS, toHebrewDate } from '@/lib/workingHoursExceptions';
import { saveHoursExceptionAction, deleteHoursExceptionAction, type ExceptionActionState } from './exceptionActions';

const text = t.admin.hoursExceptions;
const fieldClass = 'w-full rounded-lg border border-[#d6c8b4] bg-white px-3 py-2 text-[#1b1715]';
const initial: ExceptionActionState = { ok: false };

function Result({ state }: { state: ExceptionActionState }) {
  return state.error ? <p role="alert" className="text-sm text-red-700">{text.errors[state.error]}</p>
    : state.ok ? <p role="status" className="text-sm text-green-700">{text.saved}</p> : null;
}

function DateFields({ prefix, calendar, today, label }: {
  prefix: string; calendar: string; today: string; label: string;
}) {
  const hebrew = toHebrewDate(today);
  return <fieldset className="space-y-2">
    <legend className="text-sm font-medium">{label}</legend>
    {calendar === 'GREGORIAN'
      ? <input aria-label={label} required type="date" name={`${prefix}Date`} defaultValue={today}
          min="1900-01-01" max="2200-12-31" dir="ltr" className={fieldClass} />
      : <div className="grid grid-cols-3 gap-2">
          <label>{text.day}<input required aria-label={`${label} ${text.day}`} name={`${prefix}Day`} type="number"
            min={1} max={30} defaultValue={hebrew.day} className={fieldClass} /></label>
          <label>{text.month}<select aria-label={`${label} ${text.month}`} name={`${prefix}Month`}
            defaultValue={hebrew.month} className={fieldClass}>
            {HEBREW_MONTHS.map((month) => <option key={month} value={month}>{text.months[month]}</option>)}
          </select></label>
          <label>{text.year}<input required aria-label={`${label} ${text.year}`} name={`${prefix}Year`} type="number"
            min={5661} max={5960} defaultValue={hebrew.year} className={fieldClass} /></label>
        </div>}
  </fieldset>;
}

export default function ExceptionsForm({ staff, selectedStaffId, today }: {
  staff: { id: string; displayName: string }[]; selectedStaffId?: string; today: string;
}) {
  const [state, action, pending] = useActionState(saveHoursExceptionAction, initial);
  const [calendar, setCalendar] = useState('GREGORIAN');
  const [recurrence, setRecurrence] = useState('ONCE');
  const [closed, setClosed] = useState(true);
  const [range, setRange] = useState(false);
  const [ready, setReady] = useState(false);
  useEffect(() => setReady(true), []);
  return <form onSubmit={(event) => {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    // Dispatch explicitly to retain the draft, including calendar controls, after validation errors.
    startTransition(() => action(data));
  }}
    className="space-y-4 rounded-xl border border-[#e7ddcd] bg-white p-4" aria-label={text.add}>
    <h3 className="font-semibold">{text.add}</h3>
    <label className="block">{text.name}<input required name="title" maxLength={100} className={fieldClass} /></label>
    <label className="block">{text.scope}<select name="staffId" aria-label={text.scope} defaultValue={selectedStaffId ?? ''} className={fieldClass}>
      <option value="">{t.admin.workingHours.businessScopeName}</option>
      {staff.map((member) => <option key={member.id} value={member.id}>{member.displayName}</option>)}
    </select></label>
    <label className="block">{text.calendar}<select name="calendar" aria-label={text.calendar} value={calendar}
      onChange={(event) => setCalendar(event.target.value)} className={fieldClass}>
      <option value="GREGORIAN">{text.gregorian}</option><option value="HEBREW">{text.hebrew}</option>
    </select></label>
    <label className="block">{text.recurrence}<select name="recurrence" aria-label={text.recurrence} value={recurrence}
      onChange={(event) => setRecurrence(event.target.value)} className={fieldClass}>
      <option value="ONCE">{text.once}</option><option value="WEEKLY">{text.weekly}</option>
      <option value="ANNUAL">{text.annual}</option>
    </select></label>
    <DateFields key={`start-${calendar}`} prefix="start" calendar={calendar} today={today} label={text.startDate} />
    {recurrence === 'ONCE' && <>
      <label className="flex gap-2"><input type="checkbox" name="range" checked={range}
        onChange={(event) => setRange(event.target.checked)} />{text.range}</label>
      {range && <DateFields key={`end-${calendar}`} prefix="end" calendar={calendar} today={today} label={text.endDate} />}
    </>}
    {recurrence === 'WEEKLY' && <label className="block">{text.interval}
      <input type="number" min={1} max={52} required name="intervalWeeks" defaultValue={2} className={fieldClass} />
      <span className="text-xs">{text.anchorHelp}</span>
    </label>}
    {recurrence !== 'ONCE' && <label className="block">{text.until}
      <input type="date" name="until" min={today} max="2200-12-31" dir="ltr" className={fieldClass} />
    </label>}
    <label className="flex gap-2"><input type="checkbox" name="closed" checked={closed}
      onChange={(event) => setClosed(event.target.checked)} />{text.closed}</label>
    {!closed && <div className="grid grid-cols-2 gap-3">
      <label>{t.admin.workingHours.startLabel}<input required name="startTime" type="time" defaultValue="09:00" className={fieldClass} /></label>
      <label>{t.admin.workingHours.endLabel}<input required name="endTime" type="time" defaultValue="17:00" className={fieldClass} /></label>
    </div>}
    <p className="text-xs text-[#6e655f]">{text.semantics}</p>
    {calendar === 'HEBREW' && <p className="text-xs text-[#6e655f]">{text.hebrewHelp}</p>}
    <Result state={state} />
    <button type="submit" disabled={pending || !ready} className="rounded-lg bg-brand-600 px-4 py-2 font-medium text-white disabled:opacity-50">
      {pending ? text.saving : text.save}
    </button>
  </form>;
}

export function DeleteExceptionButton({ id, title }: { id: string; title: string }) {
  const [state, action, pending] = useActionState(deleteHoursExceptionAction, initial);
  return <form action={action}>
    <input type="hidden" name="id" value={id} />
    <button type="submit" disabled={pending} aria-label={`${text.remove} ${title}`}
      className="rounded-lg border px-3 py-1 text-sm text-red-700">{text.remove}</button>
    <Result state={state} />
  </form>;
}
