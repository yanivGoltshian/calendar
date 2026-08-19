/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // פלט standalone לבנייה רזה לקונטיינר (Docker). ראו docs/deployment-cost.md.
  output: 'standalone',
  // הלוגו ותמונת הכריכה נשמרים כ-data URL מוטמע בטופס. בעמוד ההגדרות שתי
  // התמונות נשמרות יחד בשמירה אחת ('שמירת הכול'), ולכן גוף הבקשה של
  // ה-Server Action עלול להגיע לכמה מגה-בייט ולהידחות בשקט לפני השמירה.
  // כל תמונה מוגבלת לכ-3MB בדחיסה, ומרחיבים כאן את המגבלה למרווח נוח לשתיהן יחד.
  experimental: {
    serverActions: {
      bodySizeLimit: '9mb',
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
