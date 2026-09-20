import { cookies } from 'next/headers';
import { LOCALE_COOKIE, normalizeLocale, translate, type Locale, type TFunction } from './index';

export function getLocale(): Locale {
  try {
    return normalizeLocale(cookies().get(LOCALE_COOKIE)?.value);
  } catch {
    return 'en';
  }
}

/** For server components. Client components use useT() from ./client. */
export function getT(): TFunction {
  const locale = getLocale();
  return (text: string) => translate(locale, text);
}
