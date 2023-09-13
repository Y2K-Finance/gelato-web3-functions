import {
  Web3Function,
  Web3FunctionContext,
} from "@gelatonetwork/web3-functions-sdk";
import { ORACLE_ABI } from "./abi";
import { fetchUmaOracles } from "./helper";
import { Interface } from "ethers/lib/utils";

Web3Function.onRun(async (context: Web3FunctionContext) => {
  // Fetch data
  const y2kBackendUrl = await context.secrets.get("Y2K_BACKEND_URL");
  if (!y2kBackendUrl) {
    return { canExec: false, message: `Y2K_BACKEND_URL not set in secrets` };
  }

  const oracles = await fetchUmaOracles(y2kBackendUrl);
  console.log(`Read uma oracles to fetch: ${JSON.stringify(oracles)}`);

  // Generate call data
  const marketIds = Object.keys(oracles);
  if (marketIds.length == 0) {
    return { canExec: false, message: `No markets to update` };
  }
  const umaPriceProviderInterface = new Interface(ORACLE_ABI);
  const callData = marketIds.map((id) => ({
    to: oracles[id],
    data: umaPriceProviderInterface.encodeFunctionData("fetchAssertion", [id]),
  }));

  // Return execution call data
  return {
    canExec: true,
    callData,
  };
});
