/** UX feedback only. The booking endpoint remains authoritative. */
export function bookingContactFeedback(name: string, phone: string, email: string, requireEmail: boolean) {
  const digits = phone.replace(/[^\d+]/g, '');
  const normalized = digits.startsWith('+972') ? digits : digits.startsWith('972') ? `+${digits}` :
    digits.startsWith('0') ? `+972${digits.slice(1)}` : digits.startsWith('+') ? digits : `+972${digits}`;
  const phoneValid = /^\+9725\d{8}$/.test(normalized);
  const trimmed = email.trim();
  const emailValid = !trimmed ? !requireEmail :
    trimmed.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed);
  return { phoneValid, emailValid, valid: !!name.trim() && phoneValid && emailValid };
}
