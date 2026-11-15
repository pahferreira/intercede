import { i18n, type Messages } from "@lingui/core";

export const locales = ["en", "pt-BR"] as const;

export type Locale = (typeof locales)[number];

export const sourceLocale: Locale = "en";

const storageKey = "intercede.locale";

type CatalogLoader = (locale: Locale) => Promise<Messages>;

function isLocale(value: string | null): value is Locale {
	return locales.some((locale) => locale === value);
}

function language(tag: string) {
	return tag.toLowerCase().split("-")[0];
}

export function resolveInitialLocale(
	stored: string | null,
	browserLanguage: string,
): Locale {
	if (isLocale(stored)) {
		return stored;
	}
	return (
		locales.find((locale) => language(locale) === language(browserLanguage)) ??
		sourceLocale
	);
}

const loadCatalog: CatalogLoader = async (locale) => {
	const { messages } = await import(`./locales/${locale}/messages.po`);
	return messages;
};

async function activateLocale(locale: Locale, load = loadCatalog) {
	const messages = await load(locale);
	i18n.loadAndActivate({ locale, messages });
	document.documentElement.lang = locale;
}

export async function activateInitialLocale(load = loadCatalog) {
	const locale = resolveInitialLocale(
		localStorage.getItem(storageKey),
		navigator.language,
	);
	localStorage.setItem(storageKey, locale);
	try {
		await activateLocale(locale, load);
	} catch {
		await activateLocale(sourceLocale, load);
	}
}

export async function switchLocale(locale: Locale) {
	localStorage.setItem(storageKey, locale);
	await activateLocale(locale);
}
