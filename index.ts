import { Command } from 'commander'
import figlet from 'figlet'

import dotenv from 'dotenv'
dotenv.config({
  path: ['.env.local', '.env'],
})

import { Demo } from './bots/demo'
import { BotConfig } from './ts/BotConfig'

const program = new Command()

console.log(figlet.textSync('Demo Bot'))

program
  .version('1.0.0')
  .requiredOption(
    '-a, --amount <lamports>',
    'The target amount of the token to swap, in lamports',
  )
  .option(
    '-api, --api-endpoint <julian | jupiter>',
    'The API endpoint to use',
    'jupiter',
  )
  .option(
    '-im, --input-mint <address>',
    'The address of the input token mint',
    'So11111111111111111111111111111111111111112',
  )
  .option(
    '-ma, --max-accounts',
    'Rough estimate of the max accounts to be used for the quote, so that you can compose with your own accounts',
  )
  .option(
    '-odr, --only-direct-routes <boolean>',
    'Direct Routes limits Jupiter routing to single hop routes only.',
    'false',
  )
  .option(
    '-om, --output-mint <address>',
    'The address of the output token mint',
    'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
  )
  .option(
    '-p, --port <number>',
    'The target API server port',
    '8080',
  )
  .option(
    '-sm, --swap-mode <ExactIn | ExactOut>',
    'The swap mode to use',
    'ExactIn',
  )

  .parse(process.argv)

const options = program.opts()

const main = async () => {
  // Check for environment variables
  if (!process.env.WALLET_PRIVATE_KEY)
    throw new Error('Wallet Private Key environment variable not set.')

  if (!process.env.RPC_HTTPS_SOLANA_MAINNET)
    throw new Error('RPC Environment variable not set.')

  if (!process.env.API_ENDPOINT_JULIAN || !process.env.API_ENDPOINT_JUPITER)
    throw new Error('API Endpoint environment variable not set.')


  // Assign environment variables
  const apiEndpointJulian = process.env.API_ENDPOINT_JULIAN as string
  const apiEndpointJupiter = process.env.API_ENDPOINT_JUPITER as string
  const rpcEndpointHttps = process.env.RPC_HTTPS_SOLANA_MAINNET as string
  // const privateKey = process.env.WALLET_PRIVATE_KEY as string   // Dynamically generated for example purposes

  // Assign selected API endpoint
  let apiEndpoint
  switch (options.apiEndpoint?.toLowerCase()) {
    case 'julian':
      apiEndpoint = apiEndpointJulian
      break
    case 'jupiter':
      apiEndpoint = apiEndpointJupiter
      break
    default:
      apiEndpoint = apiEndpointJulian
  }

  // Assign bot class
  const DemoBot = Demo

  // Configure bot
  const botConfig: BotConfig = {
    amount: Number(options.amount),
    apiEndpoint,
    inputMint: options.inputMint,
    maxAccounts: isNaN(Number(options.maxAccounts)) ? undefined : Number(options.maxAccounts),
    onlyDirectRoutes: Boolean(options.onlyDirectRoutes),
    outputMint: options.outputMint,
    rpcEndpointHttps,
    swapMode: options.swapMode,
  }

  console.log(botConfig)
  const bot = new DemoBot(botConfig)

  // Initialize the bot
  bot.init()
}

// Call the main function and catch any errors
main().catch(console.error)
