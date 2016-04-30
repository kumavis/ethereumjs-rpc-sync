const Block = require('ethereumjs-block')
const Transaction = require('ethereumjs-tx')
const ethUtil = require('ethereumjs-util')

module.exports = materializeBlock


function materializeBlock(blockParams, uncles){
  // console.log(blockParams)
  var block = new Block({
    transactions: [],
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
  blockHeader.receiptTrie = blockParams.receiptRoot || ethUtil.SHA3_NULL
  blockHeader.coinbase = blockParams.miner
  blockHeader.difficulty = blockParams.difficulty
  blockHeader.extraData = blockParams.extraData
  blockHeader.gasLimit = blockParams.gasLimit
  blockHeader.gasUsed = blockParams.gasUsed
  blockHeader.timestamp = blockParams.timestamp
  blockHeader.hash = function () {
    return ethUtil.toBuffer(blockParams.hash)
  }

  block.transactions = (blockParams.transactions || []).map(function(txParams){
    var tx = new Transaction(txParams)
    // override from address
    tx._from = txParams.from
    // override hash
    tx.hash = function(){ return ethUtil.toBuffer(txParams.hash) }
    return tx
  })
  block.uncleHeaders = (uncles || []).map(function(uncle){
    return materializeBlock(uncle)
  })

  return block
}