import assert from "node:assert/strict";
import test from "node:test";
import { Interface } from "ethers";
import { nineMMRouter, pulsexRouterABI } from "./abis";
import {
  addFeeOnTransferInputBuffer,
  applyFeeOnTransferOutput,
  feeOnTransferReceivedBps,
  isFeeOnTransferWrapperFailure,
  isKnownFeeOnTransferToken,
} from "./fee-on-transfer";

test("recognises the configured fee-on-transfer tokens case-insensitively", () => {
  assert.equal(
    isKnownFeeOnTransferToken("0xaf1EfD88115a90676f8EEef01C88b0C49F3e8e8b"),
    true,
  );
  assert.equal(
    isKnownFeeOnTransferToken("0xE6E5B8AB71E5A747A609796666D0E3A0A5EC8BFF"),
    true,
  );
  assert.equal(
    isKnownFeeOnTransferToken("0x74a1942613008Aa6Fec06C27F796edE6460259c1"),
    true,
  );
  assert.equal(
    isKnownFeeOnTransferToken("0x0000000000000000000000000000000000000001"),
    false,
  );
});

test("adds a separate input buffer for the known one-percent transfer fee", () => {
  assert.equal(
    addFeeOnTransferInputBuffer(
      1_000_000n,
      "0xaf1EfD88115a90676f8EEef01C88b0C49F3e8e8b",
    ),
    1_010_102n,
  );
  assert.equal(
    addFeeOnTransferInputBuffer(
      1_000_000n,
      "0x0000000000000000000000000000000000000001",
    ),
    1_000_000n,
  );
});

test("net-of-tax output rounds down and passes unknown tokens through", () => {
  assert.equal(
    applyFeeOnTransferOutput(
      1_010_102n,
      "0x74a1942613008Aa6Fec06C27F796edE6460259c1",
    ),
    1_000_000n,
  );
  assert.equal(
    applyFeeOnTransferOutput(
      1_000_000n,
      "0x0000000000000000000000000000000000000001",
    ),
    1_000_000n,
  );
  assert.equal(
    feeOnTransferReceivedBps("0x74a1942613008Aa6Fec06C27F796edE6460259c1"),
    9900n,
  );
  assert.equal(
    feeOnTransferReceivedBps("0x0000000000000000000000000000000000000001"),
    null,
  );
});

test("recognises the wrapper transfer failure in nested ethers errors", () => {
  const error = {
    code: "CALL_EXCEPTION",
    info: {
      error: {
        message:
          "execution reverted: TransferHelper::transferFrom: transferFrom failed",
      },
    },
  };

  assert.equal(isFeeOnTransferWrapperFailure(error), true);
});

test("does not treat unrelated reverts as transfer-tax failures", () => {
  assert.equal(
    isFeeOnTransferWrapperFailure(
      new Error("execution reverted: PulseXRouter: INSUFFICIENT_OUTPUT_AMOUNT"),
    ),
    false,
  );
});

test("configured V2 router ABIs include the fee-on-transfer sell method", () => {
  const method = "swapExactTokensForETHSupportingFeeOnTransferTokens";

  assert.ok(new Interface(pulsexRouterABI).getFunction(method));
  assert.ok(new Interface(nineMMRouter).getFunction(method));
});
