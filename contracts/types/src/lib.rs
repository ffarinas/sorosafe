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
    /// `revoke` by a signer who has not approved the proposal.
    NotApproved = 17,
    /// The vault cannot cover a payment plus its fee without spending fees
    /// already owed to the protocol.
    InsufficientFunds = 18,
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
    // A vault may start with its creator alone (1 of 1) and add signers later
    // through a ChangeRules proposal that keeps the same address.
    if rules.signers.is_empty()
        || rules.signers.len() > MAX_SIGNERS
        || rules.threshold < 1
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
/// Largest amount a Stellar Asset Contract can move in one transfer (i64).
pub const MAX_TRANSFER: i128 = i64::MAX as i128;
/// Highest service fee a protocol may configure: 10%.
pub const MAX_FEE_BPS: u32 = 1000;
pub const MAX_SIGNERS: u32 = 20;
pub const MAX_ASSETS: u32 = 16;
/// Shape checks shared by the factory and every vault. Fees accrue inside the
/// vault and are pulled by `claim_fees`, so whether the collector can receive
/// an asset never affects payments; the factory checks it once at deployment.
pub fn validate_protocol(e: &Env, p: &Protocol) {
    if p.fee_bps > MAX_FEE_BPS || p.collector.to_string().to_bytes().first() != Some(b'G') {
        panic_with_error!(e, Error::InvalidFee);
    }
    if p.assets.is_empty() || p.assets.len() > MAX_ASSETS {
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
        seen.push_back(asset);
    }
}
/// Deployment-time sanity check: a protocol whose collector cannot hold one of
/// its fee assets would accrue fees nobody can claim. Issuer freezes or
/// trustline removal after deployment only block `claim_fees`, not payments.
pub fn check_collector_receives(e: &Env, p: &Protocol) {
    if p.fee_bps == 0 {
        return;
    }
    for asset in p.assets.iter() {
        soroban_sdk::token::Client::new(e, &asset).balance(&p.collector);
        if !soroban_sdk::token::StellarAssetClient::new(e, &asset).authorized(&p.collector) {
            panic_with_error!(e, Error::InvalidFee);
        }
    }
}
