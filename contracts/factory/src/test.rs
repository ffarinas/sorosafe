extern crate std;
use super::*;
use soroban_sdk::{
    testutils::{Address as _, Ledger},
    vec, xdr, TryFromVal,
};
fn account(e: &Env, n: u8) -> Address {
    Address::try_from_val(
        e,
        &xdr::ScAddress::Account(xdr::AccountId(xdr::PublicKey::PublicKeyTypeEd25519(
            xdr::Uint256([n; 32]),
        ))),
    )
    .unwrap()
}
#[test]
fn deployment_is_atomic_registered_and_namespaced_by_creator() {
    let e = Env::default();
    e.mock_all_auths();
    e.ledger().with_mut(|l| l.max_entry_ttl = 6_312_000);
    let asset = e
        .register_stellar_asset_contract_v2(Address::generate(&e))
        .address();
    let wasm = e.deployer().upload_contract_wasm(*include_bytes!(
        "../../target/wasm32v1-none/release/junto_vault.wasm"
    ));
    let protocol = Protocol {
        collector: account(&e, 4),
        fee_bps: 0,
        assets: vec![&e, asset],
    };
    let id = e.register(Factory, (wasm, protocol));
    let c = FactoryClient::new(&e, &id);
    let a = account(&e, 1);
    let b = account(&e, 2);
    let rules = Rules {
        signers: vec![&e, a.clone(), b.clone()],
        threshold: 2,
    };
    let salt = BytesN::from_array(&e, &[1; 32]);
    let name = String::from_str(&e, "Team");
    let first = c.create(&a, &salt, &name, &rules);
    assert!(c.is_vault(&first));
    let second = c.create(&b, &salt, &name, &rules);
    assert_ne!(first, second);
    assert!(c.is_vault(&second));
    assert!(c.try_create(&a, &salt, &name, &rules).is_err());
    assert!(!c.is_vault(&Address::generate(&e)));
    let cfg: junto_vault::Config =
        e.invoke_contract(&first, &soroban_sdk::symbol_short!("config"), vec![&e]);
    assert_eq!(cfg.factory, id);
    assert_eq!(cfg.rules, rules);
}
#[test]
fn factory_creation_rejects_nonmember_creator_and_missing_auth() {
    let e = Env::default();
    e.mock_all_auths();
    e.ledger().with_mut(|l| l.max_entry_ttl = 6_312_000);
    let asset = e
        .register_stellar_asset_contract_v2(Address::generate(&e))
        .address();
    let wasm = e.deployer().upload_contract_wasm(*include_bytes!(
        "../../target/wasm32v1-none/release/junto_vault.wasm"
    ));
    let id = e.register(
        Factory,
        (
            wasm,
            Protocol {
                collector: account(&e, 4),
                fee_bps: 0,
                assets: vec![&e, asset],
            },
        ),
    );
    let c = FactoryClient::new(&e, &id);
    let a = account(&e, 1);
    let b = account(&e, 2);
    let rules = Rules {
        signers: vec![&e, a.clone(), b],
        threshold: 2,
    };
    let salt = BytesN::from_array(&e, &[1; 32]);
    let name = String::from_str(&e, "Team");
    assert_eq!(
        c.try_create(&account(&e, 3), &salt, &name, &rules),
        Err(Ok(Error::Unauthorized.into()))
    );
    e.set_auths(&[]);
    assert!(c.try_create(&a, &salt, &name, &rules).is_err());
}
