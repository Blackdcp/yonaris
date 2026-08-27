# Reviewed consumer cohort import validation fixtures

This directory preserves historical request and validation contracts. The
former `reviewed-consumer-cohort-import` forced-command operation is
permanently rejected by the LAS dispatcher and policy parsers and is not a
production gate. Do not add a production request/policy line, restore its
workflow call, or expose the runtime dotenv or Docker socket to its candidate
helper.

Any future cohort import needs a newly named, independently reviewed stable
fixed-argument operation and exact protocol bound to the active immutable
release and five-digest receipt. Re-enabling the retired name is not supported.
