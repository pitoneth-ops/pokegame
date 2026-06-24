"""
Solana SPL / Token-2022 helpers — deposit verification + withdrawal sending.
Env vars:
  TREASURY_PRIVATE_KEY  — base58-encoded 64-byte keypair (Phantom → Export Private Key)
  TOKEN_MINT            — token mint address
  TOKEN_DECIMALS        — decimal places (default 6 for pump.fun)
  SOLANA_RPC_URL        — Solana RPC endpoint
"""

import os, struct, base64, requests

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
    Return on-chain token balance using getTokenAccountsByOwner.
    Avoids Pubkey.from_string on the program ID (which can fail in solders).
    """
    prog_str = _get_token_program()
    print(f"[solana] balance check | wallet={wallet_str[:8]}… | prog={prog_str[:8]}…")
    try:
        resp     = _rpc("getTokenAccountsByOwner", [
            wallet_str,
            {"programId": prog_str},
            {"encoding": "jsonParsed"},
        ])
        accounts = (resp.get("result") or {}).get("value") or []
        for acc in accounts:
            try:
                info = acc["account"]["data"]["parsed"]["info"]
                if info.get("mint") != TOKEN_MINT_STR:
                    continue
                ta  = info["tokenAmount"]
                bal = float(ta.get("uiAmount") or 0)
                raw = int(ta.get("amount") or 0)
                ata = acc.get("pubkey", "")
                print(f"[solana] balance: {bal} | ata={ata[:8]}…")
                return {"balance": bal, "raw": raw, "ata": ata, "token_program": prog_str}
            except (KeyError, TypeError):
                continue
        print(f"[solana] balance: no account found for mint {TOKEN_MINT_STR[:8]}…")
        return {"balance": 0.0, "raw": 0, "ata": "", "token_program": prog_str}
    except Exception as e:
        print(f"[solana] getTokenAccountsByOwner error for {wallet_str}: {e}")
        return {"balance": 0.0, "raw": 0, "ata": "", "token_program": prog_str}


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


def send_spl_tokens(to_wallet_str: str, game_amount: int) -> dict:
    """
    Send `game_amount` tokens from treasury to `to_wallet_str`.
    Handles both SPL Token and Token-2022 automatically.
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

    token_prog_str = _get_token_program()
    treasury       = kp.pubkey()
    token_prog     = Pubkey.from_string(token_prog_str)

    from_ata_str = _get_ata(str(treasury), TOKEN_MINT_STR, token_prog_str)
    to_ata_str   = _get_ata(to_wallet_str, TOKEN_MINT_STR, token_prog_str)
    from_ata     = Pubkey.from_string(from_ata_str)
    to_ata       = Pubkey.from_string(to_ata_str)

    try:
        acc = _rpc("getAccountInfo", [to_ata_str, {"encoding": "base64"}])
        if not acc.get("result", {}).get("value"):
            return {
                "ok": False,
                "error": "Your token account doesn't exist yet. Send a tiny amount of the token to your wallet first.",
            }
    except Exception as e:
        return {"ok": False, "error": f"RPC error checking destination: {e}"}

    raw_amount = game_amount * (10 ** TOKEN_DECIMALS)

    # Transfer instruction discriminant is 3 for both SPL Token and Token-2022
    data = struct.pack("<BQ", 3, raw_amount)
    accounts = [
        AccountMeta(from_ata, is_signer=False, is_writable=True),
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
