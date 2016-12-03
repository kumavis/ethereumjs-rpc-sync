// const leveldb = require('level')
const VM = require('ethereumjs-vm')
const request = require('request')
const async = require('async')
const Blockchain = require('ethereumjs-blockchain')
const Block = require('ethereumjs-block')
const BlockHeader = require('ethereumjs-block/header')
const ethUtil = require('ethereumjs-util')
const rpcToBlock = require('./materialize-block.js')


// const RPC_ENDPOINT = 'https://mainnet.infura.io/'
const RPC_ENDPOINT = 'http://localhost:8545/'

// var blockchainDb = leveldb('./blockchaindb')
var blockchainDb = null

var blockchain = new Blockchain(blockchainDb, false)
var vm = new VM({ blockchain: blockchain })


let lastBlock = null
let blockNumber = null
let blockHash = null
let blockSyncNumber = 0

vm.on('beforeBlock', function (block) {
  lastBlock = block
  blockNumber = ethUtil.bufferToInt(block.header.number)
  blockHash = ethUtil.bufferToHex(block.hash())
})

vm.on('afterBlock', function (results) {
  // if (results.error) console.log(results.error)
  var ourStateRoot = ethUtil.bufferToHex(vm.stateManager.trie.root)
  var stateRootMatches = (ourStateRoot === ethUtil.bufferToHex(lastBlock.header.stateRoot))
  // var out = `#${blockNumber} ${blockHash} txs: ${results.receipts.length} root: ${ourStateRoot}`
  var paddedBlockNumber = ('          ' + blockNumber).slice(-8)
  var out = `#${paddedBlockNumber} ${blockHash} txs: ${results.receipts.length}`
  console.log(out)
  if (!stateRootMatches) {
    throw new Error('Stateroots don\'t match.')
    process.exit()
  }
})

vm.on('beforeTx', function (tx) {
  console.log('tx.hash:', ethUtil.bufferToHex(tx.hash()))
})

// vm.on('step', function (info) {
//   console.log(info.opcode.opcode, ethUtil.bufferToHex(info.address))
// })

async.series([
  setGenesis,
  runBlockchain,
], function(err){ if (err) throw err })

function runBlockchain(cb){
  console.log('running blockchain...')
  async.forever(function(cb){
    // var blockNumber = ethUtil.bufferToInt(block.header.number)
    // console.log(`at block #${blockSyncNumber}, getting next`)
    materializeBlock(blockSyncNumber+1, function(err, block){
      if (err) return cb(err)
      // console.log(`got block:\n`, describeBlock(block))
      blockSyncNumber++
      addBlockToChain(block, cb)
    })
  }, cb)
}

function setGenesis(cb){
  materializeBlock(0, function(err, genesis){
    if (err) return cb(err)
    console.log(`recorded genesis.`)
    // console.log(`got genesis:\n`, describeBlock(genesis))
    async.series([
      (cb) => blockchain.putGenesis(genesis, cb),
      (cb) => vm.stateManager.generateCanonicalGenesis(cb),
    ], cb)
  })
}

function addBlockToChain(block, cb){
  var isGenesis = (ethUtil.bufferToInt(block.header.number) === 0)
  async.series([
    (cb) => blockchain.putBlock(block, cb, isGenesis),
    (cb) => runBlock(block, cb),
  ], cb)
}

function getBlockByNumber(num, cb){
  performRpcRequest({
    id: 1,
    jsonrpc: '2.0',
    method: 'eth_getBlockByNumber',
    params: [ethUtil.intToHex(num), true],
  }, function(err, res){
    if (err) return cb(err)
    cb(null, res.result)
  })
}

function getUncleByBlockHashAndIndex(hash, index, cb){
  performRpcRequest({
    id: 1,
    jsonrpc: '2.0',
    method: 'eth_getUncleByBlockHashAndIndex',
    params: [hash, ethUtil.intToHex(index)],
  }, function(err, res){
    if (err) return cb(err)
    cb(null, res.result)
  })
}

function performRpcRequest(payload, cb){
  request({
    uri: RPC_ENDPOINT,
    method: 'POST',
    json: payload,
  }, function(err, res, body){
    if (err) return cb(err)
    if (body && body.error) return cb(body.error.message)
    cb(null, body)
  })
}

function materializeBlock(num, cb){
  getBlockByNumber(num, function(err, blockParams){
    if (err) return cb(err)
    async.map(blockParams.uncles, function lookupUncle(uncleHash, cb){
      var uncleIndex = blockParams.uncles.indexOf(uncleHash)
      getUncleByBlockHashAndIndex(blockParams.hash, uncleIndex, cb)
    }, function(err, uncles){
      if (err) return cb(err)
      var block = rpcToBlock(blockParams, uncles)
      cb(null, block)
    })
  })
}

// determine starting state for block run
function getStartingState (cb) {
  // if we are just starting or if a chain re-org has happened
  if (!headBlock || reorg) {
    self.stateManager.blockchain.getBlock(block.header.parentHash, function (err, parentBlock) {
      parentState = parentBlock.header.stateRoot
      // generate genesis state if we are at the genesis block
      // we don't have the genesis state
      if (!headBlock) {
        return self.stateManager.generateCanonicalGenesis(cb)
      } else {
        cb(err)
      }
    })
  } else {
    parentState = headBlock.header.stateRoot
    cb()
  }
}

// run block, update head if valid
function runBlock (block, cb) {
  blockchain.getBlock(block.header.parentHash, function (err, parentBlock) {
    if (err) return cb(err)
    let parentState = parentBlock.header.stateRoot
    // console.log('start-root', vm.stateManager.trie.root.toString('hex'))
    vm.runBlock({
      block: block,
      root: parentState
    }, function (err, results) {
      if (err) {
        console.log('ERROR - runBlock:', err)
        return cb(err)
      }
      // console.log('vm results:', results)
      cb()
    })
  })
}


function describeBlock(block){
  return {
    number: ethUtil.bufferToHex(block.header.number),
    mixHash: ethUtil.bufferToHex(block.header.mixHash),
    parentHash: ethUtil.bufferToHex(block.header.parentHash),
    nonce: ethUtil.bufferToHex(block.header.nonce),
    uncleHash: ethUtil.bufferToHex(block.header.uncleHash),
    bloom: ethUtil.bufferToHex(block.header.bloom),
    transactionsTrie: ethUtil.bufferToHex(block.header.transactionsTrie),
    stateRoot: ethUtil.bufferToHex(block.header.stateRoot),
    receiptTrie: ethUtil.bufferToHex(block.header.receiptTrie),
    coinbase: ethUtil.bufferToHex(block.header.coinbase),
    difficulty: ethUtil.bufferToHex(block.header.difficulty),
    extraData: ethUtil.bufferToHex(block.header.extraData),
    gasLimit: ethUtil.bufferToHex(block.header.gasLimit),
    gasUsed: ethUtil.bufferToHex(block.header.gasUsed),
    timestamp: ethUtil.bufferToHex(block.header.timestamp),
  }
}