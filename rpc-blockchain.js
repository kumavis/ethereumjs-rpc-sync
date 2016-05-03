const async = require('async')
const ethUtil = require('ethereumjs-util')
const EthQuery = require('eth-store/query')
const materializeBlock = require('./materialize-block')

module.exports = RpcBlockchain


function RpcBlockchain(provider, iteratorDb){
  const self = this
  self.eth = new EthQuery(provider)
  self._iteratorDb = iteratorDb
}

RpcBlockchain.prototype.getBlock = function(blockHash, cb){
  const self = this
  var blockHashHex = ethUtil.bufferToHex(blockHash)
  self.eth.getBlockByHashWithUncles(blockHashHex, function(err, blockParams){
    if (err) return cb(err)
    if (!blockParams) throw new Error('Could not find block at '+blockHashHex)
    // if (!blockParams) cb(new Error('Could not find block at '+blockHashHex))
    var block = materializeBlock(blockParams, blockParams.uncles)
    cb(null, block)
  })
}

RpcBlockchain.prototype.delBlock = function(blockHash, cb){
  throw new Error('Attempted to delete block: '+ethUtil.bufferToHex(blockHash))
}

RpcBlockchain.prototype.iterator = function(name, onBlock, onDone){
  const self = this

  self._getIteratorData(name, function(iteratorHead){
    if (!iteratorHead) {
      iteratorHead = {
        name: name,
        blockNumber: 0,
        // totalDifficulty: undefined,
      }
      self._putIteratorData(name, iteratorHead, function(err){
        if (err) return onDone(err)
        self._followBlockchain(iteratorHead, onBlock, onDone)
      })
    } else {
      self._followBlockchain(iteratorHead, onBlock, onDone)
    }
  })
}

RpcBlockchain.prototype._followBlockchain = function(iteratorHead, onBlock, onDone){
  const self = this
  var headBlock = null

  async.forever(function nextBlock(cb){
    
    self._getBlockByNumber(iteratorHead.blockNumber, function(err, block){
      if (err) return cb(err)
  
      // already at head
      if (!block) return setTimeout(function(){
        console.log('waiting for next block...')
        cb()
      }, 1000)
  
      // process new block
      if (iteratorHead.blockNumber === 0) {
        // dont report genesis block
        advanceIterator()
      } else {
        reportBlock()
      }

      function reportBlock(){
        var reorg = headBlock ? headBlock.hash().toString('hex') !== block.header.parentHash.toString('hex') : false
        onBlock(block, reorg, function(err){
          if (err) return cb(err)
          advanceIterator()
        })
      }

      function advanceIterator(){
        headBlock = block
        iteratorHead.blockNumber++
        self._putIteratorData(iteratorHead.name, iteratorHead, function(err){
          if (err) return cb(err)
          cb()
        })
      }

    })

  }, onDone)

}

// private

RpcBlockchain.prototype._getBlockByNumber = function(blockNumber, cb){
  const self = this
  var blockNumberHex = ethUtil.bufferToHex(blockNumber)
  self.eth.getBlockByNumberWithUncles(blockNumberHex, function(err, blockParams){
    if (err) return cb(err)
    if (!blockParams) return cb(null, null)
    var block = materializeBlock(blockParams, blockParams.uncles)
    cb(null, block)
  })
}

RpcBlockchain.prototype._getIteratorData = function(name, cb){
  const self = this
  self._iteratorDb.get('iterator:'+name, {valueEncoding: 'json'}, function(err, result){
    if (!result) return cb(null)
    cb(result)
  })
}

RpcBlockchain.prototype._putIteratorData = function(name, iteratorHead, cb){
  const self = this
  self._iteratorDb.put('iterator:'+name, iteratorHead, {valueEncoding: 'json'}, cb)
}