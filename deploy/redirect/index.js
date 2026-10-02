// sorosafe.app points to the Testnet app until Mainnet launches.
const redirect = {
  fetch(request) {
    const url = new URL(request.url);
    return Response.redirect(
      `https://testnet.sorosafe.app${url.pathname}${url.search}`,
      302,
    );
  },
};
export default redirect;
