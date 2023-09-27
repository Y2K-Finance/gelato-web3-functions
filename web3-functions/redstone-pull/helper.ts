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

export const fetchOracleData = async (
  endpoint: string
): Promise<{
  provider: string;
  markets: { [key: string]: number };
}> => {
  const data = await fetch(`${endpoint}/api/redstone`);
  const { oracleData } = await data.json();
  return oracleData;
};
