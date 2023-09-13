export const FACTORY_V2_ABI = [
  {
    inputs: [
      {
        internalType: "uint256",
        name: "",
        type: "uint256",
      },
    ],
    name: "marketToOracle",
    outputs: [
      {
        internalType: "address",
        name: "",
        type: "address",
      },
    ],
    stateMutability: "view",
    type: "function",
  },
];

export const ORACLE_ABI = [
  {
    inputs: [
      {
        internalType: "uint256",
        name: "_marketId",
        type: "uint256",
      },
    ],
    name: "fetchAssertion",
    outputs: [
      {
        internalType: "bytes32",
        name: "assertionId",
        type: "bytes32",
      },
    ],
    stateMutability: "nonpayable",
    type: "function",
  },
];
