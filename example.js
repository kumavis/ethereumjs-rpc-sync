const leveldb = require('level')
const ethUtil = require('ethereumjs-util')
const RpcBlockchain = require('./rpc-blockchain')
const request = require('request')
const VM = require('ethereumjs-vm')
const StateTrie = require('merkle-patricia-tree/secure')

// var provider = { sendAsync: function(payload,cb){ request({ uri: 'https://rpc.metamask.io', json: payload }, function(err, res, body){ if (err) return cb (err); cb(null, body) }) } }
var provider = { sendAsync: function(payload,cb){ request({ uri: 'http://localhost:8545', json: payload }, function(err, res, body){ if (err) return cb (err); cb(null, body) }) } }

var iteratorDb = leveldb('./iteratordb')
var stateDb = leveldb('./statedb')

var stateTrie = new StateTrie(stateDb)
var blockchain = new RpcBlockchain(provider, iteratorDb)


// blockchain.getBlock(ethUtil.toBuffer('0x6855e21f1bceb78ec65c803935b7a03e5e00949c859de19a1e795cb7d1e0e041'), function(){
//   console.log(arguments)
// })

// blockchain.iterator('vm', function onBlock(block, reorg, cb){
//   console.log(ethUtil.bufferToInt(block.number))
//   cb()
// }, function onEnd(err){
//   throw err
// })


// iteratorDb.put('iterator:vm', { name: 'vm', blockNumber: 46146 }, {valueEncoding: 'json'})




var vm = new VM(stateTrie, blockchain)

// vm.stateManager.generateCanonicalGenesis(function(err){
//   if (err) throw err
//   vm.stateManager.getAccountBalance(new Buffer('a1e4380a3b1f749673e270229993ee55f35663b4','hex'), function(){
//     console.log(arguments)
//   })
// })




var lastBlock
var blockNumber
var blockHash

vm.on('step', function (info) {
  console.log(info.opcode.opcode, ethUtil.bufferToHex(info.address))
})

vm.on('beforeTx', function (tx) {
  console.log('tx.to:', ethUtil.bufferToHex(tx.to))
  console.log('tx.from:', ethUtil.bufferToHex(tx.getSenderAddress()))
  console.log('tx.hash:', ethUtil.bufferToHex(tx.hash()))
})

vm.on('beforeBlock', function (block) {
  lastBlock = block
  blockNumber = ethUtil.bufferToHex(block.header.number)
  blockHash = ethUtil.bufferToHex(block.hash())
})

vm.on('afterBlock', function (results) {
  // if (results.error) console.log(results.error)
  var ourStateRoot = ethUtil.bufferToHex(vm.stateManager.trie.root)
  var stateRootMatches = (ourStateRoot === ethUtil.bufferToHex(lastBlock.header.stateRoot))
  var out = `#${blockNumber} ${blockHash} txs: ${results.receipts.length} root: ${ourStateRoot}`
  console.log(out)
  if (!stateRootMatches) {
    throw new Error('Stateroots don\'t match.')
    process.exit()
  }
})

// console.log('generateGenesis - before')
// vm.generateCanonicalGenesis(function(){
//   console.log('generateGenesis - after')
console.log('runBlockchain - before')
vm.runBlockchain(function () {
  console.log('runBlockchain - after')
})
// })

// 010b25
