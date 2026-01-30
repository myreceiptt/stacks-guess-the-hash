import { describe, expect, it } from "vitest";
import { Cl, ClarityType, cvToValue } from "@stacks/transactions";
import { tx } from "@stacks/clarinet-sdk";

const CONTRACT_NAME = "guess-the-hash";

const accounts = simnet.getAccounts();
const deployer = accounts.get("deployer")!;
const wallet1 = accounts.get("wallet_1")!;
const wallet2 = accounts.get("wallet_2")!;
const wallet3 = accounts.get("wallet_3")!;

const contractPrincipal = `${deployer}.${CONTRACT_NAME}`;

const u = (n: number) => Cl.uint(n);
const listU = (vals: number[]) => Cl.list(vals.map(Cl.uint));

const unwrap = (val: any) =>
  val && typeof val === "object" && "value" in val ? val.value : val;

const asBigInt = (val: any) => {
  const v = unwrap(val);
  return typeof v === "bigint" ? v : BigInt(v);
};

const getBalance = (principal: string): bigint => {
  const { result } = simnet.execute(`(stx-get-balance '${principal})`);
  return asBigInt(cvToValue(result));
};

const getBet = (betId: number) => {
  const { result } = simnet.callReadOnlyFn(
    CONTRACT_NAME,
    "get-bet",
    [u(betId)],
    deployer
  );
  return result;
};

const getConfig = () => {
  const { result } = simnet.callReadOnlyFn(CONTRACT_NAME, "get-config", [], deployer);
  return cvToValue(result) as any;
};

const mineEmptyBlocks = (count: number) => {
  for (let i = 0; i < count; i++) simnet.mineBlock([]);
};

const placeBet = (choices: number[], stakePerChar: number, sender: string) => {
  const [receipt] = simnet.mineBlock([
    tx.callPublicFn(
      CONTRACT_NAME,
      "place-bet",
      [listU(choices), u(stakePerChar)],
      sender
    ),
  ]);
  return receipt;
};

const resolveBet = (betId: number, sender: string) => {
  const [receipt] = simnet.mineBlock([
    tx.callPublicFn(CONTRACT_NAME, "resolve", [u(betId)], sender),
  ]);
  return receipt;
};

const outcomeAtHeight = (height: number) => {
  const snippet = `(let ((h (unwrap-panic (get-stacks-block-info? header-hash u${height}))))
    (mod (buff-to-uint-be (unwrap-panic (element-at? h u31))) u16))`;
  const { result } = simnet.execute(snippet);
  return asBigInt(cvToValue(result));
};

const fundContract = (amount: number, sender: string) => {
  simnet.mineBlock([tx.transferSTX(amount, contractPrincipal, sender)]);
};

describe("Guess The Hash v1 - place-bet validation", () => {
  it("accepts valid choices: length 1, >1, and 16", () => {
    const tx1 = placeBet([0], 1000, wallet1);
    expect(tx1.result).toBeOk(u(1));

    const tx2 = placeBet([0, 1, 2], 1000, wallet1);
    expect(tx2.result).toBeOk(u(2));

    const tx3 = placeBet(
      [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15],
      1000,
      wallet1
    );
    expect(tx3.result).toBeOk(u(3));
  });

  it("rejects invalid choices: empty, duplicates, out of range", () => {
    const empty = placeBet([], 1000, wallet1);
    expect(empty.result).toHaveClarityType(ClarityType.ResponseErr);
    expect((empty.result as any).value).toStrictEqual(u(400));

    const dup = placeBet([1, 1], 1000, wallet1);
    expect(dup.result).toHaveClarityType(ClarityType.ResponseErr);
    expect((dup.result as any).value).toStrictEqual(u(400));

    expect(() =>
      simnet.mineBlock([
        tx.callPublicFn(
          CONTRACT_NAME,
          "place-bet",
          [Cl.list([Cl.int(-1)]), u(1000)],
          wallet1
        ),
      ])
    ).toThrow();

    const outOfRange = placeBet([16], 1000, wallet1);
    expect(outOfRange.result).toHaveClarityType(ClarityType.ResponseErr);
    expect((outOfRange.result as any).value).toStrictEqual(u(400));
  });

  it("stake-per-char-ustx must be > 0", () => {
    const ok = placeBet([0], 1, wallet1);
    expect(ok.result).toBeOk(u(1));

    const bad = placeBet([0], 0, wallet1);
    expect(bad.result).toHaveClarityType(ClarityType.ResponseErr);
    expect((bad.result as any).value).toStrictEqual(u(401));
  });

  it("fee correctness: fee bps and transfers", () => {
    // set fee treasury (also sets admin on first call)
    const setTreasury = simnet.callPublicFn(
      CONTRACT_NAME,
      "set-fee-treasury",
      [Cl.principal(wallet2)],
      deployer
    );
    expect(setTreasury.result).toBeOk(Cl.bool(true));

    const stakePerChar = 10_000;
    const choices = [0, 1, 2, 3];
    const totalStake = stakePerChar * choices.length;
    const feeBps = 100;
    const fee = Math.floor((totalStake * feeBps) / 10_000);
    const net = totalStake - fee;

    const balanceBefore = getBalance(contractPrincipal);

    const txReceipt = placeBet(choices, stakePerChar, wallet1);
    expect(txReceipt.result).toBeOk(u(1));

    expect(txReceipt.events).toContainEqual({
      event: "stx_transfer_event",
      data: {
        sender: wallet1,
        recipient: contractPrincipal,
        amount: totalStake.toString(),
        memo: "",
      },
    });

    if (fee > 0) {
      expect(txReceipt.events).toContainEqual({
        event: "stx_transfer_event",
        data: {
          sender: contractPrincipal,
          recipient: wallet2,
          amount: fee.toString(),
          memo: "",
        },
      });
    }

    const balanceAfter = getBalance(contractPrincipal);
    expect(balanceAfter - balanceBefore).toBe(BigInt(net));
  });

  it("stores bet fields correctly", () => {
    const txReceipt = placeBet([5, 7], 1000, wallet1);
    expect(txReceipt.result).toBeOk(u(1));

    const betOpt = getBet(1);
    expect(betOpt).toHaveClarityType(ClarityType.OptionalSome);
    const bet = cvToValue((betOpt as any).value) as any;

    expect(unwrap(bet["bettor"])).toBe(wallet1);
    expect(unwrap(bet["resolved"])).toBe(false);
    expect(asBigInt(bet["target-height"])).toBe(asBigInt(bet["placed-height"]) + 2n);
  });
});

describe("Guess The Hash v1 - resolve timing rules", () => {
  it("cannot resolve before target height", () => {
    const txReceipt = placeBet([0, 1], 1000, wallet1);
    expect(txReceipt.result).toBeOk(u(1));

    const bet = cvToValue((getBet(1) as any).value) as any;
    const target = Number(asBigInt(bet["target-height"]));

    const early = resolveBet(1, wallet2);
    expect(early.result).toHaveClarityType(ClarityType.ResponseErr);
    expect((early.result as any).value).toStrictEqual(u(425));

    const currentHeight = Number(
      asBigInt(cvToValue(simnet.execute("stacks-block-height").result))
    );
    if (currentHeight <= target) {
      mineEmptyBlocks(target - currentHeight);
    }

    const ok = resolveBet(1, wallet2);
    expect(ok.result).toHaveClarityType(ClarityType.ResponseOk);
  });

  it("can resolve exactly at target height and after", () => {
    const txReceipt = placeBet([3], 1000, wallet1);
    expect(txReceipt.result).toBeOk(u(1));

    const bet = cvToValue((getBet(1) as any).value) as any;
    const target = Number(asBigInt(bet["target-height"]));

    const currentHeight = Number(
      asBigInt(cvToValue(simnet.execute("stacks-block-height").result))
    );
    if (currentHeight < target) {
      mineEmptyBlocks(target - currentHeight);
    }

    const atTarget = resolveBet(1, wallet1);
    expect(atTarget.result).toHaveClarityType(ClarityType.ResponseOk);

    // place another bet and resolve after target
    const txReceipt2 = placeBet([4], 1000, wallet1);
    expect(txReceipt2.result).toBeOk(u(2));
    const bet2 = cvToValue((getBet(2) as any).value) as any;
    const target2 = Number(asBigInt(bet2["target-height"]));

    const currentHeight2 = Number(
      asBigInt(cvToValue(simnet.execute("stacks-block-height").result))
    );
    if (currentHeight2 <= target2) {
      mineEmptyBlocks(target2 - currentHeight2 + 1);
    }
    const after = resolveBet(2, wallet1);
    expect(after.result).toHaveClarityType(ClarityType.ResponseOk);
  });
});

describe("Guess The Hash v1 - resolve outcome correctness", () => {
  it("winning case: payout = 2 * stake-per-char and bettor balance increases", () => {
    const stakePerChar = 2000;
    const txReceipt = placeBet(
      [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15],
      stakePerChar,
      wallet1
    );
    expect(txReceipt.result).toBeOk(u(1));

    const bet = cvToValue((getBet(1) as any).value) as any;
    const target = Number(asBigInt(bet["target-height"]));
    const currentHeight = Number(
      asBigInt(cvToValue(simnet.execute("stacks-block-height").result))
    );
    if (currentHeight <= target) {
      mineEmptyBlocks(target - currentHeight);
    }

    const balBefore = getBalance(wallet1);
    const resolved = resolveBet(1, wallet2);
    expect(resolved.result).toHaveClarityType(ClarityType.ResponseOk);
    const result = cvToValue((resolved.result as any).value) as any;

    expect(unwrap(result["won"])).toBe(true);
    expect(asBigInt(result["payout"])).toBe(BigInt(2 * stakePerChar));

    const balAfter = getBalance(wallet1);
    expect(balAfter - balBefore).toBe(BigInt(2 * stakePerChar));

    // outcome should match block hash at target height
    const expectedOutcome = outcomeAtHeight(target);
    expect(asBigInt(result["outcome"])).toBe(expectedOutcome);
  });

  it("losing case: payout = 0 and won = false", () => {
    const stakePerChar = 1000;
    let attempts = 0;
    let lossObserved = false;

    while (attempts < 32 && !lossObserved) {
      attempts += 1;
      fundContract(50_000, wallet1);
      const txReceipt = placeBet([0], stakePerChar, wallet1);
      expect(txReceipt.result).toBeOk(u(attempts));

      const bet = cvToValue((getBet(attempts) as any).value) as any;
      const target = Number(asBigInt(bet["target-height"]));
      const currentHeight = Number(
        asBigInt(cvToValue(simnet.execute("stacks-block-height").result))
      );
      if (currentHeight <= target) {
        mineEmptyBlocks(target - currentHeight);
      }

      const resolved = resolveBet(attempts, wallet2);
      expect(resolved.result).toHaveClarityType(ClarityType.ResponseOk);
      const result = cvToValue((resolved.result as any).value) as any;

      if (unwrap(result["won"]) === false) {
        lossObserved = true;
        expect(asBigInt(result["payout"])).toBe(0n);
        const betAfter = cvToValue((getBet(attempts) as any).value) as any;
        expect(unwrap(betAfter["resolved"])).toBe(true);
      }
    }

    expect(lossObserved).toBe(true);
  });
});

describe("Guess The Hash v1 - double execution protection", () => {
  it("resolving the same bet twice fails", () => {
    const txReceipt = placeBet([1, 2], 1000, wallet1);
    expect(txReceipt.result).toBeOk(u(1));

    const bet = cvToValue((getBet(1) as any).value) as any;
    const target = Number(asBigInt(bet["target-height"]));
    const currentHeight = Number(
      asBigInt(cvToValue(simnet.execute("stacks-block-height").result))
    );
    if (currentHeight <= target) {
      mineEmptyBlocks(target - currentHeight);
    }

    const resolved = resolveBet(1, wallet2);
    expect(resolved.result).toHaveClarityType(ClarityType.ResponseOk);

    const again = resolveBet(1, wallet2);
    expect(again.result).toHaveClarityType(ClarityType.ResponseErr);
    expect((again.result as any).value).toStrictEqual(u(409));
  });
});

describe("Guess The Hash v1 - resolver tip behavior", () => {
  it("resolver receives tip when contract balance sufficient", () => {
    const setTip = simnet.mineBlock([
      tx.callPublicFn(CONTRACT_NAME, "set-resolver-tip-ustx", [u(500)], deployer),
    ])[0];
    expect(setTip.result).toBeOk(Cl.bool(true));
    const config = getConfig();
    expect(asBigInt(config["resolver-tip-ustx"])).toBe(500n);

    fundContract(10_000, wallet1);
    const txReceipt = placeBet([0, 1, 2], 2000, wallet1);
    expect(txReceipt.result).toBeOk(u(1));

    const bet = cvToValue((getBet(1) as any).value) as any;
    const target = Number(asBigInt(bet["target-height"]));
    const currentHeight = Number(
      asBigInt(cvToValue(simnet.execute("stacks-block-height").result))
    );
    if (currentHeight <= target) {
      mineEmptyBlocks(target - currentHeight);
    }

    const contractBal = getBalance(contractPrincipal);
    expect(contractBal >= 500n).toBe(true);

    const resolverBalBefore = getBalance(wallet2);
    const resolved = resolveBet(1, wallet2);
    const result = cvToValue((resolved.result as any).value) as any;
    expect(asBigInt(result["tip"])).toBe(500n);

    const resolverBalAfter = getBalance(wallet2);
    expect(resolverBalAfter - resolverBalBefore).toBe(500n);
  });

  it("insufficient balance: resolve succeeds, tip is 0", () => {
    const setTip = simnet.callPublicFn(
      CONTRACT_NAME,
      "set-resolver-tip-ustx",
      [u(50_000_000_000)],
      deployer
    );
    expect(setTip.result).toBeOk(Cl.bool(true));

    const txReceipt = placeBet([1], 1000, wallet1);
    expect(txReceipt.result).toBeOk(u(1));

    const bet = cvToValue((getBet(1) as any).value) as any;
    const target = Number(asBigInt(bet["target-height"]));
    const currentHeight = Number(
      asBigInt(cvToValue(simnet.execute("stacks-block-height").result))
    );
    if (currentHeight <= target) {
      mineEmptyBlocks(target - currentHeight);
    }

    const resolverBalBefore = getBalance(wallet2);
    const resolved = resolveBet(1, wallet2);
    expect(resolved.result).toHaveClarityType(ClarityType.ResponseOk);
    const result = cvToValue((resolved.result as any).value) as any;
    expect(asBigInt(result["tip"])).toBe(0n);

    const resolverBalAfter = getBalance(wallet2);
    expect(resolverBalAfter - resolverBalBefore).toBe(0n);
  });
});

describe("Guess The Hash v1 - permissionless resolve", () => {
  it("bettor resolves own bet", () => {
    const txReceipt = placeBet([2], 1000, wallet1);
    expect(txReceipt.result).toBeOk(u(1));

    const bet = cvToValue((getBet(1) as any).value) as any;
    const target = Number(asBigInt(bet["target-height"]));
    const currentHeight = Number(
      asBigInt(cvToValue(simnet.execute("stacks-block-height").result))
    );
    if (currentHeight <= target) {
      mineEmptyBlocks(target - currentHeight);
    }

    const resolved = resolveBet(1, wallet1);
    expect(resolved.result).toHaveClarityType(ClarityType.ResponseOk);
  });

  it("different principal resolves bettor's bet", () => {
    const txReceipt = placeBet([3], 1000, wallet1);
    expect(txReceipt.result).toBeOk(u(1));

    const bet = cvToValue((getBet(1) as any).value) as any;
    const target = Number(asBigInt(bet["target-height"]));
    const currentHeight = Number(
      asBigInt(cvToValue(simnet.execute("stacks-block-height").result))
    );
    if (currentHeight <= target) {
      mineEmptyBlocks(target - currentHeight);
    }

    const resolved = resolveBet(1, wallet3);
    expect(resolved.result).toHaveClarityType(ClarityType.ResponseOk);
  });
});

describe("Guess The Hash v1 - multiple bets independence", () => {
  it("two bets from same user resolve independently", () => {
    const tx1 = placeBet([0, 1], 1000, wallet1);
    expect(tx1.result).toBeOk(u(1));
    const tx2 = placeBet([2, 3], 1000, wallet1);
    expect(tx2.result).toBeOk(u(2));

    const bet1 = cvToValue((getBet(1) as any).value) as any;
    const bet2 = cvToValue((getBet(2) as any).value) as any;

    const target1 = Number(asBigInt(bet1["target-height"]));
    const target2 = Number(asBigInt(bet2["target-height"]));
    const maxTarget = Math.max(target1, target2);
    const currentHeight = Number(
      asBigInt(cvToValue(simnet.execute("stacks-block-height").result))
    );
    if (currentHeight <= maxTarget) {
      mineEmptyBlocks(maxTarget - currentHeight);
    }

    const r1 = resolveBet(1, wallet2);
    const r2 = resolveBet(2, wallet2);
    expect(r1.result).toHaveClarityType(ClarityType.ResponseOk);
    expect(r2.result).toHaveClarityType(ClarityType.ResponseOk);

    const bet1After = cvToValue((getBet(1) as any).value) as any;
    const bet2After = cvToValue((getBet(2) as any).value) as any;
    expect(unwrap(bet1After["resolved"])).toBe(true);
    expect(unwrap(bet2After["resolved"])).toBe(true);
  });

  it("bets from different users do not interfere", () => {
    const tx1 = placeBet([4], 1000, wallet1);
    expect(tx1.result).toBeOk(u(1));
    const tx2 = placeBet([5], 1000, wallet2);
    expect(tx2.result).toBeOk(u(2));

    const bet1 = cvToValue((getBet(1) as any).value) as any;
    const bet2 = cvToValue((getBet(2) as any).value) as any;

    const maxTarget = Math.max(
      Number(asBigInt(bet1["target-height"])),
      Number(asBigInt(bet2["target-height"]))
    );
    const currentHeight = Number(
      asBigInt(cvToValue(simnet.execute("stacks-block-height").result))
    );
    if (currentHeight <= maxTarget) {
      mineEmptyBlocks(maxTarget - currentHeight);
    }

    const r1 = resolveBet(1, wallet3);
    const r2 = resolveBet(2, wallet3);
    expect(r1.result).toHaveClarityType(ClarityType.ResponseOk);
    expect(r2.result).toHaveClarityType(ClarityType.ResponseOk);

    const bet1After = cvToValue((getBet(1) as any).value) as any;
    const bet2After = cvToValue((getBet(2) as any).value) as any;
    expect(unwrap(bet1After["bettor"])).toBe(wallet1);
    expect(unwrap(bet2After["bettor"])).toBe(wallet2);
  });
});

describe("Guess The Hash v1 - admin setters sanity", () => {
  it("set-fee-bps accepts 0..1000 and rejects >1000", () => {
    const ok0 = simnet.callPublicFn(
      CONTRACT_NAME,
      "set-fee-bps",
      [u(0)],
      deployer
    );
    expect(ok0.result).toBeOk(Cl.bool(true));

    const ok1000 = simnet.callPublicFn(
      CONTRACT_NAME,
      "set-fee-bps",
      [u(1000)],
      deployer
    );
    expect(ok1000.result).toBeOk(Cl.bool(true));

    const bad = simnet.callPublicFn(
      CONTRACT_NAME,
      "set-fee-bps",
      [u(1001)],
      deployer
    );
    expect(bad.result).toHaveClarityType(ClarityType.ResponseErr);
    expect((bad.result as any).value).toStrictEqual(u(422));
  });

  it("set-fee-treasury updates treasury", () => {
    const setTreasury = simnet.callPublicFn(
      CONTRACT_NAME,
      "set-fee-treasury",
      [Cl.principal(wallet3)],
      deployer
    );
    expect(setTreasury.result).toBeOk(Cl.bool(true));

    const config = getConfig();
    expect(unwrap(config["fee-treasury"])).toBe(wallet3);
  });

  it("set-resolver-tip-ustx updates resolver tip", () => {
    const setTip = simnet.callPublicFn(
      CONTRACT_NAME,
      "set-resolver-tip-ustx",
      [u(777)],
      deployer
    );
    expect(setTip.result).toBeOk(Cl.bool(true));

    const config = getConfig();
    expect(asBigInt(config["resolver-tip-ustx"])).toBe(777n);
  });
});
