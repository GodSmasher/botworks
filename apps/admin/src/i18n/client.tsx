'use client';

import { createContext, useCallback, useContext, type ReactNode } from 'react';
import { translate, type Locale, type TFunction } from './index';

const LocaleContext = createContext<Locale>('en');

export function LocaleProvider({ locale, children }: { locale: Locale; children: ReactNode }) {
  return <LocaleContext.Provider value={locale}>{children}</LocaleContext.Provider>;
}

export function useLocale(): Locale {
  return useContext(LocaleContext);
}

/** For client components. Server components use getT() from ./server. */
export function useT(): TFunction {
  const locale = useLocale();
  return useCallback((text: string) => translate(locale, text), [locale]);
}
