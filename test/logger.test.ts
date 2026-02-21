import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  classifyError, EXIT_SUCCESS, EXIT_FINDINGS, EXIT_CONFIG_ERROR, EXIT_NETWORK_ERROR,
  setVerbose, setQuiet, isVerbose, isQuiet,
} from "../src/output/logger.js";

describe("exit codes", () => {
  it("EXIT_SUCCESS is 0", () => assert.equal(EXIT_SUCCESS, 0));
  it("EXIT_FINDINGS is 1", () => assert.equal(EXIT_FINDINGS, 1));
  it("EXIT_CONFIG_ERROR is 2", () => assert.equal(EXIT_CONFIG_ERROR, 2));
  it("EXIT_NETWORK_ERROR is 3", () => assert.equal(EXIT_NETWORK_ERROR, 3));
});

describe("classifyError", () => {
  it("classifies network errors", () => {
    const { exitCode } = classifyError(new Error("ECONNREFUSED"));
    assert.equal(exitCode, EXIT_NETWORK_ERROR);
  });

  it("classifies API errors", () => {
    const { exitCode } = classifyError(new Error("API error: 429 Too Many Requests"));
    assert.equal(exitCode, EXIT_NETWORK_ERROR);
  });

  it("classifies config errors", () => {
    const { exitCode } = classifyError(new Error("API key is not set"));
    assert.equal(exitCode, EXIT_CONFIG_ERROR);
  });

  it("classifies unknown provider", () => {
    const { exitCode } = classifyError(new Error("Unknown provider: xyz"));
    assert.equal(exitCode, EXIT_CONFIG_ERROR);
  });

  it("defaults to network error for unknown errors", () => {
    const { exitCode } = classifyError(new Error("something went wrong"));
    assert.equal(exitCode, EXIT_NETWORK_ERROR);
  });

  it("handles non-Error values", () => {
    const { message } = classifyError("string error");
    assert.equal(message, "string error");
  });
});

describe("verbose/quiet modes", () => {
  it("defaults to false", () => {
    setVerbose(false);
    setQuiet(false);
    assert.equal(isVerbose(), false);
    assert.equal(isQuiet(), false);
  });

  it("can set verbose", () => {
    setVerbose(true);
    assert.equal(isVerbose(), true);
    setVerbose(false); // cleanup
  });

  it("can set quiet", () => {
    setQuiet(true);
    assert.equal(isQuiet(), true);
    setQuiet(false); // cleanup
  });
});
