/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // פלט standalone לבנייה רזה לקונטיינר (Docker). ראו docs/deployment-cost.md.
  output: 'standalone',
  // הלוגו ותמונת הכריכה נשמרים כ-data URL מוטמע בטופס הפרופיל, ולכן גוף
  // הבקשה של ה-Server Action עלול לעבור את מגבלת ברירת המחדל (1MB) ולהידחות
  // בשקט לפני השמירה. מרחיבים את המגבלה עם מרווח נוח לשתי התמונות יחד.
  experimental: {
    serverActions: {
      bodySizeLimit: '4mb',
    },
  },
  async headers() {
    return [
      {
        source: '/sw.js',
        headers: [
          { key: 'Cache-Control', value: 'no-cache, no-store, must-revalidate' },
          { key: 'Service-Worker-Allowed', value: '/' },
        ],
      },
    ];
  },
};

export default nextConfig;
