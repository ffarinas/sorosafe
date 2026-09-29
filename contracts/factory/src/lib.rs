#![no_std]
use junto_types::{validate_protocol, validate_rules, Error, Protocol, Rules};
use soroban_sdk::{
    auth::{ContractContext, InvokerContractAuthEntry, SubContractInvocation},
    contract, contractevent, contractimpl, contracttype, panic_with_error, vec,
    xdr::ToXdr,
    Address, BytesN, Env, IntoVal, String, Symbol, Vec,
};
#[contracttype]
#[derive(Clone)]
pub struct Config {
    pub wasm_hash: BytesN<32>,
    pub protocol: Protocol,
}
#[contracttype]
#[derive(Clone)]
enum Key {
    Config,
    Vault(Address),
}
#[contractevent]
#[derive(Clone)]
pub struct VaultCreated {
    #[topic]
    pub vault: Address,
}
#[contract]
pub struct Factory;
fn config(e: &Env) -> Config {
    e.storage().instance().extend_ttl(7 * 17_280, 30 * 17_280);
    e.storage().instance().get(&Key::Config).unwrap()
}
#[contractimpl]
impl Factory {
    pub fn __constructor(e: Env, wasm_hash: BytesN<32>, protocol: Protocol) {
        validate_protocol(&e, &protocol);
        e.storage().instance().set(
            &Key::Config,
            &Config {
                wasm_hash,
                protocol,
            },
        );
        e.storage().instance().extend_ttl(7 * 17_280, 30 * 17_280);
    }
    pub fn config(e: Env) -> Config {
        config(&e)
    }
    pub fn create(
        e: Env,
        creator: Address,
        salt: BytesN<32>,
        name: String,
        rules: Rules,
    ) -> Address {
        creator.require_auth();
        validate_rules(&e, &rules);
        if !rules.signers.contains(&creator) {
            panic_with_error!(&e, Error::Unauthorized);
        }
        let c = config(&e);
        // Namespaced by authenticated creator: another account cannot preempt
        // the address by copying a pending create transaction's salt.
        let namespaced = e.crypto().sha256(&(creator, salt).to_xdr(&e));
        let deployer = e.deployer().with_current_contract(namespaced);
        let constructor_args = (e.current_contract_address(), name, rules, c.protocol);
        // The constructor is below the host deployment frame, so authorization
        // must explicitly bind the predicted address and exact constructor args.
        e.authorize_as_current_contract(vec![
            &e,
            InvokerContractAuthEntry::Contract(SubContractInvocation {
                context: ContractContext {
                    contract: deployer.deployed_address(),
                    fn_name: Symbol::new(&e, "__constructor"),
                    args: constructor_args.clone().into_val(&e),
                },
                sub_invocations: Vec::new(&e),
            }),
        ]);
        let vault = deployer.deploy_v2(c.wasm_hash, constructor_args);
        let key = Key::Vault(vault.clone());
        e.storage().persistent().set(&key, &true);
        e.storage()
            .persistent()
            .extend_ttl(&key, 7 * 17_280, 30 * 17_280);
        VaultCreated {
            vault: vault.clone(),
        }
        .publish(&e);
        vault
    }
    pub fn is_vault(e: Env, vault: Address) -> bool {
        config(&e);
        let key = Key::Vault(vault);
        if e.storage().persistent().has(&key) {
            e.storage()
                .persistent()
                .extend_ttl(&key, 7 * 17_280, 30 * 17_280);
            true
        } else {
            false
        }
    }
}

#[cfg(test)]
mod test;
