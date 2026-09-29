#![no_std]
use soroban_sdk::{contracterror, contracttype, panic_with_error, Address, Env, Vec};
#[contracterror]
#[derive(Copy, Clone, Debug, Eq, PartialEq)]
#[repr(u32)]
pub enum Error {
    InvalidRules = 1,
    Unauthorized = 2,
    InvalidAsset = 3,
    InvalidAmount = 4,
    InvalidFee = 5,
    InvalidExpiry = 6,
    NotFound = 7,
    Closed = 8,
    Expired = 9,
    StaleRules = 10,
    AlreadyApproved = 11,
    Quorum = 12,
    Nonce = 13,
    InvalidRecipient = 14,
    Overflow = 15,
    InvalidName = 16,
}
#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct Protocol {
    pub collector: Address,
    pub fee_bps: u32,
    pub assets: Vec<Address>,
}
#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct Rules {
    pub signers: Vec<Address>,
    pub threshold: u32,
}
pub fn validate_rules(e: &Env, rules: &Rules) {
    if rules.signers.len() < 2
        || rules.signers.len() > 20
        || rules.threshold < 2
        || rules.threshold > rules.signers.len()
    {
        panic_with_error!(e, Error::InvalidRules);
    }
    let mut seen = Vec::new(e);
    for signer in rules.signers.iter() {
        // v1 deliberately supports Stellar G accounts only. Contract signers
        // introduce custom authorization code and require a separate review.
        if signer.to_string().to_bytes().first() != Some(b'G') || seen.contains(&signer) {
            panic_with_error!(e, Error::InvalidRules);
        }
        seen.push_back(signer);
    }
}
pub fn validate_protocol(e: &Env, p: &Protocol) {
    if p.fee_bps > 1000 || p.collector.to_string().to_bytes().first() != Some(b'G') {
        panic_with_error!(e, Error::InvalidFee);
    }
    if p.assets.is_empty() || p.assets.len() > 16 {
        panic_with_error!(e, Error::InvalidAsset);
    }
    let mut seen = Vec::new(e);
    for asset in p.assets.iter() {
        // Built-in SAC only: no arbitrary token callbacks or upgradeable tokens.
        if asset.executable() != Some(soroban_sdk::Executable::StellarAsset)
            || seen.contains(&asset)
        {
            panic_with_error!(e, Error::InvalidAsset);
        }
        if p.fee_bps > 0 {
            // Reject configurations that cannot receive their own fees. Issuer
            // freezes or trustline removal after deployment can still block fees.
            soroban_sdk::token::Client::new(e, &asset).balance(&p.collector);
            if !soroban_sdk::token::StellarAssetClient::new(e, &asset).authorized(&p.collector) {
                panic_with_error!(e, Error::InvalidFee);
            }
        }
        seen.push_back(asset);
    }
}
