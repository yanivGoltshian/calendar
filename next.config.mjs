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
        // HSTS על כל התגובות: מכריח את הדפדפן ל-HTTPS למשך שנתיים. ה-redirect
        // עצמו מ-HTTP ל-HTTPS נאכף בשכבת ה-ingress של Container Apps
        // (allowInsecure=false), וכאן רק מצרפים את מדיניות ה-HSTS לתגובות ה-HTTPS.
        // הערה: preload אינו ניתן להגשה בפועל למארח DuckDNS (אי-אפשר להגיש
        // תת-דומיין ל-hstspreload.org ללא בעלות על duckdns.org), ולכן ה-token
        // נשאר הצהרתי; ההגנה בפועל מגיעה מ-max-age + includeSubDomains.
        // ראו docs/ssl-https-runbook.md.
        source: '/:path*',
        headers: [
          {
            key: 'Strict-Transport-Security',
            value: 'max-age=63072000; includeSubDomains; preload',
          },
        ],
      },
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
