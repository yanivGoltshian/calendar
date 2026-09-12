import { permanentRedirect } from 'next/navigation';
import { DEMO_BUSINESS_PATH } from '@/config/brand';

export function GET(): never {
  permanentRedirect(DEMO_BUSINESS_PATH);
}
