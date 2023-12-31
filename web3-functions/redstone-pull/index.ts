import {
  Web3Function,
  Web3FunctionContext,
} from "@gelatonetwork/web3-functions-sdk";
import { WrapperBuilder } from "@redstone-finance/evm-connector";
import { Contract } from "@ethersproject/contracts";
import { BigNumber, ethers } from "ethers";
import { PROVIDER_ABI } from "./abi";
import { fetchLatestPrice, fetchOracleData } from "./helper";
import { DIVISION_FACTOR } from "./constants";

Web3Function.onRun(async (context: Web3FunctionContext) => {
  // Init Providers
  const { multiChainProvider } = context;
  const provider = multiChainProvider.default();
  // const arbRedstoneAdapter = await context.secrets.get("REDSTONE_ADAPTER");
  // if (!arbRedstoneAdapter) {
  //   return { canExec: false, message: `REDSTONE_ADAPTER not set in secrets` };
  // }

  // Fetch data
  const y2kBackendUrl = await context.secrets.get("Y2K_BACKEND_URL");
  if (!y2kBackendUrl) {
    return { canExec: false, message: `Y2K_BACKEND_URL not set in secrets` };
  }
  const oracleData = await fetchOracleData(y2kBackendUrl);
  console.log(`Read data feeds to track: ${JSON.stringify(oracleData)}`);

  // Read Data Feeds for Markets
  const providerContract = oracleData.provider;
  const universalProvider = new Contract(
    providerContract,
    PROVIDER_ABI,
    provider
  );
  const marketIds = Object.keys(oracleData.markets);
  const dataFeedsInBytes32 = await universalProvider.getDataFeeds(marketIds);
  const dataFeeds = dataFeedsInBytes32.map(ethers.utils.parseBytes32String);
  if (dataFeeds.includes("")) {
    return { canExec: false, message: `There is an invalid data feed` };
  }
  console.log(`Redstone data feed ids: ${dataFeeds}`);

  // Read Latest Redstone Prices
  const redstoneGatewayUrl = await context.secrets.get("REDSTONE_GATEWAY");
  if (!redstoneGatewayUrl) {
    return { canExec: false, message: `REDSTONE_GATEWAY not set in secrets` };
  }
  const latestPrices = await fetchLatestPrice(redstoneGatewayUrl, dataFeeds);
  console.log(`Extracted ${latestPrices.length} price feeds: ${latestPrices}`);

  // Read last updated prices
  const priceData = await universalProvider.getCurrentPrices(marketIds);
  console.log(`Read ${priceData.prices.length} price feeds: ${priceData}`);

  // Determine which price feeds need to be updated
  const marketIdsToUpdate = [];
  const stalePeriod = parseInt(
    (await context.secrets.get("STALE_PERIOD")) || "86400"
  );
  for (let i = 0; i < marketIds.length; i++) {
    const onChainPrice = BigNumber.from(priceData.prices[i]).toNumber() / 1e8;
    const onChainPublishTime = BigNumber.from(
      priceData.updatedAt[i]
    ).toNumber();
    const now = Math.floor(Date.now() / 1000);
    const offChainPrice = latestPrices[i];
    const allowedDivation = oracleData.markets[marketIds[i]];

    if (offChainPrice == 0 || !allowedDivation) continue;

    const timeDiff = now - onChainPublishTime;
    const curDeviation =
      (Math.abs(onChainPrice - offChainPrice) * DIVISION_FACTOR) /
      offChainPrice;

    console.log(
      `${dataFeeds[i]} price feed's time diff is ${timeDiff} and deviation is ${curDeviation}`
    );

    // Update if exceeds deviation allowance or staled for 24 hours
    if (curDeviation > allowedDivation || timeDiff > stalePeriod) {
      console.log(`${marketIds[i]}: ${dataFeeds[i]} need to be updated`);
      marketIdsToUpdate.push(marketIds[i]);
    }
  }
  console.log(`${marketIdsToUpdate.length} markets need to be updated`);

  if (marketIdsToUpdate.length == 0) {
    return { canExec: false, message: `No price feed to update` };
  }

  // Return execution call data
  const wrappedProvider = WrapperBuilder.wrap(
    universalProvider
  ).usingDataService({
    dataFeeds,
  });
  const { data } = await wrappedProvider.populateTransaction.updatePrices(
    marketIds
  );
  if (!data) {
    return { canExec: false, message: `Failed to prepare calldata` };
  }
  return {
    canExec: true,
    callData: [
      {
        to: providerContract,
        data,
      },
    ],
  };
});
