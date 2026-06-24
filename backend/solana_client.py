"""
Solana SPL token helpers — deposit verification + withdrawal sending.
Requires env vars:
  TREASURY_PRIVATE_KEY  — base58-encoded 64-byte keypair (generate in Phantom → Export Private Key)
  TOKEN_MINT            — SPL token mint address (default: the test token)
  TOKEN_DECIMALS        — decimal places of the token (default: 6 for pump.fun tokens)
  SOLANA_RPC_URL        — Solana RPC endpoint (default: mainnet-beta public)
"""

import os, struct, base64, requests

TOKEN_MINT_STR = os.getenv("TOKEN_MINT", "6AVAUKa9uxQpruHZUinFECpXEh1usRVtzQWK8N2wpump")
TOKEN_DECIMALS = int(os.getenv("TOKEN_DECIMALS", "6"))
RPC_URL        = os.getenv("SOLANA_RPC_URL", "https://api.mainnet-beta.solana.com")

_TOKEN_PROGRAM  = "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA"
_ASSOC_PROGRAM  = "ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJe1bJz"


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
        # Phantom exports 64-byte keypairs; Solana CLI exports 32-byte seeds.
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


def _get_ata(wallet_str: str, mint_str: str) -> str:
    from solders.pubkey import Pubkey
    wallet     = Pubkey.from_string(wallet_str)
    mint       = Pubkey.from_string(mint_str)
    token_prog = Pubkey.from_string(_TOKEN_PROGRAM)
    assoc_prog = Pubkey.from_string(_ASSOC_PROGRAM)
    ata, _     = Pubkey.find_program_address(
        [bytes(wallet), bytes(token_prog), bytes(mint)], assoc_prog
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
        "mint":     TOKEN_MINT_STR,
        "decimals": TOKEN_DECIMALS,
        "treasury": get_treasury_pubkey(),
    }


def verify_deposit_tx(signature: str, from_wallet: str) -> dict:
    """
    Check that `signature` transferred TOKEN_MINT tokens to the treasury wallet.
    Returns {"ok": True, "amount": N} on success (N = in-game PKG credited).
    """
    treasury = get_treasury_pubkey()
    if not treasury:
        return {"ok": False, "error": "Treasury not configured — set TREASURY_PRIVATE_KEY in Railway env vars."}

    try:
        resp = _rpc("getTransaction", [
            signature,
            {"encoding": "jsonParsed", "maxSupportedTransactionVersion": 0},
        ])
    except Exception as e:
        return {"ok": False, "error": f"RPC error: {e}"}

    tx = resp.get("result")
    if not tx:
        return {"ok": False, "error": "Transaction not found or not yet confirmed (wait ~30s and retry)."}

    meta = tx.get("meta", {})
    if meta.get("err"):
        return {"ok": False, "error": "Transaction failed on-chain."}

    # Parse token balance changes for this mint
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
        return {"ok": False, "error": f"Amount too small — minimum deposit is 1 PKG (= 10^{TOKEN_DECIMALS} raw units)."}

    return {"ok": True, "amount": game_amount}


def send_spl_tokens(to_wallet_str: str, game_amount: int) -> dict:
    """
    Send `game_amount` in-game PKG from treasury to `to_wallet_str` as real SPL tokens.
    Returns {"ok": True, "signature": "..."} on success.
    """
    try:
        from solders.pubkey import Pubkey
        from solders.instruction import Instruction, AccountMeta
        from solders.hash import Hash
        from solders.message import Message
        from solders.transaction import Transaction
    except ImportError:
        return {"ok": False, "error": "solders package not installed — check Railway build logs."}

    kp = _get_keypair()
    if not kp:
        return {"ok": False, "error": "Treasury not configured — set TREASURY_PRIVATE_KEY in Railway env vars."}

    treasury   = kp.pubkey()
    token_prog = Pubkey.from_string(_TOKEN_PROGRAM)

    from_ata_str = _get_ata(str(treasury), TOKEN_MINT_STR)
    to_ata_str   = _get_ata(to_wallet_str, TOKEN_MINT_STR)
    from_ata     = Pubkey.from_string(from_ata_str)
    to_ata       = Pubkey.from_string(to_ata_str)

    # Destination ATA must exist (player needs to have received this token at least once)
    try:
        acc = _rpc("getAccountInfo", [to_ata_str, {"encoding": "base64"}])
        if not acc.get("result", {}).get("value"):
            return {
                "ok": False,
                "error": (
                    "Your $PKG token account doesn't exist yet. "
                    "Send a tiny amount of $PKG to your wallet via Phantom first, then retry."
                ),
            }
    except Exception as e:
        return {"ok": False, "error": f"RPC error checking destination account: {e}"}

    raw_amount = game_amount * (10 ** TOKEN_DECIMALS)

    # SPL Token Transfer instruction (discriminant 3)
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
        send_resp = _rpc("sendTransaction", [
            tx_b64,
            {"encoding": "base64", "skipPreflight": False},
        ])
    except Exception as e:
        return {"ok": False, "error": f"sendTransaction RPC error: {e}"}

    if "error" in send_resp:
        return {"ok": False, "error": f"Transaction rejected: {send_resp['error']}"}

    return {"ok": True, "signature": send_resp.get("result", "")}
