import type { Issue } from '../issue';
import { DRAFT_ISSUE_001 } from './draft-001';

/**
 * Every issue of The Road Report, newest last.
 *
 * AN EXPLICIT ARRAY, NOT FILESYSTEM DISCOVERY. One line added per issue. A
 * directory scan would be shorter to write and would silently pick up a
 * half-finished file someone left in the folder — the preview and the test
 * suite would then be describing an issue nobody meant to include. Adding the
 * line is the act of saying "this one counts".
 *
 * ISSUES ARE FILES, NOT DATABASE ROWS. The editorial review step for a weekly
 * email with one author and one reviewer is a pull request: it already gives
 * diffs, line comments, permanent history and a real named approver. A
 * `newsletter_issues` table would add a schema, RLS policies, an admin route, a
 * form and a transitions log to replace something that works better — and the
 * admin gate it would sit behind is a single shared password with no per-user
 * identity, so it could not even record who approved an issue as honestly as
 * `git log` does.
 */
export const ISSUES: readonly Issue[] = [DRAFT_ISSUE_001];

export { DRAFT_ISSUE_001 };
