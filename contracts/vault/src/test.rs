extern crate std;
use super::*;
use soroban_sdk::{
    testutils::{Address as _, IssuerFlags, Ledger},
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
struct Opts {
    count: u32,
    threshold: u32,
    funds: i128,
    fee_bps: u32,
    trust_collector: bool,
}
impl Default for Opts {
    fn default() -> Self {
        Self {
            count: 3,
            threshold: 2,
            funds: 1_000_000,
            fee_bps: 25,
            trust_collector: true,
        }
    }
}
impl Fixture {
    fn new() -> Self {
        Self::build(Opts::default())
    }
    fn with_rule(count: u32, threshold: u32) -> Self {
        Self::build(Opts {
            count,
            threshold,
            ..Opts::default()
        })
    }
    /// The first `count` accounts sign with `threshold`; all three are kept in
    /// `signers` so tests can add the others later.
    fn build(o: Opts) -> Self {
        let Opts {
            count,
            threshold,
            funds,
            fee_bps,
            trust_collector,
        } = o;
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
        let sac = e.register_stellar_asset_contract_v2(admin);
        // Lets tests freeze the collector's trustline like a real issuer can.
        sac.issuer().set_flag(IssuerFlags::RevocableFlag);
        let asset = sac.address();
        if trust_collector {
            token::StellarAssetClient::new(&e, &asset).trust(&collector);
        }
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
                    fee_bps,
                    assets: vec![&e, asset.clone()],
                },
            ),
        );
        if funds > 0 {
            token::StellarAssetClient::new(&e, &asset).mint(&id, &funds);
        }
        Self {
            e,
            id,
            signers,
            asset,
            collector,
            to,
        }
    }
    fn token(&self) -> token::Client<'_> {
        token::Client::new(&self.e, &self.asset)
    }
    fn mint(&self, amount: i128) {
        token::StellarAssetClient::new(&self.e, &self.asset).mint(&self.id, &amount);
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
/// More than the fixture vault holds (1_000_000), so approvals stay pending.
const UNFUNDED: i128 = 2_000_000;
#[test]
fn payment_transfers_amount_and_accrues_exact_fee_until_claimed() {
    let f = Fixture::new();
    let c = f.client();
    let id = f.pay(100_001);
    // The approval that completes the quorum executes the payment.
    f.approve(id);
    let t = f.token();
    assert_eq!(t.balance(&f.to), 100_001);
    // The fee stays in the vault, owed to the collector.
    assert_eq!(t.balance(&f.collector), 0);
    assert_eq!(c.fees_owed(&f.asset), 251);
    assert_eq!(t.balance(&f.id), 899_999);
    assert_eq!(c.claim_fees(&f.asset), 251);
    assert_eq!(t.balance(&f.collector), 251);
    assert_eq!(t.balance(&f.id), 899_748);
    assert_eq!(c.fees_owed(&f.asset), 0);
    // Nothing left to claim: a no-op, not an error.
    assert_eq!(c.claim_fees(&f.asset), 0);
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
    let id = f.pay(UNFUNDED);
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
    let id = f.pay(UNFUNDED);
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
    let id = f.pay(UNFUNDED);
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
    let payment = f.pay(UNFUNDED);
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
    // A Stellar Asset Contract moves at most i64::MAX, fee included.
    assert_eq!(
        c.try_quote(&i128::MAX),
        Err(Ok(Error::InvalidAmount.into()))
    );
    let max = i64::MAX as i128;
    assert_eq!(c.try_quote(&max), Err(Ok(Error::InvalidAmount.into())));
    let largest = max * 400 / 401;
    assert!(largest + c.quote(&largest) <= max);
    assert_eq!(
        c.try_quote(&(largest + 2)),
        Err(Ok(Error::InvalidAmount.into()))
    );
}
#[test]
fn propose_rejects_amount_plus_fee_above_i64() {
    let f = Fixture::new();
    let c = f.client();
    let a = f.signers.get(0).unwrap();
    let max = i64::MAX as i128;
    for amount in [max, max - 1, i128::MAX] {
        assert_eq!(
            c.try_propose(
                &a,
                &0,
                &Action::Pay(f.asset.clone(), f.to.clone(), amount),
                &2_000
            ),
            Err(Ok(Error::InvalidAmount.into()))
        );
    }
}
#[test]
fn payment_that_cannot_cover_its_fee_stays_pending() {
    let f = Fixture::new();
    let c = f.client();
    // The vault holds exactly the amount but not the fee on top.
    let id = f.pay(1_000_000);
    f.approve(id);
    assert_eq!(c.proposal(&id).approvals.len(), 2);
    assert_eq!(c.try_execute(&id), Err(Ok(Error::InsufficientFunds.into())));
    let t = f.token();
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
    assert_eq!(c.proposal(&id).status, 1);
}
#[test]
fn unfunded_approval_is_recorded_and_executes_later() {
    let f = Fixture::new();
    let c = f.client();
    let id = f.pay(UNFUNDED);
    f.approve(id);
    // Quorum reached but the vault cannot pay yet: nothing moves.
    assert_eq!(c.proposal(&id).status, 0);
    assert_eq!(c.proposal(&id).approvals.len(), 2);
    token::StellarAssetClient::new(&f.e, &f.asset).mint(&f.id, &UNFUNDED);
    c.execute(&id);
    assert_eq!(c.proposal(&id).status, 1);
}
#[test]
fn unfunded_solo_proposal_stays_pending_and_executes_after_funding() {
    let f = Fixture::build(Opts {
        count: 1,
        threshold: 1,
        funds: 0,
        ..Opts::default()
    });
    let c = f.client();
    let id = f.pay(1_000);
    let p = c.proposal(&id);
    assert_eq!(p.status, 0);
    assert_eq!(p.approvals.len(), 1);
    assert_eq!(c.try_execute(&id), Err(Ok(Error::InsufficientFunds.into())));
    f.mint(1_003);
    c.execute(&id);
    assert_eq!(c.proposal(&id).status, 1);
    assert_eq!(f.token().balance(&f.to), 1_000);
    assert_eq!(c.fees_owed(&f.asset), 3);
}
#[test]
fn funding_boundary_includes_the_fee_and_owed_fees_are_never_spent() {
    // 400_000 pays a 1_000 fee at 25 bps: the vault needs 401_000.
    let f = Fixture::build(Opts {
        count: 1,
        threshold: 1,
        funds: 400_999,
        ..Opts::default()
    });
    let c = f.client();
    let t = f.token();
    let id = f.pay(400_000);
    assert_eq!(c.proposal(&id).status, 0);
    assert_eq!(c.try_execute(&id), Err(Ok(Error::InsufficientFunds.into())));
    f.mint(1);
    c.execute(&id);
    assert_eq!(c.proposal(&id).status, 1);
    assert_eq!(t.balance(&f.to), 400_000);
    assert_eq!(t.balance(&f.collector), 0);
    assert_eq!(t.balance(&f.id), 1_000);
    assert_eq!(c.fees_owed(&f.asset), 1_000);
    // The remaining balance is all owed fees: a new payment cannot use it.
    let next = f.pay(1);
    assert_eq!(c.proposal(&next).status, 0);
    assert_eq!(
        c.try_execute(&next),
        Err(Ok(Error::InsufficientFunds.into()))
    );
    // One short of amount + fee + owed fees still fails; exactly that is enough.
    f.mint(1);
    assert_eq!(
        c.try_execute(&next),
        Err(Ok(Error::InsufficientFunds.into()))
    );
    f.mint(1);
    c.execute(&next);
    assert_eq!(c.fees_owed(&f.asset), 1_001);
    assert_eq!(t.balance(&f.id), 1_001);
    assert_eq!(c.claim_fees(&f.asset), 1_001);
    assert_eq!(t.balance(&f.collector), 1_001);
    assert_eq!(t.balance(&f.id), 0);
    assert_eq!(c.fees_owed(&f.asset), 0);
}
#[test]
fn frozen_collector_blocks_only_fee_claims() {
    let f = Fixture::with_rule(1, 1);
    let c = f.client();
    let sac = token::StellarAssetClient::new(&f.e, &f.asset);
    sac.set_authorized(&f.collector, &false);
    let first = f.pay(400);
    let second = f.pay(800);
    assert_eq!(c.proposal(&first).status, 1);
    assert_eq!(c.proposal(&second).status, 1);
    assert_eq!(f.token().balance(&f.to), 1_200);
    assert_eq!(c.fees_owed(&f.asset), 3);
    assert!(c.try_claim_fees(&f.asset).is_err());
    assert_eq!(c.fees_owed(&f.asset), 3);
    sac.set_authorized(&f.collector, &true);
    assert_eq!(c.claim_fees(&f.asset), 3);
    assert_eq!(f.token().balance(&f.collector), 3);
}
#[test]
fn collector_without_trustline_blocks_only_fee_claims() {
    let f = Fixture::build(Opts {
        count: 1,
        threshold: 1,
        trust_collector: false,
        ..Opts::default()
    });
    let c = f.client();
    let id = f.pay(400);
    assert_eq!(c.proposal(&id).status, 1);
    assert_eq!(f.token().balance(&f.to), 400);
    assert!(c.try_claim_fees(&f.asset).is_err());
    assert_eq!(c.fees_owed(&f.asset), 1);
}
#[test]
fn zero_fee_vault_owes_nothing() {
    let f = Fixture::build(Opts {
        count: 1,
        threshold: 1,
        fee_bps: 0,
        ..Opts::default()
    });
    let c = f.client();
    assert_eq!(c.quote(&1_000_000), 0);
    let id = f.pay(1_000_000);
    assert_eq!(c.proposal(&id).status, 1);
    assert_eq!(c.proposal(&id).fee, 0);
    assert_eq!(c.fees_owed(&f.asset), 0);
    assert_eq!(c.claim_fees(&f.asset), 0);
    assert_eq!(f.token().balance(&f.id), 0);
}
#[test]
fn revoke_without_approval_is_rejected() {
    let f = Fixture::new();
    let c = f.client();
    let id = f.pay(UNFUNDED);
    assert_eq!(
        c.try_revoke(&f.signers.get(1).unwrap(), &id),
        Err(Ok(Error::NotApproved.into()))
    );
    c.revoke(&f.signers.get(0).unwrap(), &id);
    assert_eq!(
        c.try_revoke(&f.signers.get(0).unwrap(), &id),
        Err(Ok(Error::NotApproved.into()))
    );
}
#[test]
fn expiry_may_be_exactly_seven_days_away() {
    let f = Fixture::new();
    let c = f.client();
    let a = f.signers.get(0).unwrap();
    let pay = Action::Pay(f.asset.clone(), f.to.clone(), UNFUNDED);
    let limit = 1_000 + 7 * 24 * 60 * 60;
    assert_eq!(
        c.try_propose(&a, &0, &pay, &(limit + 1)),
        Err(Ok(Error::InvalidExpiry.into()))
    );
    assert_eq!(c.propose(&a, &0, &pay, &limit), 0);
}
#[test]
fn rules_accept_twenty_signers_and_reject_twenty_one() {
    let f = Fixture::new();
    let c = f.client();
    let a = f.signers.get(0).unwrap();
    let mut signers = vec![&f.e, a.clone()];
    for n in 10..29u8 {
        signers.push_back(account(&f.e, n));
    }
    assert_eq!(signers.len(), 20);
    let mut too_many = signers.clone();
    too_many.push_back(account(&f.e, 29));
    assert_eq!(
        c.try_propose(
            &a,
            &0,
            &Action::ChangeRules(Rules {
                signers: too_many,
                threshold: 2
            }),
            &2_000
        ),
        Err(Ok(Error::InvalidRules.into()))
    );
    let rules = Rules {
        signers,
        threshold: 20,
    };
    let id = c.propose(&a, &0, &Action::ChangeRules(rules.clone()), &2_000);
    f.approve(id);
    assert_eq!(c.config().rules, rules);
}
#[test]
fn protocol_settings_are_validated() {
    let f = Fixture::new();
    let e = &f.e;
    let other = e
        .register_stellar_asset_contract_v2(Address::generate(e))
        .address();
    let protocol = |fee_bps: u32, assets: Vec<Address>| Protocol {
        collector: f.collector.clone(),
        fee_bps,
        assets,
    };
    let check = |p: Protocol| e.try_as_contract::<(), Error>(&f.id, || validate_protocol(e, &p));
    assert_eq!(check(protocol(1_000, vec![e, f.asset.clone()])), Ok(()));
    assert_eq!(
        check(protocol(1_001, vec![e, f.asset.clone()])),
        Err(Ok(Error::InvalidFee))
    );
    assert_eq!(
        check(protocol(25, vec![e, f.asset.clone(), f.asset.clone()])),
        Err(Ok(Error::InvalidAsset))
    );
    assert_eq!(
        check(protocol(25, Vec::new(e))),
        Err(Ok(Error::InvalidAsset))
    );
    assert_eq!(
        check(protocol(25, vec![e, f.to.clone()])),
        Err(Ok(Error::InvalidAsset))
    );
    let mut many = Vec::new(e);
    for _ in 0..16 {
        many.push_back(
            e.register_stellar_asset_contract_v2(Address::generate(e))
                .address(),
        );
    }
    assert_eq!(check(protocol(0, many.clone())), Ok(()));
    many.push_back(other.clone());
    assert_eq!(check(protocol(0, many)), Err(Ok(Error::InvalidAsset)));
    // The factory's deployment check: the collector must hold every fee asset,
    // unless there is no fee to collect.
    let receives = |p: Protocol| {
        e.try_as_contract::<(), Error>(&f.id, || junto_types::check_collector_receives(e, &p))
    };
    assert_eq!(receives(protocol(25, vec![e, f.asset.clone()])), Ok(()));
    assert!(receives(protocol(25, vec![e, other.clone()])).is_err());
    assert_eq!(receives(protocol(0, vec![e, other])), Ok(()));
}
#[test]
fn vault_names_must_have_one_to_eighty_bytes() {
    let f = Fixture::new();
    let e = &f.e;
    let c = f.client().config();
    let long = "x".repeat(81);
    let build = |name: &str| {
        let name = String::from_str(e, name);
        e.try_as_contract::<(), Error>(&f.id, || {
            Vault::__constructor(
                e.clone(),
                c.factory.clone(),
                name,
                c.rules.clone(),
                c.protocol.clone(),
            )
        })
    };
    assert_eq!(build(""), Err(Ok(Error::InvalidName)));
    assert_eq!(build(&long), Err(Ok(Error::InvalidName)));
    assert_eq!(build(&long[..80]), Ok(()));
}
