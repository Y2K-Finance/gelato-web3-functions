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

const Y2K_BACKEND_URL = "https://y2k-backend-git-pythsupport-y2k.vercel.app";

export const fetchMarketsForPyth = async () => {
  const data = await fetch(`${Y2K_BACKEND_URL}/api/pyth/markets`);
  const { markets } = await data.json();
  return markets;
};

export const fetchTokensAndPriceFeedIds = async (): Promise<{
  tokens: string[];
  priceFeedIds: string[];
}> => {
  const data = await fetch(`${Y2K_BACKEND_URL}/api/pyth/pricefeed`);
  return await data.json();
};

export const fetchDeviation = async (): Promise<{ [key: string]: number }> => {
  const data = await fetch(`${Y2K_BACKEND_URL}/api/pyth/deviation`);
  const { deviations } = await data.json();
  return deviations;
};
