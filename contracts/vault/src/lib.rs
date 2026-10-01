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

pub use junto_types::{validate_protocol, validate_rules, Error, Protocol, Rules};
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
    pub fn quote(e: Env, amount: i128) -> i128 {
        if amount <= 0 {
            panic_with_error!(&e, Error::InvalidAmount);
        }
        let c = config(&e);
        let fee = mul_div_ceil(&e, &amount, &(c.protocol.fee_bps as i128), &10_000);
        amount
            .checked_add(fee)
            .unwrap_or_else(|| panic_with_error!(&e, Error::Overflow));
        fee
    }
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
                Self::quote(e.clone(), *amount)
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
        // instead of asking for a second transaction.
        if p.approvals.len() >= c.rules.threshold {
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
    }
    pub fn revoke(e: Env, signer: Address, id: u64) {
        let c = config(&e);
        member(&e, &c, &signer);
        let mut p = proposal(&e, id);
        pending(&e, &c, &p);
        if let Some(index) = p.approvals.first_index_of(signer.clone()) {
            p.approvals.remove(index);
        }
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

/// Executes an approved proposal. Callers check status, expiry, epoch and quorum.
fn apply(e: Env, mut c: Config, mut p: Proposal) {
    let id = p.id;
    p.status = 1;
    save_proposal(&e, &p);
    match &p.action {
        Action::Pay(asset, to, amount) => {
            let client = token::Client::new(&e, asset);
            let vault = e.current_contract_address();
            client.transfer(&vault, to, amount);
            if p.fee > 0 {
                client.transfer(&vault, &c.protocol.collector, &p.fee);
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
