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
    const rules = [];
    // HSTS רק בבנייית production: מכריח את הדפדפן ל-HTTPS למשך שנתיים. ה-redirect
    // עצמו מ-HTTP ל-HTTPS נאכף בשכבת ה-ingress של Container Apps
    // (allowInsecure=false), וכאן רק מצרפים את מדיניות ה-HSTS לתגובות ה-HTTPS.
    // מגבילים ל-production כדי לא להשפיע על פיתוח מקומי מעל http.
    // אין preload: torchick.duckdns.org הוא תת-דומיין של הסיומת הציבורית המשותפת
    // duckdns.org, והגשת מארח בסיומת משותפת לרשימת ה-preload אינה נאותה ובלתי
    // הפיכה למעשה. includeSubDomains נשאר כי איננו מחזיקים תת-תת-דומיינים.
    // ראו docs/ssl-https-runbook.md.
    if (process.env.NODE_ENV === 'production') {
      rules.push({
        source: '/:path*',
        headers: [
          {
            key: 'Strict-Transport-Security',
            value: 'max-age=63072000; includeSubDomains',
          },
        ],
      });
    }
    rules.push({
      source: '/sw.js',
      headers: [
        { key: 'Cache-Control', value: 'no-cache, no-store, must-revalidate' },
        { key: 'Service-Worker-Allowed', value: '/' },
      ],
    });
    return rules;
  },
};

export default nextConfig;
