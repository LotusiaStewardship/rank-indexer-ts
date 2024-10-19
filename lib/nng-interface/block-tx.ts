// automatically generated by the FlatBuffers compiler, do not modify

/* eslint-disable @typescript-eslint/no-unused-vars, @typescript-eslint/no-explicit-any, @typescript-eslint/no-non-null-assertion */

import * as flatbuffers from 'flatbuffers';

import { Tx } from '../nng-interface/tx.js';


export class BlockTx {
  bb: flatbuffers.ByteBuffer|null = null;
  bb_pos = 0;
  __init(i:number, bb:flatbuffers.ByteBuffer):BlockTx {
  this.bb_pos = i;
  this.bb = bb;
  return this;
}

static getRootAsBlockTx(bb:flatbuffers.ByteBuffer, obj?:BlockTx):BlockTx {
  return (obj || new BlockTx()).__init(bb.readInt32(bb.position()) + bb.position(), bb);
}

static getSizePrefixedRootAsBlockTx(bb:flatbuffers.ByteBuffer, obj?:BlockTx):BlockTx {
  bb.setPosition(bb.position() + flatbuffers.SIZE_PREFIX_LENGTH);
  return (obj || new BlockTx()).__init(bb.readInt32(bb.position()) + bb.position(), bb);
}

tx(obj?:Tx):Tx|null {
  const offset = this.bb!.__offset(this.bb_pos, 4);
  return offset ? (obj || new Tx()).__init(this.bb!.__indirect(this.bb_pos + offset), this.bb!) : null;
}

dataPos():number {
  const offset = this.bb!.__offset(this.bb_pos, 6);
  return offset ? this.bb!.readUint32(this.bb_pos + offset) : 0;
}

undoPos():number {
  const offset = this.bb!.__offset(this.bb_pos, 8);
  return offset ? this.bb!.readUint32(this.bb_pos + offset) : 0;
}

undoSize():number {
  const offset = this.bb!.__offset(this.bb_pos, 10);
  return offset ? this.bb!.readUint32(this.bb_pos + offset) : 0;
}

static startBlockTx(builder:flatbuffers.Builder) {
  builder.startObject(4);
}

static addTx(builder:flatbuffers.Builder, txOffset:flatbuffers.Offset) {
  builder.addFieldOffset(0, txOffset, 0);
}

static addDataPos(builder:flatbuffers.Builder, dataPos:number) {
  builder.addFieldInt32(1, dataPos, 0);
}

static addUndoPos(builder:flatbuffers.Builder, undoPos:number) {
  builder.addFieldInt32(2, undoPos, 0);
}

static addUndoSize(builder:flatbuffers.Builder, undoSize:number) {
  builder.addFieldInt32(3, undoSize, 0);
}

static endBlockTx(builder:flatbuffers.Builder):flatbuffers.Offset {
  const offset = builder.endObject();
  return offset;
}

static createBlockTx(builder:flatbuffers.Builder, txOffset:flatbuffers.Offset, dataPos:number, undoPos:number, undoSize:number):flatbuffers.Offset {
  BlockTx.startBlockTx(builder);
  BlockTx.addTx(builder, txOffset);
  BlockTx.addDataPos(builder, dataPos);
  BlockTx.addUndoPos(builder, undoPos);
  BlockTx.addUndoSize(builder, undoSize);
  return BlockTx.endBlockTx(builder);
}
}