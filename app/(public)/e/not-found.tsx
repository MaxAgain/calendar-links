import { headers } from 'next/headers';
import { parseAcceptLanguage, pickLang, translator } from '@/lib/i18n';
import { BRAND_URL } from '@/lib/site';
import { TrackNotFound } from './track-not-found';

export default async function EventNotFound() {
  const lang = pickLang(parseAcceptLanguage((await headers()).get('accept-language')));
  const t = translator(lang);
  return (
    <div className="card" lang={lang}>
      <h1>{t('notFoundTitle')}</h1>
      <p>{t('notFound')}</p>
      <p className="section">
        <a href={BRAND_URL}>{t('toWebsite')} →</a>
      </p>
      <TrackNotFound />
    </div>
  );
}
