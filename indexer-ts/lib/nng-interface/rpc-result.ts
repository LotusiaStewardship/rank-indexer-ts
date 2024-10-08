// automatically generated by the FlatBuffers compiler, do not modify

/* eslint-disable @typescript-eslint/no-unused-vars, @typescript-eslint/no-explicit-any, @typescript-eslint/no-non-null-assertion */

import * as flatbuffers from 'flatbuffers';

export class RpcResult {
  bb: flatbuffers.ByteBuffer|null = null;
  bb_pos = 0;
  __init(i:number, bb:flatbuffers.ByteBuffer):RpcResult {
  this.bb_pos = i;
  this.bb = bb;
  return this;
}

static getRootAsRpcResult(bb:flatbuffers.ByteBuffer, obj?:RpcResult):RpcResult {
  return (obj || new RpcResult()).__init(bb.readInt32(bb.position()) + bb.position(), bb);
}

static getSizePrefixedRootAsRpcResult(bb:flatbuffers.ByteBuffer, obj?:RpcResult):RpcResult {
  bb.setPosition(bb.position() + flatbuffers.SIZE_PREFIX_LENGTH);
  return (obj || new RpcResult()).__init(bb.readInt32(bb.position()) + bb.position(), bb);
}

isSuccess():boolean {
  const offset = this.bb!.__offset(this.bb_pos, 4);
  return offset ? !!this.bb!.readInt8(this.bb_pos + offset) : false;
}

errorCode():number {
  const offset = this.bb!.__offset(this.bb_pos, 6);
  return offset ? this.bb!.readInt32(this.bb_pos + offset) : 0;
}

errorMsg():string|null
errorMsg(optionalEncoding:flatbuffers.Encoding):string|Uint8Array|null
errorMsg(optionalEncoding?:any):string|Uint8Array|null {
  const offset = this.bb!.__offset(this.bb_pos, 8);
  return offset ? this.bb!.__string(this.bb_pos + offset, optionalEncoding) : null;
}

data(index: number):number|null {
  const offset = this.bb!.__offset(this.bb_pos, 10);
  return offset ? this.bb!.readUint8(this.bb!.__vector(this.bb_pos + offset) + index) : 0;
}

dataLength():number {
  const offset = this.bb!.__offset(this.bb_pos, 10);
  return offset ? this.bb!.__vector_len(this.bb_pos + offset) : 0;
}

dataArray():Uint8Array|null {
  const offset = this.bb!.__offset(this.bb_pos, 10);
  return offset ? new Uint8Array(this.bb!.bytes().buffer, this.bb!.bytes().byteOffset + this.bb!.__vector(this.bb_pos + offset), this.bb!.__vector_len(this.bb_pos + offset)) : null;
}

static startRpcResult(builder:flatbuffers.Builder) {
  builder.startObject(4);
}

static addIsSuccess(builder:flatbuffers.Builder, isSuccess:boolean) {
  builder.addFieldInt8(0, +isSuccess, +false);
}

static addErrorCode(builder:flatbuffers.Builder, errorCode:number) {
  builder.addFieldInt32(1, errorCode, 0);
}

static addErrorMsg(builder:flatbuffers.Builder, errorMsgOffset:flatbuffers.Offset) {
  builder.addFieldOffset(2, errorMsgOffset, 0);
}

static addData(builder:flatbuffers.Builder, dataOffset:flatbuffers.Offset) {
  builder.addFieldOffset(3, dataOffset, 0);
}

static createDataVector(builder:flatbuffers.Builder, data:number[]|Uint8Array):flatbuffers.Offset {
  builder.startVector(1, data.length, 1);
  for (let i = data.length - 1; i >= 0; i--) {
    builder.addInt8(data[i]!);
  }
  return builder.endVector();
}

static startDataVector(builder:flatbuffers.Builder, numElems:number) {
  builder.startVector(1, numElems, 1);
}

static endRpcResult(builder:flatbuffers.Builder):flatbuffers.Offset {
  const offset = builder.endObject();
  return offset;
}

static createRpcResult(builder:flatbuffers.Builder, isSuccess:boolean, errorCode:number, errorMsgOffset:flatbuffers.Offset, dataOffset:flatbuffers.Offset):flatbuffers.Offset {
  RpcResult.startRpcResult(builder);
  RpcResult.addIsSuccess(builder, isSuccess);
  RpcResult.addErrorCode(builder, errorCode);
  RpcResult.addErrorMsg(builder, errorMsgOffset);
  RpcResult.addData(builder, dataOffset);
  return RpcResult.endRpcResult(builder);
}
}