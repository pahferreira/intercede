import { i18n } from "@lingui/core";

export const locales = ["en", "pt-BR"] as const;

export type Locale = (typeof locales)[number];

const storageKey = "intercede.locale";

function isLocale(value: string | null): value is Locale {
	return locales.some((locale) => locale === value);
}

export function resolveInitialLocale(
	stored: string | null,
	browserLanguage: string,
): Locale {
	if (isLocale(stored)) {
		return stored;
	}
	return browserLanguage.toLowerCase().startsWith("pt") ? "pt-BR" : "en";
}

export function initialLocale(): Locale {
	return resolveInitialLocale(
		localStorage.getItem(storageKey),
		navigator.language,
	);
}

export async function activateLocale(locale: Locale) {
	const { messages } = await import(`./locales/${locale}/messages.po`);
	i18n.loadAndActivate({ locale, messages });
	document.documentElement.lang = locale;
}

export async function switchLocale(locale: Locale) {
	localStorage.setItem(storageKey, locale);
	await activateLocale(locale);
}
