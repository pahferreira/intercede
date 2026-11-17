import {
	type Icon,
	IconAlertCircle,
	IconAlertTriangle,
	IconArrowUp,
	IconCandle,
	IconCheck,
	IconChevronDown,
	IconCopy,
	IconFlame,
	IconHeartHandshake,
	IconLanguage,
	IconPray,
	IconRefresh,
	IconWifiOff,
	IconX,
} from "@tabler/icons-react";
import type { ReactNode } from "react";
import appIcon from "../assets/logos/intercede-app-icon.svg";
import lockupOnDark from "../assets/logos/intercede-lockup-on-dark.svg";
import lockupOnLight from "../assets/logos/intercede-lockup-on-light.svg";
import markOnDark from "../assets/logos/intercede-mark-on-dark.svg";
import markOnLight from "../assets/logos/intercede-mark-on-light.svg";

const colours = [
	{ name: "violet", className: "bg-violet" },
	{ name: "violet-raised", className: "bg-violet-raised" },
	{ name: "violet-sunken", className: "bg-violet-sunken" },
	{ name: "line", className: "bg-line" },
	{ name: "line-strong", className: "bg-line-strong" },
	{ name: "ivory", className: "bg-ivory" },
	{ name: "ivory-muted", className: "bg-ivory-muted" },
	{ name: "ivory-subtle", className: "bg-ivory-subtle" },
	{ name: "ivory-tint", className: "bg-ivory-tint" },
	{ name: "ivory-tint-strong", className: "bg-ivory-tint-strong" },
	{ name: "flame", className: "bg-flame" },
	{ name: "flame-hover", className: "bg-flame-hover" },
	{ name: "flame-pressed", className: "bg-flame-pressed" },
	{ name: "flame-tint", className: "bg-flame-tint" },
	{ name: "on-flame", className: "bg-on-flame" },
	{ name: "on-ivory", className: "bg-on-ivory" },
	{ name: "success", className: "bg-success" },
	{ name: "notice", className: "bg-notice" },
	{ name: "danger", className: "bg-danger" },
	{ name: "focus-ring", className: "bg-focus-ring" },
] as const;

const typeStyles = [
	{ name: "display-xl", className: "text-display-xl", sample: "Intercede" },
	{ name: "display", className: "text-display", sample: "Intercede" },
	{ name: "eyebrow", className: "text-eyebrow", sample: "Welcome to" },
	{
		name: "title",
		className: "text-title",
		sample: "What's in your heart to pray for today?",
	},
	{
		name: "heading",
		className: "text-heading",
		sample: "You committed to pray for these intentions",
	},
	{
		name: "body-lg",
		className: "text-body-lg",
		sample: "Please pray for my mother's surgery on Thursday.",
	},
	{
		name: "body",
		className: "text-body",
		sample: "These are still waiting for prayer.",
	},
	{ name: "label", className: "text-label", sample: "I commit!" },
	{
		name: "small",
		className: "text-small",
		sample: "Fits because you mentioned family health.",
	},
	{
		name: "caption",
		className: "text-caption uppercase",
		sample: "Intention #A3F9",
	},
] as const;

const shadows = [
	{ name: "shadow-sm", className: "shadow-sm" },
	{ name: "shadow-md", className: "shadow-md" },
	{ name: "shadow-lg", className: "shadow-lg" },
	{ name: "shadow-flame", className: "shadow-flame" },
] as const;

const radii = [
	{ name: "radius-sm", className: "rounded-sm" },
	{ name: "radius-md", className: "rounded-md" },
	{ name: "radius-lg", className: "rounded-lg" },
] as const;

const motions = [
	{ name: "duration-fast", className: "duration-fast ease-out" },
	{ name: "duration-base", className: "duration-base ease-out" },
	{ name: "duration-slow", className: "duration-slow ease-out" },
	{ name: "ease-out", className: "duration-slow ease-out" },
	{ name: "ease-in-out", className: "duration-slow ease-in-out" },
] as const;

const logos = [
	{ name: "intercede-app-icon", src: appIcon, ground: "bg-violet" },
	{ name: "intercede-mark-on-dark", src: markOnDark, ground: "bg-violet" },
	{ name: "intercede-mark-on-light", src: markOnLight, ground: "bg-ivory" },
	{ name: "intercede-lockup-on-dark", src: lockupOnDark, ground: "bg-violet" },
	{
		name: "intercede-lockup-on-light",
		src: lockupOnLight,
		ground: "bg-ivory",
	},
] as const;

const interfaceIcons = [
	{ name: "IconArrowUp", Icon: IconArrowUp },
	{ name: "IconCopy", Icon: IconCopy },
	{ name: "IconCheck", Icon: IconCheck },
	{ name: "IconAlertCircle", Icon: IconAlertCircle },
	{ name: "IconAlertTriangle", Icon: IconAlertTriangle },
	{ name: "IconRefresh", Icon: IconRefresh },
	{ name: "IconWifiOff", Icon: IconWifiOff },
	{ name: "IconLanguage", Icon: IconLanguage },
	{ name: "IconX", Icon: IconX },
	{ name: "IconChevronDown", Icon: IconChevronDown },
] as const;

const faithIcons = [
	{ name: "IconCandle", Icon: IconCandle },
	{ name: "IconFlame", Icon: IconFlame },
	{ name: "IconPray", Icon: IconPray },
	{ name: "IconHeartHandshake", Icon: IconHeartHandshake },
] as const;

function Section({ title, children }: { title: string; children: ReactNode }) {
	return (
		<section className="flex flex-col gap-space-4">
			<h2 className="text-heading">{title}</h2>
			{children}
		</section>
	);
}

function Token({ name, children }: { name: string; children: ReactNode }) {
	return (
		<figure aria-label={name} className="flex flex-col gap-space-2">
			{children}
			<figcaption className="text-small text-ivory-muted">{name}</figcaption>
		</figure>
	);
}

function IconGrid({
	icons,
}: {
	icons: ReadonlyArray<{ name: string; Icon: Icon }>;
}) {
	return (
		<div className="grid grid-cols-2 gap-space-4 md:grid-cols-4">
			{icons.map(({ name, Icon }) => (
				<Token key={name} name={name}>
					<Icon size={24} stroke={2} aria-hidden />
				</Token>
			))}
		</div>
	);
}

export function DesignSystem() {
	return (
		<div className="mx-auto flex max-w-column-chat flex-col gap-space-6 py-space-5">
			<h1 className="text-title">Design system</h1>

			<Section title="Logo">
				<div className="grid grid-cols-1 gap-space-4 md:grid-cols-2">
					{logos.map(({ name, src, ground }) => (
						<Token key={name} name={name}>
							<div
								className={`flex justify-center rounded-lg border-2 border-line p-space-5 ${ground}`}
							>
								<img src={src} alt="" className="h-space-8" />
							</div>
						</Token>
					))}
				</div>
			</Section>

			<Section title="Icons">
				<p className="text-small text-ivory-muted">
					Tabler outline, 2px stroke, currentColor: 20px beside text, 24px
					alone.
				</p>
				<h3 className="text-label">Interface</h3>
				<IconGrid icons={interfaceIcons} />
				<h3 className="text-label">Faith</h3>
				<IconGrid icons={faithIcons} />
			</Section>

			<Section title="Colour">
				<div className="grid grid-cols-2 gap-space-4 md:grid-cols-4">
					{colours.map(({ name, className }) => (
						<Token key={name} name={name}>
							<div
								className={`h-control-lg rounded-md border-2 border-line ${className}`}
							/>
						</Token>
					))}
				</div>
			</Section>

			<Section title="Type">
				<div className="flex flex-col gap-space-5">
					{typeStyles.map(({ name, className, sample }) => (
						<Token key={name} name={name}>
							<p className={className}>{sample}</p>
						</Token>
					))}
				</div>
			</Section>

			<Section title="Shadow">
				<div className="grid grid-cols-2 gap-space-5 md:grid-cols-4">
					{shadows.map(({ name, className }) => (
						<Token key={name} name={name}>
							<div
								className={`h-control-lg rounded-lg bg-violet-raised ${className}`}
							/>
						</Token>
					))}
				</div>
			</Section>

			<Section title="Radius">
				<div className="grid grid-cols-3 gap-space-4">
					{radii.map(({ name, className }) => (
						<Token key={name} name={name}>
							<div
								className={`h-control-lg border-2 border-line-strong bg-violet-raised ${className}`}
							/>
						</Token>
					))}
				</div>
			</Section>

			<Section title="Motion">
				<p className="text-small text-ivory-muted">
					Hover a row to play its transition.
				</p>
				<div className="flex flex-col gap-space-3">
					{motions.map(({ name, className }) => (
						<Token key={name} name={name}>
							<div className="group rounded-md border-2 border-line p-space-1">
								<div
									className={`size-control-md rounded-sm bg-flame transition-transform group-hover:translate-x-space-8 motion-reduce:transition-none ${className}`}
								/>
							</div>
						</Token>
					))}
				</div>
			</Section>
		</div>
	);
}
