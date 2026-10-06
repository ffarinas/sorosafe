#![no_std]
//! Junto custody contract. The host authenticates signers; this contract never
//! accepts raw signatures, external calls, allowances, or code upgrades.
use soroban_sdk::{
    contract, contractevent, contractimpl, contracttype, panic_with_error, token, Address, Env,
    String, Vec,
};
use stellar_contract_utils::math::i128_fixed_point::mul_div_ceil;

const TTL: u32 = 30 * 17_280;
const TTL_THRESHOLD: u32 = 7 * 17_280;
const MAX_LIFETIME: u64 = 7 * 24 * 60 * 60;

pub use junto_types::{validate_protocol, validate_rules, Error, Protocol, Rules, MAX_TRANSFER};
#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct Config {
    pub factory: Address,
    pub name: String,
    pub rules: Rules,
    pub protocol: Protocol,
    pub epoch: u32,
    pub next_id: u64,
}
#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub enum Action {
    Pay(Address, Address, i128),
    ChangeRules(Rules),
}
#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct Proposal {
    pub id: u64,
    pub epoch: u32,
    pub proposer: Address,
    pub action: Action,
    pub approvals: Vec<Address>,
    pub expires: u64,
    pub created: u64,
    /// 0 pending, 1 executed, 2 cancelled. Expiry is derived from ledger time.
    pub status: u32,
    pub fee: i128,
}
#[contracttype]
#[derive(Clone)]
enum Key {
    Config,
    Proposal(u64),
    Paid(Address),
    /// Service fees accrued per asset and not yet claimed by the collector.
    FeesOwed(Address),
}
#[contractevent]
#[derive(Clone)]
pub struct ProposalChanged {
    #[topic]
    pub id: u64,
    pub proposal: Proposal,
}
#[contractevent]
#[derive(Clone)]
pub struct ApprovalChanged {
    #[topic]
    pub id: u64,
    pub signer: Address,
    pub approved: bool,
}
/// A payment left its service fee in the vault for the collector.
#[contractevent]
#[derive(Clone)]
pub struct FeeAccrued {
    #[topic]
    pub asset: Address,
    pub id: u64,
    pub amount: i128,
    pub owed: i128,
}
/// Owed fees for an asset were sent to the protocol collector.
#[contractevent]
#[derive(Clone)]
pub struct FeesClaimed {
    #[topic]
    pub asset: Address,
    pub collector: Address,
    pub amount: i128,
}
#[contract]
pub struct Vault;

fn config(e: &Env) -> Config {
    e.storage().instance().extend_ttl(TTL_THRESHOLD, TTL);
    e.storage().instance().get(&Key::Config).unwrap()
}
fn save_config(e: &Env, c: &Config) {
    e.storage().instance().set(&Key::Config, c);
}
fn proposal(e: &Env, id: u64) -> Proposal {
    let key = Key::Proposal(id);
    let p = e
        .storage()
        .persistent()
        .get(&key)
        .unwrap_or_else(|| panic_with_error!(e, Error::NotFound));
    e.storage()
        .persistent()
        .extend_ttl(&key, TTL_THRESHOLD, TTL);
    p
}
fn save_proposal(e: &Env, p: &Proposal) {
    let key = Key::Proposal(p.id);
    e.storage().persistent().set(&key, p);
    e.storage()
        .persistent()
        .extend_ttl(&key, TTL_THRESHOLD, TTL);
}
fn fees_owed(e: &Env, asset: &Address) -> i128 {
    e.storage()
        .instance()
        .get(&Key::FeesOwed(asset.clone()))
        .unwrap_or(0)
}
fn fee_for(e: &Env, c: &Config, amount: i128) -> i128 {
    // A Stellar Asset Contract moves at most i64::MAX per transfer, and the
    // amount plus its fee must stay spendable from one balance.
    if amount <= 0 || amount > MAX_TRANSFER {
        panic_with_error!(e, Error::InvalidAmount);
    }
    let fee = mul_div_ceil(e, &amount, &(c.protocol.fee_bps as i128), &10_000);
    let total = amount
        .checked_add(fee)
        .unwrap_or_else(|| panic_with_error!(e, Error::Overflow));
    if total > MAX_TRANSFER {
        panic_with_error!(e, Error::InvalidAmount);
    }
    fee
}
fn member(e: &Env, c: &Config, signer: &Address) {
    if !c.rules.signers.contains(signer) {
        panic_with_error!(e, Error::Unauthorized);
    }
    signer.require_auth();
}
fn pending(e: &Env, c: &Config, p: &Proposal) {
    if p.status != 0 {
        panic_with_error!(e, Error::Closed);
    }
    if p.expires <= e.ledger().timestamp() {
        panic_with_error!(e, Error::Expired);
    }
    if p.epoch != c.epoch {
        panic_with_error!(e, Error::StaleRules);
    }
}

#[contractimpl]
impl Vault {
    pub fn __constructor(e: Env, factory: Address, name: String, rules: Rules, protocol: Protocol) {
        factory.require_auth();
        validate_rules(&e, &rules);
        validate_protocol(&e, &protocol);
        if name.is_empty() || name.len() > 80 {
            panic_with_error!(&e, Error::InvalidName);
        }
        save_config(
            &e,
            &Config {
                factory,
                name,
                rules,
                protocol,
                epoch: 0,
                next_id: 0,
            },
        );
        e.storage().instance().extend_ttl(TTL_THRESHOLD, TTL);
    }
    pub fn config(e: Env) -> Config {
        config(&e)
    }
    pub fn proposal(e: Env, id: u64) -> Proposal {
        config(&e);
        proposal(&e, id)
    }
    pub fn payments_to(e: Env, recipient: Address) -> u64 {
        config(&e);
        let key = Key::Paid(recipient);
        let count = e.storage().persistent().get(&key).unwrap_or(0);
        if e.storage().persistent().has(&key) {
            e.storage()
                .persistent()
                .extend_ttl(&key, TTL_THRESHOLD, TTL);
        }
        count
    }
    /// Service fee for a payment of `amount`. The fee stays in the vault as
    /// owed to the collector, so a payment needs `amount + fee` available.
    pub fn quote(e: Env, amount: i128) -> i128 {
        let c = config(&e);
        fee_for(&e, &c, amount)
    }
    /// Fees accrued for `asset` that the collector has not claimed yet. They
    /// are part of the vault's token balance but can never fund a payment.
    pub fn fees_owed(e: Env, asset: Address) -> i128 {
        config(&e);
        fees_owed(&e, &asset)
    }
    /// Anybody may send the fees owed for `asset` to the protocol collector.
    /// If the collector cannot receive (no trustline, frozen, merged), only
    /// this call fails; payments keep working and the fees stay owed.
    pub fn claim_fees(e: Env, asset: Address) -> i128 {
        let c = config(&e);
        let owed = fees_owed(&e, &asset);
        if owed <= 0 {
            return 0;
        }
        e.storage().instance().remove(&Key::FeesOwed(asset.clone()));
        token::Client::new(&e, &asset).transfer(
            &e.current_contract_address(),
            &c.protocol.collector,
            &owed,
        );
        FeesClaimed {
            asset,
            collector: c.protocol.collector,
            amount: owed,
        }
        .publish(&e);
        owed
    }
    /// `expected_id` must equal `config().next_id`. This is intentional: it
    /// makes the proposal id deterministic so the client can sign the exact
    /// id it will reference, and a racing proposal fails instead of shifting it.
    pub fn propose(e: Env, signer: Address, expected_id: u64, action: Action, expires: u64) -> u64 {
        let mut c = config(&e);
        member(&e, &c, &signer);
        if expected_id != c.next_id {
            panic_with_error!(&e, Error::Nonce);
        }
        let now = e.ledger().timestamp();
        if expires <= now || expires > now.saturating_add(MAX_LIFETIME) {
            panic_with_error!(&e, Error::InvalidExpiry);
        }
        let fee = match &action {
            Action::Pay(asset, to, amount) => {
                if !c.protocol.assets.contains(asset) {
                    panic_with_error!(&e, Error::InvalidAsset);
                }
                if to == &e.current_contract_address() || to == asset {
                    panic_with_error!(&e, Error::InvalidRecipient);
                }
                fee_for(&e, &c, *amount)
            }
            Action::ChangeRules(rules) => {
                validate_rules(&e, rules);
                0
            }
        };
        let p = Proposal {
            id: c.next_id,
            epoch: c.epoch,
            proposer: signer.clone(),
            action,
            // Proposing already requires the signer's auth for these exact
            // arguments, so it counts as their approval: no second transaction.
            approvals: Vec::from_array(&e, [signer.clone()]),
            expires,
            created: now,
            status: 0,
            fee,
        };
        c.next_id = c
            .next_id
            .checked_add(1)
            .unwrap_or_else(|| panic_with_error!(&e, Error::Overflow));
        save_config(&e, &c);
        save_proposal(&e, &p);
        ProposalChanged {
            id: p.id,
            proposal: p.clone(),
        }
        .publish(&e);
        // Indexers that count ApprovalChanged see the proposer's approval too.
        ApprovalChanged {
            id: p.id,
            signer,
            approved: true,
        }
        .publish(&e);
        // With a 1-of-N rule the proposer alone is the quorum: run it now
        // instead of asking for a second transaction. An unfunded payment
        // stays pending and can be executed once the vault is topped up.
        if p.approvals.len() >= c.rules.threshold && fundable(&e, &p) {
            apply(e.clone(), c, p.clone());
        }
        p.id
    }
    pub fn approve(e: Env, signer: Address, id: u64) {
        let c = config(&e);
        member(&e, &c, &signer);
        let mut p = proposal(&e, id);
        pending(&e, &c, &p);
        if p.approvals.contains(&signer) {
            panic_with_error!(&e, Error::AlreadyApproved);
        }
        p.approvals.push_back(signer.clone());
        save_proposal(&e, &p);
        ApprovalChanged {
            id,
            signer,
            approved: true,
        }
        .publish(&e);
        // The approval that completes the quorum also runs the action, so
        // nobody signs twice. If the vault cannot cover a payment yet, the
        // approval is still recorded and `execute` remains available.
        // Remaining risk: a recipient that cannot receive the asset (missing
        // trustline, frozen) makes the transfer, and so this approval, revert.
        // The client checks recipients before proposing and approving.
        if p.approvals.len() >= c.rules.threshold && fundable(&e, &p) {
            apply(e.clone(), c, p);
        }
    }
    pub fn revoke(e: Env, signer: Address, id: u64) {
        let c = config(&e);
        member(&e, &c, &signer);
        let mut p = proposal(&e, id);
        pending(&e, &c, &p);
        let index = p
            .approvals
            .first_index_of(signer.clone())
            .unwrap_or_else(|| panic_with_error!(&e, Error::NotApproved));
        p.approvals.remove(index);
        save_proposal(&e, &p);
        ApprovalChanged {
            id,
            signer,
            approved: false,
        }
        .publish(&e);
    }
    pub fn cancel(e: Env, signer: Address, id: u64) {
        let c = config(&e);
        member(&e, &c, &signer);
        let mut p = proposal(&e, id);
        pending(&e, &c, &p);
        if p.proposer != signer {
            panic_with_error!(&e, Error::Unauthorized);
        }
        p.status = 2;
        save_proposal(&e, &p);
        ProposalChanged { id, proposal: p }.publish(&e);
    }
    /// Anybody may pay the network fee to execute an already approved action.
    /// State is consumed before token calls; failed transfers roll it all back.
    /// Fails with `InsufficientFunds` if the payment would spend owed fees.
    pub fn execute(e: Env, id: u64) {
        let c = config(&e);
        let p = proposal(&e, id);
        pending(&e, &c, &p);
        if p.approvals.len() < c.rules.threshold {
            panic_with_error!(&e, Error::Quorum);
        }
        apply(e, c, p);
    }
}

/// Whether the vault holds enough of the asset for a payment and its fee
/// without touching fees already owed to the collector.
fn fundable(e: &Env, p: &Proposal) -> bool {
    match &p.action {
        Action::Pay(asset, _, amount) => {
            let needed = amount
                .checked_add(p.fee)
                .and_then(|n| n.checked_add(fees_owed(e, asset)))
                .unwrap_or(i128::MAX);
            token::Client::new(e, asset).balance(&e.current_contract_address()) >= needed
        }
        Action::ChangeRules(_) => true,
    }
}
/// Executes an approved proposal. Callers check status, expiry, epoch and quorum.
fn apply(e: Env, mut c: Config, mut p: Proposal) {
    let id = p.id;
    if !fundable(&e, &p) {
        panic_with_error!(&e, Error::InsufficientFunds);
    }
    p.status = 1;
    save_proposal(&e, &p);
    match &p.action {
        Action::Pay(asset, to, amount) => {
            let client = token::Client::new(&e, asset);
            let vault = e.current_contract_address();
            client.transfer(&vault, to, amount);
            // The fee stays in the vault as owed to the collector; it is paid
            // out by `claim_fees`, so a collector that cannot receive never
            // blocks payments.
            if p.fee > 0 {
                let owed = fees_owed(&e, asset)
                    .checked_add(p.fee)
                    .unwrap_or_else(|| panic_with_error!(&e, Error::Overflow));
                e.storage()
                    .instance()
                    .set(&Key::FeesOwed(asset.clone()), &owed);
                FeeAccrued {
                    asset: asset.clone(),
                    id,
                    amount: p.fee,
                    owed,
                }
                .publish(&e);
            }
            let key = Key::Paid(to.clone());
            let count: u64 = e.storage().persistent().get(&key).unwrap_or(0);
            let next = count
                .checked_add(1)
                .unwrap_or_else(|| panic_with_error!(&e, Error::Overflow));
            e.storage().persistent().set(&key, &next);
            e.storage()
                .persistent()
                .extend_ttl(&key, TTL_THRESHOLD, TTL);
        }
        Action::ChangeRules(rules) => {
            c.rules = rules.clone();
            c.epoch = c
                .epoch
                .checked_add(1)
                .unwrap_or_else(|| panic_with_error!(&e, Error::Overflow));
            save_config(&e, &c);
        }
    }
    ProposalChanged { id, proposal: p }.publish(&e);
}

#[cfg(test)]
mod test;
