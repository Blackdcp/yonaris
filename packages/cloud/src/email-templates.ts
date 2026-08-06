/**
 * Transactional email templates for cloud auth flows.
 *
 * Pure template functions — no I/O — so they're unit-testable without
 * mocking Resend. All interpolated user-controlled strings (inviter name,
 * organization name) are HTML-escaped before landing in markup.
 */
import { DEFAULT_APP_NAME, YONARIS_COLORS } from "@workspace/config/constants";

export interface EmailContent {
	subject: string;
	html: string;
	text: string;
}

function escapeHtml(value: string): string {
	return value
		.replace(/&/g, "&amp;")
		.replace(/</g, "&lt;")
		.replace(/>/g, "&gt;")
		.replace(/"/g, "&quot;")
		.replace(/'/g, "&#39;");
}

function wrapHtml(heading: string, sentence: string, url: string): string {
	return `
		<div style="background-color: ${YONARIS_COLORS.paper}; padding: 32px 16px;">
			<div style="font-family: Inter, Arial, sans-serif; max-width: 520px; margin: 0 auto; color: ${YONARIS_COLORS.ink};">
				<div style="font-size: 24px; font-weight: 600; letter-spacing: -0.03em; margin-bottom: 24px;">${DEFAULT_APP_NAME}</div>
				<div style="background-color: #fffefa; border: 1px solid ${YONARIS_COLORS.mist}; border-top: 3px solid ${YONARIS_COLORS.signal}; border-radius: 8px; padding: 32px;">
					<h1 style="font-size: 22px; line-height: 1.25; margin: 0 0 14px;">${heading}</h1>
					<p style="color: ${YONARIS_COLORS.blueGray}; font-size: 15px; line-height: 1.6; margin: 0 0 24px;">${sentence}</p>
					<p style="margin: 0 0 24px;">
						<a href="${url}" style="display: inline-block; padding: 11px 20px; background-color: ${YONARIS_COLORS.ink}; color: ${YONARIS_COLORS.paper}; text-decoration: none; border-radius: 5px; font-size: 14px; font-weight: 600;">
							Continue
						</a>
					</p>
					<p style="border-top: 1px solid ${YONARIS_COLORS.mist}; color: #66717e; font-size: 12px; line-height: 1.5; margin: 0; padding-top: 18px; word-break: break-all;">
						If the button doesn't work, copy and paste this link into your browser: ${url}
					</p>
				</div>
				<p style="color: ${YONARIS_COLORS.stone}; font-size: 11px; letter-spacing: 0.08em; margin: 20px 0 0; text-transform: uppercase;">Finite truths. Recursive growth.</p>
			</div>
		</div>
	`.trim();
}

export function verificationEmail(input: { url: string }): EmailContent {
	const { url } = input;
	return {
		subject: "Verify your email address",
		html: wrapHtml(
			"Verify your email address",
			"Click the button below to verify your email and finish signing up.",
			url,
		),
		text: `Verify your email address by visiting this link: ${url}`,
	};
}

export function passwordResetEmail(input: { url: string }): EmailContent {
	const { url } = input;
	return {
		subject: `Reset your ${DEFAULT_APP_NAME} password`,
		html: wrapHtml("Reset your password", "Click the button below to choose a new password.", url),
		text: `Reset your ${DEFAULT_APP_NAME} password by visiting this link: ${url}`,
	};
}

export function invitationEmail(input: { inviterName: string; orgName: string; url: string }): EmailContent {
	const { inviterName, orgName, url } = input;
	const safeInviterName = escapeHtml(inviterName);
	const safeOrgName = escapeHtml(orgName);
	return {
		subject: `${inviterName} invited you to ${orgName} on ${DEFAULT_APP_NAME}`,
		html: wrapHtml(
			`You've been invited to join ${safeOrgName}`,
			`${safeInviterName} invited you to join ${safeOrgName} on ${DEFAULT_APP_NAME}. Click the button below to accept.`,
			url,
		),
		text: `${inviterName} invited you to join ${orgName} on ${DEFAULT_APP_NAME}. Accept the invitation here: ${url}`,
	};
}
