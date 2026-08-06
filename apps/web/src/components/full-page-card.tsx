import { Link } from "@tanstack/react-router";
import { Button } from "@workspace/ui/components/button";
import { Card, CardContent, CardHeader, CardTitle } from "@workspace/ui/components/card";
import { Separator } from "@workspace/ui/components/separator";
import type { ReactNode } from "react";
import { BrandPaths } from "@/brand/brand-paths";
import { Logo } from "@/components/logo";

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
	backButtonText = "Go Back",
	customBackButton,
	className = "w-md",
}: FullPageCardProps) {
	return (
		<div
			data-slot="full-page-shell"
			className="relative flex min-h-screen items-center justify-center overflow-hidden bg-muted/30 p-4"
		>
			<aside data-slot="full-page-brand" className="relative hidden overflow-hidden">
				<BrandPaths />
				<div data-slot="full-page-brand-copy">
					<Logo className="relative z-10" />
					<p className="yonaris-brand-statement">Finite truths. Recursive growth.</p>
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
								{title && <CardTitle className="text-xl">{title}</CardTitle>}
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
								<Link to={backButtonHref}>{backButtonText}</Link>
							</Button>
						</div>
					) : null}
				</div>
			</main>
		</div>
	);
}
