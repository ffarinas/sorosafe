extern crate std;
use super::*;
use soroban_sdk::testutils::{Address as _, Ledger};

fn setup() -> (Env, Address, Address, FaucetClient<'static>) {
    let e = Env::default();
    e.mock_all_auths();
    e.ledger().with_mut(|l| l.timestamp = 1_000);
    let admin = Address::generate(&e);
    let asset = e.register_stellar_asset_contract_v2(admin).address();
    let id = e.register(Faucet, (asset.clone(), 100_i128));
    token::StellarAssetClient::new(&e, &asset).mint(&id, &250);
    let client = FaucetClient::new(&e, &id);
    (e, asset, id, client)
}

#[test]
fn claims_once_per_day_and_stops_when_empty() {
    let (e, asset, _, c) = setup();
    let a = Address::generate(&e);
    let t = token::Client::new(&e, &asset);
    assert_eq!(c.claim(&a), 100);
    assert_eq!(t.balance(&a), 100);
    assert_eq!(c.try_claim(&a), Err(Ok(Error::TooSoon.into())));
    assert_eq!(c.wait(&a), DAY);
    e.ledger().with_mut(|l| l.timestamp = 1_000 + DAY);
    assert_eq!(c.wait(&a), 0);
    c.claim(&a);
    // 50 left: not enough for another full claim.
    let b = Address::generate(&e);
    assert_eq!(c.try_claim(&b), Err(Ok(Error::Empty.into())));
}

#[test]
fn claim_requires_the_receiver_auth() {
    let (e, _, _, c) = setup();
    let a = Address::generate(&e);
    e.set_auths(&[]);
    assert!(c.try_claim(&a).is_err());
}
