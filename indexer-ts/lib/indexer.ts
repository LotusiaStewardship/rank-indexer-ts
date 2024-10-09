import { Script, Transaction } from '@abcpros/bitcore-lib-xpi'
import { Builder, ByteBuffer } from 'flatbuffers'
import * as NNG from './nng-interface'
import { Socket, socket } from 'nanomsg'
//import { Socket } from '@rustup/nng'
import { Database } from './database'
import {
  ERR,
  NNG_REQUEST_TIMEOUT_LENGTH,
  NNG_RPC_BLOCKRANGE_SIZE,
  NNG_RPC_RCVMAXSIZE_CONSENSUS,
  NNG_SOCKET_MAXRECONN,
  NNG_SOCKET_RECONN,
} from '../util/constants'
/** First block with a RANK transaction */
const GENESIS = {
  hash: '00000000019cc1ddc04bc541f531f1424d04d0c37443867f1f6137cc7f7d09e5',
  height: 811624,
  timestamp: 1721079817n
}
/**  */
export type NNGMessageType = 
  'mempooltxadd' |
  'mempooltxrem' |
  'blkconnected' |
  'blkdisconctd'
/**  */
export type ScriptPart = {
  offset: number,
  len: number,
  hex?: string,
}
/**  */
export type ParsedTransaction = {
  txid: string,
  timestamp: Date // unix
  outputs: Transaction.Output[]
}
/** OP_RETURN <RANK> <sentiment> <profileId> [<postId> <commentHex>] */
type RankOutput = {
  platform: string // e.g. Twitter/X.com
  profileId: string // who the ranking is for
  sentiment: boolean // true = positive, false = negative
  value: bigint // sats for sentiment
}
/**  */
export type RankTransaction = RankOutput & {
  output: string // <txid>_<outIdx>
  height: number // -1 if mempool
  timestamp: bigint // unix timestamp
}
/**  */
export type Profile = {
  // 16-byte hex-encoded profile name (e.g. "mcp011011" -> "000000000000006d6370303131303131")
  id: string
  // 1-byte hex-encoded platform code (e.g. Twitter -> "01")
  platform: string 
  ranks: RankTransaction[]
  ranking?: bigint // ranking needs to be calculated after upserts
}
/** */
export type Block = {
  height: number,
  timestamp: bigint,
  hash: string,
  prevhash?: string, // for reorg checks only; does not get saved to database
  ranksLength: number // default is 0 unless a block is based
}
/**  */
enum QUEUE_STATE {
  FREE = 0,
  BUSY = 1,
}
/** Signal to would-be promises that they should think twice before resolving */
export class Indexer {
  private db: Database
  private sub: Socket
  private rpc: Socket
  private nngUri: string
  private rpcUri: string
  private queue: {
    state: QUEUE_STATE
    mempool: RankTransaction[]
    promises: Promise<any>[]
  } = {
    state: QUEUE_STATE.FREE,
    mempool: [],
    promises: []
  }
  private subChannels: NNGMessageType[] = ['mempooltxadd', 'blkconnected', 'blkdisconctd']
  private parts: {
    [part in 'lokad' | 'sentiment' | 'platform' | 'profile' | 'post' | 'comment']: ScriptPart
  } = {
    lokad: { offset: 2, len: 4, hex: Buffer.from('RANK').toString('hex') },
    sentiment: { offset: 6, len: 1 },
    platform: { offset: 8, len: 1 },
    profile: { offset: 10, len: 16 },
    post: { offset: 26, len: 32 }, // sha-256 hash of post metadata + body, if applicable
    comment: { offset: 58, len: 164 } // optional on-chain comment to accompany vote (223 bytes - 59 bytes)
  }
  private genesis: Block = {
    ...GENESIS,
    ranksLength: 1
  }
  private checkpoint: Block
  /**
   * 
   * @param nngUri 
   * @param rpcUri 
   */
  constructor(
    nngUri: string,
    rpcUri: string
  ) {
    this.db = new Database()
    this.nngUri = nngUri
    this.rpcUri = rpcUri
    // Pub/Sub socket setup
    this.sub = socket('sub', { chan: [] })
    this.sub.on('error', this.close)
    this.sub.on('data', this.nngSubHandler)
    this.sub.rcvmaxsize(NNG_RPC_RCVMAXSIZE_CONSENSUS)
    this.sub.reconn(NNG_SOCKET_RECONN)
    this.sub.maxreconn(NNG_SOCKET_MAXRECONN)
    // RPC socket setup
    this.rpc = socket('req')
    this.rpc.on('error', this.close)
    this.rpc.rcvmaxsize(NNG_RPC_RCVMAXSIZE_CONSENSUS * NNG_RPC_BLOCKRANGE_SIZE)
    this.rpc.reconn(NNG_SOCKET_RECONN)
    this.rpc.maxreconn(NNG_SOCKET_MAXRECONN)
  }
  /**
   * Start the engines!
   */
  async init() {
    let log = 'INIT: '
    // signal handlers
    process.on('SIGINT', this.close)
    process.on('SIGTERM', this.close)
    // connect db
    await this.db.connect()
    // Connect NNG sockets to their respective URIs
    // TODO: Need to actually detect NNG connectivity... refer to todo.txt
    try {
      this.rpc.connect(this.rpcUri)
      this.sub.connect(this.nngUri)
      if (!this.rpc.connected || !this.sub.connected) {
        throw new Error(`NNG failed to connect. Make sure NNG is enabled in your lotus.conf and try again.`)
      }
    } catch (e: any) {
      this.close(
        ERR.NNG_CONNECT,
        log + e.message
      )
    }
    // Rewind any mempool txs that weren't reconciled during last runtime
    // Prepares for a clean and error-free runtime :)
    const mempooltxs = await this.db.getRankTransactionsByHeight(-1)
    if (mempooltxs.length > 0){
      try {
        const result = await this.rewindProfiles(mempooltxs)
        console.log(log + result)
      } catch (e: any) {
        this.close(
          ERR.IDX_PROFILE_REWIND,
          log + e.message
        )
      }
    }
    // Get current checkpoint height/hash for init, otherwise start at genesis
    const checkpoint = await this.db.getCheckpoint() ?? this.genesis
    console.log(log + `current checkpoint: ${checkpoint.hash} (height ${checkpoint.height})`)
    // Get the best block compared to our checkpoint
    // The best block could be a previous block with a different hash
    const best = await this.getBestBlock(checkpoint)
    // Check for reorgs
    if (
      best.height < checkpoint.height ||
      checkpoint.hash != best.hash && best.height == checkpoint.height ||
      checkpoint.hash != best.prevhash && best.height == (checkpoint.height + 1)
    ) {
      console.log(
        log + ` --- ! REORG DETECTED\r\n`
      + log + ` --- !    checkpoint best: ${checkpoint.hash} (height ${checkpoint.height})\r\n`
      + log + ` --- !           RPC best: ${best.hash} (height ${best.height})\r\n`
      + log + ` --- !       RPC prevhash: ${best.prevhash} (height ${best.height - 1})`)
      // rewind backwards to match checkpoint height/hash to RPC
      try {
        for (let height = checkpoint.height; height > best.height; height--) {
          const result = await this.rewindBlock(height)
          console.log(log + result)
        }
      } catch (e: any) {
        this.close(
          ERR.IDX_BLOCKS_REWIND,
          log + e.message
        )
      }
    }
    // Sync to the chain tip, starting with the block after our current height
    try {
      const t0 = performance.now()
      // checkpoint is latest synced block or current best (if already synced)
      this.checkpoint = await this.syncBlocks(checkpoint) ?? best
      const t1 = ((performance.now() - t0) / 1000).toFixed(3)
      console.log(log + `synced with RPC: ${this.checkpoint.hash} (height: ${this.checkpoint.height})`)
      console.log(log + `processed ${this.checkpoint.height - best.height} total blocks (${t1}s)`)
    } catch (e: any) {
      this.close(
        ERR.IDX_BLOCKS_SYNC,
        log + e.message
      )
    }
    // Sync the mempool now, just in case we missed anything 😋
    try {
      const result = await this.syncMempool()
      console.log(log + result)
    } catch (e: any) {
      this.close(
        ERR.IDX_MEMPOOL_SYNC,
        log + e.message
      )
    }
    // Subscribe to required NNG channels
    this.sub.chan(this.subChannels)
    console.log(log + `subscribed to NNG (${this.subChannels.join(', ')})`)
  }
  /**
   * Shutdown established connections and close the NNG socket
   * @returns {void}
   */
  async close(
    exitCode: number | string,
    exitError?: string
  ): Promise<NodeJS.Immediate> {
    let log = 'QUIT: '
    if (exitError?.length) {
      log = `FATAL: `
      console.error(log + `${ERR[exitCode]} [${exitCode}]: ${exitError}`)
    } else {
      console.log(log + `exiting due to ${exitCode}`)
    }
    //clearInterval(this.processingInterval)
    // ignore shutdown() number since we're exiting anyway
    this.sub?.shutdown(this.nngUri)
    this.sub?.close()
    console.log(log + 'NNG sub/pub socket shut down')
    this.rpc?.shutdown(this.rpcUri)
    this.rpc?.close()
    console.log(log + 'NNG req/res socket shut down')
    await this.db?.disconnect()
    console.log(log + 'database disconnected')
    // Next time the check queue is processed, we will exit
    return setImmediate(() => process.exit(typeof exitCode == 'string' ? -1 : exitCode))
  }
  /**
   * Compare checkpoint `Block` against the RPC counterpart. Recurse backwards until a match is found.
   * @param checkpoint `Block` whose hash is compared to RPC at the same `height`
   * @returns {Promise<Block>} The best `Block` required to fully sync with RPC
   */
  private async getBestBlock(checkpoint: Block): Promise<Block> {
    try {
      // nanomsg library will block if there is a connection issue
      // nanomsg library will return if RPC responds
      const block = await this.rpcGetBlock(checkpoint.height)
      // block will be null if RPC didn't give us the block for the checkpoint height
      if (block) {
        const header = block.header()
        const rpcHash = this.toBlockhashOrTxid(header.blockHash().hash())
        if (rpcHash == checkpoint.hash) {
          // return RPC block (with prevhash) as best
          return this.toBlock(header, true)
        }
      }
      // Either we didn't get a block from RPC or hash mismatch
      // Get the prevblock from database and recurse
      const prevblock = await this.db.getBlockByHeight(checkpoint.height - 1)
      return this.getBestBlock(prevblock)
    } catch (e: any) {
      throw new Error(`getBestBlock(${typeof checkpoint}): ${e.message}`)
    }
  }
  /**
   * 
   * @param height 
   * @returns 
   */
  private async rewindBlock(
    height: number
  ): Promise<string> {
    try {
      // Gather RANK txs from this block
      const ranks = await this.db.getRankTransactionsByHeight(height)
      // Use "true" to tell this method to execute rewind query vs upsert query
      const result = await this.rewindProfiles(ranks)
      // Delete block
      await this.db.deleteBlockByHeight(height)
      return ` --- ! height ${height}: ${result}`
    } catch (e: any) {
      throw new Error(`rewindBlock(${height}: ${e.message}`)
    }

  }
  /**
   * Called during reorg to delete RANK txs and adjust Profile rankings accordingly
   * @param ranks 
   */
  private async rewindProfiles(
    ranks: RankTransaction[]
  ) {
    try {
      const t0 = performance.now()
      const profiles = this.toProfiles(ranks)
      await this.db.rewindProfiles(profiles)
      const t1 = (performance.now() - t0).toFixed(3)
      return `rewound ${profiles.length} profiles, ${ranks.length} RANK txs (${t1}ms)`
    } catch (e: any) {
      throw new Error(`rewindProfiles(${typeof ranks}): ${e.message}`)
    }
  }
  /**
   * Poll NNG over RPC for (up to) `NNG_RPC_BLOCKRANGE_SIZE` blocks and process them for `RANK` transactions.
   * This method is called recursively from within until RANK database is synced with the blockchain.
   * @param checkpoint Checkpoint block as starting point, either from database or recursive call
   * @returns 
   */
  private async syncBlocks(
    checkpoint: Block
  ): Promise<Block> { 
    let log = `INIT: `
    const t0 = performance.now()
    // Fetch range of blocks, starting at first height following checkpoint
    const startRange = checkpoint.height + 1
    const blockrange = await this.rpcGetBlockRange(startRange)
    const blocksLength = blockrange.blocksLength()
    // Already synced if no blocks returned from RPC
    if (blocksLength < 1) {
      return checkpoint
    }
    // Prepare for processing the block range
    const endRange = startRange + blocksLength
    log += `height ${startRange}->${endRange - 1}: `
    const blocks: Block[] = []
    const ranks: RankTransaction[] = []
    // Proceed with processing the block range
    for (let i = 0; i < blocksLength; i++) {
      try {
        const block = blockrange.blocks(i)
        const checkpoint = this.toBlock(block.header())
        const txsLength = block.txsLength()
        // Skip processing blocks with only coinbase tx or none at all
        // Keep block to update database checkpoint
        if (txsLength <= 1) {
          blocks.push(checkpoint)
          continue
        }
        const result = this.toRankTransactions(block)
        // Saving these for later
        blocks.push({ ...checkpoint, ranksLength: result.length })
        ranks.push(...result)
      } catch (e: any) {
        throw new Error(`syncBlocks(${typeof checkpoint}): ${e.message}`)
      }
    }
    // Upsert profiles and include all associated RANK txs
    if (ranks.length > 0) {
      try {
        // Upsert all block txs, filtering any found in the mempool queue
        await this.upsertProfiles(ranks)
      } catch (e: any) {
        this.close(
          ERR.IDX_PROFILE_UPSERT,
          log + e.message
        )
      }
    }
    // Save blocks after RANK txs in case of error we can resync
    try {
      await this.db.saveBlocks(blocks)
    } catch (e: any) {
      this.close(
        ERR.IDX_BLOCKS_SYNC,
        log + e.message
      )
    }
    const t1 = (performance.now() - t0).toFixed(3)
    console.log(log + `processed ${ranks.length} RANK txs (${t1}ms)`)
    // If we didn't get a full range of blocks then we are fully synced
    // Return the latest block height/hash to update the checkpoint
    if (blocksLength < NNG_RPC_BLOCKRANGE_SIZE) {
      // At this point, any RPC call will likely only be for a single block
      // Set the rcvmaxsize appropriately (as of 9/24/24 block size per network policy is 2MB)
      // UPDATE 10/8/24: Don't change this because we may need to sync blocks after reorg
      //this.rpc.rcvmaxsize(NNG_RPC_RCVMAXSIZE_CONSENSUS)
      // All done catching up; return latest block for logging status to console
      return blocks.pop()
    }
    // recursively sync the next range of blocks, starting at new checkpoint
    return this.syncBlocks(blocks.pop())
  }
  /**
   * 
   */
  private async syncMempool() {
    const t0 = performance.now()
    const mempool = await this.rpcGetMempool()
    const txsLength = mempool.txsLength()
    if (txsLength < 1) {
      return `no mempool txs to process`
    }
    const ranks = this.toRankTransactions(mempool)
    if (ranks.length < 1) {
      return `no mempool RANK txs to process`
    }
    try {
      await this.upsertProfiles(ranks)
      const t1 = (performance.now() - t0).toFixed(3)
      // Initialize the mempool queue with these RANK txs
      this.queue.mempool = ranks
      return `processed ${ranks.length} mempool RANK txs (${t1}ms)`
    } catch (e: any) {
      throw new Error(e.message)
    }
  }
  /**
   * 
   * @param msg 
   * @returns 
   */
  private nngSubHandler = async (msg: Buffer): Promise<void> => {
    let log = 'NNGSUB: '
    // Parse out the message type and convert message to ByteBuffer
    const msgType = msg.subarray(0, 12).toString() as NNGMessageType
    const bb = new ByteBuffer(msg.subarray(12))

    switch (msgType) {
      case 'mempooltxadd':
        try {
          return this.nngMempoolTxAdd(bb)
        } catch (e: any) {
          this.close(
            ERR.NNG_MEMPOOLTXADD,
            log + `mempooltxadd: ${e.message}`
          )
        }
      case 'blkconnected':
        try {
          return this.nngBlockConnected(bb)
        } catch (e: any) {
          this.close(
            ERR.NNG_BLKCONNCETED,
            log + `blkconnected: ${e.message}`
          )
        }
      case 'blkdisconctd':
        try {
          return this.nngBlockDisconnected(bb)
        } catch (e: any) {
          this.close(
            ERR.NNG_BLKDISCONCTD,
            log + `blkdisconctd: ${e.message}`
          )
        }
      /**
       * 10/8/24: Not subscribed to this NNG channel message yet
       * 
      // tx removed from mempool because it conflicts with tx in new block, reorg, etc.
      case 'mempooltxrem':
        try {
          return this.nngMempoolTxRem(bb)
        } catch (e: any) {
          this.close(
            ERR.NNG_MEMPOOLTXADD,
            log + e.message
          )
        }
        break
      */
    }
  }
  /**
   * 
   * @param bb 
   */
  private async nngMempoolTxAdd(bb: ByteBuffer) {
    // Queue state is busy during blkdisconctd, and we shouldn't question it, so let's gtfo
    if (this.queue.state == QUEUE_STATE.BUSY) {
      return
    }
    let log = 'NNGSUB: mempooltxadd: '
    const mempooltx = NNG.TransactionAddedToMempool
      .getRootAsTransactionAddedToMempool(bb)
      .mempoolTx()
      .tx()
    const tx = new Transaction(Buffer.from(mempooltx.rawArray()))
    // If a reorg occurs, all txs from those blocks will trigger mempooltxadd
    // If any reorg'd block contains RANK txs, they will fail when adding to db
    // Need to first make sure the RANK tx doesn't exist before proceeding
    /**
     * UPDATE:
     * Since blkdisconctd handler is being implemented, reorged txs will be removed,
     * so this is no longer necessary.
    if (await this.db.isExistingTransaction(tx.txid)) {
      return
    }
    */
    const ranks = this.processRawTransaction(tx)
    if (ranks.length > 0) {
      const result = await this.upsertProfiles(ranks)
      // Keep these RANK txs to reconcile with next block
      this.queue.mempool.push(...ranks)
      console.log(log + `${tx.txid}: ${result}`)
    }
  }
  /**
   * 
   * @param bb 
   * @returns 
   */
  private async nngBlockConnected(bb: ByteBuffer) {
    // Queue state is busy during blkdisconctd, and we shouldn't question it, so let's gtfo
    if (this.queue.state == QUEUE_STATE.BUSY) {
      return
    }
    let log = 'NNGSUB: blkconnected: '
    const connectedBlock = NNG.BlockConnected.getRootAsBlockConnected(bb)
    // Remove all conflicting txs from database
    // TODO: Will need to update Profile ranking values
    // 9/25/24: THIS CODE BLOCK IS CURRENTLY UNTESTED
    const tcl = connectedBlock.txsConflictedLength()
    if (tcl > 0) {
      for (let i = 0; i < tcl; i++) {
        const tx = connectedBlock.txsConflicted(i)
        const txid = this.toBlockhashOrTxid(tx.hash())
        await this.db.deleteRankTransactionsByTxid(txid)
        console.log(log + `${txid} deleted from db`)
      }
    }
    // include the prevhash when processing block header
    // this is for checking reorgs
    const block = connectedBlock.block()
    const best = this.toBlock(block.header())
    // Process block for any RANK txs
    const ranks = this.toRankTransactions(block)
    let logConfirmed = ': confirmed 0 RANK txs'
      const t0 = performance.now()
    if (ranks.length > 0) {
      // Find any RANK txs that were missing from mempool queue (i.e. not already upserted)
      const missing = ranks.filter(r => {
        // If we can't find the block RANK tx in mempool queue, return it as missing
        const index = this.queue.mempool.findIndex(m => r.output == m.output)
        if (index < 0) {
          return true
        }
        // splice this RANK tx from the mempool queue
        this.queue.mempool.splice(index, 1)
        // We found this RANK tx in mempool, so it was already saved; filter it out
        return false
      })
      // Upsert any missing RANK txs
      if (missing.length > 0) {
        await this.upsertProfiles(missing)
      }
      // Update all of the RANK txs for this block
      await this.db.updateRankTransactions(ranks)
      const t1 = (performance.now() - t0).toFixed(3)
      logConfirmed = `: upserted ${missing.length}, confirmed ${ranks.length} RANK txs (${t1}ms)`
    }

    // Save latest checkpoint
    await this.db.saveBlocks([{
      ...best,
      ranksLength: ranks.length
    }])
    console.log(log + `${best.hash}: height ${best.height}` + logConfirmed)

    // TODO: we may need to add some additional state checks here, but maybe not

    // Update checkpoint to this block
    this.checkpoint = { ...best }
  }
  /**
   * 
   * @param bb 
   * @returns 
   */
  private async nngBlockDisconnected(bb: ByteBuffer) {
    // If queue is aready busy (i.e. >1 block reorg) then return
    // Removing this will cascade nng blkdisconctd messages and ransack lotusd
    if (this.queue.state == QUEUE_STATE.BUSY) {
      return
    }
    // Set queue as busy so new NNG message events don't process
    this.queue.state = QUEUE_STATE.BUSY
    let log = 'NNGSUB: blkdisconctd: '
    // Set up disconnected block for comparison to current best (checkpoint)
    const disconnectedBlock = NNG.BlockDisconnected.getRootAsBlockDisconnected(bb).block()
    const block = this.toBlock(disconnectedBlock.header(), true)
    // Check for reorgs and other stuff before processing
    // If we have to process reorg, then assume our current block/ranks 
    // TODO: probably need to copy or move this logic down to blkdisconctd
    if (
      // disconnected block could be our checkpoint
      block.height <= this.checkpoint.height ||
      // checkpoint hash should match new block prevhash and new height should be +1
      (this.checkpoint.hash != block.prevhash && (this.checkpoint.height + 1) == block.height) || 
      // tertiary case for testing w/ invalidateblock; forced chain split
      (this.checkpoint.hash != block.hash && this.checkpoint.height == block.height)
    ) {
      // REORG DETECTED
      // Fetch the best block from RPC to rewind accordingly
      const best = await this.getBestBlock(this.checkpoint)
      console.log(
        log + ` --- ! BLOCKCHAIN DESYNC DETECTED -- POSSIBLE REORG\r\n`
      + log + ` --- !    checkpoint best: ${this.checkpoint.hash} (height ${this.checkpoint.height})\r\n`
      + log + ` --- !           new best: ${best.hash} (height ${best.height})\r\n`
      + log + ` --- !       new prevhash: ${best.prevhash} (height ${best.height - 1})`)
      try {
        // Rewind unconfirmed transactions first
        const unconfirmed = this.queue.mempool.splice(0)
        const result = await this.rewindProfiles(unconfirmed)
        console.log(log + ` --- ! height -1 (unconfirmed): ${result}`)
      } catch (e: any) {
        this.close(
          ERR.IDX_PROFILE_REWIND,
          log + e.message
        )
      }
      // Rewind blocks until best hash/height is reached
      try {
        for (let height = this.checkpoint.height; height > best.height; height--) {
          const result = await this.rewindBlock(height)
          console.log(log + result)
        }
      } catch (e: any) {
        this.close(
          ERR.IDX_BLOCKS_REWIND,
          log + e.message
        )
      }
      // Sync blocks after rewind, starting with next after best
      try {
        await this.syncBlocks(best)
      } catch (e: any) {
        this.close(
          ERR.IDX_BLOCKS_SYNC,
          log + e.message
        )
      }
      // Update checkpoint to new best block
      this.checkpoint = { ...best }
      console.log(log + `synced with RPC: ${this.checkpoint.hash} (height: ${this.checkpoint.height})`)
    }
    // Sync mempool before opening the queue to chaos
    const result = await this.syncMempool()
    console.log(log + result)
    // Queue is now free to process other events
    this.queue.state = QUEUE_STATE.FREE
  }
  /**
   * Process RANK txs into Profile upserts and commit to the database
   * @param ranks 
   * @returns 
   */
  private async upsertProfiles(
    ranks: RankTransaction[]
  ) {
    const t0 = performance.now()
    const profiles = this.toProfiles(ranks)
    // Upsert each Profile + RANK txs + ranking increments/decrements
    await this.db.upsertProfiles(profiles)
    const t1 = (performance.now() - t0).toFixed(3)
    return `upserted ${profiles.length} profiles, ${ranks.length} RANK txs (${t1}ms)`
  }
  /**
   * Send RPC command to lotusd over NNG interface (`this.rpc`)
   * @param param0 Object containing `rpcType` property and optional object for specific request type
   * @returns {Promise<ByteBuffer>} The parsed `ByteBuffer` response for the specific RPC call, processed in other methods
   */
  private async rpcCall(
    rpcType: keyof typeof NNG.RpcRequest,
    params?: {
      blockRangeRequest?: { startHeight: number, numBlocks: number },
      blockRequest?: { height: number },
    }
  ): Promise<ByteBuffer> {
    // Set up builder and get proper flatbuffer offset for rpcType
    const builder = new Builder()
    let offset: number
    switch (rpcType) {
      case "GetMempoolRequest":
        offset = NNG.GetMempoolRequest.createGetMempoolRequest(builder)
        break
      case "GetBlockRangeRequest":
        const { startHeight, numBlocks } = params.blockRangeRequest
        offset = NNG.GetBlockRangeRequest.createGetBlockRangeRequest(builder, startHeight, numBlocks)
        break
      case "GetBlockRequest":
        const { height } = params.blockRequest
        offset = NNG.GetBlockRequest.createGetBlockRequest(builder, NNG.BlockIdentifier.Height,
          NNG.BlockHeight.createBlockHeight(builder, height)
        )
        break
      // malformed call
      default:
        return
    }
    const rpcCall = NNG.RpcCall.createRpcCall(builder, NNG.RpcRequest[rpcType], offset)
    builder.finish(rpcCall)
    // Wrap the event listener and `rpc.send()` in a Promise to await response
    // Promise is resolved via `.once()` event after lotusd responds 
    // Then we can parse the blocks for RANK transactions
    const bb = <ByteBuffer> await new Promise((resolve, reject) => {
      const rpcSocketSendTimeout = setTimeout(
        () => reject(`rpcCall(${rpcType}, ${typeof params}): Socket.send() timeout reached (${NNG_REQUEST_TIMEOUT_LENGTH}ms)`),
        NNG_REQUEST_TIMEOUT_LENGTH
      )
      // set up response listener before sending request; avoids race condition
      this.rpc.once('data', (buf: Buffer) => {
        clearTimeout(rpcSocketSendTimeout)
        resolve(new ByteBuffer(buf))
      })
      this.rpc.send(builder.asUint8Array() as Buffer)
    })
    const result = NNG.RpcResult.getRootAsRpcResult(bb)
    if (!result.isSuccess()) {
      // If the RPC call was successful but returned error data, process that now
      switch (result.errorCode()) {
        case 5: // block not found
          return null
        // what's happening
        default:
          throw new Error(`rpcCall(${rpcType}, ${typeof params}): ${result.errorMsg()} (code: ${result.errorCode()})`)
      }
    }
    return new ByteBuffer(result.dataArray())
  }
  /**
   * Fetch block at `height`
   * @param height Block height
   * @returns {Promise<NNG.Block>}
   */
  private async rpcGetBlock(height: number): Promise<NNG.Block> {
    try {
      const bb = await this.rpcCall('GetBlockRequest', { blockRequest: { height }})
      return bb?.bytes()?.length ? NNG.GetBlockResponse.getRootAsGetBlockResponse(bb).block() : null
    } catch (e: any) {
      throw new Error(`rpcGetBlock(${height}): ${e.message}`)
    }
  }
  /**
   * Fetches mempool txs
   * @returns {Promise<NNG.GetMempoolResponse>}
   */
  private async rpcGetMempool(): Promise<NNG.GetMempoolResponse> {
    try {
      const bb = await this.rpcCall('GetMempoolRequest')
      return NNG.GetMempoolResponse.getRootAsGetMempoolResponse(bb)
    } catch (e: any) {
      throw new Error(`rpcGetMempool(): ${e.message}`)
    }
  }
  /**
   * Fetches range of blocks starting at `height`, up to `NNG_RPC_BLOCKRANGE_SIZE` limit
   * 
   * Configure `NNG_RPC_BLOCKRANGE_SIZE` in `/util/constants.ts` (default: 20)
   * @param height The starting height
   * @returns {Promise<NNG.GetBlockRangeResponse>}
   */
  private async rpcGetBlockRange(height: number): Promise<NNG.GetBlockRangeResponse> {
    try {
      const bb = await this.rpcCall('GetBlockRangeRequest', {
        blockRangeRequest: { startHeight: height, numBlocks: NNG_RPC_BLOCKRANGE_SIZE }
      })
      return NNG.GetBlockRangeResponse.getRootAsGetBlockRangeResponse(bb)
    } catch (e: any) {
      throw new Error(`rpcGetBlockRange(${height}): ${e.message}`)
    }
  }
  /**
   * 
   * @param data
   * @returns 
   */
  private toRankTransactions(data: NNG.Block | NNG.GetMempoolResponse) {
    const ranks: RankTransaction[] = []
    const txsLength = data.txsLength()
    // skip coinbase tx (i.e. `let j = 1`)
    for (let j = 1; j < txsLength; j++) {
      try {
        const txRaw = data.txs(j).tx().rawArray()
        // Convert Uint8Array to Buffer else bitcore parse will fail
        const tx = new Transaction(Buffer.from(txRaw))
        // Differentiate between Block or Mempool accordingly
        const block = data instanceof NNG.Block ? this.toBlock(data.header()) : null
        ranks.push(...this.processRawTransaction(tx, block))
      } catch (e: any) {
        throw new Error(`toRankTransactions(${typeof data}): ${e.message}`)
      }
    }
    return ranks
  }
  /**
   * Parse the raw transaction for RANK outputs and return all `RankTransaction` objects
   * @param tx Transaction object in Bitcore format
   * @returns {RankTransaction[]} Array of `RankTransaction` objects
   */
  private processRawTransaction(
    tx: Transaction,
    block?: Block
  ): RankTransaction[] {
    const { txid, outputs } = tx
    try {
      // Use current time if tx from mempool
      const t = block?.timestamp ?? BigInt(Date.now())
      // block header timestamp in seconds; need milliseconds
      const ranks: RankTransaction[] = []
      for (let outIdx = 0; outIdx < outputs.length; outIdx++) {
        const output = outputs[outIdx]
        if (!this.isRankScript(output.script)) {
          continue
        }
        ranks.push({
          output: `${txid}_${outIdx}`,
          timestamp: t,
          height: block?.height ?? undefined,
          ...this.toRankOutput(output)
        })
      }
      return ranks
    } catch (e: any) {
      throw new Error(`processRawTransaction(${typeof tx}, ${typeof block}): ${e.message}`)
    }
  }
  /**
   * Check if the provided `script` is a RANK script
   * @param script Bitcore-compatible `Script` object
   * @returns {false | Buffer}
   */
  private isRankScript(
    script: Script
  ): false | Buffer {
    // we only care about OP_RETURN outputs
    if (!script.isDataOut()) {
      return false
    }
    const scriptBuf = script.toBuffer()
    // prepare to parse lokad script parts
    const { lokad } = this.parts
    // make sure the script is long enough to parse for lokad
    if (scriptBuf.length < (lokad.offset + lokad.len)) {
      return false;
    }
    // make sure the script contains our lokad prefix
    if (this.getScriptPartHex(lokad, scriptBuf) !== lokad.hex) {
      return false;
    }
    // make sure the script contains all required parts
    // TODO: need to finish sanitizing
    const { sentiment, platform, profile, post, comment } = this.parts
    //this.getScriptParts(scriptBuf)

    // valid RANK output confirmed; return for processing
    return scriptBuf
  }
  /**
   * 
   * @param scriptBuf 
   */
  private getScriptParts(
    scriptBuf: Buffer
  ) {
    const parts: { [part: string]: BigInt | Boolean | string } = {}
    for (const [name, part] of Object.entries(this.parts)) {
      // TODO: Finish this one
    }
  }
  /**
   * Parse the provided `scriptBuf` for the ScriptPart hex data
   * @param part {ScriptPart} The ScriptPart for which to parse
   * @param scriptBuf {Buffer} The script buffer (`OP_RETURN` only)
   * @returns {string}
   */
  private getScriptPartHex(
    part: ScriptPart,
    scriptBuf: Buffer
  ): string {
    return scriptBuf
      .subarray(part.offset, (part.offset + part.len))
      .toString('hex')
  }
  /**
   * Convert raw tx output to RANK output 
   * @param output Transaction output in Bitcore-compatible format
   * @returns {RankOutput}
   */
  private toRankOutput(
    output: Transaction.Output
  ): RankOutput {
    const scriptBuf = output.script.toBuffer()
    const value = BigInt(output.satoshis)
    const sentiment = Boolean(Number(this.getScriptPartHex(this.parts.sentiment, scriptBuf)))
    const platform = this.getScriptPartHex(this.parts.platform, scriptBuf)
    const profileId = this.getScriptPartHex(this.parts.profile, scriptBuf)
    return { value, sentiment, platform, profileId }
  }
  /**
   * Parse the raw NNG 'Hash' flatbuffer for the 32-byte block hash
   * @param hash 
   * @returns {string} Block hash as hex string (little endian)
   */
  private toBlockhashOrTxid(hash: NNG.Hash): string {
    const hashBuf = Buffer.alloc(32)
    for (let i = 0; i < 32; i++) {
      const byte = hash.data(i)
      hashBuf.writeUInt8(byte, i)
    }
    // reverse for little endian
    // can probably remove this with proper buffer writing above
    return hashBuf.reverse().toString('hex')
  }
  /**
   * Parse the raw NNG `NNG.BlockHeader` flatbuffer for the nHeight
   * 
   * ref: https://docs.givelotus.org/specs/NNG.BlockHeader
   * @param header Raw `NNG.BlockHeader`
   * @returns {number} Block height as a number
   */
  private toHeight(header: NNG.BlockHeader): number {
    // header could be undefined if processing mempool tx from nng
    if (!header) {
      return undefined
    }
    const nHeight = header.rawArray().subarray(60, 64)
    return Buffer.from(nHeight).readUInt32LE()
  }
  /**
   * 
   * @param header 
   * @param includePrevHash 
   * @returns 
   */
  private toBlock(header: NNG.BlockHeader, includePrevhash: boolean = false): Block {
    try {
      const height = this.toHeight(header)
      const timestamp = header.timestamp()
      const hash = this.toBlockhashOrTxid(header.blockHash().hash())
      const prevhash = includePrevhash ? this.toBlockhashOrTxid(header.prevBlockHash().hash()): undefined
      const ranksLength = 0
      return <Block> { height, timestamp, hash, prevhash, ranksLength }
    } catch (e: any) {
      throw new Error(`toBlock(${header}, ${includePrevhash}): ${e.message}`)
    }
  }
  /**
   * 
   * @param ranks 
   * @returns 
   */
  private toProfiles(ranks: RankTransaction[]) {
    // Sort the RANK txs for upsert
    const profiles: Profile[] = []
    ranks.forEach((rank) => {
      const { profileId: id, platform } = rank
      const profile = profiles.find(({ id: pid }) => pid == id)
      // If we sorted this Profile already, push the RANK tx, otherwise push the Profile 
      profile?.ranks?.push(rank) ?? profiles.push({ id, platform, ranks: [rank] })
    })
    return profiles
  }
}
