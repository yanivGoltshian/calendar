import { test } from 'node:test';
import assert from 'node:assert/strict';

import { detectInstallEnv, installGuideFor } from './detectInstallEnv';

// מחרוזות User-Agent אמיתיות מייצגות לכל סביבה שאנחנו רוצים להנחות אחרת.
const UA = {
  iosSafari:
    'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1',
  iosChrome:
    'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/126.0.0.0 Mobile/15E148 Safari/604.1',
  iosWhatsApp:
    'Mozilla/5.0 (iPhone; CPU iPhone OS 17_4_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 WhatsApp/2.24.6.78',
  iosInstagram:
    'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 Instagram 331.0.0.24.105 (iPhone14,3; iOS 17_5; en_US)',
  iosFacebook:
    'Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 [FBAN/FBIOS;FBAV/456.0.0.30.108;FBBV/12345;FBDV/iPhone14,3]',
  androidChrome:
    'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Mobile Safari/537.36',
  androidSamsung:
    'Mozilla/5.0 (Linux; Android 14; SM-G991B) AppleWebKit/537.36 (KHTML, like Gecko) SamsungBrowser/25.0 Chrome/121.0.0.0 Mobile Safari/537.36',
  androidWhatsApp:
    'Mozilla/5.0 (Linux; Android 14; SM-G991B; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/126.0.0.0 Mobile Safari/537.36 WhatsApp/2.24.6.76',
  desktopChrome:
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
  desktopEdge:
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36 Edg/126.0.0.0',
  desktopFirefox:
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:127.0) Gecko/20100101 Firefox/127.0',
  desktopSafari:
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Safari/605.1.15',
} as const;

test('iOS Safari: פלטפורמה iOS, דפדפן ספארי, הוספה ידנית למסך הבית', () => {
  const env = detectInstallEnv(UA.iosSafari);
  assert.equal(env.platform, 'ios');
  assert.equal(env.browser, 'safari');
  assert.equal(env.canAddToHomeScreen, true);
  assert.equal(env.mustOpenInBrowser, false);
  assert.equal(env.canPromptInstall, false);
});

test('iOS WhatsApp webview: חובה לפתוח בדפדפן, לא הצגת כפתור השיתוף (שומר הרגרסיה)', () => {
  const env = detectInstallEnv(UA.iosWhatsApp);
  assert.equal(env.platform, 'ios');
  assert.equal(env.browser, 'inApp');
  assert.equal(env.mustOpenInBrowser, true);
  assert.equal(env.canAddToHomeScreen, false);
  assert.equal(env.canPromptInstall, false);
});

test('iOS Instagram webview: מזוהה כדפדפן מובנה שדורש פתיחה בדפדפן', () => {
  const env = detectInstallEnv(UA.iosInstagram);
  assert.equal(env.platform, 'ios');
  assert.equal(env.browser, 'inApp');
  assert.equal(env.mustOpenInBrowser, true);
  assert.equal(env.canAddToHomeScreen, false);
});

test('iOS Facebook webview: מזוהה כדפדפן מובנה שדורש פתיחה בדפדפן', () => {
  const env = detectInstallEnv(UA.iosFacebook);
  assert.equal(env.platform, 'ios');
  assert.equal(env.browser, 'inApp');
  assert.equal(env.mustOpenInBrowser, true);
});

test('Android Chrome: התקנה בהקשה אחת דרך beforeinstallprompt', () => {
  const env = detectInstallEnv(UA.androidChrome);
  assert.equal(env.platform, 'android');
  assert.equal(env.browser, 'chrome');
  assert.equal(env.canPromptInstall, true);
  assert.equal(env.mustOpenInBrowser, false);
  assert.equal(env.canAddToHomeScreen, false);
});

test('Android WhatsApp webview: חובה לפתוח בכרום', () => {
  const env = detectInstallEnv(UA.androidWhatsApp);
  assert.equal(env.platform, 'android');
  assert.equal(env.browser, 'inApp');
  assert.equal(env.mustOpenInBrowser, true);
  assert.equal(env.canPromptInstall, false);
});

test('Desktop Chrome: פלטפורמת מחשב עם התקנה בהקשה אחת', () => {
  const env = detectInstallEnv(UA.desktopChrome);
  assert.equal(env.platform, 'desktop');
  assert.equal(env.browser, 'chrome');
  assert.equal(env.canPromptInstall, true);
  assert.equal(env.mustOpenInBrowser, false);
  assert.equal(env.canAddToHomeScreen, false);
});

test('standalone (מותקן): כל דגלי ההתקנה כבויים', () => {
  const env = detectInstallEnv(UA.iosSafari, { standalone: true });
  assert.equal(env.platform, 'ios');
  assert.equal(env.browser, 'safari');
  assert.equal(env.canAddToHomeScreen, false);
  assert.equal(env.canPromptInstall, false);
  assert.equal(env.mustOpenInBrowser, false);
});

test('iPadOS שמדווח כ-Mac עם מגע: מזוהה כ-iOS Safari (best effort)', () => {
  const iPadOsUa =
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Safari/605.1.15';
  const env = detectInstallEnv(iPadOsUa, { maxTouchPoints: 5 });
  assert.equal(env.platform, 'ios');
  assert.equal(env.browser, 'safari');
  assert.equal(env.canAddToHomeScreen, true);
});

// installGuideFor: מיפוי טהור מסביבה → סוג ההנחיה שיוצג בחלון המודרך.
test('installGuideFor — iOS Safari מקבל הנחיית הוספה למסך הבית', () => {
  assert.equal(installGuideFor(detectInstallEnv(UA.iosSafari)), 'ios');
});

test('installGuideFor — כרום באייפון מונחה לפתוח בספארי', () => {
  const env = detectInstallEnv(UA.iosChrome);
  assert.equal(env.platform, 'ios');
  assert.equal(env.browser, 'chrome');
  assert.equal(installGuideFor(env), 'iosOtherBrowser');
});

test('installGuideFor — דפדפנים מובנים ב-iOS מונחים לפתוח בדפדפן', () => {
  assert.equal(installGuideFor(detectInstallEnv(UA.iosWhatsApp)), 'inApp');
  assert.equal(installGuideFor(detectInstallEnv(UA.iosInstagram)), 'inApp');
  assert.equal(installGuideFor(detectInstallEnv(UA.iosFacebook)), 'inApp');
});

test('installGuideFor — אנדרואיד כרום וסמסונג מקבלים הנחיית אנדרואיד', () => {
  assert.equal(installGuideFor(detectInstallEnv(UA.androidChrome)), 'android');
  assert.equal(installGuideFor(detectInstallEnv(UA.androidSamsung)), 'android');
});

test('installGuideFor — וואטסאפ באנדרואיד מונחה לפתוח בדפדפן', () => {
  assert.equal(installGuideFor(detectInstallEnv(UA.androidWhatsApp)), 'inApp');
});

test('installGuideFor — כרום ואדג׳ במחשב מקבלים הנחיית סמל ההתקנה', () => {
  assert.equal(installGuideFor(detectInstallEnv(UA.desktopChrome)), 'desktop');
  assert.equal(installGuideFor(detectInstallEnv(UA.desktopEdge)), 'desktop');
});

test('installGuideFor — פיירפוקס וספארי במחשב מקבלים הנחיה ידנית', () => {
  assert.equal(installGuideFor(detectInstallEnv(UA.desktopFirefox)), 'manual');
  assert.equal(installGuideFor(detectInstallEnv(UA.desktopSafari)), 'manual');
});

test('installGuideFor — מצב מותקן (standalone) נופל להנחיה ידנית ולא מציג פתיחה בדפדפן', () => {
  // כשמותקן כל הדגלים כבויים; ההנחיה לא רלוונטית אך חייבת להישאר יציבה.
  assert.equal(installGuideFor(detectInstallEnv(UA.androidChrome, { standalone: true })), 'android');
  assert.equal(installGuideFor(detectInstallEnv(UA.iosSafari, { standalone: true })), 'iosOtherBrowser');
  assert.equal(installGuideFor(detectInstallEnv(UA.iosWhatsApp, { standalone: true })), 'iosOtherBrowser');
});
