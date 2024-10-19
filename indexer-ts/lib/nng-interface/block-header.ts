// automatically generated by the FlatBuffers compiler, do not modify

/* eslint-disable @typescript-eslint/no-unused-vars, @typescript-eslint/no-explicit-any, @typescript-eslint/no-non-null-assertion */

import * as flatbuffers from 'flatbuffers';

import { BlockHash } from '../nng-interface/block-hash.js';


export class BlockHeader {
  bb: flatbuffers.ByteBuffer|null = null;
  bb_pos = 0;
  __init(i:number, bb:flatbuffers.ByteBuffer):BlockHeader {
  this.bb_pos = i;
  this.bb = bb;
  return this;
}

static getRootAsBlockHeader(bb:flatbuffers.ByteBuffer, obj?:BlockHeader):BlockHeader {
  return (obj || new BlockHeader()).__init(bb.readInt32(bb.position()) + bb.position(), bb);
}

static getSizePrefixedRootAsBlockHeader(bb:flatbuffers.ByteBuffer, obj?:BlockHeader):BlockHeader {
  bb.setPosition(bb.position() + flatbuffers.SIZE_PREFIX_LENGTH);
  return (obj || new BlockHeader()).__init(bb.readInt32(bb.position()) + bb.position(), bb);
}

raw(index: number):number|null {
  const offset = this.bb!.__offset(this.bb_pos, 4);
  return offset ? this.bb!.readUint8(this.bb!.__vector(this.bb_pos + offset) + index) : 0;
}

rawLength():number {
  const offset = this.bb!.__offset(this.bb_pos, 4);
  return offset ? this.bb!.__vector_len(this.bb_pos + offset) : 0;
}

rawArray():Uint8Array|null {
  const offset = this.bb!.__offset(this.bb_pos, 4);
  return offset ? new Uint8Array(this.bb!.bytes().buffer, this.bb!.bytes().byteOffset + this.bb!.__vector(this.bb_pos + offset), this.bb!.__vector_len(this.bb_pos + offset)) : null;
}

blockHash(obj?:BlockHash):BlockHash|null {
  const offset = this.bb!.__offset(this.bb_pos, 6);
  return offset ? (obj || new BlockHash()).__init(this.bb!.__indirect(this.bb_pos + offset), this.bb!) : null;
}

prevBlockHash(obj?:BlockHash):BlockHash|null {
  const offset = this.bb!.__offset(this.bb_pos, 8);
  return offset ? (obj || new BlockHash()).__init(this.bb!.__indirect(this.bb_pos + offset), this.bb!) : null;
}

nBits():number {
  const offset = this.bb!.__offset(this.bb_pos, 10);
  return offset ? this.bb!.readUint32(this.bb_pos + offset) : 0;
}

timestamp():bigint {
  const offset = this.bb!.__offset(this.bb_pos, 12);
  return offset ? this.bb!.readUint64(this.bb_pos + offset) : BigInt('0');
}

static startBlockHeader(builder:flatbuffers.Builder) {
  builder.startObject(5);
}

static addRaw(builder:flatbuffers.Builder, rawOffset:flatbuffers.Offset) {
  builder.addFieldOffset(0, rawOffset, 0);
}

static createRawVector(builder:flatbuffers.Builder, data:number[]|Uint8Array):flatbuffers.Offset {
  builder.startVector(1, data.length, 1);
  for (let i = data.length - 1; i >= 0; i--) {
    builder.addInt8(data[i]!);
  }
  return builder.endVector();
}

static startRawVector(builder:flatbuffers.Builder, numElems:number) {
  builder.startVector(1, numElems, 1);
}

static addBlockHash(builder:flatbuffers.Builder, blockHashOffset:flatbuffers.Offset) {
  builder.addFieldOffset(1, blockHashOffset, 0);
}

static addPrevBlockHash(builder:flatbuffers.Builder, prevBlockHashOffset:flatbuffers.Offset) {
  builder.addFieldOffset(2, prevBlockHashOffset, 0);
}

static addNBits(builder:flatbuffers.Builder, nBits:number) {
  builder.addFieldInt32(3, nBits, 0);
}

static addTimestamp(builder:flatbuffers.Builder, timestamp:bigint) {
  builder.addFieldInt64(4, timestamp, BigInt('0'));
}

static endBlockHeader(builder:flatbuffers.Builder):flatbuffers.Offset {
  const offset = builder.endObject();
  return offset;
}

}
