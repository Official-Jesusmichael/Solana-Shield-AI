> ## Documentation Index
> Fetch the complete documentation index at: https://www.helius.dev/docs/llms.txt
> Use this file to discover all available pages before exploring further.

# How to Index Solana Data

> Learn how to build, backfill, and keep Solana indexes up to date.

## Overview

The Solana blockchain stores data in a sequential, append-only ledger. This is great for data integrity and transaction throughput, but comes at a significant cost: it makes querying [historical data](/rpc/historical-data) very inefficient and prohibitively slow.

Complex operations often involve filtering, aggregation, or joining data from multiple sources. In these cases, making direct queries to Solana is impractical for most real-world applications.

To solve this, most businesses build private indexes of Solana’s historical data.

## What does indexing Solana data mean?

Indexing is the process of querying data from the Solana blockchain and storing it in a backend database (e.g., PostgreSQL, ClickHouse) that can then be used to readily serve customer requests without needing to directly query the blockchain using [Solana RPC calls](/api-reference/rpc/http-methods).

An indexer typically does four things:

1. **Backfill historical data:** use [archival RPC methods](/rpc/guides/overview#historical-data-archival) to query all historical data
2. **Stream new data:** process new blocks when they are confirmed by the network
3. **Parse and transform data:** extract relevant data from the confirmed blocks (e.g., transactions, state changes, etc.)
4. **Organize data into a database:** update the index with the new data

### Why do most companies build Solana indexes?

Companies build Solana indexes because their business depends on providing fast, real-time access to purpose-specific blockchain data that native RPCs don’t offer (e.g. NFT sale history).

Companies also leverage custom indices to combine off-chain data (e.g., Centralized Exchange prices, KYC information, etc.) with their on-chain data.

#### Wallet Example

For example, if a Solana wallet needs to quickly return a user's token accounts and balances, querying Solana directly with [`getTokenAccountsByOwner`](/api-reference/rpc/http/gettokenaccountsbyowner) and [`getTokenAccountBalance`](/api-reference/rpc/http/gettokenaccountbalance) is too slow and could make their product unusable. Instead, wallets will typically maintain their own indexes of customer addresses, tokens, and account balances.

#### Trading Example

Similarly, a crypto trading firm may want to log all trading activity that happens on a specific trading pair (e.g., [SOL-USDC](https://orbmarkets.io/address/So11111111111111111111111111111111111111112/markets?sort_by=volume24h\&sort_type=desc)) or specific [market](https://orbmarkets.io/) to backtest their trading algorithms.

Directly querying the blockchain for this data would be far too slow for any practical trading analysis. Instead, quant traders may elect to build indexes for the SOL-USDC market, and keep it updated with the latest trades using real-time streaming products like [LaserStream](/laserstream).

#### Filtering Example

Imagine a user wants to filter transactions by specific criteria in their frontend application (e.g., by token type, transfer amount, date, or wallet address).

Without an indexer, your app would need to scan through millions of transactions across 100s of thousands of blocks, checking each one against the filter criteria.

This process is too slow for modern product user experiences.

#### PnL Example

To calculate a trader's profit and loss (PnL), you would need to:

* Find every transaction associated with their wallet in a given timeframe
* Filter out swap transactions and label them as buys or sells
* Determine how many fees the user paid during each swap
* Get the historical price data for each token at the time of each trade
* Aggregate the PnL of each transaction to calculate the trader’s total PnL

Calculating this all in real-time is impractical, and requires a faster, more scalable solution.

With an index, all this information is already processed and stored in a queryable database. Now, calculating a trader’s PnL becomes a single API call that is served instantly.

Let’s look at three approaches for backfilling a Solana index and keeping it up to date.

## Step 1: Get the historical data

The first step to building a Solana index is getting all the historical data that you care about.

There are three main ways to do this:

1. **getTransactionsForAddress** (recommended)
2. **getSignaturesForAddress** and **getTransaction**
3. **getBlock**

### Method 1: getTransactionsForAddress (recommended)

The [`getTransactionsForAddress`](/rpc/gettransactionsforaddress) RPC method allows you to fetch the full transaction details for an arbitrary segment of blockchain data. Due to its powerful filtering abilities, you won't waste time retrieving data that is not needed for your index, and because of its reverse search functionality you can get transactions in chronological order.

#### Steps to use this method

* Determine the timeframe that you need data from and set the filter accordingly
* Set `transactionDetails` to `full` to get all transaction details
* Configure `tokenAccounts` filter to include associated token account transactions if needed
* Paginate through the results using `paginationToken`
* On each iteration, extract the data you need and store it in your database

#### Benefits of using getTransactionsForAddress

The main advantages of using the [gTFA endpoint](/api-reference/rpc/http/gettransactionsforaddress) are speed and simplicity. With slot and time-based filters, token account support, reverse search, and pagination, you can get any data you want, from any time in Solana's history, all with a single call without complex looping or retry logic. Unlike `getSignaturesForAddress`, it can also include transactions involving associated token accounts owned by the address.

### Method 2: getSignaturesForAddress and getTransaction

Before the release of gTFA, the standard approach for querying historical data was to recursively loop over signatures using [`getSignaturesForAddress`](/rpc/guides/getsignaturesforaddress) (from newest to oldest) and then calling [`getTransaction`](/rpc/guides/gettransaction) to extract the full transaction details.

#### Steps to use this method

Here are the basic steps to use this method:

* Call `getSignaturesForAddress`
* Store the signature of the last received transaction of this call
* For the next call to `getSignaturesForAddress`, set the `before` parameter to this signature
* Repeat this in a loop for as long as needed
* For each transaction signature retrieved this way, call `getTransaction` to get its full transaction details
* Insert the relevant data into your database

#### Downsides of this method

Unfortunately, to use this method you need to:

* Start at the newest transaction and work backwards
* Make one additional RPC call for each transaction
* Build a thread-safe queue to handle concurrent processing
* Build logic for retries and backoffs to prevent missed data and getting rate limited
* Does not include transactions involving associated token accounts owned by the address

While this method works, it is more complicated, less flexible, and spends a lot more [credits](/billing/credits). For complete wallet history including token accounts, use `getTransactionsForAddress` instead.

### Method 3: Use getBlock

The [`getBlock`](/rpc/guides/getblock) method is most effective when a high percentage of transactions in your target blocks are relevant to your analysis, such as indexing the transactions of [frequently used Solana programs](/orb/explore-programs) like DFlow’s Aggregator, the Pump.fun program, or Solana’s Token program.

#### Steps to use this method

The basic process for querying historical data with `getBlock` includes:

* Decide on a time range to query
* Convert this time range to slot numbers
* Fetch the corresponding blocks sequentially (forward or backward)
* For each block, filter the transactions that are relevant to your index
* Store the relevant information from them in your index

For most use cases, this method is inherently wasteful since you're retrieving all transactions in a block when typically only a small fraction will be relevant to your analysis.

Use this method only when you’re examining the transactions of frequently used programs or when address-based filtering cannot capture your target data.

## Step 2: Sync Solana data with your database

After fetching historical data, you need to transform it and store it efficiently in a database.

**Your storage choice should be tailored to your specific use case** — there's no one-size-fits-all solution. The right database depends on the size of your dataset, latency requirements, query patterns, and team expertise.

### Option 1: SQL Databases

Storing Solana data in relational databases like PostgreSQL is recommended for most use cases. SQL is flexible, ubiquitous, and easy to learn. Modern relational databases can scale to beyond 100M+ rows, while still offering you the benefits of ACID compliance, complex joins, and powerful secondary indices.

Use **SQLite** for prototyping, local development or when you want zero configuration with a single file database. It's ideal when your dataset stays under a few gigabytes.

Use **PostgreSQL** for production applications that need data replication, concurrent access from multiple clients, or advanced features like full-text search and JSON operators.

For most production-level Solana indexers, PostgreSQL is our recommended choice.

#### Implementation example:

As an example, we will show how to store token transfers in a PostgreSQL database.

First, create a table:

```sql theme={"system"}
CREATE TABLE token_transfers (
    id BIGSERIAL PRIMARY KEY,
    slot BIGINT NOT NULL,
    timestamp TIMESTAMP NOT NULL,
    signature BYTEA NOT NULL UNIQUE,
    token_mint BYTEA NOT NULL,
    source_address BYTEA NOT NULL,
    destination_address BYTEA NOT NULL,
    amount BIGINT NOT NULL,
    decimals SMALLINT NOT NULL,
    program_id BYTEA
);
```

Then, add indexes on frequently queried columns:

```sql theme={"system"}
CREATE INDEX idx_source_address ON token_transfers (source_address);
CREATE INDEX idx_destination_address ON token_transfers (destination_address);
CREATE INDEX idx_token_mint ON token_transfers (token_mint);
```

You can also create partial indices in case only a subset of the data is queried frequently.

Here’s how you create an index for high-value transfers only:

```sql theme={"system"}
CREATE INDEX idx_large_transfers ON token_transfers(amount) WHERE amount > 1000000;
```

When backfilling data, make sure to use bulk INSERTs and prepared statements for optimal writing speed.

### Option 2: Columnar Databases

Columnar databases are optimized for analytical queries, aggregations, and high-volume time-series data. If you need to index several billion transactions, columnar databases like ClickHouse or Cassandra are your best option.

Use **ClickHouse** when you need real-time analytical queries on large datasets — it's optimized for fast reads, aggregations, and time-series analysis.

Use **Cassandra** when you need extremely high write throughput, effortless horizontal scaling and high fault tolerance. This makes it ideal for continuously ingesting massive volumes of Solana data.

#### Implementation example:

We will show how to store token transfers in a ClickHouse database.

For this purpose, create a table that uses the [MergeTree table engine](https://clickhouse.com/docs/engines/table-engines/mergetree-family/mergetree). It is designed for high ingest rates, so it’s ideal for indexing.

Use this command:

```sql theme={"system"}
CREATE TABLE token_transfers (
    block_time DateTime,
    slot UInt64,
    signature FixedString(64),
    token_mint FixedString(32),
    source_address FixedString(32),
    destination_address FixedString(32),
    amount UInt64,
    decimals UInt8,
    program_id FixedString(32),
    date Date DEFAULT toDate(block_time)
)
ENGINE = MergeTree()
PARTITION BY toYYYYMM(date)
ORDER BY (token_mint, date)
SETTINGS index_granularity = 8192;
```

In this setup, `(token_mint, date)` is set as both the primary key and sorting key. ClickHouse will order the data on disk according to your sort key. This is optimal for querying a single [token mint](/orb/explore-mint-addresses), and narrowing down the response by date ranges.

Here’s an example query:

```sql theme={"system"}
SELECT date, signature, source_address, destination_address, amount
FROM token_transfers
WHERE token_mint = 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v'
AND block_time BETWEEN '2025-01-01' AND '2025-01-31'
```

Transaction signatures and addresses are stored using the `FixedString(N)` data format which stores exactly N bytes. ClickHouse automatically compresses data, which reduces storage costs by 10-20x and improves query performance.

To optimize query performances, use Materialized Views to pre-compute common aggregations.

For example, you could pre-compute the daily transfer volume of tokens to be used by volume-related charts on a dashboard.

### Option 3: Data Lakes

Data lakes are ideal for storing massive amounts of raw and processed blockchain data for long-term archival and analytical queries.

A simple implementation uses the Parquet data format with Amazon Athena.

**Parquet** is a column-oriented data file format designed for efficient data storage and retrieval.

**Amazon Athena** is an interactive query service that allows you to analyze data stored in Amazon S3 using standard SQL without the need to set up infrastructure or load data into a separate database.

<Warning>
  Data lakes are only recommended if you need to query large amounts of unstructured data. For the majority of use cases, we recommend using a SQL database (Option 1).
</Warning>

#### Implementation example:

We want to create an archive of token transfers and query them.

First, we need to store them in S3: Create a bucket named `solana_index` and partition your token transfer data by time using this key structure:

```
s3://solana_index/token_transfers/YYYY/MM/DD/part-00000.parquet
```

Each day's transfers are stored in a separate Parquet file in its corresponding date folder.

As you process transfers from Solana, transform them into the Parquet format and write them to the respective S3 object.

Later, you [create a table](https://docs.aws.amazon.com/athena/latest/ug/step-2-create-a-table.html) in Athena and connect it to the bucket. This allows you to run queries like this directly on the data in the bucket:

```sql theme={"system"}
SELECT block_time, signature, source_address, destination_address, amount
FROM token_transfers
WHERE token_mint = 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v' AND block_time BETWEEN TIMESTAMP '2025-01-01 00:00:00' AND TIMESTAMP '2025-01-31 23:59:59';
```

### Use Indexing Frameworks

Use [**Carbon**](https://github.com/sevenlabs-hq/carbon) and similar frameworks to avoid writing boilerplate code and set up your indexer in hours rather than days.

#### Key features:

* Pre-built decoders for popular programs (Token program, DeFi protocols, Metaplex)
* Configurable data sources (RPC, LaserStream, Enhanced WebSockets)
* Built-in support for both backfill and real-time streaming
* Outputs to multiple storage backends (Postgres comes out of the box)
* Fully customizable: you can set up your own data sources, decoders and data sinks

## **Step 3: Keep your index up to date**

After backfilling historical data, you need a real-time streaming solution to keep your index up to date with new blockchain activity. Without this, your index becomes stale.

### Method 1: LaserStream (recommended)

We recommend [LaserStream gRPC](/laserstream/grpc) as your default choice for all production indexing use cases. It's purpose-built for reliable, ultra-low-latency, and fault-tolerant data streaming.

Some benefits of using LaserStream include:

* **24-Hour historical replay**: if your indexer disconnects, LaserStream [automatically replays](/laserstream/historical-replay) all missed transactions from where you left off
* **Automatic reconnection**: our [LaserStream SDKs](/laserstream/clients) (Rust, Go, JS/TS) seamlessly handle network interruptions for you
* **Node failover**: your LaserStream connection aggregates data from multiple nodes simultaneously, ensuring maximum uptime

Combining speed and reliability, LaserStream is ideal for real-time applications like live transaction feeds, trading dashboards, and instant balance updates.

#### How to Use LaserStream for Indexing

Use the [`subscribe`](/api-reference/laserstream/grpc/subscribe) method to subscribe to blockchain events.

Here are some best practices:

* **Narrow your filter as much as possible**: Only subscribe to the data you actually need to index to minimize bandwidth consumption and processing needed.
* **Use the `confirmed` commitment level**: This balances latency and finality. The `processed` level may be too unreliable, while `finalized` adds \~13 seconds of latency
* **Set `failed: false`** unless you specifically need to track failed transactions
* **Exclude vote transactions** (`vote: false`) as they are not relevant for indexing

Let’s look at an example.

Use the following subscription to index all new token transfers:

```ts theme={"system"}
{
  transactions: {
    "transfers": {
      vote: false,
      failed: false,
      accountsInclude: [
        '​​TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA',
        'TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb'
      ]
    }
  },
  commitment: CommitmentLevel.CONFIRMED,
  accounts: {},
  slots: {},
  transactionsStatus: {},
  blocks: {},
  blocksMeta: {},
  entry: {},
  accountsDataSlice: []
}
```

### Method 2: Use Enhanced WebSockets

[Enhanced WebSockets](/enhanced-websockets) are powered by the same infrastructure as LaserStream, and it is a cost-effective real-time streaming alternative to LaserStream gRPC.

You should use Enhanced WSS when:

* Your application can tolerate occasional data gaps
* Real-time updates are important, but not mission-critical
* You have existing infrastructure to detect and backfill missing data
* Budget constraints are significant and you need to minimize streaming costs
* You're prototyping or testing before committing to LaserStream

However, there are a few trade-offs to consider when choosing Enhanced WSS:

* **Speed**: Enhanced WSS are fast, but still slower than LaserStream
* **Reliability**: No historical replay guarantee. If your WebSocket disconnects, you'll need to manually detect and backfill gaps using RPC methods
* **Complexity**: Requires additional monitoring infrastructure to ensure data completeness

#### How to Use Enhanced WebSockets for Indexing

To update an index that stores all token transfers, you would subscribe to [`transactionSubscribe`](/enhanced-websockets/transaction-subscribe) like this:

```ts theme={"system"}
{
  jsonrpc: '2.0',
  id: 1,
  method: 'transactionSubscribe',
  params: [
    {
      failed: false,
      accountInclude: [
        '​​TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA',
        'TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb'
      ]
    },
    {
      commitment: 'confirmed',
      encoding: 'jsonParsed',
      transactionDetails: 'full',
      maxSupportedTransactionVersion: 0
    }
  ]
}
```

## Get started

Building a robust Solana index and backfilling data requires solving three core challenges:

1. Efficiently fetching historical data
2. Transforming and storing data for quick retrievals
3. Keeping indexed Solana data updated in real time

With our new [state-of-the-art archival system](https://www.helius.dev/blog/introducing-gettransactionsforaddress), archival calls like **getTransactionForAddress**, and industry-leading data streaming solutions like LaserStream, building a Solana index is easier, and more practical than ever.

### Next steps:

* [Sign up for a free Helius account](https://www.helius.dev) to get API access
* Read the [gTFA documentation](/rpc/gettransactionsforaddress) for information about backfilling
* Explore the [LaserStream quickstart guide](/laserstream) for real-time streaming
> ## Documentation Index
> Fetch the complete documentation index at: https://www.helius.dev/docs/llms.txt
> Use this file to discover all available pages before exploring further.

# Enhanced Transactions Overview

> Transform complex Solana blockchain transactions into human-readable data with Helius Enhanced Transactions API. Parse transaction details, fetch history, and understand on-chain activity without manual decoding.

<CardGroup cols={2}>
  <Card title="Parse Transaction(s)" icon="code" href="/enhanced-transactions/parse-transactions">
    Parse transactions into human-readable data
  </Card>

  <Card title="Transaction History" icon="clock-rotate-left" href="/enhanced-transactions/transaction-history">
    Get historical transaction data for any address
  </Card>
</CardGroup>

<Note>
  **Quick Reference**:

  * `/v0/transactions` - Parse individual or multiple transaction signatures
  * `/v0/addresses/{address}/transactions` - Get transaction history for an address
  * Filter by transaction type using the `type` parameter (e.g., `NFT_SALE`, `SWAP`, `TRANSFER`)
  * View all available type filters in the [API Reference](/api-reference/enhanced-transactions/gettransactionsbyaddress)
</Note>

## Overview

The Enhanced Transactions API transforms complex Solana transactions into human-readable data.

## Key Features

<CardGroup cols={2}>
  <Card title="Human-Readable Data" icon="book-open">
    Get clear descriptions of transaction activities instead of raw blockchain data
  </Card>

  <Card title="Type Filtering" icon="filter">
    Filter transactions by type: NFT sales, swaps, transfers, and more.
    [See all types](/api-reference/enhanced-transactions/gettransactionsbyaddress).
  </Card>

  <Card title="Pagination Support" icon="arrows-rotate">
    Efficiently fetch large transaction histories with built-in pagination
  </Card>

  <Card title="Detailed Metadata" icon="info">
    Access timestamps, fees, signatures, and account information
  </Card>
</CardGroup>

## What You Get

The Enhanced Transactions API provides:

* **Structured Data**: Transaction details organized in a clean, accessible format
* **Event Summaries**: High-level summaries of what happened in each transaction
* **Account Information**: Details about all accounts involved
* **Transfer Details**: Clear information about SOL and token movements
* **Timestamps**: When transactions were processed
* **Fee Information**: Transaction fees and fee payer details

## Use Cases

The Enhanced Transactions API is ideal for:

* **Wallet Applications**: Display transaction history to users
* **Portfolio Trackers**: Track asset movements across accounts
* **Analytics Platforms**: Analyze on-chain activity
* **NFT Marketplaces**: Monitor NFT sales and listings
* **DeFi Applications**: Track swaps and transfers (for supported protocols)

## Getting Started

<Steps>
  <Step title="Get Your API Key">
    Sign up at [dashboard.helius.dev](https://dashboard.helius.dev) to get your API key.
  </Step>

  <Step title="Choose Your Endpoint">
    Select either the parse transactions or transaction history endpoint based on your needs.
  </Step>

  <Step title="Make Your First Request">
    Start with a simple request to parse a transaction or fetch transaction history.

    <Tip>
      Check out our [Parse Transactions](/enhanced-transactions/parse-transactions) and [Transaction History](/enhanced-transactions/transaction-history) guides for code examples.
    </Tip>
  </Step>
</Steps>

## Questions?

For frequently asked questions about Enhanced Transactions including usage, authentication, rate limits, and troubleshooting, visit our comprehensive [Enhanced Transactions FAQ](/faqs/enhanced-transactions).
> ## Documentation Index
> Fetch the complete documentation index at: https://www.helius.dev/docs/llms.txt
> Use this file to discover all available pages before exploring further.

# Parse Transactions

> Parse transactions into human-readable data.

<Note>
  Enhanced Transaction API V1 is actively being improved with new parser types to expand coverage. We're planning a complete overhaul in V2 in the near future with enhanced capabilities.
</Note>

## Overview

The Parse Transactions endpoint transforms raw transaction signatures or data into structured, human-readable information. Instead of manually decoding instruction data and account lists, you receive clear details about transfers, swaps, NFT activities, and more.

<Card title="API Reference" horizontal icon="code" href="/api-reference/enhanced-transactions/gettransactions">
  View detailed API documentation for parsing transactions
</Card>

## Quickstart

Parse one or more transaction signatures with a single API call:

<Tabs>
  <Tab title="JavaScript">
    ```javascript theme={"system"}
    const parseTransaction = async () => {
      const url = "https://api-mainnet.helius-rpc.com/v0/transactions/?api-key=YOUR_API_KEY";

      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          transactions: ["5rfFLBUp5YPr6rC2g1KBBW8LGZBcZ8Lvs7gKAdgrBjmQvFf6EKkgc5cpAQUTwGxDJbNqtLYkjV5vS5zVK4tb6JtP"],
        }),
      });

      const data = await response.json();
      console.log("Parsed transaction:", data);
    };

    parseTransaction();
    ```
  </Tab>

  <Tab title="Python">
    ```python theme={"system"}
    import requests
    import json

    def parse_transaction():
        url = "https://api-mainnet.helius-rpc.com/v0/transactions/?api-key=YOUR_API_KEY"
        
        payload = {
            "transactions": ["5rfFLBUp5YPr6rC2g1KBBW8LGZBcZ8Lvs7gKAdgrBjmQvFf6EKkgc5cpAQUTwGxDJbNqtLYkjV5vS5zVK4tb6JtP"]
        }
        
        response = requests.post(url, json=payload)
        data = response.json()
        print("Parsed transaction:", data)
        
    parse_transaction()
    ```
  </Tab>
</Tabs>

## Response Structure

Enhanced transaction responses include structured data with human-readable descriptions:

```json theme={"system"}
{
  "description": "Transfer 0.1 SOL to FXvStt8aeQHMGKDgqaQ2HXWfJsXnqiKSoBEpHJahkuD",
  "type": "TRANSFER",
  "source": "SYSTEM_PROGRAM",
  "fee": 5000,
  "feePayer": "M2mx93ekt1fmXSVkTrUL9xVFHkmME8HTUi5Cyc5aF7K",
  "signature": "5rfFLBUp5YPr6rC2g1KBBW8LGZBcZ8Lvs7gKAdgrBjmQvFf6EKkgc5cpAQUTwGxDJbNqtLYkjV5vS5zVK4tb6JtP",
  "slot": 171341028,
  "timestamp": 1674080473,
  "nativeTransfers": [
    {
      "fromUserAccount": "M2mx93ekt1fmXSVkTrUL9xVFHkmME8HTUi5Cyc5aF7K",
      "toUserAccount": "FXvStt8aeQHMGKDgqaQ2HXWfJsXnqiKSoBEpHJahkuD",
      "amount": 100000000
    }
  ],
  "events": {
    "sol": {
      "from": "M2mx93ekt1fmXSVkTrUL9xVFHkmME8HTUi5Cyc5aF7K",
      "to": "FXvStt8aeQHMGKDgqaQ2HXWfJsXnqiKSoBEpHJahkuD",
      "amount": 0.1
    }
  }
}
```

## What You Get

The parsed transaction data includes:

* **Description**: Human-readable summary of what happened
* **Type**: Transaction category (TRANSFER, SWAP, NFT\_SALE, etc.)
* **Source**: Program that executed the transaction
* **Fee Information**: Transaction fees and fee payer
* **Native Transfers**: SOL movements between accounts
* **Token Transfers**: SPL token movements
* **Events**: High-level event summaries
* **Timestamps**: When the transaction was processed

## Questions?

For frequently asked questions about Enhanced Transactions including usage, authentication, rate limits, and troubleshooting, visit our comprehensive [Enhanced Transactions FAQ](/faqs/enhanced-transactions).
> ## Documentation Index
> Fetch the complete documentation index at: https://www.helius.dev/docs/llms.txt
> Use this file to discover all available pages before exploring further.

# Transaction History

> Human-readable transaction history for any Solana address.

<Note>
  Enhanced Transaction API V1 is actively being improved with new parser types to expand coverage. We're planning a complete overhaul in V2 in the near future with enhanced capabilities.
</Note>

## Overview

The Enhanced Transactions API transforms complex Solana transactions into human-readable data. Instead of dealing with raw instruction data and account lists, you get structured information about:

* What happened in the transaction (transfers, swaps, NFT activities)
* Which accounts were involved
* How much SOL or tokens were transferred
* Associated metadata (e.g. token mint addresses, token names, token symbols, etc.)

Under the hood, the API is powered by the [getTransactionsForAddress](/rpc/gettransactionsforaddress) RPC method.

<Card title="API Reference" horizontal icon="code" href="/api-reference/enhanced-transactions/gettransactionsbyaddress">
  View detailed API documentation for transaction history
</Card>

## Associated Token Accounts

<Note>
  On Solana, your wallet doesn't actually hold tokens directly. Instead, your wallet owns token accounts, and those token accounts hold your tokens.
  When someone sends you USDC, it goes to your USDC token account instead of your main wallet address.
</Note>

This method is unique because it allows you to query **complete token history**. You can query for a wallet's full history, including associated token addresses (ATAs).
Native RPC methods such as getSignaturesForAddress do not include ATAs.

The `token-accounts` filter gives you control over this behavior:

* **`none`** (default): Only returns transactions that directly reference the wallet address. Use this when you only care about direct wallet interactions.
* **`balanceChanged`** (recommended): Returns transactions that reference the wallet address OR modify the balance of a token account owned by the wallet. This filters out spam and unrelated operations like fee collections or delegations, giving you a clean view of meaningful wallet activity.
* **`all`**: Returns all transactions that reference the wallet address or any token account owned by the wallet.

<Warning>
  **Limitation for Legacy Transactions**: The `token-accounts` filter relies on the `owner` field in token balance metadata, which was not available before slot 111,491,819 (\~December 2022). Transactions involving token accounts active before this slot may be missing from `balanceChanged` and `all` results. See the [getTransactionsForAddress tutorial](/rpc/gettransactionsforaddress#workaround-historical-token-account-discovery) for a workaround with full code example.
</Warning>

## Network Support

| Network | Supported | Retention Period |
| ------- | --------- | ---------------- |
| Mainnet | Yes       | Unlimited        |
| Devnet  | Yes       | 2 weeks          |
| Testnet | No        | N/A              |

## Quickstart

Retrieve transaction history for any Solana address:

<Tabs>
  <Tab title="JavaScript">
    ```javascript theme={"system"}
    const fetchWalletTransactions = async () => {
      const walletAddress = "M2mx93ekt1fmXSVkTrUL9xVFHkmME8HTUi5Cyc5aF7K"; // Replace with target wallet
      const url = `https://api-mainnet.helius-rpc.com/v0/addresses/${walletAddress}/transactions?api-key=YOUR_API_KEY`;
      
      const response = await fetch(url);
      const transactions = await response.json();
      console.log("Wallet transactions:", transactions);
    };

    fetchWalletTransactions();
    ```
  </Tab>

  <Tab title="Python">
    ```python theme={"system"}
    import requests

    def fetch_wallet_transactions():
        wallet_address = "M2mx93ekt1fmXSVkTrUL9xVFHkmME8HTUi5Cyc5aF7K"  # Replace with target wallet
        url = f"https://api-mainnet.helius-rpc.com/v0/addresses/{wallet_address}/transactions?api-key=YOUR_API_KEY"
        
        response = requests.get(url)
        transactions = response.json()
        print("Wallet transactions:", transactions)
        
    fetch_wallet_transactions()
    ```
  </Tab>
</Tabs>

### Filter by Transaction Type

Get only specific transaction types, such as NFT sales, token transfers, or swaps:

<Tabs>
  <Tab title="NFT Sales">
    ```javascript theme={"system"}
    const fetchNftSales = async () => {
      const tokenAddress = "GjUG1BATg5V4bdAr1csKys1XK9fmrbntgb1iV7rAkn94"; // NFT mint address
      const url = `https://api-mainnet.helius-rpc.com/v0/addresses/${tokenAddress}/transactions?api-key=YOUR_API_KEY&type=NFT_SALE`;
      
      const response = await fetch(url);
      const nftSales = await response.json();
      console.log("NFT sale transactions:", nftSales);
    };
    ```
  </Tab>

  <Tab title="Token Transfers">
    ```javascript theme={"system"}
    const fetchTokenTransfers = async () => {
      const walletAddress = "M2mx93ekt1fmXSVkTrUL9xVFHkmME8HTUi5Cyc5aF7K"; // Wallet address
      const url = `https://api-mainnet.helius-rpc.com/v0/addresses/${walletAddress}/transactions?api-key=YOUR_API_KEY&type=TRANSFER`;
      
      const response = await fetch(url);
      const transfers = await response.json();
      console.log("Transfer transactions:", transfers);
    };
    ```
  </Tab>

  <Tab title="Swaps">
    ```javascript theme={"system"}
    const fetchSwapTransactions = async () => {
      const walletAddress = "M2mx93ekt1fmXSVkTrUL9xVFHkmME8HTUi5Cyc5aF7K"; // Wallet address
      const url = `https://api-mainnet.helius-rpc.com/v0/addresses/${walletAddress}/transactions?api-key=YOUR_API_KEY&type=SWAP`;
      
      const response = await fetch(url);
      const swaps = await response.json();
      console.log("Swap transactions:", swaps);
    };
    ```
  </Tab>
</Tabs>

[See all available types](/api-reference/enhanced-transactions/gettransactionsbyaddress).

### Pagination

For high-volume addresses, implement pagination to fetch all transactions:

```javascript theme={"system"}
const fetchAllTransactions = async () => {
  const walletAddress = "2k5AXX4guW9XwRQ1AKCpAuUqgWDpQpwFfpVFh3hnm2Ha"; // Replace with target wallet
  const baseUrl = `https://api-mainnet.helius-rpc.com/v0/addresses/${walletAddress}/transactions?api-key=YOUR_API_KEY`;
  let url = baseUrl;
  let lastSignature = null;
  let allTransactions = [];
  
  while (true) {
    if (lastSignature) {
      url = baseUrl + `&before-signature=${lastSignature}`;
    }
    
    const response = await fetch(url);
    
    // Check response status
    if (!response.ok) {
      console.error(`API error: ${response.status}`);
      break;
    }
    
    const transactions = await response.json();
    
    if (transactions && transactions.length > 0) {
      console.log(`Fetched batch of ${transactions.length} transactions`);
      allTransactions = [...allTransactions, ...transactions];
      lastSignature = transactions[transactions.length - 1].signature;
    } else {
      console.log(`Finished! Total transactions: ${allTransactions.length}`);
      break;
    }
  }
  
  return allTransactions;
};
```

## API Reference

| Parameter          | Description                                                           | Default     | Example                          |
| ------------------ | --------------------------------------------------------------------- | ----------- | -------------------------------- |
| `limit`            | Number of transactions to return (1-100)                              | 10          | `&limit=25`                      |
| `before-signature` | Fetch transactions before this signature (use with `sort-order=desc`) | -           | `&before-signature=sig123...`    |
| `after-signature`  | Fetch transactions after this signature (use with `sort-order=asc`)   | -           | `&after-signature=sig456...`     |
| `type`             | Filter by transaction type                                            | -           | `&type=NFT_SALE`                 |
| `sort-order`       | Sort order for results                                                | `desc`      | `&sort-order=asc`                |
| `token-accounts`   | Filter transactions for related token accounts                        | `none`      | `&token-accounts=balanceChanged` |
| `commitment`       | Commitment level                                                      | `finalized` | `&commitment=confirmed`          |

### Time-Based Filtering

| Parameter  | Description                                   | Example                |
| ---------- | --------------------------------------------- | ---------------------- |
| `gt-time`  | Transactions after this Unix timestamp        | `&gt-time=1656442333`  |
| `gte-time` | Transactions at or after this Unix timestamp  | `&gte-time=1656442333` |
| `lt-time`  | Transactions before this Unix timestamp       | `&lt-time=1656442333`  |
| `lte-time` | Transactions at or before this Unix timestamp | `&lte-time=1656442333` |

### Slot-Based Filtering

| Parameter  | Description                         | Example               |
| ---------- | ----------------------------------- | --------------------- |
| `gt-slot`  | Transactions after this slot        | `&gt-slot=148277128`  |
| `gte-slot` | Transactions at or after this slot  | `&gte-slot=148277128` |
| `lt-slot`  | Transactions before this slot       | `&lt-slot=148277128`  |
| `lte-slot` | Transactions at or before this slot | `&lte-slot=148277128` |

<Info>
  **Filtering Tips**:

  * Time parameters use Unix timestamps (seconds since epoch)
  * Slot parameters use Solana slot numbers
  * You cannot combine time-based and slot-based filters in the same request
  * Use `sort-order=asc` for ascending (oldest first) or `sort-order=desc` for descending (newest first)
</Info>

## Advanced Filtering Examples

### Filter by Time Range

Get transactions within a specific time window:

<Tabs>
  <Tab title="Last 24 Hours">
    ```javascript theme={"system"}
    const fetchRecentTransactions = async () => {
      const walletAddress = "M2mx93ekt1fmXSVkTrUL9xVFHkmME8HTUi5Cyc5aF7K";
      const now = Math.floor(Date.now() / 1000);
      const oneDayAgo = now - (24 * 60 * 60);
      
      const url = `https://api-mainnet.helius-rpc.com/v0/addresses/${walletAddress}/transactions?api-key=YOUR_API_KEY&gte-time=${oneDayAgo}&lte-time=${now}`;
      
      const response = await fetch(url);
      const transactions = await response.json();
      console.log("Transactions from last 24 hours:", transactions);
    };
    ```
  </Tab>

  <Tab title="Specific Date Range">
    ```javascript theme={"system"}
    const fetchTransactionsByDateRange = async () => {
      const walletAddress = "M2mx93ekt1fmXSVkTrUL9xVFHkmME8HTUi5Cyc5aF7K";
      
      // January 1, 2024 to January 31, 2024
      const startTime = Math.floor(new Date('2024-01-01').getTime() / 1000);
      const endTime = Math.floor(new Date('2024-01-31').getTime() / 1000);
      
      const url = `https://api-mainnet.helius-rpc.com/v0/addresses/${walletAddress}/transactions?api-key=YOUR_API_KEY&gte-time=${startTime}&lte-time=${endTime}`;
      
      const response = await fetch(url);
      const transactions = await response.json();
      console.log("Transactions in January 2024:", transactions);
    };
    ```
  </Tab>
</Tabs>

### Filter by Slot Range

Get transactions within a specific slot range:

```javascript theme={"system"}
const fetchTransactionsBySlotRange = async () => {
  const walletAddress = "M2mx93ekt1fmXSVkTrUL9xVFHkmME8HTUi5Cyc5aF7K";
  const startSlot = 148000000;
  const endSlot = 148100000;
  
  const url = `https://api-mainnet.helius-rpc.com/v0/addresses/${walletAddress}/transactions?api-key=YOUR_API_KEY&gte-slot=${startSlot}&lte-slot=${endSlot}`;
  
  const response = await fetch(url);
  const transactions = await response.json();
  console.log(`Transactions between slots ${startSlot} and ${endSlot}:`, transactions);
};
```

### Change Sort Order

Get transactions in ascending order (oldest first):

```javascript theme={"system"}
const fetchOldestTransactions = async () => {
  const walletAddress = "M2mx93ekt1fmXSVkTrUL9xVFHkmME8HTUi5Cyc5aF7K";
  const url = `https://api-mainnet.helius-rpc.com/v0/addresses/${walletAddress}/transactions?api-key=YOUR_API_KEY&sort-order=asc&limit=10`;
  
  const response = await fetch(url);
  const transactions = await response.json();
  console.log("10 oldest transactions:", transactions);
};
```

### Include Transfers for Related Token Accounts

Query for a wallet’s full history, including associated token addresses (ATAs):

```javascript theme={"system"}
const fetchTransactionsWithATA = async () => {
  const walletAddress = "M2mx93ekt1fmXSVkTrUL9xVFHkmME8HTUi5Cyc5aF7K";
  
  const url = `https://api-mainnet.helius-rpc.com/v0/addresses/${walletAddress}/transactions?api-key=YOUR_API_KEY&token-accounts=balanceChanged&sort-order=desc&limit=50`;
  
  const response = await fetch(url);
  const transactions = await response.json();
  console.log("Most recent transactions (including ATA transfers)", transactions);
};
```

### Combine Multiple Filters

Combine type filtering with time range and custom sort order:

```javascript theme={"system"}
const fetchFilteredTransactionsAdvanced = async () => {
  const walletAddress = "M2mx93ekt1fmXSVkTrUL9xVFHkmME8HTUi5Cyc5aF7K";
  
  // Get NFT sales from the last 7 days, oldest first
  const now = Math.floor(Date.now() / 1000);
  const sevenDaysAgo = now - (7 * 24 * 60 * 60);
  
  const url = `https://api-mainnet.helius-rpc.com/v0/addresses/${walletAddress}/transactions?api-key=YOUR_API_KEY&type=NFT_SALE&gte-time=${sevenDaysAgo}&sort-order=asc&limit=50`;
  
  const response = await fetch(url);
  const transactions = await response.json();
  console.log("NFT sales from last 7 days (oldest first):", transactions);
};
```

### Pagination with Time Filters

Paginate through results with time filtering:

```javascript theme={"system"}
const fetchAllTransactionsInTimeRange = async () => {
  const walletAddress = "M2mx93ekt1fmXSVkTrUL9xVFHkmME8HTUi5Cyc5aF7K";
  const startTime = Math.floor(new Date('2024-01-01').getTime() / 1000);
  const endTime = Math.floor(new Date('2024-01-31').getTime() / 1000);
  
  let beforeSignature = null;
  let allTransactions = [];
  
  while (true) {
    let url = `https://api-mainnet.helius-rpc.com/v0/addresses/${walletAddress}/transactions?api-key=YOUR_API_KEY&gte-time=${startTime}&lte-time=${endTime}&limit=100`;
    
    if (beforeSignature) {
      url += `&before-signature=${beforeSignature}`;
    }
    
    const response = await fetch(url);
    const transactions = await response.json();
    
    if (!Array.isArray(transactions) || transactions.length === 0) {
      break;
    }
    
    allTransactions = [...allTransactions, ...transactions];
    beforeSignature = transactions[transactions.length - 1].signature;
    
    console.log(`Fetched ${transactions.length} transactions, total: ${allTransactions.length}`);
  }
  
  console.log(`Total transactions in time range: ${allTransactions.length}`);
  return allTransactions;
};
```

<Tip>
  **Performance Tips**:

  * Use time or slot filters to reduce the search space when you know the approximate time period
  * Combine with `limit` parameter to control page size
  * Use `sort-order=asc` when you want to process transactions chronologically
  * Time-based filters are more intuitive for date ranges, while slot-based filters are useful for blockchain-specific queries
</Tip>

## Type Filtering Considerations

<Warning>
  **Runtime Type Filtering**:

  Type filtering happens at runtime, meaning the API searches through transactions sequentially until it finds at least 50 matching items. If the API cannot find any transactions matching your filter within the search period, it will return an error with instructions to continue searching.
</Warning>

When using type filters, you may encounter a situation where no matching transactions are found within the current search window. In this case, the API returns an error response like:

```json theme={"system"}
{
  "error": "Failed to find events within the search period. To continue search, query the API again with the `before-signature` parameter set to 2UKbsu95YzxGjUGYRg2znozmmVADVgmnhHqzDxq8Xfb3V5bf2NHUkaXGPrUpQnRFVHVKbawdQXtm4xJt9njMDHvg."
}
```

To continue the search, you need to use the signature provided in the error message with the appropriate parameter (`before-signature` for descending, `after-signature` for ascending) in your next request. Here's how to handle this:

```javascript theme={"system"}
const fetchFilteredTransactions = async (sortOrder = 'desc') => {
  const walletAddress = "M2mx93ekt1fmXSVkTrUL9xVFHkmME8HTUi5Cyc5aF7K";
  const transactionType = "NFT_SALE";
  let continuationSignature = null;
  let allFilteredTransactions = [];
  let maxRetries = 10; // Prevent infinite loops
  let retryCount = 0;
  
  // Determine which parameter to use based on sort order
  const continuationParam = sortOrder === 'asc' ? 'after-signature' : 'before-signature';
  
  while (retryCount < maxRetries) {
    // Build URL with optional continuation parameter
    let url = `https://api-mainnet.helius-rpc.com/v0/addresses/${walletAddress}/transactions?api-key=YOUR_API_KEY&type=${transactionType}&sort-order=${sortOrder}`;
    
    if (continuationSignature) {
      url += `&${continuationParam}=${continuationSignature}`;
    }
    
    try {
      const response = await fetch(url);
      const data = await response.json();
      
      // Check if we received an error about search period
      if (data.error && data.error.includes("Failed to find events within the search period")) {
        // Extract the signature from the error message
        const signatureMatch = data.error.match(/parameter set to ([A-Za-z0-9]+)/);
        
        if (signatureMatch && signatureMatch[1]) {
          console.log(`No results in this period. Continuing search from: ${signatureMatch[1]}`);
          continuationSignature = signatureMatch[1];
          retryCount++;
          continue; // Continue searching with new signature
        } else {
          console.log("No more transactions to search");
          break;
        }
      }
      
      // Check if we received transactions
      if (Array.isArray(data) && data.length > 0) {
        console.log(`Found ${data.length} ${transactionType} transactions`);
        allFilteredTransactions = [...allFilteredTransactions, ...data];
        
        // Set continuation signature for next page
        continuationSignature = data[data.length - 1].signature;
        retryCount = 0; // Reset retry count since we found results
      } else {
        console.log("No more transactions found");
        break;
      }
      
    } catch (error) {
      console.error("Error fetching transactions:", error);
      break;
    }
  }
  
  console.log(`Total ${transactionType} transactions found: ${allFilteredTransactions.length}`);
  return allFilteredTransactions;
};

// Usage examples:
// Descending order (newest first) - uses 'before-signature' parameter
fetchFilteredTransactions('desc');

// Ascending order (oldest first) - uses 'after-signature' parameter
fetchFilteredTransactions('asc');
```

<Info>
  **Key Points**:

  * The API searches through up to 50 transactions at a time when using type filters
  * If no matches are found, use the signature from the error message to continue searching
  * Use `before-signature` parameter when searching in descending order (default, newest first)
  * **Use `after-signature` parameter when searching in ascending order (oldest first)** - this is required for chronological searches
  * Implement a maximum retry limit to prevent infinite loops
  * This behavior is expected and allows you to search through an address's entire history for specific transaction types
</Info>

## Questions?

For frequently asked questions about Enhanced Transactions including usage, authentication, rate limits, and troubleshooting, visit our comprehensive [Enhanced Transactions FAQ](/faqs/enhanced-transactions).