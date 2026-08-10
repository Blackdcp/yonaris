import { Logo } from "./logo";

const DEFAULT_CONTACT_EMAIL = "black.dcp@outlook.com";

function founderContactHref() {
	const email = import.meta.env.VITE_FOUNDER_CONTACT_EMAIL?.trim() || DEFAULT_CONTACT_EMAIL;
	return `mailto:${email}?subject=${encodeURIComponent("Yonaris / 与创始团队交流")}`;
}

function ContactLink() {
	return (
		<a
			href={founderContactHref()}
			className="group inline-flex min-h-11 items-center gap-3 rounded-[6px] border border-[#c94f00] bg-[#c94f00] px-4 text-xs font-medium text-white transition-colors duration-200 hover:border-[#dde2e8] hover:bg-[#f6f4f1] hover:text-[#0b1220] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#f6f4f1] focus-visible:ring-offset-3 focus-visible:ring-offset-[#0b1220]"
		>
			与创始团队交流
			<svg
				aria-hidden="true"
				viewBox="0 0 16 16"
				fill="none"
				className="size-3.5 transition-transform duration-200 group-hover:-translate-y-px group-hover:translate-x-px"
			>
				<path
					d="M4 12 12 4M6.5 4H12v5.5"
					stroke="currentColor"
					strokeWidth="1.5"
					strokeLinecap="square"
					strokeLinejoin="miter"
				/>
			</svg>
		</a>
	);
}

function SignalPaths({ compact = false }: { compact?: boolean }) {
	return (
		<svg
			aria-hidden="true"
			viewBox={compact ? "0 120 780 740" : "0 0 760 820"}
			preserveAspectRatio={compact ? "xMidYMid meet" : "xMidYMid slice"}
			className="absolute inset-0 size-full"
		>
			<g fill="none" stroke="#8a95a3" strokeLinecap="round">
				{Array.from({ length: 12 }, (_, index) => {
					const startX = -260 + index * 54;
					return (
						<path
							key={startX}
							className="yonaris-signal-path"
							d={`M ${startX} 875 C ${80 + index * 28} 690, ${250 + index * 14} 560, ${370 + index * 10} ${478 - index * 8} C ${470 + index * 11} ${402 - index * 12}, ${590 + index * 8} ${284 - index * 7}, 800 ${76 + index * 17}`}
							strokeOpacity={index % 4 === 0 ? 0.22 : 0.12}
							strokeWidth={index % 4 === 0 ? 0.65 : 0.5}
							style={{ animationDelay: `${60 + index * 24}ms` }}
						/>
					);
				})}
			</g>

			<g fill="none" strokeLinecap="round" strokeLinejoin="round">
				{Array.from({ length: 8 }, (_, index) => {
					const startX = -80 + index * 58;
					const endX = 418 + index * 8;
					const endY = 370 - index * 32;
					return (
						<path
							key={startX}
							className="yonaris-signal-path"
							d={`M ${startX} 860 C ${startX + 168} 650, ${270 + index * 18} 520, ${endX - 12} ${endY + 120} C ${endX - 3} ${endY + 82}, ${endX} ${endY + 48}, ${endX} ${endY + 18} Q ${endX} ${endY}, ${endX + 18} ${endY} H 780`}
							stroke={index === 2 || index === 5 ? "#dde2e8" : "#8a95a3"}
							strokeOpacity={index === 2 || index === 5 ? 0.62 : 0.34}
							strokeWidth={index === 2 || index === 5 ? 1.05 : 0.7}
							style={{ animationDelay: `${100 + index * 38}ms` }}
						/>
					);
				})}
			</g>

			<g className="yonaris-evidence-ticks" stroke="#f6f4f1" strokeLinecap="square">
				<path d="M348 462v-30" strokeWidth="2.4" />
				<path d="M374 425v-44" strokeWidth="2.1" />
				<path d="M402 388v-62" strokeWidth="1.7" />
				<path d="M432 350v-44" strokeWidth="1.4" />
			</g>

			<g className="yonaris-signal-ticks" stroke="#ff6a00" strokeLinecap="square">
				<path d="M516 218v44" strokeWidth="2" />
				<path d="M448 542v56" strokeWidth="1.8" />
			</g>
		</svg>
	);
}

export function Homepage() {
	return (
		<div className="yonaris-home flex min-h-[100svh] flex-col overflow-hidden bg-[#0b1220] text-[#f6f4f1]" lang="zh-CN">
			<header className="relative z-20 border-b border-white/10">
				<div className="mx-auto flex h-[4.5rem] max-w-7xl items-center justify-between px-5 sm:px-8 lg:px-10">
					<a href="#thesis" aria-label="Yonaris 首页">
						<Logo variant="white" className="h-7 sm:h-8" />
					</a>
					<ContactLink />
				</div>
			</header>

			<main id="thesis" className="relative flex flex-1 overflow-hidden">
				<div className="pointer-events-none absolute inset-y-0 right-0 hidden w-[64%] md:block">
					<SignalPaths />
				</div>
				<div className="yonaris-mobile-signal pointer-events-none absolute right-0 bottom-0 h-56 w-[56%] overflow-hidden md:hidden">
					<SignalPaths compact />
				</div>

				<div className="yonaris-thesis-layout relative z-10 mx-auto grid w-full max-w-7xl flex-1 items-center px-5 py-12 sm:px-8 sm:py-16 md:grid-cols-12 lg:px-10">
					<div className="yonaris-hero-copy md:col-span-6 lg:col-span-6">
						<p className="max-w-[30rem] text-base leading-7 text-[#f6f4f1]/72 sm:text-xl sm:leading-8">
							AI 进入营销和购买决策之后
						</p>

						<h1 className="yonaris-thesis-title mt-3 text-[clamp(2.2rem,10.8vw,3.6rem)] leading-[1.02] font-medium tracking-[-0.02em] sm:text-[clamp(3.6rem,5.1vw,4.6rem)] lg:text-[clamp(4.1rem,5vw,4.6rem)]">
							<span className="block">新的 MarTech</span>
							<span className="block">正在被重新定义</span>
						</h1>

						<div className="yonaris-thesis-rule mt-7 h-px w-8 bg-[#ff6a00]" />

						<p
							aria-label="Yonaris products"
							className="mt-8 text-[11px] font-medium tracking-[0.045em] text-[#f6f4f1]/72 sm:text-xs"
						>
							<span className="block whitespace-nowrap sm:inline">
								Product Truth
								<span aria-hidden="true" className="mx-3 text-[#ff6a00]">
									·
								</span>
								Market Intent
							</span>
							<span aria-hidden="true" className="mx-3 hidden text-[#ff6a00] sm:inline">
								·
							</span>
							<span className="mt-2 block whitespace-nowrap sm:mt-0 sm:inline">
								Model Intelligence
								<span aria-hidden="true" className="mx-3 text-[#ff6a00]">
									·
								</span>
								Commercial Feedback
							</span>
						</p>
					</div>
				</div>
			</main>

			<footer className="relative z-20 border-t border-white/10 bg-[#0b1220]">
				<div className="mx-auto flex min-h-16 max-w-7xl items-center justify-between gap-5 px-5 py-4 text-[10px] text-[#f6f4f1]/70 sm:px-8 lg:px-10">
					<span>© {new Date().getFullYear()} Yonaris</span>
					<span className="hidden font-mono uppercase tracking-[0.16em] min-[350px]:inline">
						Finite truths. Recursive growth.
					</span>
				</div>
			</footer>
		</div>
	);
}
