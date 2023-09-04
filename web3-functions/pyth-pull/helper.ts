/* eslint-disable @typescript-eslint/naming-convention */

import { gql } from "graphql-request";
import { gqlFetchAll } from "./utils";

const SUBQUERY_URL =
  "https://subgraph.satsuma-prod.com/a30e504dd617/y2k-finance/v2-prod/api";
const MARKETS_QUERY = gql`
  {
    markets(where: { isV2: true }) {
      strikePrice
      token
      marketIndex
      isV2
    }
  }
`;
type MarketsResponse = {
  markets: {
    token: string;
    strikePrice: string;
    marketIndex: string;
    isV2: boolean;
  }[];
};

export const fetchMarkets = async () => {
  const marketsResponse = await gqlFetchAll<MarketsResponse>({
    endpoint: SUBQUERY_URL,
    query: MARKETS_QUERY,
    dataToSearch: "markets",
  });
  return marketsResponse;
};

export const fetchTokensAndPriceFeedIds = async (): Promise<{
  tokens: string[];
  priceFeedIds: string[];
}> => {
  const tokens = [
    "0xda10009cbd5d07dd0cecc66161fc93d7c9000da1", // DAI
    "0xff970a61a04b1ca14834a43f5de4533ebddb5cc8", // USDC
    "0x4fabb145d64652a948d72533023f6e7a623c7c53", // BUSD
    "0x680447595e8b7b3aa1b43beb9f6098c79ac2ab3f", // USDD
    "0xfd086bc7cd5c481dcc9c85ebe478a1c0b69fcbb9", // USDT
    "0x17fc002b466eec40dae837fc4be5c67993ddbd6f", // FRAX
    "0xae7ab96520de3a18e5e111b5eaab095312d7fe84", // stETH
    "0x2260fac5e5542a773aa44fbcfedf7c193bc2c599", // WBTC
    "0x5979d7b546e38e414f7e9822514be443a4800529", // WstETH
    // "0x64343594ab9b56e99087bfa6f2335db24c2d1f17", // VST
    // "0xd85e038593d7a098614721eae955ec2022b9b91b", // gDAI
    "0x4d15a3a2286d883af0aa1b3f21367843fac63e07", // TUSD
    "0x11cdb42b0eb46d95f990bedd4695a6e3fa034978", // CRV
  ];
  const priceFeedIds = [
    "0xb0948a5e5313200c632b51bb5ca32f6de0d36e9950a942d19751e833f70dabfd", // DAI
    "0xeaa020c61cc479712813461ce153894a96a6c00b21ed0cfc2798d1f9a9e9c94a", // USDC
    "0x5bc91f13e412c07599167bae86f07543f076a638962b8d6017ec19dab4a82814", // BUSD
    "0x6d20210495d6518787b72e4ad06bc4df21e68d89a802cf6bced2fca6c29652a6", // USDD
    "0x2b89b9dc8fdf9f34709a5b106b472f0f39bb6ca9ce04b0fd7f2e971688e2e53b", // USDT
    "0xc3d5d8d6d17081b3d0bbca6e2fa3a6704bb9a9561d9f9e1dc52db47629f862ad", // FRAX
    "0x3af6a3098c56f58ff47cc46dee4a5b1910e5c157f7f0b665952445867470d61f", // stETH/ETH
    "0xe62df6c8b4a85fe1a67db44dc12de5db330f7ac66b72dc658afedf0f4a415b43", // WBTC
    "0x6df640f3b8963d8f8358f791f352b8364513f6ab1cca5ed3f1f7b5448980e784", // WstETH
    // "0x64343594ab9b56e99087bfa6f2335db24c2d1f17", // VST
    // "0xd85e038593d7a098614721eae955ec2022b9b91b", // gDAI
    "0x433faaa801ecdb6618e3897177a118b273a8e18cc3ff545aadfc207d58d028f7", // TUSD
    "0xa19d04ac696c7a6616d291c7e5d1377cc8be437c327b75adb5dc1bad745fcae8", // CRV
  ];

  return { tokens, priceFeedIds };
};

export const fetchDeviation = async (): Promise<{ [key: string]: number }> => {
  return {
    "0xfea7a6a0b346362bf88a9e4a88416b77a57d6c2a": 10,
  };
};
