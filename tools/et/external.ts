// External Contracts, Libraries, and Addresses on supported chains

export const Chains: Record<string, Chain> = {
    Arbitrum: {
        One: 42161,
        Nova: 42170,
        Goerli: 421613,
    },
}
export const Tokens: Record<string, Token> = {
    WETH: {
        [Chains.Arbitrum.One]: "0x82aF49447D8a07e3bd95BD0d56f35241523fBab1",
        [Chains.Arbitrum.Goerli]: "0xFd3Aa40aF20c80a106B0b80E18D93440f48a0fe4"
    },
}

export const Contracts = {
    WETH: {
        WETH9: {
            [Chains.Arbitrum.One]: "0x82aF49447D8a07e3bd95BD0d56f35241523fBab1",
            [Chains.Arbitrum.Goerli]: "0xFd3Aa40aF20c80a106B0b80E18D93440f48a0fe4"
        }
    },
}

export const Constants = {
    INFINITE_ALLOWANCE: "0xfe00000000000000000000000000000000000000000000000000000000000000"
}

export type Chain = Record<string, number>
export type ChainId = ValueOf<typeof Chains.Arbitrum>
export type Contract = Record<ChainId, Address>
export type Token = Record<ChainId, Address>
export type Address = string

type ValueOf<T> = T[keyof T];
