# Test fixtures

`photo-baseline.jpg` (task 029): a 120 x 80 baseline JPEG (SOF0) made once by Chromium 156.0.8078.4's own encoder,
through Playwright: a canvas filled with `#299d91`, a white 40 x 24 rectangle at (8, 8) and a `#e73d1c` circle of
radius 18 at (90, 50), then `canvas.toBlob(callback, 'image/jpeg', 0.9)`. The same bytes are in `backend/test/fixtures/`.

The PNGs, the EXIF, comment and trailing-data case and the polyglot are built in code by `e2e/images.ts`. Chromium's
encoder writes only baseline JPEGs, so the progressive JPEG is built in code too, by
`backend/test/helpers/images.ts` only (the backend tests use it; the e2e tests do not).
