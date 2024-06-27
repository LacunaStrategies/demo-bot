import { Instruction, QuoteResponse, SwapInstructionsPostRequest, SwapInstructionsResponse } from "@jup-ag/api"
import { AddressLookupTableAccount, Connection, Keypair, PublicKey, TransactionInstruction, TransactionMessage, VersionedTransaction } from "@solana/web3.js"
import util from 'util'

import AddressLookupTableDB from "@/database/AddressLookupTableDB"
import { getSignature } from "@/lib/getSignature"
import { BotConfig } from "@/ts/BotConfig"

export class Demo {

    private priceWatchIntervalId?: NodeJS.Timeout
    private lastCheck: number = 0
    private running: boolean = false

    private amount: number
    private apiEndpoint: string
    private connection: Connection
    private inputMint: string
    private keypair: Keypair
    private maxAccounts?: number
    private onlyDirectRoutes: boolean
    private outputMint: string
    private swapMode: 'ExactIn' | 'ExactOut'

    constructor(config: BotConfig) {
        const {
            amount,
            apiEndpoint,
            inputMint,
            maxAccounts,
            onlyDirectRoutes,
            outputMint,
            rpcEndpointHttps,
            swapMode,
        } = config

        this.amount = amount
        this.apiEndpoint = apiEndpoint
        this.connection = new Connection(rpcEndpointHttps, 'confirmed')
        this.inputMint = inputMint
        this.keypair = Keypair.generate()
        this.maxAccounts = maxAccounts
        this.onlyDirectRoutes = onlyDirectRoutes
        this.outputMint = outputMint
        this.swapMode = swapMode
    }

    init() {
        console.log('🚀 Bot initialized!')
        this.initiatePriceWatch()
    }

    private initiatePriceWatch(): void {
        this.priceWatchIntervalId = setInterval(async () => {
            console.log('Interval triggered')
            const currentTime = Date.now()

            // Restrain pace to interval
            if (currentTime - this.lastCheck >= 3000) {
                this.lastCheck = currentTime

                // Prevent bot from running multiple instances
                if (this.running) return

                // Start running arb check
                this.running = true
                console.log('🔍 Checking for arbitrage opportunities...')

                // Fetch quote
                const quoteResponse = await fetch(`${this.apiEndpoint}/quote?inputMint=${this.inputMint}&outputMint=${this.outputMint}&amount=${this.amount}&onlyDirectRoutes=${this.onlyDirectRoutes}&swapMode=${this.swapMode}${this.maxAccounts ? `&maxAccounts=${this.maxAccounts}` : ''}`).then((res) => res.json()).catch((error: any) => console.log(error)) as QuoteResponse
                console.log(util.inspect(quoteResponse, false, null, true))

                if (!quoteResponse) {
                    console.error("Failed to get quote!")
                    return
                }

                if ((quoteResponse as any).error) {
                    console.error(quoteResponse)
                    return
                }

                // Fetch swap instructions
                const swapInstructionsResponse = await fetch(`${this.apiEndpoint}/swap-instructions`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                        userPublicKey: this.keypair.publicKey.toBase58(),
                        quoteResponse,
                    } as SwapInstructionsPostRequest["swapRequest"])
                }).then((res) => res.json()).catch((error: any) => console.log(error)) as SwapInstructionsResponse
                console.log(util.inspect(swapInstructionsResponse, false, null, true))

                if (!swapInstructionsResponse) {
                    console.error("Failed to get swap instructions!")
                    this.running = false
                    return
                }

                if ((swapInstructionsResponse as any).error) {
                    console.error(swapInstructionsResponse)
                    this.running = false
                    return
                }

                // Destructure swap instructions response
                const {
                    addressLookupTableAddresses,
                    cleanupInstruction,
                    computeBudgetInstructions,
                    setupInstructions,
                    swapInstruction,
                } = swapInstructionsResponse

                // Compile address lookup table accounts
                const addressLookupTableAccounts: AddressLookupTableAccount[] = [];
                addressLookupTableAccounts.push(
                    ...(await this.getAddressLookupTableAccounts(addressLookupTableAddresses))
                );

                // * Example of caching - cache alt accounts by alt address
                for (let i = 0; i < addressLookupTableAddresses.length; i++) {
                    const key = addressLookupTableAddresses[i]
                    const data = addressLookupTableAccounts[i].key.toBase58()
                    const cacheResp = await AddressLookupTableDB.put(key, data)
                    console.log(`Address lookup tables cached: ${key}: ${cacheResp}`)
                }

                // Compile instructions
                const instructions: TransactionInstruction[] = [
                    ...computeBudgetInstructions.map(this.deserializeInstruction),
                    ...setupInstructions.map(this.deserializeInstruction),
                    this.deserializeInstruction(swapInstruction),
                ]
                cleanupInstruction && instructions.push(this.deserializeInstruction(cleanupInstruction))

                // Generate transaction
                const { blockhash, lastValidBlockHeight } = await this.connection.getLatestBlockhash();

                const messageV0 = new TransactionMessage({
                    payerKey: this.keypair.publicKey,
                    recentBlockhash: blockhash,
                    instructions,
                }).compileToV0Message(addressLookupTableAccounts);
                const tx = new VersionedTransaction(messageV0)

                // Sign the transaction
                tx.sign([this.keypair])
                const signature = getSignature(tx);

                // Serialize the transaction
                const serializedTransaction = Buffer.from(tx.serialize())

                // Simulate transaction
                console.log('🚀 Simulating transaction...')
                const simulatedTransactionResponse = await this.connection.simulateTransaction(tx).catch((error: any) => console.log(error))
                console.log(util.inspect(simulatedTransactionResponse, false, null, true))

                console.log(`https://solscan.io/tx/${signature}`);

                this.running = false;
            }

        }, 3000)
    }


    private deserializeInstruction = (instruction: Instruction) => {
        return new TransactionInstruction({
            programId: new PublicKey(instruction.programId),
            keys: instruction.accounts.map((key) => ({
                pubkey: new PublicKey(key.pubkey),
                isSigner: key.isSigner,
                isWritable: key.isWritable,
            })),
            data: Buffer.from(instruction.data, "base64"),
        });
    };

    private getAddressLookupTableAccounts = async (
        keys: string[]
    ): Promise<AddressLookupTableAccount[]> => {
        const addressLookupTableAccountInfos =
            await this.connection.getMultipleAccountsInfo(
                keys.map((key) => new PublicKey(key))
            );

        return addressLookupTableAccountInfos.reduce((acc, accountInfo, index) => {
            const addressLookupTableAddress = keys[index];
            if (accountInfo) {
                const addressLookupTableAccount = new AddressLookupTableAccount({
                    key: new PublicKey(addressLookupTableAddress),
                    state: AddressLookupTableAccount.deserialize(accountInfo.data),
                });
                acc.push(addressLookupTableAccount);
            }

            return acc;
        }, new Array<AddressLookupTableAccount>());
    };

}