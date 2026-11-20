import type { EvalEntry } from "./evaluate";

export const entries: EvalEntry[] = [
	{
		text: "people fighting cancer",
		language: "en",
		relevant: ["en-mother-cancer"],
	},
	{
		text: "someone facing surgery",
		language: "en",
		relevant: ["en-father-surgery"],
	},
	{ text: "those looking for work", language: "en", relevant: ["en-son-job"] },
	{
		text: "families struggling with money",
		language: "en",
		relevant: ["en-debt", "en-son-job"],
	},
	{
		text: "marriages in trouble",
		language: "en",
		relevant: ["en-marriage", "en-divorce-kids"],
	},
	{
		text: "people grieving a loss",
		language: "en",
		relevant: ["en-grief-wife", "en-miscarriage"],
	},
	{
		text: "couples who want to have children",
		language: "en",
		relevant: ["en-infertility", "en-miscarriage"],
	},
	{
		text: "students preparing for exams",
		language: "en",
		relevant: ["en-exams"],
	},
	{ text: "mental health", language: "en", relevant: ["en-anxiety"] },
	{ text: "addiction", language: "en", relevant: ["en-addiction"] },
	{
		text: "young people who left the church",
		language: "en",
		relevant: ["en-faith-return"],
	},
	{ text: "loneliness", language: "en", relevant: ["en-lonely"] },
	{
		text: "safety for travellers and soldiers",
		language: "en",
		relevant: ["en-travel", "en-soldier"],
	},
	{ text: "pessoas com câncer", language: "pt", relevant: ["pt-mae-cancer"] },
	{
		text: "doentes no hospital",
		language: "pt",
		relevant: ["pt-avo-uti", "pt-cirurgia-filho"],
	},
	{ text: "quem está sem emprego", language: "pt", relevant: ["pt-emprego"] },
	{
		text: "problemas financeiros",
		language: "pt",
		relevant: ["pt-dividas", "pt-emprego"],
	},
	{
		text: "famílias em crise",
		language: "pt",
		relevant: ["pt-casamento", "pt-filho-drogas"],
	},
	{ text: "quem perdeu alguém", language: "pt", relevant: ["pt-luto-pai"] },
	{
		text: "gestantes e bebês",
		language: "pt",
		relevant: ["pt-gravidez-risco"],
	},
	{
		text: "estudantes e provas",
		language: "pt",
		relevant: ["pt-enem", "pt-concurso"],
	},
	{
		text: "saúde mental",
		language: "pt",
		relevant: ["pt-depressao", "pt-solidao"],
	},
	{
		text: "dependência química",
		language: "pt",
		relevant: ["pt-filho-drogas"],
	},
	{
		text: "filhos afastados da fé",
		language: "pt",
		relevant: ["pt-fe-filha"],
	},
	{ text: "proteção em viagens", language: "pt", relevant: ["pt-viagem"] },
	{ text: "vítimas de desastres", language: "pt", relevant: ["pt-enchentes"] },
	{ text: "crianças doentes", language: "pt", relevant: ["pt-cirurgia-filho"] },
];
