/**
 * The one classroom photograph, described once.
 *
 * Two surfaces show it — the campaign page's empty state and the homepage
 * campaign band — and they must show the SAME file at the SAME intrinsic
 * dimensions. Duplicating the path as a string literal in both is how a
 * second copy of a photograph eventually gets committed, so the path and
 * the dimensions live here and both call sites import them.
 *
 * Alt text is deliberately NOT here: the two surfaces sit in different
 * contexts and are allowed to describe the image differently.
 *
 * Dimensions are pinned against the committed bytes by the
 * supply-the-classroom harness, which reads them out of the JPEG itself.
 */

/** Path under public/, as the browser requests it. */
export const CLASSROOM_PHOTO_SRC = '/images/classroom/empty-classroom.jpg';

/** Intrinsic pixel dimensions of CLASSROOM_PHOTO_SRC — 4:3. */
export const CLASSROOM_PHOTO_WIDTH = 1536;
export const CLASSROOM_PHOTO_HEIGHT = 1152;
