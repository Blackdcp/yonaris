import { useState } from "react";
import { buildDiagnosticMailto, type DiagnosticInput, type Locale, validateDiagnosticInput } from "@/lib/marketing-content";

const fieldCopy = {
	en: {
		brand: ["Brand", "Your brand or company"],
		website: ["Website", "https://example.com"],
		market: ["Market or category", "What market are you competing in?"],
		competitors: ["Known competitors", "Names or URLs, separated by commas"],
		question: ["One question that matters", "What should an AI system be able to answer about your market or brand?"],
		name: ["Your name", "Name"],
		email: ["Work email", "you@company.com"],
		error: "Complete the required fields with a valid website and email.",
		submit: "Get a Free Diagnostic",
	},
	zh: {
		brand: ["品牌", "你的品牌或公司"],
		website: ["官网", "https://example.com"],
		market: ["市场或品类", "你正在参与哪个市场的竞争？"],
		competitors: ["主要竞品", "名称或网址，用逗号分隔"],
		question: ["一个真正重要的问题", "你希望 AI 能够正确回答哪个关于市场或品牌的问题？"],
		name: ["你的姓名", "姓名"],
		email: ["工作邮箱", "you@company.com"],
		error: "请完整填写必填项，并检查官网和邮箱格式。",
		submit: "获取免费诊断",
	},
} as const;

function inputFromForm(form: HTMLFormElement): DiagnosticInput {
	const data = new FormData(form);
	return {
		brand: String(data.get("brand") ?? ""),
		website: String(data.get("website") ?? ""),
		market: String(data.get("market") ?? ""),
		competitors: String(data.get("competitors") ?? ""),
		question: String(data.get("question") ?? ""),
		name: String(data.get("name") ?? ""),
		email: String(data.get("email") ?? ""),
	};
}

export function DiagnosticForm({ locale, initialWebsite = "" }: { locale: Locale; initialWebsite?: string }) {
	const copy = fieldCopy[locale];
	const [invalidFields, setInvalidFields] = useState<(keyof DiagnosticInput)[]>([]);

	function submit(event: React.FormEvent<HTMLFormElement>) {
		event.preventDefault();
		const input = inputFromForm(event.currentTarget);
		const errors = validateDiagnosticInput(input);
		setInvalidFields(errors);
		if (errors.length > 0) {
			requestAnimationFrame(() => document.getElementById(`diagnostic-${errors[0]}`)?.focus());
			return;
		}
		window.location.href = buildDiagnosticMailto(input, locale);
	}

	const inputClass = "mt-3 min-h-12 w-full border border-[var(--yonaris-ink)]/18 bg-transparent px-4 text-base text-[var(--yonaris-ink)] outline-none transition-colors placeholder:text-[var(--yonaris-stone)] focus:border-[var(--yonaris-signal-strong)] focus:ring-1 focus:ring-[var(--yonaris-signal-strong)]";

	return (
		<form onSubmit={submit} noValidate className="border-t border-[var(--yonaris-ink)]/18 pt-8" aria-describedby="diagnostic-disclosure diagnostic-error">
			<div className="grid gap-x-6 gap-y-7 sm:grid-cols-2">
				{(["brand", "website", "market", "competitors"] as const).map((field) => (
					<label key={field} className="text-xs font-medium text-[var(--yonaris-slate)]">
						{copy[field][0]}{field === "brand" || field === "website" ? <span className="ml-1 text-[var(--yonaris-signal-strong)]">*</span> : null}
						<input id={`diagnostic-${field}`} name={field} type={field === "website" ? "url" : "text"} required={field === "brand" || field === "website"} defaultValue={field === "website" ? initialWebsite : undefined} placeholder={copy[field][1]} aria-invalid={invalidFields.includes(field)} className={inputClass} />
					</label>
				))}
				<label className="text-xs font-medium text-[var(--yonaris-slate)] sm:col-span-2">
					{copy.question[0]}<span className="ml-1 text-[var(--yonaris-signal-strong)]">*</span>
					<textarea id="diagnostic-question" name="question" required rows={5} placeholder={copy.question[1]} aria-invalid={invalidFields.includes("question")} className={`${inputClass} resize-y py-3`} />
				</label>
				{(["name", "email"] as const).map((field) => (
					<label key={field} className="text-xs font-medium text-[var(--yonaris-slate)]">
						{copy[field][0]}<span className="ml-1 text-[var(--yonaris-signal-strong)]">*</span>
						<input id={`diagnostic-${field}`} name={field} type={field === "email" ? "email" : "text"} required placeholder={copy[field][1]} aria-invalid={invalidFields.includes(field)} className={inputClass} />
					</label>
				))}
			</div>
			<p id="diagnostic-error" role="alert" className={`mt-6 text-sm text-[#9f290f] ${invalidFields.length > 0 ? "block" : "hidden"}`}>{copy.error}</p>
			<div className="mt-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
				<button type="submit" className="inline-flex min-h-12 items-center justify-center gap-3 border border-[var(--yonaris-signal-strong)] bg-[var(--yonaris-signal-strong)] px-5 text-xs font-medium text-white transition-colors hover:border-[var(--yonaris-ink)] hover:bg-[var(--yonaris-ink)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--yonaris-signal-strong)] focus-visible:ring-offset-3">
					{copy.submit}
					<svg aria-hidden="true" viewBox="0 0 16 16" fill="none" className="size-3.5"><path d="M4 12 12 4M6.5 4H12v5.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="square" /></svg>
				</button>
				<p id="diagnostic-disclosure" className="max-w-md text-xs leading-5 text-[var(--yonaris-slate)]/58">{locale === "zh" ? "提交后会打开你的邮件客户端；只有你发送邮件后，申请才会真正发出。" : "This opens your email client. Nothing is sent until you send the email."}</p>
			</div>
		</form>
	);
}
