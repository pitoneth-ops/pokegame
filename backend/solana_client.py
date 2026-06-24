"""
Solana SPL / Token-2022 helpers — deposit verification + withdrawal sending.
Env vars:
  TREASURY_PRIVATE_KEY  — base58-encoded 64-byte keypair (Phantom → Export Private Key)
  TOKEN_MINT            — token mint address
  TOKEN_DECIMALS        — decimal places (default 6 for pump.fun)
  SOLANA_RPC_URL        — Solana RPC endpoint
"""

import os, struct, base64, time, requests

TOKEN_MINT_STR = os.getenv("TOKEN_MINT", "6AVAUKa9uxQpruHZUinFECpXEh1usRVtzQWK8N2wpump")
TOKEN_DECIMALS = int(os.getenv("TOKEN_DECIMALS", "6"))
RPC_URL        = os.getenv("SOLANA_RPC_URL", "https://api.mainnet-beta.solana.com")

_TOKEN_PROGRAM      = "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA"
_TOKEN_2022_PROGRAM = "TokenzQdBNbLqP5VEo1SUEoCYuW2vqayer8mPpWt3tKib"
_ASSOC_PROGRAM      = "ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJe8bGi"

_cached_token_program: str | None = None

# ─────────────────────────────────────────────────────────
# Internal helpers
# ─────────────────────────────────────────────────────────

def _get_keypair():
    raw_b58 = os.getenv("TREASURY_PRIVATE_KEY", "")
    if not raw_b58:
        return None
    try:
        from base58 import b58decode
        from solders.keypair import Keypair
        raw = b58decode(raw_b58)
        if len(raw) == 64:
            return Keypair.from_bytes(raw)
        return Keypair.from_seed(raw)
    except Exception as e:
        print(f"[solana] keypair load error: {e}")
        return None


def _rpc(method: str, params: list) -> dict:
    resp = requests.post(
        RPC_URL,
        json={"jsonrpc": "2.0", "id": 1, "method": method, "params": params},
        timeout=20,
    )
    resp.raise_for_status()
    return resp.json()


def _get_token_program() -> str:
    # TOKEN_MINT_STR (6AVAUKa9ux…) is a Token-2022 mint — hardcoded, no RPC needed.
    # Override with env var TOKEN_PROGRAM_ID if ever switching to a regular SPL token.
    return os.getenv("TOKEN_PROGRAM_ID", _TOKEN_2022_PROGRAM)


def _get_ata(wallet_str: str, mint_str: str, token_program_str: str | None = None) -> str:
    from solders.pubkey import Pubkey
    wallet     = Pubkey.from_string(wallet_str)
    mint       = Pubkey.from_string(mint_str)
    prog       = Pubkey.from_string(token_program_str or _get_token_program())
    assoc_prog = Pubkey.from_string(_ASSOC_PROGRAM)
    ata, _     = Pubkey.find_program_address(
        [bytes(wallet), bytes(prog), bytes(mint)], assoc_prog
    )
    return str(ata)


# ─────────────────────────────────────────────────────────
# Public API
# ─────────────────────────────────────────────────────────

def get_treasury_pubkey() -> str | None:
    kp = _get_keypair()
    return str(kp.pubkey()) if kp else None


def get_token_info() -> dict:
    return {
        "mint":          TOKEN_MINT_STR,
        "decimals":      TOKEN_DECIMALS,
        "treasury":      get_treasury_pubkey(),
        "token_program": _get_token_program(),
    }


def get_wallet_token_balance(wallet_str: str) -> dict:
    """
    Return on-chain token balance.
    Strategy 1: direct {mint} lookup — finds the account regardless of program.
    Strategy 2: {programId} scan for Token-2022, then SPL fallback.
    """
    # ── Strategy 1: direct mint lookup ───────────────────────────────────────
    for prog_str in [_TOKEN_2022_PROGRAM, _TOKEN_PROGRAM]:
        try:
            resp = _rpc("getTokenAccountsByOwner", [
                wallet_str,
                {"mint": TOKEN_MINT_STR},
                {"encoding": "jsonParsed", "commitment": "confirmed"},
            ])
            if "error" in resp:
                print(f"[solana] mint-lookup RPC error: {resp['error']}")
            else:
                accounts = (resp.get("result") or {}).get("value") or []
                print(f"[solana] mint-lookup → {len(accounts)} accounts (prog hint={prog_str[:8]}…)")
                if accounts:
                    acc = accounts[0]
                    ta  = acc["account"]["data"]["parsed"]["info"]["tokenAmount"]
                    bal = float(ta.get("uiAmount") or 0)
                    raw = int(ta.get("amount") or 0)
                    ata = acc.get("pubkey", "")
                    print(f"[solana] FOUND via mint-lookup: bal={bal} ata={ata[:8]}…")
                    return {"balance": bal, "raw": raw, "ata": ata, "token_program": prog_str}
            break  # mint-lookup is program-independent; no need to retry
        except Exception as e:
            print(f"[solana] mint-lookup error: {e}")
            break

    # ── Strategy 2: programId scan ───────────────────────────────────────────
    for prog_str in [_TOKEN_2022_PROGRAM, _TOKEN_PROGRAM]:
        try:
            resp = _rpc("getTokenAccountsByOwner", [
                wallet_str,
                {"programId": prog_str},
                {"encoding": "jsonParsed"},
            ])
            if "error" in resp:
                print(f"[solana] prog-scan RPC error ({prog_str[:8]}…): {resp['error']}")
                continue
            accounts = (resp.get("result") or {}).get("value") or []
            print(f"[solana] prog-scan {prog_str[:8]}… → {len(accounts)} accounts")
            for acc in accounts:
                try:
                    info = acc["account"]["data"]["parsed"]["info"]
                    if info.get("mint") != TOKEN_MINT_STR:
                        continue
                    ta  = info["tokenAmount"]
                    bal = float(ta.get("uiAmount") or 0)
                    raw = int(ta.get("amount") or 0)
                    ata = acc.get("pubkey", "")
                    print(f"[solana] FOUND via prog-scan: bal={bal} ata={ata[:8]}… prog={prog_str[:8]}…")
                    return {"balance": bal, "raw": raw, "ata": ata, "token_program": prog_str}
                except (KeyError, TypeError):
                    continue
        except Exception as e:
            print(f"[solana] prog-scan error ({prog_str[:8]}…): {e}")

    print(f"[solana] not found — wallet={wallet_str[:8]}… mint={TOKEN_MINT_STR[:8]}…")
    return {"balance": 0.0, "raw": 0, "ata": "", "token_program": _TOKEN_2022_PROGRAM}


def verify_deposit_tx(signature: str, from_wallet: str) -> dict:
    """
    Verify that `signature` transferred TOKEN_MINT tokens to treasury.
    Works for both SPL Token and Token-2022.
    """
    treasury = get_treasury_pubkey()
    if not treasury:
        return {"ok": False, "error": "Treasury not configured — set TREASURY_PRIVATE_KEY."}

    try:
        resp = _rpc("getTransaction", [
            signature,
            {"encoding": "jsonParsed", "maxSupportedTransactionVersion": 0, "commitment": "confirmed"},
        ])
    except Exception as e:
        return {"ok": False, "error": f"RPC error: {e}"}

    tx = resp.get("result")
    if not tx:
        return {"ok": False, "error": "Transaction not found or not yet confirmed (wait ~30s and retry)."}

    meta = tx.get("meta", {})
    if meta.get("err"):
        return {"ok": False, "error": "Transaction failed on-chain."}

    pre  = {b["owner"]: int(b["uiTokenAmount"]["amount"])
            for b in meta.get("preTokenBalances", [])
            if b.get("mint") == TOKEN_MINT_STR}
    post = {b["owner"]: int(b["uiTokenAmount"]["amount"])
            for b in meta.get("postTokenBalances", [])
            if b.get("mint") == TOKEN_MINT_STR}

    treasury_pre  = pre.get(treasury, 0)
    treasury_post = post.get(treasury, 0)
    raw_received  = treasury_post - treasury_pre

    if raw_received <= 0:
        return {"ok": False, "error": "No tokens received by treasury in this transaction."}

    game_amount = raw_received // (10 ** TOKEN_DECIMALS)
    if game_amount <= 0:
        return {"ok": False, "error": f"Amount too small — minimum is 1 token (10^{TOKEN_DECIMALS} raw units)."}

    return {"ok": True, "amount": game_amount}


_price_cache: dict = {"usd": None, "ts": 0.0}
_PRICE_TTL = 60.0  # seconds


def get_token_price_usd() -> float | None:
    """Fetch token price in USD from DexScreener, cached 60 s."""
    now = time.time()
    if _price_cache["usd"] is not None and now - _price_cache["ts"] < _PRICE_TTL:
        return _price_cache["usd"]
    try:
        r = requests.get(
            f"https://api.dexscreener.com/latest/dex/tokens/{TOKEN_MINT_STR}",
            timeout=5,
            headers={"Accept": "application/json"},
        )
        r.raise_for_status()
        pairs = r.json().get("pairs") or []
        for pair in pairs:
            raw = pair.get("priceUsd")
            if raw and float(raw) > 0:
                price = float(raw)
                _price_cache["usd"] = price
                _price_cache["ts"]  = now
                print(f"[solana] token price: ${price:.10f}")
                return price
    except Exception as e:
        print(f"[solana] price fetch error: {e}")
    return _price_cache.get("usd")  # return stale if available


def _find_ata_via_rpc(wallet_str: str) -> str | None:
    """Find the token account for TOKEN_MINT_STR in wallet_str using mint-lookup."""
    try:
        resp = _rpc("getTokenAccountsByOwner", [
            wallet_str,
            {"mint": TOKEN_MINT_STR},
            {"encoding": "jsonParsed"},
        ])
        accs = (resp.get("result") or {}).get("value") or []
        if accs:
            return accs[0].get("pubkey")
    except Exception as e:
        print(f"[solana] _find_ata_via_rpc({wallet_str[:8]}…): {e}")
    return None


def send_spl_tokens(to_wallet_str: str, game_amount: int) -> dict:
    """
    Send `game_amount` tokens from treasury to `to_wallet_str`.
    Uses mint-lookup to find ATAs (avoids Pubkey.from_string on program ID).
    Uses TransferChecked (ix 12) — required for Token-2022 with extensions.
    """
    try:
        from solders.pubkey import Pubkey
        from solders.instruction import Instruction, AccountMeta
        from solders.hash import Hash
        from solders.message import Message
        from solders.transaction import Transaction
    except ImportError:
        return {"ok": False, "error": "solders package not installed."}

    kp = _get_keypair()
    if not kp:
        return {"ok": False, "error": "Treasury not configured — set TREASURY_PRIVATE_KEY."}

    treasury = kp.pubkey()

    # Find ATAs via RPC mint-lookup (avoids Pubkey.from_string on program ID)
    from_ata_str = _find_ata_via_rpc(str(treasury))
    to_ata_str   = _find_ata_via_rpc(to_wallet_str)

    if not from_ata_str:
        return {"ok": False, "error": "Treasury token account not found — send SCAM to treasury first."}
    if not to_ata_str:
        return {"ok": False, "error": "Your token account doesn't exist yet. Send a tiny amount of the token to your wallet first."}

    # Get the token program from the ATA's on-chain owner (authoritative)
    try:
        acc_info       = _rpc("getAccountInfo", [from_ata_str, {"encoding": "base64"}])
        token_prog_str = (acc_info.get("result", {}).get("value") or {}).get("owner", _TOKEN_2022_PROGRAM)
    except Exception as e:
        print(f"[solana] getAccountInfo error: {e}")
        token_prog_str = _TOKEN_2022_PROGRAM

    # Construct Pubkey — fall back to manual base58 decode if from_string fails
    try:
        token_prog = Pubkey.from_string(token_prog_str)
    except Exception:
        from base58 import b58decode
        token_prog = Pubkey.from_bytes(b58decode(token_prog_str))

    from_ata = Pubkey.from_string(from_ata_str)
    to_ata   = Pubkey.from_string(to_ata_str)
    mint_key = Pubkey.from_string(TOKEN_MINT_STR)

    raw_amount = game_amount * (10 ** TOKEN_DECIMALS)

    # TransferChecked (discriminant 12): amount u64 + decimals u8
    # Required for Token-2022 tokens with extensions; also valid for regular SPL.
    data = struct.pack("<BQB", 12, raw_amount, TOKEN_DECIMALS)
    accounts = [
        AccountMeta(from_ata, is_signer=False, is_writable=True),
        AccountMeta(mint_key, is_signer=False, is_writable=False),
        AccountMeta(to_ata,   is_signer=False, is_writable=True),
        AccountMeta(treasury, is_signer=True,  is_writable=False),
    ]
    ix = Instruction(token_prog, data, accounts)

    try:
        bh_resp   = _rpc("getLatestBlockhash", [])
        bh_str    = bh_resp["result"]["value"]["blockhash"]
        blockhash = Hash.from_string(bh_str)
    except Exception as e:
        return {"ok": False, "error": f"Could not fetch blockhash: {e}"}

    msg = Message([ix], treasury)
    tx  = Transaction([kp], msg, blockhash)

    tx_b64 = base64.b64encode(bytes(tx)).decode()
    try:
        send_resp = _rpc("sendTransaction", [tx_b64, {"encoding": "base64", "skipPreflight": False}])
    except Exception as e:
        return {"ok": False, "error": f"sendTransaction error: {e}"}

    if "error" in send_resp:
        return {"ok": False, "error": f"Transaction rejected: {send_resp['error']}"}

    return {"ok": True, "signature": send_resp.get("result", "")}
