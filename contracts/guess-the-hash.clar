;; Guess The Hash (v1) - core contract
;;
;; Locked rules (see README):
;; - Independent bets, no pools/jackpots, no commit-reveal
;; - Bettor chooses 1..16 hex digits (0..15)
;; - target-height = placed-height + 2
;; - outcome = last hex digit of the Stacks block hash at target-height
;; - win if outcome digit is in chosen set
;; - payout on win = 2 * stake-per-char-ustx
;; - fee = 1% (configurable bps), sent at place-bet
;; - anyone can resolve; resolver receives fixed tip from contract balance (if available)
;;
;; Admin model:
;; - The first successful admin call (any of the setters) sets `admin` to tx-sender.
;; - Until then, fee treasury defaults to the burn address (safe default).
;; - Deployer should call `set-fee-treasury` right after deployment.
;;
;; Block hash source:
;; - Uses (get-stacks-block-info? header-hash <height>) and takes the last nibble.

(define-constant ERR_NOT_FOUND u404)
(define-constant ERR_ALREADY_RESOLVED u409)
(define-constant ERR_TOO_EARLY u425)
(define-constant ERR_BAD_CHOICES u400)
(define-constant ERR_BAD_STAKE u401)
(define-constant ERR_TRANSFER_FAIL u500)
(define-constant ERR_PAYOUT_INSUFFICIENT u402)
(define-constant ERR_NOT_ADMIN u403)
(define-constant ERR_BAD_FEE_BPS u422)
(define-constant ERR_NO_BLOCK_INFO u430)

(define-constant FEE_BPS_DENOM u10000)
(define-constant DEFAULT_FEE_TREASURY 'SP000000000000000000002Q6VF78)

(define-data-var admin (optional principal) none)
(define-data-var fee-treasury principal DEFAULT_FEE_TREASURY)
(define-data-var fee-bps uint u100)
(define-data-var resolver-tip-ustx uint u0)
(define-data-var next-bet-id uint u1)

(define-map bets
  { bet-id: uint }
  {
    bettor: principal,
    placed-height: uint,
    target-height: uint,
    stake-per-char-ustx: uint,
    choice-bitmap: uint,
    total-stake-ustx: uint,
    fee-ustx: uint,
    resolved: bool,
    resolved-height: (optional uint),
    outcome-digit: (optional uint),
    won: bool,
  }
)

(define-read-only (get-config)
  {
    fee-treasury: (var-get fee-treasury),
    fee-bps: (var-get fee-bps),
    resolver-tip-ustx: (var-get resolver-tip-ustx),
    next-bet-id: (var-get next-bet-id),
  }
)

(define-read-only (get-bet (bet-id uint))
  (map-get? bets { bet-id: bet-id })
)

(define-private (is-admin)
  (match (var-get admin)
    who (is-eq tx-sender who)
    false
  )
)

(define-private (require-admin)
  (begin
    (asserts! (is-admin) (err ERR_NOT_ADMIN))
    (ok true)
  )
)

(define-private (init-admin-if-needed)
  (match (var-get admin)
    current true
    (begin
      (var-set admin (some tx-sender))
      true
    )
  )
)

(define-private (checked-transfer
    (amount uint)
    (sender principal)
    (recipient principal)
  )
  (match (stx-transfer? amount sender recipient)
    ok-val (ok ok-val)
    err-code (err ERR_TRANSFER_FAIL)
  )
)

(define-private (contract-principal)
  current-contract
)

(define-private (digit->bit (d uint))
  (bit-shift-left u1 d)
)

(define-private (choices-fold
    (d uint)
    (acc {
      bitmap: uint,
      ok: bool,
    })
  )
  (if (not (get ok acc))
    acc
    (if (> d u15)
      {
        bitmap: (get bitmap acc),
        ok: false,
      }
      (let ((bit (digit->bit d)))
        (if (is-eq (bit-and (get bitmap acc) bit) u0)
          {
            bitmap: (bit-or (get bitmap acc) bit),
            ok: true,
          }
          {
            bitmap: (get bitmap acc),
            ok: false,
          }
        )
      )
    )
  )
)

(define-private (build-choice-bitmap (choices (list 16 uint)))
  ;; Returns (ok bitmap) or (err ERR_BAD_CHOICES)
  (let ((result (fold choices-fold choices {
      bitmap: u0,
      ok: true,
    })))
    (if (get ok result)
      (ok (get bitmap result))
      (err ERR_BAD_CHOICES)
    )
  )
)

(define-private (get-outcome-digit (height uint))
  ;; Returns (ok uint) 0..15
  (match (get-stacks-block-info? header-hash height)
    header-hash (match (element-at? header-hash u31)
      last-byte (ok (mod (buff-to-uint-be last-byte) u16))
      (err ERR_NO_BLOCK_INFO)
    )
    (err ERR_NO_BLOCK_INFO)
  )
)

;; --- Admin ---

(define-public (set-fee-treasury (new principal))
  (begin
    (init-admin-if-needed)
    (try! (require-admin))
    (var-set fee-treasury new)
    (ok true)
  )
)

(define-public (set-fee-bps (new uint))
  (begin
    (init-admin-if-needed)
    (try! (require-admin))
    (asserts! (<= new u1000) (err ERR_BAD_FEE_BPS))
    (var-set fee-bps new)
    (ok true)
  )
)

(define-public (set-resolver-tip-ustx (new uint))
  (begin
    (init-admin-if-needed)
    (try! (require-admin))
    (var-set resolver-tip-ustx new)
    (ok true)
  )
)

;; --- Core ---

(define-public (place-bet
    (choices (list 16 uint))
    (stake-per-char-ustx uint)
  )
  (let ((n (len choices)))
    (begin
      (asserts! (and (>= n u1) (<= n u16)) (err ERR_BAD_CHOICES))
      (asserts! (> stake-per-char-ustx u0) (err ERR_BAD_STAKE))

      (let (
          (choice-bitmap (try! (build-choice-bitmap choices)))
          (total-stake-ustx (* stake-per-char-ustx n))
          (fee-ustx (/ (* (* stake-per-char-ustx n) (var-get fee-bps)) FEE_BPS_DENOM))
        )
        (let (
            (bet-id (var-get next-bet-id))
            (placed-height stacks-block-height)
            (target-height (+ stacks-block-height u2))
            (contract (contract-principal))
          )
          (begin
            ;; collect stake to contract
            (try! (checked-transfer total-stake-ustx tx-sender contract))

            ;; pay fee out immediately (if any)
            (if (> fee-ustx u0)
              (begin
                (unwrap!
                  (as-contract? ((with-stx fee-ustx))
                    (unwrap!
                      (stx-transfer? fee-ustx tx-sender (var-get fee-treasury))
                      (err ERR_TRANSFER_FAIL)
                    )
                    true
                  )
                  (err ERR_TRANSFER_FAIL)
                )
                true
              )
              true
            )

            (map-set bets { bet-id: bet-id } {
              bettor: tx-sender,
              placed-height: placed-height,
              target-height: target-height,
              stake-per-char-ustx: stake-per-char-ustx,
              choice-bitmap: choice-bitmap,
              total-stake-ustx: total-stake-ustx,
              fee-ustx: fee-ustx,
              resolved: false,
              resolved-height: none,
              outcome-digit: none,
              won: false,
            })
            (var-set next-bet-id (+ bet-id u1))
            (ok bet-id)
          )
        )
      )
    )
  )
)

(define-public (resolve (bet-id uint))
  (match (map-get? bets { bet-id: bet-id })
    bet (begin
      (asserts! (not (get resolved bet)) (err ERR_ALREADY_RESOLVED))
      (asserts! (>= stacks-block-height (get target-height bet))
        (err ERR_TOO_EARLY)
      )

      (let (
          (outcome (try! (get-outcome-digit (get target-height bet))))
          (won (not (is-eq (bit-and (get choice-bitmap bet) (digit->bit outcome)) u0)))
          (payout (if won
            (* u2 (get stake-per-char-ustx bet))
            u0
          ))
          (tip-wanted (var-get resolver-tip-ustx))
          (contract (contract-principal))
        )
        (begin
          ;; payout first (must succeed if won)
          (if won
            (begin
              (asserts! (>= (stx-get-balance contract) payout)
                (err ERR_PAYOUT_INSUFFICIENT)
              )
              (unwrap!
                (as-contract? ((with-stx payout))
                  (unwrap! (stx-transfer? payout tx-sender (get bettor bet))
                    (err ERR_TRANSFER_FAIL)
                  )
                  true
                )
                (err ERR_TRANSFER_FAIL)
              )
              true
            )
            true
          )

          ;; tip is best-effort; skip if insufficient
          (let ((tip-paid (if (and (> tip-wanted u0) (>= (stx-get-balance contract) tip-wanted))
              (match (as-contract? ((with-stx tip-wanted))
                (match (stx-transfer? tip-wanted tx-sender contract-caller)
                  ok-val tip-wanted
                  err-code u0
                ))
                paid paid
                err-index u0
              )
              u0
            )))
            (begin
              (map-set bets { bet-id: bet-id }
                (merge bet {
                  resolved: true,
                  resolved-height: (some stacks-block-height),
                  outcome-digit: (some outcome),
                  won: won,
                })
              )
              (ok {
                won: won,
                outcome: outcome,
                payout: payout,
                tip: tip-paid,
              })
            )
          )
        )
      )
    )
    (err ERR_NOT_FOUND)
  )
)
