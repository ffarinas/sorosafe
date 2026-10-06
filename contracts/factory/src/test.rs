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
    let id = e.register(Factory, (wasm.clone(), protocol));
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
    // Every vault runs exactly the registered code.
    assert_eq!(
        first.executable(),
        Some(soroban_sdk::Executable::Wasm(wasm.clone()))
    );
    assert_eq!(
        second.executable(),
        Some(soroban_sdk::Executable::Wasm(wasm))
    );
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
fn factory(e: &Env) -> FactoryClient<'_> {
    e.mock_all_auths();
    e.ledger().with_mut(|l| l.max_entry_ttl = 6_312_000);
    let asset = e
        .register_stellar_asset_contract_v2(Address::generate(e))
        .address();
    let wasm = e.deployer().upload_contract_wasm(*include_bytes!(
        "../../target/wasm32v1-none/release/junto_vault.wasm"
    ));
    let id = e.register(
        Factory,
        (
            wasm,
            Protocol {
                collector: account(e, 4),
                fee_bps: 0,
                assets: vec![e, asset],
            },
        ),
    );
    FactoryClient::new(e, &id)
}
#[test]
fn factory_accepts_twenty_signers_and_rejects_twenty_one() {
    let e = Env::default();
    let c = factory(&e);
    let mut signers = Vec::new(&e);
    for n in 1..=20u8 {
        signers.push_back(account(&e, n));
    }
    let a = account(&e, 1);
    let name = String::from_str(&e, "Team");
    let rules = Rules {
        signers: signers.clone(),
        threshold: 20,
    };
    let vault = c.create(&a, &BytesN::from_array(&e, &[1; 32]), &name, &rules);
    assert!(c.is_vault(&vault));
    signers.push_back(account(&e, 21));
    assert_eq!(
        c.try_create(
            &a,
            &BytesN::from_array(&e, &[2; 32]),
            &name,
            &Rules {
                signers,
                threshold: 2
            }
        ),
        Err(Ok(Error::InvalidRules.into()))
    );
}
#[test]
fn vault_names_must_have_one_to_eighty_bytes() {
    let e = Env::default();
    let c = factory(&e);
    let a = account(&e, 1);
    let rules = Rules {
        signers: vec![&e, a.clone()],
        threshold: 1,
    };
    let long = "x".repeat(81);
    for (n, name) in [(1u8, ""), (2, &long[..])] {
        // The host reports a failed constructor as a deployment error; the
        // vault tests check the typed InvalidName itself.
        assert!(c
            .try_create(
                &a,
                &BytesN::from_array(&e, &[n; 32]),
                &String::from_str(&e, name),
                &rules
            )
            .is_err());
    }
    let vault = c.create(
        &a,
        &BytesN::from_array(&e, &[3; 32]),
        &String::from_str(&e, &long[..80]),
        &rules,
    );
    assert!(c.is_vault(&vault));
}
#[test]
fn factory_requires_a_collector_that_can_hold_fee_assets() {
    let e = Env::default();
    e.mock_all_auths();
    let asset = e
        .register_stellar_asset_contract_v2(Address::generate(&e))
        .address();
    let wasm = e.deployer().upload_contract_wasm(*include_bytes!(
        "../../target/wasm32v1-none/release/junto_vault.wasm"
    ));
    let protocol = |fee_bps| Protocol {
        collector: account(&e, 4),
        fee_bps,
        assets: vec![&e, asset.clone()],
    };
    let check = |p: Protocol| {
        let id = Address::generate(&e);
        e.register_at(&id, Factory, (wasm.clone(), p.clone()));
    };
    // No trustline and nothing to collect: fine.
    check(protocol(0));
    let result = std::panic::catch_unwind(std::panic::AssertUnwindSafe(|| check(protocol(25))));
    assert!(result.is_err());
}
