#![no_std]
//! Testnet faucet: hands out a fixed amount of one token per account per day.
//! It holds its own balance and has no admin, so no server key is needed to
//! give test funds; anyone can top it up with a normal token transfer.
use soroban_sdk::{
    contract, contracterror, contractevent, contractimpl, contracttype, panic_with_error,
    token, Address, Env,
};

const DAY: u64 = 86_400;
const TTL: u32 = 30 * 17_280;
const TTL_THRESHOLD: u32 = 7 * 17_280;

#[contracttype]
#[derive(Clone)]
enum Key {
    Token,
    Amount,
    Last(Address),
}
#[contracterror]
#[derive(Copy, Clone, Debug, Eq, PartialEq, PartialOrd, Ord)]
#[repr(u32)]
pub enum Error {
    TooSoon = 1,
    Empty = 2,
    InvalidAmount = 3,
}
#[contractevent]
#[derive(Clone)]
pub struct Claimed {
    #[topic]
    pub to: Address,
    pub amount: i128,
}
#[contract]
pub struct Faucet;

#[contractimpl]
impl Faucet {
    pub fn __constructor(e: Env, token: Address, amount: i128) {
        if amount <= 0 {
            panic_with_error!(&e, Error::InvalidAmount);
        }
        e.storage().instance().set(&Key::Token, &token);
        e.storage().instance().set(&Key::Amount, &amount);
        e.storage().instance().extend_ttl(TTL_THRESHOLD, TTL);
    }
    pub fn token(e: Env) -> Address {
        e.storage().instance().get(&Key::Token).unwrap()
    }
    pub fn amount(e: Env) -> i128 {
        e.storage().instance().get(&Key::Amount).unwrap()
    }
    /// Seconds until `to` can claim again (0 when it can claim now).
    pub fn wait(e: Env, to: Address) -> u64 {
        let last: Option<u64> = e.storage().persistent().get(&Key::Last(to));
        match last {
            Some(t) => (t + DAY).saturating_sub(e.ledger().timestamp()),
            None => 0,
        }
    }
    pub fn claim(e: Env, to: Address) -> i128 {
        to.require_auth();
        e.storage().instance().extend_ttl(TTL_THRESHOLD, TTL);
        if Self::wait(e.clone(), to.clone()) > 0 {
            panic_with_error!(&e, Error::TooSoon);
        }
        let amount = Self::amount(e.clone());
        let client = token::Client::new(&e, &Self::token(e.clone()));
        let me = e.current_contract_address();
        if client.balance(&me) < amount {
            panic_with_error!(&e, Error::Empty);
        }
        client.transfer(&me, &to, &amount);
        let key = Key::Last(to.clone());
        e.storage().persistent().set(&key, &e.ledger().timestamp());
        e.storage().persistent().extend_ttl(&key, TTL_THRESHOLD, TTL);
        Claimed { to, amount }.publish(&e);
        amount
    }
}

#[cfg(test)]
mod test;
