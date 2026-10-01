extern crate std;
use super::*;
use soroban_sdk::{
    testutils::{Address as _, Ledger},
    vec, xdr, TryFromVal,
};
use std::rc::Rc;

fn account(e: &Env, n: u8) -> Address {
    let id = xdr::AccountId(xdr::PublicKey::PublicKeyTypeEd25519(xdr::Uint256([n; 32])));
    e.host()
        .add_ledger_entry(
            &Rc::new(xdr::LedgerKey::Account(xdr::LedgerKeyAccount {
                account_id: id.clone(),
            })),
            &Rc::new(xdr::LedgerEntry {
                data: xdr::LedgerEntryData::Account(xdr::AccountEntry {
                    account_id: id.clone(),
                    balance: 1_000_000_000,
                    flags: 0,
                    home_domain: Default::default(),
                    inflation_dest: None,
                    num_sub_entries: 0,
                    seq_num: xdr::SequenceNumber(0),
                    thresholds: xdr::Thresholds([1; 4]),
                    signers: Default::default(),
                    ext: xdr::AccountEntryExt::V0,
                }),
                last_modified_ledger_seq: 0,
                ext: xdr::LedgerEntryExt::V0,
            }),
            None,
        )
        .unwrap();
    Address::try_from_val(e, &xdr::ScAddress::Account(id)).unwrap()
}
struct Fixture {
    e: Env,
    id: Address,
    signers: Vec<Address>,
    asset: Address,
    collector: Address,
    to: Address,
}
impl Fixture {
    fn new() -> Self {
        Self::with_rule(3, 2)
    }
    /// The first `count` accounts sign with `threshold`; all four are kept in
    /// `signers` so tests can add the others later.
    fn with_rule(count: u32, threshold: u32) -> Self {
        let e = Env::default();
        e.ledger().with_mut(|l| {
            l.timestamp = 1_000;
            l.max_entry_ttl = 6_312_000;
        });
        e.mock_all_auths();
        let signers = vec![&e, account(&e, 1), account(&e, 2), account(&e, 3)];
        let collector = account(&e, 4);
        let to = account(&e, 5);
        let admin = Address::generate(&e);
        let asset = e.register_stellar_asset_contract_v2(admin).address();
        token::StellarAssetClient::new(&e, &asset).trust(&collector);
        token::StellarAssetClient::new(&e, &asset).trust(&to);
        let id = e.register(
            Vault,
            (
                Address::generate(&e),
                String::from_str(&e, "Team"),
                Rules {
                    signers: signers.slice(0..count),
                    threshold,
                },
                Protocol {
                    collector: collector.clone(),
                    fee_bps: 25,
                    assets: vec![&e, asset.clone()],
                },
            ),
        );
        token::StellarAssetClient::new(&e, &asset).mint(&id, &1_000_000);
        Self {
            e,
            id,
            signers,
            asset,
            collector,
            to,
        }
    }
    fn client(&self) -> VaultClient<'_> {
        VaultClient::new(&self.e, &self.id)
    }
    fn pay(&self, amount: i128) -> u64 {
        let c = self.client();
        c.propose(
            &self.signers.get(0).unwrap(),
            &c.config().next_id,
            &Action::Pay(self.asset.clone(), self.to.clone(), amount),
            &2_000,
        )
    }
    /// Adds approvals from other signers until the proposal reaches quorum.
    fn approve(&self, id: u64) {
        let c = self.client();
        let threshold = c.config().rules.threshold;
        for s in self.signers.iter() {
            let p = c.proposal(&id);
            if p.approvals.len() >= threshold {
                break;
            }
            if !p.approvals.contains(&s) {
                c.approve(&s, &id);
            }
        }
    }
}
#[test]
fn transfers_and_fee_are_atomic_and_exact() {
    let f = Fixture::new();
    let c = f.client();
    let id = f.pay(100_001);
    f.approve(id);
    c.execute(&id);
    let t = token::Client::new(&f.e, &f.asset);
    assert_eq!(t.balance(&f.to), 100_001);
    assert_eq!(t.balance(&f.collector), 251);
    assert_eq!(t.balance(&f.id), 899_748);
    assert_eq!(c.proposal(&id).status, 1);
    assert_eq!(c.payments_to(&f.to), 1);
    assert_eq!(c.payments_to(&f.collector), 0);
    assert_eq!(c.try_execute(&id), Err(Ok(Error::Closed.into())));
}
#[test]
fn cannot_execute_with_one_approval_or_duplicate_it() {
    let f = Fixture::new();
    let c = f.client();
    let id = f.pay(100);
    // The proposer's approval is already recorded and cannot be repeated.
    assert_eq!(c.proposal(&id).approvals.len(), 1);
    assert_eq!(
        c.try_approve(&f.signers.get(0).unwrap(), &id),
        Err(Ok(Error::AlreadyApproved.into()))
    );
    assert_eq!(c.try_execute(&id), Err(Ok(Error::Quorum.into())));
}
#[test]
fn proposer_counts_as_first_approval() {
    let f = Fixture::new();
    let c = f.client();
    let id = f.pay(100);
    assert_eq!(
        c.proposal(&id).approvals,
        vec![&f.e, f.signers.get(0).unwrap()]
    );
    // With a 2-of-3 rule, one more signer is enough.
    c.approve(&f.signers.get(1).unwrap(), &id);
    c.execute(&id);
    assert_eq!(c.proposal(&id).status, 1);
}
#[test]
fn proposer_can_withdraw_their_initial_approval() {
    let f = Fixture::new();
    let c = f.client();
    let id = f.pay(100);
    c.revoke(&f.signers.get(0).unwrap(), &id);
    assert_eq!(c.proposal(&id).approvals.len(), 0);
    c.approve(&f.signers.get(1).unwrap(), &id);
    assert_eq!(c.try_execute(&id), Err(Ok(Error::Quorum.into())));
}
#[test]
fn nonmember_cannot_propose_approve_cancel_or_revoke() {
    let f = Fixture::new();
    let c = f.client();
    let id = f.pay(100);
    assert_eq!(
        c.try_propose(
            &f.to,
            &1,
            &Action::Pay(f.asset.clone(), f.to.clone(), 1),
            &2_000
        ),
        Err(Ok(Error::Unauthorized.into()))
    );
    assert_eq!(
        c.try_approve(&f.to, &id),
        Err(Ok(Error::Unauthorized.into()))
    );
    assert_eq!(
        c.try_cancel(&f.to, &id),
        Err(Ok(Error::Unauthorized.into()))
    );
    assert_eq!(
        c.try_revoke(&f.to, &id),
        Err(Ok(Error::Unauthorized.into()))
    );
}
#[test]
fn revocation_removes_only_own_approval() {
    let f = Fixture::new();
    let c = f.client();
    let id = f.pay(100);
    f.approve(id);
    c.revoke(&f.signers.get(0).unwrap(), &id);
    assert_eq!(
        c.proposal(&id).approvals,
        vec![&f.e, f.signers.get(1).unwrap()]
    );
    assert_eq!(c.try_execute(&id), Err(Ok(Error::Quorum.into())));
}
#[test]
fn cancel_requires_proposer_and_is_terminal() {
    let f = Fixture::new();
    let c = f.client();
    let id = f.pay(100);
    f.approve(id);
    assert_eq!(
        c.try_cancel(&f.signers.get(1).unwrap(), &id),
        Err(Ok(Error::Unauthorized.into()))
    );
    c.cancel(&f.signers.get(0).unwrap(), &id);
    assert_eq!(c.try_execute(&id), Err(Ok(Error::Closed.into())));
    assert_eq!(
        c.try_approve(&f.signers.get(2).unwrap(), &id),
        Err(Ok(Error::Closed.into()))
    );
}
#[test]
fn expiration_is_enforced_on_approval_and_execution() {
    let f = Fixture::new();
    let c = f.client();
    let id = f.pay(100);
    f.approve(id);
    f.e.ledger().with_mut(|l| l.timestamp = 2_000);
    assert_eq!(c.try_execute(&id), Err(Ok(Error::Expired.into())));
    assert_eq!(
        c.try_approve(&f.signers.get(2).unwrap(), &id),
        Err(Ok(Error::Expired.into()))
    );
}
#[test]
fn rotation_requires_old_quorum_and_invalidates_pending_actions() {
    let f = Fixture::new();
    let c = f.client();
    let payment = f.pay(100);
    f.approve(payment);
    let replacement = account(&f.e, 6);
    let rules = Rules {
        signers: vec![
            &f.e,
            replacement.clone(),
            f.signers.get(1).unwrap(),
            f.signers.get(2).unwrap(),
        ],
        threshold: 3,
    };
    let change = c.propose(
        &f.signers.get(1).unwrap(),
        &1,
        &Action::ChangeRules(rules.clone()),
        &2_000,
    );
    assert_eq!(c.try_execute(&change), Err(Ok(Error::Quorum.into())));
    f.approve(change);
    c.execute(&change);
    assert_eq!(c.config().rules, rules);
    assert_eq!(c.config().epoch, 1);
    assert_eq!(c.try_execute(&payment), Err(Ok(Error::StaleRules.into())));
    assert_eq!(
        c.try_approve(&f.signers.get(0).unwrap(), &payment),
        Err(Ok(Error::Unauthorized.into()))
    );
}
#[test]
fn invalid_rules_are_rejected_including_duplicate_and_contract_signers() {
    let f = Fixture::new();
    let c = f.client();
    let a = f.signers.get(0).unwrap();
    for rules in [
        Rules {
            signers: f.signers.clone(),
            threshold: 0,
        },
        Rules {
            signers: Vec::new(&f.e),
            threshold: 1,
        },
        Rules {
            signers: f.signers.clone(),
            threshold: 4,
        },
        Rules {
            signers: vec![&f.e, a.clone(), a.clone()],
            threshold: 2,
        },
        Rules {
            signers: vec![&f.e, a.clone(), f.id.clone()],
            threshold: 2,
        },
    ] {
        assert_eq!(
            c.try_propose(&a, &0, &Action::ChangeRules(rules), &2_000),
            Err(Ok(Error::InvalidRules.into()))
        );
    }
}
#[test]
fn fees_cannot_overflow_and_round_up_without_floating_point() {
    let f = Fixture::new();
    let c = f.client();
    assert_eq!(c.quote(&1), 1);
    assert_eq!(c.quote(&400), 1);
    assert_eq!(c.quote(&401), 2);
    assert_eq!(c.try_quote(&0), Err(Ok(Error::InvalidAmount.into())));
    assert_eq!(c.try_quote(&-1), Err(Ok(Error::InvalidAmount.into())));
    assert_eq!(c.try_quote(&i128::MAX), Err(Ok(Error::Overflow.into())));
    let large = i128::MAX / 2;
    assert!(c.quote(&large) > 0);
}
#[test]
fn failed_fee_rolls_back_recipient_transfer_and_execution_state() {
    let f = Fixture::new();
    let c = f.client();
    let id = f.pay(1_000_000);
    f.approve(id);
    assert!(c.try_execute(&id).is_err());
    let t = token::Client::new(&f.e, &f.asset);
    assert_eq!(t.balance(&f.to), 0);
    assert_eq!(t.balance(&f.id), 1_000_000);
    assert_eq!(c.proposal(&id).status, 0);
    assert_eq!(c.payments_to(&f.to), 0);
}
#[test]
fn proposal_identity_nonce_asset_and_destination_are_checked() {
    let f = Fixture::new();
    let c = f.client();
    let a = f.signers.get(0).unwrap();
    assert_eq!(
        c.try_propose(
            &a,
            &1,
            &Action::Pay(f.asset.clone(), f.to.clone(), 1),
            &2_000
        ),
        Err(Ok(Error::Nonce.into()))
    );
    assert_eq!(
        c.try_propose(&a, &0, &Action::Pay(f.to.clone(), f.to.clone(), 1), &2_000),
        Err(Ok(Error::InvalidAsset.into()))
    );
    assert_eq!(
        c.try_propose(
            &a,
            &0,
            &Action::Pay(f.asset.clone(), f.id.clone(), 1),
            &2_000
        ),
        Err(Ok(Error::InvalidRecipient.into()))
    );
    assert_eq!(
        c.try_propose(
            &a,
            &0,
            &Action::Pay(f.asset.clone(), f.to.clone(), 1),
            &1_000
        ),
        Err(Ok(Error::InvalidExpiry.into()))
    );
    assert_eq!(
        c.try_propose(
            &a,
            &0,
            &Action::Pay(f.asset.clone(), f.to.clone(), 1),
            &700_000
        ),
        Err(Ok(Error::InvalidExpiry.into()))
    );
    f.pay(1);
    assert_eq!(c.config().next_id, 1);
}
#[test]
fn no_host_authorization_means_no_approval() {
    let f = Fixture::new();
    let id = f.pay(100);
    // Clear mocks: unlike the business-logic tests, this verifies require_auth
    // actually executes. Real Ed25519 verification is also exercised on Testnet.
    f.e.set_auths(&[]);
    // Signer 1 has not approved yet; only missing auth can stop them here.
    assert!(f
        .client()
        .try_approve(&f.signers.get(1).unwrap(), &id)
        .is_err());
    assert_eq!(f.client().proposal(&id).approvals.len(), 1);
}
#[test]
fn solo_vault_executes_with_the_creator_alone() {
    let f = Fixture::with_rule(1, 1);
    let c = f.client();
    // Proposing reaches the 1-of-1 quorum, so the payment runs immediately.
    let id = f.pay(1_000);
    assert_eq!(c.proposal(&id).status, 1);
    let t = token::Client::new(&f.e, &f.asset);
    assert_eq!(t.balance(&f.to), 1_000);
    assert_eq!(c.try_execute(&id), Err(Ok(Error::Closed.into())));
}
#[test]
fn solo_vault_adds_signers_and_then_needs_their_approval() {
    let f = Fixture::with_rule(1, 1);
    let c = f.client();
    let owner = f.signers.get(0).unwrap();
    let rules = Rules {
        signers: f.signers.slice(0..2),
        threshold: 2,
    };
    let change = c.propose(&owner, &0, &Action::ChangeRules(rules.clone()), &2_000);
    assert_eq!(c.proposal(&change).status, 1);
    assert_eq!(c.config().rules, rules);
    // Now the creator alone is no longer enough.
    let id = f.pay(100);
    assert_eq!(c.proposal(&id).status, 0);
    assert_eq!(c.try_execute(&id), Err(Ok(Error::Quorum.into())));
    c.approve(&f.signers.get(1).unwrap(), &id);
    c.execute(&id);
    assert_eq!(c.proposal(&id).status, 1);
}
