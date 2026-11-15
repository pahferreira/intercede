import { useLingui } from "@lingui/react";
import { type Locale, locales, sourceLocale, switchLocale } from "./i18n";

const languageNames: Record<Locale, string> = {
	en: "English",
	"pt-BR": "Português",
};

export function LanguageToggle() {
	const { i18n } = useLingui();
	const next = locales.find((locale) => locale !== i18n.locale) ?? sourceLocale;

	return (
		<button
			type="button"
			lang={next}
			onClick={() => switchLocale(next)}
			className="rounded-full border border-current px-3 py-1 text-sm"
		>
			{languageNames[next]}
		</button>
	);
}
