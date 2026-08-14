# Reviewed consumer cohort imports

This directory provides an explicit, one-shot production gate for reviewed consumer-web observations.
Only one JSON file may exist in the requests directory. The immutable release helper validates its exact
request ID, manifest path, and canonical manifest fingerprint before running a dry-run and one atomic apply.

After production verification, remove the request file so later deployments cannot repeat the operation.
