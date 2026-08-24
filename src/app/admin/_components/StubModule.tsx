import { BRAND } from '@/config/brand';
import { t } from '@/i18n';
import { Card, CardBody, Badge } from '@/components/ui/admin';

/**
 * תבנית משותפת לעמודי ה-stub של מודולי ה-MVP באזור הניהול.
 * כל מודול בגל השני יחליף את עמוד ה-stub הבודד שלו בלוגיקה אמיתית,
 * ללא נגיעה בשאר העמודים.
 */
export default function StubModule({ title }: { title: string }) {
  return (
    <main className="mx-auto max-w-3xl px-4 pb-16 pt-6">
      <header className="mb-6">
        <p className="text-sm text-[#8f8478]">{BRAND.name}</p>
        <h1 className="text-2xl font-bold text-[#1b1715]">{title}</h1>
      </header>

      <Card>
        <CardBody className="flex flex-col items-start gap-3">
          <Badge tone="gold">{t.admin.stub.badge}</Badge>
          <h2 className="text-lg font-bold text-[#1b1715]">{t.admin.stub.title}</h2>
          <p className="text-sm leading-relaxed text-[#6e655f]">{t.admin.stub.body}</p>
        </CardBody>
      </Card>
    </main>
  );
}
