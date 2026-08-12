type ZonedDateTimeParts = {
	year: number;
	month: number;
	day: number;
	hour: number;
	minute: number;
};

function assertIanaTimezone(timezone: string): string {
	try {
		new Intl.DateTimeFormat("en-CA", { timeZone: timezone }).format();
		return timezone;
	} catch {
		throw new Error(`Invalid Program timezone "${timezone}".`);
	}
}

function zonedDateTimeParts(date: Date, timezone: string): ZonedDateTimeParts {
	const parts = new Intl.DateTimeFormat("en-CA", {
		timeZone: timezone,
		year: "numeric",
		month: "2-digit",
		day: "2-digit",
		hour: "2-digit",
		minute: "2-digit",
		hourCycle: "h23",
	}).formatToParts(date);
	const value = (type: Intl.DateTimeFormatPartTypes) => Number(parts.find((part) => part.type === type)?.value);
	return {
		year: value("year"),
		month: value("month"),
		day: value("day"),
		hour: value("hour"),
		minute: value("minute"),
	};
}

function parseLocalDateTimeValue(value: string): ZonedDateTimeParts {
	const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/.exec(value);
	if (!match) throw new Error("Enter a complete date and time.");
	const [, year, month, day, hour, minute] = match;
	const parsed = {
		year: Number(year),
		month: Number(month),
		day: Number(day),
		hour: Number(hour),
		minute: Number(minute),
	};
	const normalized = new Date(Date.UTC(parsed.year, parsed.month - 1, parsed.day, parsed.hour, parsed.minute));
	if (
		normalized.getUTCFullYear() !== parsed.year ||
		normalized.getUTCMonth() + 1 !== parsed.month ||
		normalized.getUTCDate() !== parsed.day ||
		normalized.getUTCHours() !== parsed.hour ||
		normalized.getUTCMinutes() !== parsed.minute
	) {
		throw new Error("Enter a valid calendar date and time.");
	}
	return parsed;
}

function sameZonedDateTime(left: ZonedDateTimeParts, right: ZonedDateTimeParts): boolean {
	return (
		left.year === right.year &&
		left.month === right.month &&
		left.day === right.day &&
		left.hour === right.hour &&
		left.minute === right.minute
	);
}

/** Format an instant for a `datetime-local` input in a Program's IANA timezone. */
export function formatZonedDateTimeInput(date: Date, timezone: string): string {
	const parts = zonedDateTimeParts(date, assertIanaTimezone(timezone));
	const pad = (value: number) => String(value).padStart(2, "0");
	return `${parts.year}-${pad(parts.month)}-${pad(parts.day)}T${pad(parts.hour)}:${pad(parts.minute)}`;
}

/**
 * Convert a timezone-free `datetime-local` value into its unique instant in a
 * Program timezone. Invalid and DST-ambiguous wall times are rejected so the
 * frozen measurement window never depends on the administrator's browser.
 */
export function parseZonedDateTimeInput(value: string, timezone: string): Date {
	const resolvedTimezone = assertIanaTimezone(timezone);
	const requested = parseLocalDateTimeValue(value);
	const wallClockMillis = Date.UTC(
		requested.year,
		requested.month - 1,
		requested.day,
		requested.hour,
		requested.minute,
	);
	const offsets = new Set<number>();
	for (let hourDelta = -36; hourDelta <= 36; hourDelta += 6) {
		const sampleMillis = wallClockMillis + hourDelta * 60 * 60 * 1_000;
		const sample = new Date(sampleMillis);
		const local = zonedDateTimeParts(sample, resolvedTimezone);
		const representedAsUtc = Date.UTC(local.year, local.month - 1, local.day, local.hour, local.minute);
		offsets.add(representedAsUtc - sampleMillis);
	}
	const matches = [...offsets]
		.map((offset) => new Date(wallClockMillis - offset))
		.filter((candidate) => sameZonedDateTime(zonedDateTimeParts(candidate, resolvedTimezone), requested));
	if (matches.length === 0) {
		throw new Error(`This local time does not exist in ${resolvedTimezone}. Choose another time.`);
	}
	if (matches.length > 1) {
		throw new Error(`This local time occurs twice in ${resolvedTimezone}. Choose an unambiguous time.`);
	}
	return matches[0];
}
