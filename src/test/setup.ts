import "@testing-library/jest-dom/vitest";
import { afterEach } from "vitest";
import { cleanup } from "@testing-library/react";

// testing-library/react only auto-registers its afterEach cleanup when it
// detects a global `afterEach`; this project doesn't enable vitest's
// `test.globals`, so register it explicitly to unmount components between
// component tests (the plain-function engine tests are unaffected).
afterEach(() => {
  cleanup();
});
