// sorosafe.app points to the Testnet app until Mainnet launches.
export default {
  fetch(request) {
    const url = new URL(request.url);
    return Response.redirect(
      `https://testnet.sorosafe.app${url.pathname}${url.search}`,
      302,
    );
  },
};
