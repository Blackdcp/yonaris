export function operatorGuidance(code: string): string {
	switch (code) {
		case "signed_out":
			return "Please sign in in the preserved browser tab, then resume that exact task.";
		case "captcha":
			return "Complete the verification in the preserved browser tab, then recover this exact task.";
		case "rate_limited":
			return "Keep the preserved tab open. Wait until the limit clears, then recover this exact task; do not resend the prompt.";
		case "response_timeout":
			return "Keep the completed answer open, then recover this exact task without resending the prompt.";
		case "recovery_tab_unavailable":
			return "Open the exact stopped conversation tab, then press Recover response again.";
		case "resume_authorization_failed":
			return "Refresh the Portal connection, then retry this same recovery; no prompt was resent.";
		case "resume_claim_mismatch":
			return "Stop and ask an administrator to inspect this task; its frozen task identity did not match.";
		case "local_journal_persistence_failed":
			return "Keep the preserved tab open and ask an administrator to repair the local task journal before retrying.";
		case "account_restricted":
			return "This account is restricted. No further tasks will be submitted.";
		case "page_drift":
			return "The consumer page changed. Keep the stopped tab open and ask an administrator to re-qualify this platform.";
		default:
			return "Keep the stopped tab open and ask an administrator to inspect this exact task.";
	}
}
