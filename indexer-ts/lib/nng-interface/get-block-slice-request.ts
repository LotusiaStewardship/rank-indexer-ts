// automatically generated by the FlatBuffers compiler, do not modify

/* eslint-disable @typescript-eslint/no-unused-vars, @typescript-eslint/no-explicit-any, @typescript-eslint/no-non-null-assertion */

import * as flatbuffers from 'flatbuffers';

export class GetBlockSliceRequest {
  bb: flatbuffers.ByteBuffer|null = null;
  bb_pos = 0;
  __init(i:number, bb:flatbuffers.ByteBuffer):GetBlockSliceRequest {
  this.bb_pos = i;
  this.bb = bb;
  return this;
}

static getRootAsGetBlockSliceRequest(bb:flatbuffers.ByteBuffer, obj?:GetBlockSliceRequest):GetBlockSliceRequest {
  return (obj || new GetBlockSliceRequest()).__init(bb.readInt32(bb.position()) + bb.position(), bb);
}

static getSizePrefixedRootAsGetBlockSliceRequest(bb:flatbuffers.ByteBuffer, obj?:GetBlockSliceRequest):GetBlockSliceRequest {
  bb.setPosition(bb.position() + flatbuffers.SIZE_PREFIX_LENGTH);
  return (obj || new GetBlockSliceRequest()).__init(bb.readInt32(bb.position()) + bb.position(), bb);
}

fileNum():number {
  const offset = this.bb!.__offset(this.bb_pos, 4);
  return offset ? this.bb!.readUint32(this.bb_pos + offset) : 0;
}

dataPos():number {
  const offset = this.bb!.__offset(this.bb_pos, 6);
  return offset ? this.bb!.readUint32(this.bb_pos + offset) : 0;
}

numBytes():number {
  const offset = this.bb!.__offset(this.bb_pos, 8);
  return offset ? this.bb!.readUint32(this.bb_pos + offset) : 0;
}

static startGetBlockSliceRequest(builder:flatbuffers.Builder) {
  builder.startObject(3);
}

static addFileNum(builder:flatbuffers.Builder, fileNum:number) {
  builder.addFieldInt32(0, fileNum, 0);
}

static addDataPos(builder:flatbuffers.Builder, dataPos:number) {
  builder.addFieldInt32(1, dataPos, 0);
}

static addNumBytes(builder:flatbuffers.Builder, numBytes:number) {
  builder.addFieldInt32(2, numBytes, 0);
}

static endGetBlockSliceRequest(builder:flatbuffers.Builder):flatbuffers.Offset {
  const offset = builder.endObject();
  return offset;
}

static createGetBlockSliceRequest(builder:flatbuffers.Builder, fileNum:number, dataPos:number, numBytes:number):flatbuffers.Offset {
  GetBlockSliceRequest.startGetBlockSliceRequest(builder);
  GetBlockSliceRequest.addFileNum(builder, fileNum);
  GetBlockSliceRequest.addDataPos(builder, dataPos);
  GetBlockSliceRequest.addNumBytes(builder, numBytes);
  return GetBlockSliceRequest.endGetBlockSliceRequest(builder);
}
}
