# RANK Transaction Indexer – v0.1.0

`rank-indexer-ts` connects to the Lotus blockchain daemon using NNG (via npm `nanomsg` library) in order to index all transactions containing a valid RANK output. RANK outputs are indexed into a PostgreSQL database. Retrieving records from this database is made possible by [`rank-api-ts`](https://github.com/LotusiaStewardship/rank-api-ts). More information on the entire RANK suite and protocol can be found in the [`rank-suite`](https://github.com/LotusiaStewardship/rank-suite) repository.

`rank-indexer-ts` is *fast*. Benchmarks performed on moderate hardware show a transaction processing rate of over 9,000 RANK tx/s during initial sync. During runtime, the indexer will queue NNG messages and process them in the order they were received, ensuring the state of the index remains intact.

As of v0.1.0, `rank-indexer-ts` is considered **stable** and **performant**. Implementing parallelization through `worker_threads` isn't planned at this time, but we will revist `worker_threads` in the future if the RANK protocol evolves and requires the indexer to evolve with it.

**\*\*\*** **For best indexing performance, run lotusd, PostgreSQL, and `rank-indexer-ts` on the same host**

# Prerequisites

- Configure lotusd – refer to [`raipay/chronik` setup instructions](https://github.com/raipay/chronik#setting-up-ecash-or-lotus-node-for-chronik)
- Clone `rank-indexer-ts` repo:

    ```
    git clone https://github.com/LotusiaStewardship/rank-indexer-ts.git
    ```

- Install `node-gyp` globally:

    ```
    sudo npm install --global node-gyp
    ```

### PostgreSQL - Linux

**NOTE: These instructions were tested on openSUSE Tumbleweed and are working as of October 23, 2024**

1. Install `postgresql-server` using your system's package manager (package name may differ depending on your distribution)
2. Open a terminal **with `root` privileges** and change to the directory where you cloned `rank-indexer-ts`
3. Enable password authentication on PostgreSQL for localhost (if not already enabled):

    ```
    sed -rn -i.bak 'p; s/(host\s+all.*127\.0\.0\.1\/32\s+)password!/\1password/p' /var/lib/pgsql/data/pg_hba.conf
    ```

4. Start (or restart) PostgreSQL service:

    ```
    systemctl restart postgresql.service
    ```

    You should see that the sevice is `active (running)`

    ```
    ● postgresql.service - PostgreSQL database server
        Loaded: loaded (/usr/lib/systemd/system/postgresql.service; enabled; preset: disabled)
        Active: active (running) since Fri 2024-10-18 10:18:46 CDT; 4 days ago
    ```

5. Execute the database setup script:
    ```
    sudo -u postgres psql -f install/rank-index.sql
    ```

\*\*\* **IMPORTANT: The location of `pg_hba.conf` will vary depending on your distribution**

# Install – Docker

**COMING SOON**

# Install – Linux / macOS

**NOTE: There is currently no plan to support Windows**

1. Open a terminal and change to the directory where you cloned `rank-indexer-ts`
2. Install prod and dev dependencies:

    ```
    npm install --include=dev
    ```

3. Apply Prisma schema to PostgreSQL and generate runtime client artifacts:

    ```
    npx prisma db push
    ```

    **OPTIONAL**: Clean install to remove dev dependencies (`omit=dev` is defined in `.npmrc`):

    ```
    npm clean-install
    ```

4. Start the indexer:

    ```
    npx tsc && node app [protocol] [pub socket path] [rpc socket path]
    ```

    Example:

    ```
    npx tsc && node app ipc ~/.lotus/pub.pipe ~/.lotus/rpc.pipe
    ```

    **NOTE: If no command-line arguments are provided, the indexer will attempt to connect to `ipc://~/.lotus/pub.pipe` and `ipc://~/.lotus/rpc.pipe`**


# Runtime

Once the indexer is running, you will begin to see scrolling messages with `init=syncBlocks`. After the initial block sync, the mempool will be synced and the NNG pub socket will begin listening for new events.

```
.. snip ..
2024-10-23T14:10:46.693Z init=syncBlocks status=finished totalBlocks=0 totalRanks=0 elapsed=0.000s
2024-10-23T14:10:46.705Z init=syncMempool txsLength=8 ranksLength=8 action=upsertProfiles elapsed=11.261ms
2024-10-23T14:10:46.705Z init=nng status=subscribed channels=mempooltxadd,mempooltxrem,blkconnected,blkdisconctd
```

### Example NNG events

```
# mempooltxadd
2024-10-23T15:23:05.900Z nng=mempooltxadd txid=da7ccad023e6b4c9cde8ff6546e21824c2d4a2378807b950c09de43d83bf9530 timestamp=1729696985898 platform=01 profileId=0000000000616c657875676f726a695f sats=1000000 sentiment=00 action=upsertProfiles elapsed=1.982ms

# mempooltxrem
2024-10-23T15:23:22.453Z nng=mempooltxrem txid=da7ccad023e6b4c9cde8ff6546e21824c2d4a2378807b950c09de43d83bf9530 timestamp=1729696985898 platform=01 profileId=0000000000616c657875676f726a695f sats=1000000 sentiment=00 action=rewindProfiles elapsed=1.199ms

# blkconnected
2024-10-23T15:23:22.457Z nng=blkconnected hash=00000000018ec3f1027a002be790431b05f392b77a6f5d6e6246a39864846ca2 height=883260 timestamp=1729697001 ranksLength=4 elapsed=3.339ms

# blkdisconctd
(none here yet)
```

### NNG Event Field Index

| Field | Description |
|-|-|
| `nng=` | Indicates an NNG event and which type |
| `txid=` | txid containing the RANK output |
| `hash=` | Block hash |
| `height=`| Block height |
| `ranksLength=` | Number of RANK outputs in the block |
| `timestamp=`| If mempool, current time; if block, timestamp in block header |
| `platform=` | Byte indicating target platform (e.g. `01` == Twitter) |
| `profileId=` | Bytes of profile name decoded from UTF-8, padded to platform's max length |
| `sentiment=` | Byte indicating positive or negative sentiment (`00` == negative, `01` == positive)
| `sats=` | Number of satoshis burned in the RANK output |
| `action=` | Indexer action taken for the RANK output |
| `elapsed=` | Time taken to process the `action=` |