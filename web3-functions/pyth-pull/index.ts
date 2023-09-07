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
import { PYTH_ABI } from "./abi";
import { fetchPricefeeds } from "./helper";
import { DIVISION_FACTOR } from "./constants";

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
  const pythContract = CONTRACT_ADDR["arbitrum"];

  // Fetch data
  const y2kBackendUrl = await context.secrets.get("Y2K_BACKEND_URL");
  if (!y2kBackendUrl) {
    return { canExec: false, message: `Y2K_BACKEND_URL not set in secrets` };
  }

  const pricefeeds = await fetchPricefeeds(y2kBackendUrl);
  console.log(`Read price feeds to track: ${JSON.stringify(pricefeeds)}`);

  // Read pyth price feeds
  const priceFeedIds = Object.keys(pricefeeds);
  const latestPriceFeeds =
    (await connection.getLatestPriceFeeds(priceFeedIds)) || [];
  console.log(`Read ${latestPriceFeeds.length} price feeds`);

  // Read last updated prices
  const priceGetContext: ContractCallContext[] = latestPriceFeeds.map(
    (feed) => ({
      reference: feed.id,
      contractAddress: pythContract,
      abi: PYTH_ABI,
      calls: [
        {
          reference: "getPriceUnsafe",
          methodName: "getPriceUnsafe",
          methodParameters: [`0x${feed.id}`],
        },
      ],
    })
  );
  const priceGetCallResults = await multicall.call(priceGetContext);

  // Determine which price feeds need to be updated
  const priceFeedIdsToUpdate = [];
  const stalePeriod = parseInt(
    (await context.secrets.get("STALE_PERIOD")) || "86400"
  );
  for (const feed of latestPriceFeeds) {
    const returnData =
      priceGetCallResults.results[feed.id].callsReturnContext[0];
    if (!returnData.success) {
      // Price never pushed
      priceFeedIdsToUpdate.push(`0x${feed.id}`);
      continue;
    }
    const onChainPrice = BigNumber.from(returnData.returnValues[0].hex);
    const onChainPublishTime = BigNumber.from(
      returnData.returnValues[3].hex
    ).toNumber();
    const priceInfo = feed.getPriceUnchecked();
    const offChainPrice = BigNumber.from(priceInfo.price);
    const allowedDivation = pricefeeds[`0x${feed.id}`];

    if (offChainPrice.isZero() || !allowedDivation) continue;

    const timeDiff = priceInfo.publishTime - onChainPublishTime;
    const curDeviation = onChainPrice
      .sub(offChainPrice)
      .abs()
      .mul(DIVISION_FACTOR)
      .div(offChainPrice)
      .toNumber();

    // Update if exceeds deviation allowance or staled for 24 hours
    if (curDeviation > allowedDivation || timeDiff > stalePeriod) {
      priceFeedIdsToUpdate.push(`0x${feed.id}`);
    }
  }

  if (priceFeedIdsToUpdate.length == 0) {
    return { canExec: false, message: `No price feed to update` };
  }

  // Prepare pyth price update calldata
  const pyth = new Contract(pythContract, PYTH_ABI, provider);
  const priceUpdateData = await connection.getPriceFeedsUpdateData(
    priceFeedIdsToUpdate
  );
  const updateFee = await pyth.getUpdateFee(priceUpdateData);
  // console.log(updateFee.toString(), JSON.stringify(priceUpdateData));

  // Return execution call data
  return {
    canExec: true,
    callData: [
      {
        to: pythContract,
        data: pyth.interface.encodeFunctionData("updatePriceFeeds", [
          priceUpdateData,
        ]),
        value: updateFee.toString(),
      },
    ],
  };
});
