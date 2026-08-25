import { useEffect, useState } from "react";

function readScrollProgress() {
	const scrollable = document.documentElement.scrollHeight - window.innerHeight;
	if (scrollable <= 0) return 1;
	return Math.min(1, Math.max(0, window.scrollY / scrollable));
}

export function ScrollProgress() {
	const [progress, setProgress] = useState(0);

	useEffect(() => {
		let frame = 0;
		const update = () => {
			if (frame) return;
			frame = window.requestAnimationFrame(() => {
				frame = 0;
				setProgress(readScrollProgress());
			});
		};

		update();
		window.addEventListener("scroll", update, { passive: true });
		window.addEventListener("resize", update);
		return () => {
			window.removeEventListener("scroll", update);
			window.removeEventListener("resize", update);
			if (frame) window.cancelAnimationFrame(frame);
		};
	}, []);

	return (
		<div className="sf-scroll-progress" data-scroll-progress="page" aria-hidden="true">
			<span style={{ transform: `scaleX(${progress})` }} />
		</div>
	);
}
