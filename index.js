// const leveldb = require('level')
// const VM = require('ethereumjs-vm')
const Blockchain = require('ethereumjs-blockchain')
const Block = require('ethereumjs-block')
const BlockHeader = require('ethereumjs-block/header')
const request = require('request')
const async = require('async')


// var blockchainDb = leveldb('./blockchaindb')
var blockchainDb = null

var blockchain = new Blockchain(blockchainDb, false)


setGenesis(function(err){
  if (err) throw err
  syncWithBlockchain()
})

function syncWithBlockchain(){
  async.forever(function(cb){
    var currentNumber = blockchain.getHead(function(err, block){
      if (err) return cb(err)
      var blockNumber = ethUtil.bufferToInt(block.header.number)
      console.log(`at block #${blockNumber}, getting next`)
      materializeBlock(blockNumber+1, function(err, block){
        if (err) return cb(err)
        console.log(`got block:\n`, describeBlock(block))
        addBlockToChain(block, cb)
      })
    })
  }, function(err) {
    throw err
  })
}




function setGenesis(cb){
  materializeBlock(0, function(err, genesis){
    if (err) return cb(err)
    console.log(`got genesis:\n`, describeBlock(genesis))
    blockchain.putGenesis(genesis, cb)
  })
}


function addBlockToChain(block, cb){
  var isGenesis = (ethUtil.bufferToInt(block.header.number) === 0)
  blockchain.putBlock(block, function(err){
    if (err) return cb(err)
    console.log('done putting block', arguments)
    cb()
  }, isGenesis)
}

function getBlockByNumber(num, cb){
  request({
    uri: 'https://rpc.metamask.io/',
    json: { method: 'eth_getBlockByNumber', params: [num, true] },
  }, function(err, res, body){
    if (err) return cb(err)
    if (body.error) return cb(body.error.message)
    var blockParams = body.result
    cb(null, blockParams)
  })
}

function materializeBlock(num, cb){
  getBlockByNumber(num, function(err, blockParams){
    if (err) return cb(err)
    // getUnclesForBlockByHash(blockParams.hash, function(err, uncles){

    // })

    var block = rpcToBlock(blockParams)

    // console.log('blockParams:', blockParams)
    // console.log('blockParams Hash:', blockParams.hash.toString('hex'))
    // console.log('block Hash:      ', ethUtil.bufferToHex(block.hash()))
    cb(null, block)
  })
}

function rpcToBlock(blockParams){
  // if (blockParams.sha3Uncles !== '0x1dcc4de8dec75d7aab85b567b6ccd41ad312451b948a7413f0a142fd40d49347') throw new Error('Missing ommers....')
  var block = new Block({
    transactions: blockParams.transactions,
    uncleHeaders: [],
  })
  var blockHeader = block.header
  blockHeader.number = blockParams.number
  blockHeader.parentHash = blockParams.parentHash
  blockHeader.nonce = blockParams.nonce
  blockHeader.uncleHash = blockParams.sha3Uncles
  blockHeader.bloom = blockParams.logsBloom
  blockHeader.transactionsTrie = blockParams.transactionsRoot
  blockHeader.stateRoot = blockParams.stateRoot
  blockHeader.receiptTrie = blockParams.receiptRoot
  blockHeader.coinbase = blockParams.miner
  blockHeader.difficulty = blockParams.difficulty
  blockHeader.extraData = blockParams.extraData
  blockHeader.gasLimit = blockParams.gasLimit
  blockHeader.gasUsed = blockParams.gasUsed
  blockHeader.timestamp = blockParams.timestamp
  blockHeader.hash = function () {
    return ethUtil.toBuffer(blockParams.hash)
  }
  return block
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