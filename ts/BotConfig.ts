export interface BotConfig {
    amount: number
    apiEndpoint: string
    inputMint: string
    maxAccounts?: number
    onlyDirectRoutes: boolean
    outputMint: string
    rpcEndpointHttps: string
    swapMode: 'ExactIn' | 'ExactOut'
}