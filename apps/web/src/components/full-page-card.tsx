import { Link } from "@tanstack/react-router";
import { Button } from "@workspace/ui/components/button";
import { Card, CardContent, CardHeader } from "@workspace/ui/components/card";
import { Separator } from "@workspace/ui/components/separator";
import type { ReactNode } from "react";
import { BrandPaths } from "@/brand/brand-paths";
import { LanguageSwitcher } from "@/components/language-switcher";
import { Logo } from "@/components/logo";
import { useI18n } from "@/i18n/provider";

interface FullPageCardProps {
	title?: string;
	subtitle?: string;
	children?: ReactNode;
	showBackButton?: boolean;
	backButtonHref?: string;
	backButtonText?: string;
	customBackButton?: ReactNode;
	className?: string;
}

export default function FullPageCard({
	title,
	subtitle,
	children = undefined,
	showBackButton = false,
	backButtonHref = "/app",
	backButtonText,
	customBackButton,
	className = "w-md",
}: FullPageCardProps) {
	const { t } = useI18n();
	const capabilities = [
		t("fullPage.brand.productEvidence"),
		t("fullPage.brand.decisionContext"),
		t("fullPage.brand.answerSignals"),
		t("fullPage.brand.marketLearning"),
	];

	return (
		<div
			data-slot="full-page-shell"
			className="relative flex min-h-screen items-center justify-center overflow-hidden bg-muted/30 p-4"
		>
			<div className="absolute right-4 top-4 z-10">
				<LanguageSwitcher />
			</div>
			<aside data-slot="full-page-brand" className="relative hidden overflow-hidden">
				<BrandPaths />
				<div data-slot="full-page-brand-header">
					<Logo surface="dark" />
				</div>
				<div data-slot="full-page-brand-copy">
					<h2 data-slot="full-page-brand-title">{t("fullPage.brand.title")}</h2>
					<div data-slot="full-page-brand-capabilities">
						{capabilities.map((capability) => (
							<span key={capability}>{capability}</span>
						))}
					</div>
				</div>
			</aside>

			<main data-slot="full-page-stage" className="flex w-full items-center justify-center">
				<div data-slot="full-page-content" className={`mx-auto ${className}`}>
					<div data-slot="full-page-form-logo" className="mb-6 flex justify-center">
						<Logo />
					</div>
					<Card data-yonaris-slot="full-page-card">
						{(title || subtitle) && (
							<CardHeader className="grid-rows-1 gap-1 px-0">
								{title && (
									<h1 data-slot="card-title" className="text-xl leading-none font-semibold">
										{title}
									</h1>
								)}
								{subtitle && <p className="text-sm text-muted-foreground">{subtitle}</p>}
							</CardHeader>
						)}
						{children && (
							<>
								{(title || subtitle) && <Separator />}
								<CardContent className={title || subtitle ? "px-0" : "flex flex-col items-center space-y-6 px-0 py-4"}>
									{children}
								</CardContent>
							</>
						)}
					</Card>
					{customBackButton ? (
						<div data-slot="full-page-back" className="flex justify-start">
							{customBackButton}
						</div>
					) : showBackButton ? (
						<div data-slot="full-page-back" className="flex justify-start">
							<Button variant="ghost" size="sm" asChild>
								<Link to={backButtonHref}>{backButtonText ?? t("common.goBack")}</Link>
							</Button>
						</div>
					) : null}
				</div>
			</main>
		</div>
	);
}
