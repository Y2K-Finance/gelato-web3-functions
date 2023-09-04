import {
  Web3Function,
  Web3FunctionContext,
} from "@gelatonetwork/web3-functions-sdk";
import {
  EvmPriceServiceConnection,
  CONTRACT_ADDR,
} from "@pythnetwork/pyth-evm-js";
import { Contract } from "@ethersproject/contracts";
import { BigNumber } from "ethers";
import { ContractCallContext, Multicall } from "ethereum-multicall";
import { FACTORY_V2_ABI, ORACLE_ABI, PYTH_ABI } from "./abi";
import {
  fetchDeviation,
  fetchMarkets,
  fetchTokensAndPriceFeedIds,
} from "./helper";

const DIVISION_FACTOR = 10000;
const FACTORY_V2 = "0xC3179AC01b7D68aeD4f27a19510ffe2bfb78Ab3e";
const connection = new EvmPriceServiceConnection(
  "https://xc-mainnet.pyth.network"
);

Web3Function.onRun(async (context: Web3FunctionContext) => {
  // Init Providers
  const { multiChainProvider } = context;
  const provider = multiChainProvider.default();
  const multicall = new Multicall({
    ethersProvider: provider,
    tryAggregate: true,
  });

  // Fetch data
  const deviation = await fetchDeviation();
  const { tokens, priceFeedIds } = await fetchTokensAndPriceFeedIds();

  if (priceFeedIds.length != tokens.length) {
    return {
      canExec: false,
      message: "Token and Price feed Ids length mismatch",
    };
  }

  const marketsResponse = await fetchMarkets();
  const markets = marketsResponse.markets.filter((market) =>
    tokens.includes(market.token)
  );
  console.log(`Read ${marketsResponse.markets.length} markets.`);

  // Read pyth price feeds
  const pythPriceFeeds: { [key: string]: { price: BigNumber; feed: string } } =
    {};
  const latestPriceFeeds =
    (await connection.getLatestPriceFeeds(priceFeedIds)) || [];
  console.log(`Read ${latestPriceFeeds.length} price feeds`);
  for (let i = 0; i < tokens.length; i += 1) {
    const feed = latestPriceFeeds[i].getPriceUnchecked();
    let pythPrice = BigNumber.from(feed.price);
    // console.log("pyth price", pythPrice.toString(), "expo", feed.expo);
    const decimals = feed.expo + 18;
    if (decimals < 0) {
      throw "Exponent too small";
    }
    pythPrice = pythPrice.mul(BigNumber.from(10).pow(decimals));
    pythPriceFeeds[tokens[i]] = { price: pythPrice, feed: priceFeedIds[i] };
  }

  console.log(`Current prices are ${pythPriceFeeds}`);

  // Read market oracles
  const marketToOracleCallContext: ContractCallContext[] = markets.map(
    (market, index) => ({
      reference: index.toString(),
      contractAddress: FACTORY_V2,
      abi: FACTORY_V2_ABI,
      calls: [
        {
          reference: "marketToOracle",
          methodName: "marketToOracle",
          methodParameters: [market.marketIndex],
        },
      ],
    })
  );
  const marketToOracleCallResults = await multicall.call(
    marketToOracleCallContext
  );
  const oracleAddresses = markets.map((market, index) => {
    return marketToOracleCallResults.results[index.toString()]
      .callsReturnContext[0].returnValues[0];
  });

  // Read oracle prices
  const oracleDataCallContext: ContractCallContext[] = oracleAddresses.map(
    (oracleAddress, index) => ({
      reference: index.toString(),
      contractAddress: oracleAddress,
      abi: ORACLE_ABI,
      calls: [
        {
          reference: "latestRoundData",
          methodName: "latestRoundData",
          methodParameters: [],
        },
        {
          reference: "getLatestPrice",
          methodName: "getLatestPrice",
          methodParameters: [],
        },
      ],
    })
  );
  const oracleDataCallResults = await multicall.call(oracleDataCallContext);
  const oracleDatas = oracleAddresses.map((_, index) => {
    const latestRoundDataReturnValues =
      oracleDataCallResults.results[index.toString()].callsReturnContext[0]
        .returnValues;
    const getLatestPriceReturnValues =
      oracleDataCallResults.results[index.toString()].callsReturnContext[1]
        .returnValues;
    return {
      price: BigNumber.from(getLatestPriceReturnValues[0].hex),
      updatedAt: BigNumber.from(latestRoundDataReturnValues[3].hex),
    };
  });

  // Determine which price feeds need to be updated
  const priceFeedIdsToUpdate = [];
  for (const [index, market] of markets.entries()) {
    const pythPrice = pythPriceFeeds[market.token].price;
    if (pythPrice.isZero()) continue;

    const curDeviation = oracleDatas[index].price
      .sub(pythPrice)
      .abs()
      .mul(DIVISION_FACTOR)
      .div(pythPrice)
      .toNumber();
    const allowedDivation = deviation[market.token] || 0;

    const timeDiff =
      new Date().getTime() / 1000 - oracleDatas[index].updatedAt.toNumber();

    // Update if exceeds deviation allowance or staled for 24 hours
    if (curDeviation > allowedDivation || timeDiff > 86400) {
      priceFeedIdsToUpdate.push(pythPriceFeeds[market.token].feed);
    }
  }

  // Prepare pyth price update calldata
  const callData = [];
  const pyth = new Contract(CONTRACT_ADDR["arbitrum"], PYTH_ABI, provider);
  if (priceFeedIdsToUpdate.length) {
    const priceUpdateData = await connection.getPriceFeedsUpdateData(
      priceFeedIdsToUpdate
    );
    const fee = await pyth.getUpdateFee(priceUpdateData);

    callData.push({
      to: CONTRACT_ADDR["arbitrum"],
      data: pyth.interface.encodeFunctionData("updatePriceFeeds", [
        priceUpdateData,
      ]),
      value: fee.toString(),
    });
  }

  // Return execution call data
  return {
    canExec: true,
    callData,
  };
});
