import { useLingui } from "@lingui/react/macro";
import { type Locale, locales, switchLocale } from "./i18n";

const languages: Record<Locale, { name: string; short: string }> = {
	en: { name: "English", short: "EN" },
	"pt-BR": { name: "Português", short: "PT" },
};

export function LanguageToggle() {
	const { i18n, t } = useLingui();

	return (
		<fieldset aria-label={t`Language`} className="flex h-control-md">
			{locales.map((locale) => {
				const selected = locale === i18n.locale;
				return (
					<button
						key={locale}
						type="button"
						lang={locale}
						aria-label={languages[locale].name}
						aria-pressed={selected}
						onClick={() => switchLocale(locale)}
						className={`border-2 border-line-strong px-space-4 text-small first:rounded-l-md last:rounded-r-md not-first:border-l-0 font-bold transition-colors duration-fast ease-out ${
							selected
								? "bg-ivory text-on-ivory"
								: "text-ivory-muted hover:bg-ivory-tint"
						}`}
					>
						{languages[locale].short}
					</button>
				);
			})}
		</fieldset>
	);
}
