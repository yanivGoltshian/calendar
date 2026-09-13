export type BusinessImportSourceType =
  'calmark' | 'instagram' | 'facebook' | 'generic-site';

export type TorChickBusinessType =
  | 'BARBERSHOP'
  | 'HAIR_SALON'
  | 'NAILS'
  | 'BEAUTY_COSMETICS'
  | 'SPA_MASSAGE'
  | 'BROWS_LASHES'
  | 'TATTOO_PIERCING'
  | 'CLINIC'
  | 'FITNESS'
  | 'OTHER';

export type BusinessImportEvidenceMethod =
  | 'json-ld'
  | 'open-graph'
  | 'meta'
  | 'html-attribute'
  | 'embedded-json'
  | 'visible-text'
  | 'canonical'
  | 'link'
  | 'heuristic';

export type BusinessImportConfidence = 'high' | 'medium' | 'low';

export interface BusinessImportEvidence {
  field: string;
  value: string;
  sourceUrl: string;
  method: BusinessImportEvidenceMethod;
  confidence?: BusinessImportConfidence;
  detail?: string;
}

export interface BusinessImportWarning {
  code:
    | 'platform-metadata-only'
    | 'platform-blocked'
    | 'page-fetch-failed'
    | 'invalid-json-ld'
    | 'missing-name'
    | 'missing-contact'
    | 'missing-address'
    | 'missing-hours'
    | 'missing-services'
    | 'missing-staff'
    | 'missing-policy'
    | 'missing-media'
    | 'social-profile-fetch-failed'
    | 'staff-service-links-assumed'
    | 'unsupported-currency'
    | 'default-duration'
    | 'media-storage-unavailable'
    | 'media-fetch-failed'
    | 'media-rejected'
    | 'result-truncated';
  message: string;
  sourceUrl?: string;
}

export interface BusinessImportHours {
  dayOfWeek: string[];
  opens: string | null;
  closes: string | null;
  raw: string;
  sourceUrl: string;
}

export interface BusinessImportService {
  name: string;
  description: string | null;
  price: number | null;
  currency: string | null;
  durationMinutes: number | null;
  imageUrl: string | null;
  sourceUrl: string;
  evidence: BusinessImportEvidence[];
}

export interface BusinessImportStaff {
  name: string;
  title: string | null;
  bio: string | null;
  imageUrl: string | null;
  serviceNames: string[];
  sourceUrl: string;
  evidence: BusinessImportEvidence[];
}

export interface BusinessImportBookingPolicy {
  minLeadTimeMinutes: number | null;
  cancellationWindowHours: number | null;
  maxAdvanceBookingDays: number | null;
  bookingRequiresApproval: boolean | null;
  notes: string[];
}

export interface BusinessImportSocialLink {
  platform:
    'instagram' | 'facebook' | 'whatsapp' | 'tiktok' | 'youtube' | 'linkedin' | 'x';
  url: string;
}

export interface BusinessImportDraft {
  sourceType: BusinessImportSourceType;
  sourceUrl: string;
  fetchedUrls: string[];
  business: {
    name: string | null;
    description: string | null;
    industry: string | null;
    category: string | null;
    typeSuggestion: TorChickBusinessType | null;
    websiteUrl: string | null;
  };
  contacts: {
    phones: string[];
    emails: string[];
  };
  location: {
    formattedAddress: string | null;
    streetAddress: string | null;
    locality: string | null;
    region: string | null;
    postalCode: string | null;
    country: string | null;
    mapUrl: string | null;
  };
  hours: BusinessImportHours[];
  services: BusinessImportService[];
  staff: BusinessImportStaff[];
  bookingPolicy: BusinessImportBookingPolicy;
  media: {
    logoUrl: string | null;
    coverImageUrl: string | null;
    galleryImageUrls: string[];
    videoUrls: string[];
    instagramPostUrls: string[];
  };
  socialLinks: BusinessImportSocialLink[];
  evidence: BusinessImportEvidence[];
  warnings: BusinessImportWarning[];
}
