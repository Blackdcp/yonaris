interface SignalFieldProps {
	tone?: "ink" | "paper";
	density?: "hero" | "section";
	className?: string;
}

export function SignalField({ tone = "ink", density = "hero", className = "" }: SignalFieldProps) {
	const line = tone === "ink" ? "#8A95A3" : "#2F3E50";
	const marker = tone === "ink" ? "#F6F4F1" : "#0B1220";
	const count = density === "hero" ? 19 : 11;

	return (
		<svg aria-hidden="true" viewBox="0 0 900 900" preserveAspectRatio="xMidYMid slice" className={`marketing-signal-field size-full ${className}`}>
			<g fill="none" stroke={line} strokeLinecap="square">
				{Array.from({ length: count }, (_, index) => {
					const offset = index * (density === "hero" ? 31 : 46);
					const strong = index === 5 || index === 12;
					return (
						<path
							key={offset}
							className="marketing-signal-path"
							d={`M ${-280 + offset} 980 C ${70 + offset * 0.32} 770, ${315 + offset * 0.16} 655, ${520 + offset * 0.08} ${520 - index * 4} C ${625 + offset * 0.08} ${452 - index * 7}, ${675 + index * 8} ${330 - index * 5}, ${690 + index * 6} ${205 - index * 4} Q ${692 + index * 6} ${174 - index * 4}, ${724 + index * 6} ${174 - index * 4} H 980`}
							strokeOpacity={strong ? 0.62 : index % 3 === 0 ? 0.3 : 0.16}
							strokeWidth={strong ? 1.15 : index % 3 === 0 ? 0.75 : 0.55}
							style={{ animationDelay: `${70 + index * 22}ms` }}
						/>
					);
				})}
			</g>
			<g className="marketing-condition-markers" stroke={marker} strokeLinecap="square">
				<path d="M503 574v38" strokeWidth="2.2" />
				<path d="M540 522v54" strokeWidth="1.8" />
				<path d="M580 466v35" strokeWidth="1.5" />
			</g>
			<g className="marketing-evidence-anchors" stroke="#FF6A00" strokeLinecap="square">
				<path d="M726 198v58" strokeWidth="2.2" />
				<path d="M636 608v70" strokeWidth="2" />
			</g>
		</svg>
	);
}
