import type { ReactNode } from "react";

const colours = [
	["violet", "bg-violet"],
	["violet-raised", "bg-violet-raised"],
	["violet-sunken", "bg-violet-sunken"],
	["line", "bg-line"],
	["line-strong", "bg-line-strong"],
	["ivory", "bg-ivory"],
	["ivory-muted", "bg-ivory-muted"],
	["ivory-subtle", "bg-ivory-subtle"],
	["ivory-tint", "bg-ivory-tint"],
	["ivory-tint-strong", "bg-ivory-tint-strong"],
	["flame", "bg-flame"],
	["flame-hover", "bg-flame-hover"],
	["flame-pressed", "bg-flame-pressed"],
	["flame-tint", "bg-flame-tint"],
	["on-flame", "bg-on-flame"],
	["on-ivory", "bg-on-ivory"],
	["success", "bg-success"],
	["notice", "bg-notice"],
	["danger", "bg-danger"],
	["focus-ring", "bg-focus-ring"],
] as const;

const typeStyles = [
	["display-xl", "text-display-xl", "Intercede"],
	["display", "text-display", "Intercede"],
	["eyebrow", "text-eyebrow", "Welcome to"],
	["title", "text-title", "What's in your heart to pray for today?"],
	["heading", "text-heading", "You committed to pray for these intentions"],
	[
		"body-lg",
		"text-body-lg",
		"Please pray for my mother's surgery on Thursday.",
	],
	["body", "text-body", "These are still waiting for prayer."],
	["label", "text-label", "I commit!"],
	["small", "text-small", "Fits because you mentioned family health."],
	["caption", "text-caption uppercase", "Intention #A3F9"],
] as const;

const shadows = [
	["shadow-sm", "shadow-sm"],
	["shadow-md", "shadow-md"],
	["shadow-lg", "shadow-lg"],
	["shadow-flame", "shadow-flame"],
] as const;

const radii = [
	["radius-sm", "rounded-sm"],
	["radius-md", "rounded-md"],
	["radius-lg", "rounded-lg"],
] as const;

const motions = [
	["duration-fast", "duration-fast ease-out"],
	["duration-base", "duration-base ease-out"],
	["duration-slow", "duration-slow ease-out"],
	["ease-out", "duration-slow ease-out"],
	["ease-in-out", "duration-slow ease-in-out"],
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

export function DesignSystem() {
	return (
		<div className="mx-auto flex max-w-column-chat flex-col gap-space-6 py-space-5">
			<h1 className="text-title">Design system</h1>

			<Section title="Colour">
				<div className="grid grid-cols-2 gap-space-4 md:grid-cols-4">
					{colours.map(([name, className]) => (
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
					{typeStyles.map(([name, className, sample]) => (
						<Token key={name} name={name}>
							<p className={className}>{sample}</p>
						</Token>
					))}
				</div>
			</Section>

			<Section title="Shadow">
				<div className="grid grid-cols-2 gap-space-5 md:grid-cols-4">
					{shadows.map(([name, className]) => (
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
					{radii.map(([name, className]) => (
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
					{motions.map(([name, className]) => (
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
